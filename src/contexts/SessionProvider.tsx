"use client";

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { setupTokenRefresh, clearTokenRefresh } from '@/utils/tokenRefresh';

type Profile = {
  organization_id: string | null;
  trial_start_date: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | null;
  daily_ai_count: number | null;
  completed_tours: string[] | null;
};

type SessionContextType = {
  session: Session | null;
  supabase: SupabaseClient;
  isLoading: boolean;
  organizationId: string | null;
  profile: Profile | null; // Added profile to context
};

// Inicializa o contexto com o cliente Supabase síncrono
const initialContextValue: SessionContextType = {
  session: null,
  supabase: supabaseClient,
  isLoading: true,
  organizationId: null,
  profile: null,
};

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null); // State for full profile
  // Derivations can stay or be redundant, but keeping organizationId for compat if needed,
  // though accessing profile.organization_id is better.
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
        return null;
      }

      try {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .limit(1);

        if (error) {
          console.error('Error fetching profile:', error);
          return null;
        }

        const userProfile = data?.[0] || null;
        // Cast to Profile type safely
        return userProfile as Profile;
      } catch (error) {
        console.error('Exception in fetchProfile:', error);
        return null;
      }
    };


    const getSession = async (retryCount = 0) => {
      console.log(`🔍 [SessionProvider] getSession() iniciado (tentativa ${retryCount + 1})...`);

      try {
        if (!supabaseClient || typeof supabaseClient.auth?.getSession !== 'function') {
          console.error('❌ [SessionProvider] Supabase client is undefined or invalid during getSession.');
          setIsLoading(false);
          return;
        }

        // Timeout reduzido para 2 segundos. Se o Supabase não responder rápido, assumimos o controle.
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timeout')), 2000)
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

        // ... Lógica de sucesso normal ...
        if (error) {
          console.error('❌ [SessionProvider] Error getting session:', error);
          // Se houver erro real do Supabase (não timeout), limpar sessão
          await supabaseClient.auth.signOut();
          setSession(null);
          setOrganizationId(null);
          setIsLoading(false);
        } else {
          setSession(currentSession);

          if (currentSession?.user) {
            console.log('🔍 [SessionProvider] Buscando perfil do usuário...');
            const fullProfile = await fetchProfile(currentSession.user.id);
            setProfile(fullProfile);
            setOrganizationId(fullProfile?.organization_id || null);
            console.log('✅ [SessionProvider] Perfil carregado:', fullProfile?.organization_id);
          } else {
            setProfile(null);
            setOrganizationId(null);
            console.log('ℹ️ [SessionProvider] Sem sessão ativa');
          }
          setIsLoading(false);
          console.log('✅ [SessionProvider] isLoading = false');
        }
      } catch (error: any) {
        // SE DER TIMEOUT, TENTAMOS RECUPERAR MANUALMENTE DO STORAGE
        if (error.message === 'Session fetch timeout') {
          console.warn('⚠️ [SessionProvider] Timeout do Supabase Client! Tentando recuperação manual do LocalStorage...');

          try {
            // Tenta ler o token direto do LocalStorage (chave padrão do Supabase para este projeto)
            const PROJECT_ID = 'zdbjzrpgliqicwvncfpc';
            const storedSessionStr = localStorage.getItem(`sb-${PROJECT_ID}-auth-token`);

            if (storedSessionStr) {
              const storedSession = JSON.parse(storedSessionStr);
              // Verifica se parece uma sessão válida
              if (storedSession && storedSession.access_token && storedSession.user) {
                console.log('✅ [SessionProvider] Sessão recuperada MANUALMENTE do LocalStorage! (Bypassing Supabase Client)');

                setSession(storedSession);

                // Tenta buscar perfil (sem bloquear se falhar)
                if (storedSession.user) {
                  fetchProfile(storedSession.user.id)
                    .then(fullProfile => {
                      setProfile(fullProfile);
                      setOrganizationId(fullProfile?.organization_id || null);
                    })
                    .catch(err => console.error('Erro ao buscar perfil no fallback:', err));
                }

                setIsLoading(false);

                // Importante: Iniciar o refresh manual para validar este token em background
                setupTokenRefresh();
                return; // Sucesso! Não precisa tentar de novo.
              }
            }
          } catch (storageError) {
            console.error('❌ [SessionProvider] Falha na recuperação manual:', storageError);
          }

          // Se a recuperação manual falhar, aí sim tentamos o retry padrão ou desistimos
          if (retryCount < 2) {
            console.log(`⚠️ [SessionProvider] Recuperação falhou. Tentando getSession novamente (${retryCount + 1}/2)...`);
            setTimeout(() => getSession(retryCount + 1), 1000);
            return;
          }
        }

        console.error('❌ [SessionProvider] Exception in getSession:', error);
        setSession(null);
        setOrganizationId(null);
        setIsLoading(false);
        console.log('✅ [SessionProvider] isLoading = false (após erro persistente)');
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
            console.log('✅ [SessionProvider] Token refreshed manually');
            setupTokenRefresh(); // Reagendar próximo refresh

            // Resetar flag após 2 segundos (tempo suficiente para estabilizar)
            setTimeout(() => {
              isRefreshing = false;
            }, 2000);
          }

          // Atualizar sessão e perfil
          if (session) {
            setSession(session);
            // Fetch additional profile data
            const fullProfile = await fetchProfile(session.user.id);
            setProfile(fullProfile);
            setOrganizationId(fullProfile?.organization_id || null);
          } else {
            setSession(null);
            setProfile(null);
            setOrganizationId(null);
          }

          setIsLoading(false); // Always set loading to false AFTER fetching profile


          // Log do estado atual
          console.log('[SessionProvider] State:', { event, hasSession: !!session, organizationId });

          // Handle initial session load (após reload)
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            console.log('✅ [SessionProvider] Session restored/loaded:', session ? 'User logged in' : 'No session');
          }

          // Handle sign in - limpar cache quando novo login
          if (event === 'SIGNED_IN' && !isRefreshing) {
            console.log('✅ [SessionProvider] User signed in, setting up manual refresh');
            setupTokenRefresh();
          }

          // Handle sign out
          if (event === 'SIGNED_OUT' && !isRefreshing) {
            console.log('👋 [SessionProvider] User signed out');
            setOrganizationId(null);
            setProfile(null); // Clear profile on sign out
            clearTokenRefresh();
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
    profile, // Added profile to context value
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