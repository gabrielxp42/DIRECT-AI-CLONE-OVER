"use client";

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { setupTokenRefresh, clearTokenRefresh } from '@/utils/tokenRefresh';

type Profile = {
  organization_id: string | null;
};

type SessionContextType = {
  session: Session | null;
  supabase: SupabaseClient;
  isLoading: boolean;
  organizationId: string | null; // Adicionado organizationId
};

// Inicializa o contexto com o cliente Supabase síncrono
const initialContextValue: SessionContextType = {
  session: null,
  supabase: supabaseClient, // O cliente é síncrono e deve estar aqui
  isLoading: true,
  organizationId: null,
};

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    // Validação do cliente Supabase
    if (!supabaseClient || typeof supabaseClient.from !== 'function') {
      console.error('Supabase client is not properly initialized.');
      setIsLoading(false);
      return;
    }

    const fetchProfile = async (userId: string) => {
      if (!supabaseClient || typeof supabaseClient.from !== 'function') {
        console.error('Supabase client is undefined or invalid during fetchProfile.');
        return null;
      }

      try {
        // Alterado de .single() para .limit(1) para ser mais robusto contra 406
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('organization_id')
          .eq('id', userId)
          .limit(1);

        if (error) {
          console.error('Error fetching profile:', error);
          return null;
        }

        // Pega o primeiro item do array, se existir
        return data?.[0]?.organization_id || null;
      } catch (error) {
        console.error('Exception in fetchProfile:', error);
        return null;
      }
    };


    const getSession = async () => {
      console.log('🔍 [SessionProvider] getSession() iniciado...');

      try {
        if (!supabaseClient || typeof supabaseClient.auth?.getSession !== 'function') {
          console.error('❌ [SessionProvider] Supabase client is undefined or invalid during getSession.');
          setIsLoading(false);
          return;
        }

        // Timeout de 10 segundos para evitar loading infinito
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timeout')), 10000)
        );

        console.log('🔍 [SessionProvider] Chamando supabaseClient.auth.getSession()...');

        // Buscar sessão do storage local com timeout
        const sessionPromise = supabaseClient.auth.getSession();
        const { data: { session: currentSession }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        console.log('✅ [SessionProvider] getSession() retornou:', {
          hasSession: !!currentSession,
          hasError: !!error,
          userId: currentSession?.user?.id
        });

        if (error) {
          console.error('❌ [SessionProvider] Error getting session:', error);
          // Se houver erro, limpar sessão
          await supabaseClient.auth.signOut();
          setSession(null);
          setOrganizationId(null);
          setIsLoading(false);
        } else {
          setSession(currentSession);

          if (currentSession?.user) {
            console.log('🔍 [SessionProvider] Buscando perfil do usuário...');
            const orgId = await fetchProfile(currentSession.user.id);
            setOrganizationId(orgId);
            console.log('✅ [SessionProvider] Perfil carregado:', orgId);
          } else {
            setOrganizationId(null);
            console.log('ℹ️ [SessionProvider] Sem sessão ativa');
          }
          setIsLoading(false);
          console.log('✅ [SessionProvider] isLoading = false');
        }
      } catch (error: any) {
        console.error('❌ [SessionProvider] Exception in getSession:', error);
        setSession(null);
        setOrganizationId(null);
        setIsLoading(false);
        console.log('✅ [SessionProvider] isLoading = false (após erro)');
      }
    };

    // IMPORTANTE: Configurar o listener ANTES de chamar getSession
    // Isso garante que capturamos a restauração da sessão após reload
    if (!supabaseClient || typeof supabaseClient.auth?.onAuthStateChange !== 'function') {
      console.error('Cannot subscribe to auth state changes: Supabase client is invalid.');
      // Mesmo assim, tentar getSession
      getSession();
      return;
    }

    let subscription: { unsubscribe: () => void } | null = null;
    let isRefreshing = false; // Flag para detectar refresh em andamento

    try {
      // Configurar o listener PRIMEIRO para capturar a restauração da sessão
      const { data: { subscription: authSubscription } } = supabaseClient.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔐 [SessionProvider] Auth state changed:', event, session?.user?.email || 'no user');

          // IGNORAR SIGNED_OUT se estiver no meio de um refresh
          if (event === 'SIGNED_OUT' && isRefreshing) {
            console.log('⚠️ [SessionProvider] Ignorando SIGNED_OUT durante refresh de token');
            return;
          }

          // Marcar que refresh está em andamento
          if (event === 'TOKEN_REFRESHED') {
            isRefreshing = true;
            console.log('✅ [SessionProvider] Token refreshed, rescheduling next refresh');
            setupTokenRefresh(); // Reagendar próximo refresh

            // Resetar flag após 2 segundos (tempo suficiente para estabilizar)
            setTimeout(() => {
              isRefreshing = false;
            }, 2000);
          }

          // Atualizar sessão
          setSession(session);
          setIsLoading(false);

          if (session?.user) {
            const orgId = await fetchProfile(session.user.id);
            setOrganizationId(orgId);
          } else {
            setOrganizationId(null);
          }

          // Log do estado atual
          console.log('[SessionProvider] State:', { event, hasSession: !!session, organizationId });

          // Handle initial session load (após reload)
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            console.log('✅ [SessionProvider] Session restored/loaded:', session ? 'User logged in' : 'No session');
          }

          // Handle sign in - limpar cache quando novo login
          if (event === 'SIGNED_IN' && !isRefreshing) {
            console.log('✅ [SessionProvider] User signed in, setting up token refresh');
            setupTokenRefresh(); // Configurar refresh automático
          }

          // Handle sign out
          if (event === 'SIGNED_OUT' && !isRefreshing) {
            console.log('👋 [SessionProvider] User signed out');
            setOrganizationId(null);
            clearTokenRefresh(); // Limpar refresh ao fazer logout
          }
        }
      );
      subscription = authSubscription;

      // AGORA chamar getSession - o listener já está configurado
      // Isso garante que se a sessão já estiver no storage, será capturada
      getSession();
    } catch (error) {
      console.error('❌ [SessionProvider] Error setting up auth state change listener:', error);
      // Se falhar, ainda tentar getSession
      getSession();
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Garantir que sempre retornamos um supabase válido
  // IMPORTANTE: Só retornar supabase se estiver totalmente inicializado
  const validSupabase = supabaseClient &&
    typeof supabaseClient === 'object' &&
    typeof supabaseClient.from === 'function'
    ? supabaseClient
    : supabaseClient; // Se não for válido, ainda retorna (pode ser o mock, mas os hooks devem verificar)

  // Log de debug para rastrear o estado
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[SessionProvider] State:', {
      hasSession: !!session,
      sessionUser: session?.user?.email,
      isLoading,
      hasValidSupabase: validSupabase && typeof validSupabase.from === 'function',
    });
  }

  const value = {
    session,
    supabase: validSupabase,
    isLoading,
    organizationId,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === null) {
    // Esta linha é a que lança o erro se chamada fora do provedor.
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};