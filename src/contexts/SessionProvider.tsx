"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

type Profile = {
  organization_id: string | null;
};

type SessionContextType = {
  session: Session | null;
  supabase: SupabaseClient;
  isLoading: boolean;
  organizationId: string | null; // Adicionado organizationId
};

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      if (!supabaseClient) {
        console.error('Supabase client is undefined during fetchProfile.');
        return null;
      }
      
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
    };

    const getSession = async () => {
      try {
        if (!supabaseClient) {
          console.error('Supabase client is undefined during getSession.');
          setIsLoading(false);
          return;
        }
        
        const { data: { session: currentSession }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          const orgId = await fetchProfile(currentSession.user.id);
          setOrganizationId(orgId);
        } else {
          setOrganizationId(null);
        }
      } catch (error) {
        console.error('Error in getSession:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    if (!supabaseClient) return; // Evita a subscrição se o cliente for nulo

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setIsLoading(false);
        
        if (session?.user) {
          const orgId = await fetchProfile(session.user.id);
          setOrganizationId(orgId);
        } else {
          setOrganizationId(null);
        }
        
        // Handle session refresh
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        }
        
        // Handle sign out
        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setOrganizationId(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    supabase: supabaseClient,
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
    // Se o provedor estiver renderizando, isso não deve acontecer.
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};