"use client";

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { setupTokenRefresh, clearTokenRefresh } from '@/utils/tokenRefresh';
import { getValidToken } from '@/utils/tokenGuard';

type Profile = {
  id: string;
  organization_id: string | null;
  trial_start_date: string | null;
  subscription_tier?: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | null;
  daily_ai_count: number | null;
  completed_tours: string[] | null;
  is_admin?: boolean;
  subscription_gift_viewed?: boolean;
  is_gifted_plan?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  whatsapp_instance_id?: string | null;
  whatsapp_instance_token?: string | null;
  whatsapp_status?: string | null;
  whatsapp_api_url?: string | null;
  whatsapp_api_key?: string | null;
  is_whatsapp_plus_active?: boolean;
  is_whatsapp_plus_gifted?: boolean;
  is_whatsapp_plus_gifted_viewed?: boolean;
  company_name?: string | null;
  company_logo_url?: string | null;
  company_primary_color?: string | null;
  company_address_street?: string | null;
  company_address_number?: string | null;
  company_address_neighborhood?: string | null;
  company_address_city?: string | null;
  company_address_state?: string | null;
  company_address_zip?: string | null;
  company_business_hours?: string | null;
  next_billing_date?: string | null;
  partner_code?: string | null;
  is_affiliate?: boolean;
  affiliate_code?: string | null;
  commission_rate?: number | null;
  affiliate_pix_key: string | null;
  affiliate_pix_key_type: string | null;
  whatsapp_boss_notifications_enabled?: boolean;
  whatsapp_boss_group_id?: string | null;
  whatsapp_boss_alert_types?: string[];
  whatsapp_qr_cache?: string | null;
  gabi_templates?: any;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
  stripe_customer_id?: string | null;
};


type SessionContextType = {
  session: Session | null;
  supabase: SupabaseClient;
  isLoading: boolean;
  organizationId: string | null;
  profile: Profile | null;
};

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Usar uma ref para evitar closures obsoletas em callbacks assíncronos
  const stateRef = useRef({ profile, session });

  useEffect(() => {
    stateRef.current = { profile, session };
  }, [profile, session]);

  // Affiliate Tracking Component-level logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref') || params.get('code');

    if (code) {
      console.log('🎯 [SessionProvider] Affiliate code detected:', code);
      localStorage.setItem('direct_ai_affiliate_code', code.toUpperCase());
    }
  }, []);


  const fetchProfileData = async (userId: string, token: string) => {
    try {
      // Usar fetch direto como no restante do projeto para máxima estabilidade
      const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;
      const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        // Se for 406 ou similar, talvez o perfil não exista ainda, o que é OK
        if (response.status !== 406) {
          console.warn('[SessionProvider] Error fetching profile:', response.status);
        }
        return null;
      }

      const data = await response.json();
      return (data && data.length > 0) ? (data[0] as Profile) : null;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('[SessionProvider] Profile fetch aborted (safe to ignore)');
        return null;
      }
      console.error('[SessionProvider] Exception in fetchProfileData:', error);
      return null;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      console.log('🔍 [SessionProvider] Initializing session...');

      try {
        const token = await getValidToken();

        if (token) {
          console.log('✅ [SessionProvider] Token detected, fetching full session data...');

          const getAuthKey = (storage: Storage) => Object.keys(storage).find(key => key.includes('auth-token'));
          let authKey = getAuthKey(localStorage);
          let storage = localStorage;

          if (!authKey) {
            authKey = getAuthKey(sessionStorage);
            storage = sessionStorage;
          }

          const storedData = authKey ? storage.getItem(authKey) : null;
          const fullSession = storedData ? JSON.parse(storedData) : null;

          if (fullSession && fullSession.user) {
            setSession(fullSession);
            console.log('👤 [SessionProvider] Session restored for user:', fullSession.user.id);

            const p = await fetchProfileData(fullSession.user.id, token);
            if (p) {
              console.log('📄 [SessionProvider] Profile data loaded successfully');
              setProfile(p);
              setOrganizationId(p.organization_id);
            } else {
              console.warn('⚠️ [SessionProvider] Profile fetch returned no data');
            }

            supabaseClient.auth.setSession({
              access_token: token,
              refresh_token: fullSession.refresh_token
            }).catch(err => {
              console.error('❌ [SessionProvider] Error setting supabase session:', err);
            });

            setupTokenRefresh();
          } else {
            console.log('ℹ️ [SessionProvider] Stored auth token found but Session object is missing/invalid');
          }
        } else {
          console.log('ℹ️ [SessionProvider] No active session found via TokenGuard');
        }
      } catch (error) {
        console.error('❌ [SessionProvider] Fatal initialization error:', error);
      } finally {
        console.log('🏁 [SessionProvider] Initialization lifecycle complete');
        setIsLoading(false);
      }
    };

    // Configurar listener para mudanças futuras
    const { data: { subscription: authSub } } = supabaseClient.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log(`🔐 [SessionProvider] Auth state change event: ${event}`);

        if (event === 'SIGNED_OUT') {
          console.log('🚪 [SessionProvider] User signed out, clearing state');
          setSession(null);
          setProfile(null);
          setOrganizationId(null);
          clearTokenRefresh();
          setIsLoading(false); // Explicit stop after sign out
        } else if (currentSession) {
          console.log('🔑 [SessionProvider] Session active for user:', currentSession.user.id);

          setSession(prev => {
            if (prev?.access_token === currentSession.access_token) return prev;
            return currentSession;
          });

          const currentProfile = stateRef.current.profile;
          if (!currentProfile || currentProfile.id !== currentSession.user.id) {
            console.log('⏳ [SessionProvider] Profile missing or changed, fetching...');
            const p = await fetchProfileData(currentSession.user.id, currentSession.access_token);
            if (p) {
              setProfile(p);
              setOrganizationId(p.organization_id);
              console.log('✅ [SessionProvider] Profile sync complete');
            }
          }

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setupTokenRefresh();
          }

          // Note: setIsLoading(false) usually happens after initialize completes, 
          // but we ensure it here too for sign-in edge cases.
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          // If we have no session but these events fire, the loading might hang if we don't handle it
          setIsLoading(false);
        }
      }
    );

    // REALTIME: Listen for profile updates (e.g. Admin gifts a plan)
    const channel = supabaseClient
      .channel('public:profiles')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: session ? `id=eq.${session.user.id}` : undefined,
        },
        async (payload) => {
          console.log('⚡ [SessionProvider] Realtime profile update received:', payload);
          if (payload.new) {
            // Merge new data into existing profile state
            setProfile((prev) => prev ? { ...prev, ...payload.new } : (payload.new as Profile));

            // If it's a gift or major change, show success log
            if (payload.new.is_gifted_plan && !payload.old.is_gifted_plan) {
              console.log('🎁 Presente recebido em tempo real!');
            }
          }
        }
      )
      .subscribe();

    initialize();

    return () => {
      authSub.unsubscribe();
      supabaseClient.removeChannel(channel);
    };
  }, [session?.user?.id]); // Re-subscribe if user ID changes (login/logout)

  const memoizedValue = useMemo(() => ({
    session,
    supabase: supabaseClient,
    isLoading,
    organizationId,
    profile,
  }), [session, isLoading, organizationId, profile]);

  return (
    <SessionContext.Provider value={memoizedValue}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};