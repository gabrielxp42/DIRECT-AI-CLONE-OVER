"use client";

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { setupTokenRefresh, clearTokenRefresh } from '@/utils/tokenRefresh';
import { getValidToken } from '@/utils/tokenGuard';

type Profile = {
  id: string;
  uid: string;
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
  pwa_version?: string | null;
  last_active_at?: string | null;
  is_multi_profile_enabled?: boolean;
  role_permissions?: Record<UserRole, Record<string, boolean>>;
  is_vetoriza_ai_gifted?: boolean;
  is_vetoriza_ai_gifted_viewed?: boolean;
  ai_credits?: number;
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
  chefe: {}, // Tem acesso total via lógica de bypass
  designer: { 
    view_dashboard: true, 
    view_pedidos: true, 
    view_kanban: true, 
    edit_kanban: true, 
    view_vetorizar: true,
    view_produtos: true 
  },
  operador: { 
    view_dashboard: true, 
    view_kanban: true, 
    edit_kanban: true, 
    view_insumos: true,
    view_logistica: true
  },
  atendente: { 
    view_dashboard: true, 
    view_pedidos: true, 
    view_clientes: true, 
    view_logistica: true,
    view_produtos: true
  }
};

export type UserRole = 'chefe' | 'designer' | 'operador' | 'atendente';

export type SubProfile = {
  id: string;
  parent_profile_id: string;
  name: string;
  role: UserRole;
  whatsapp_number: string | null;
  avatar_url: string | null;
  pin: string | null;
  is_active: boolean;
};

type SessionContextType = {
  session: Session | null;
  supabase: SupabaseClient;
  isLoading: boolean;
  isSyncing: boolean;
  organizationId: string | null;
  profile: Profile | null;
  activeSubProfile: SubProfile | null;
  switchSubProfile: (subProfile: SubProfile | null) => void;
  hasPermission: (permission: string) => boolean;
};

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [activeSubProfile, setActiveSubProfile] = useState<SubProfile | null>(null);
  const navigate = useNavigate();

  // Usar uma ref para evitar closures obsoletas em callbacks assíncronos
  const stateRef = useRef({ profile, session, organizationId, isSyncing });

  useEffect(() => {
    stateRef.current = { profile, session, organizationId, isSyncing };
  }, [profile, session, organizationId, isSyncing]);

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
      const url = `${SUPABASE_URL}/rest/v1/profiles_v2?uid=eq.${userId}&select=*`;
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

  // Perfil fetch com RETRY (fundamental para o trigger do Supabase no Google Login)
  const fetchProfileWithRetry = async (userId: string, token: string, retries = 3, delay = 1000): Promise<Profile | null> => {
    for (let i = 0; i < retries; i++) {
      console.log(`⏳ [SessionProvider] Fetching profile (Attempt ${i + 1}/${retries})...`);
      const p = await fetchProfileData(userId, token);
      if (p) return p;
      
      if (i < retries - 1) {
        console.log(`🤔 [SessionProvider] Profile not found yet, retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; // Exponential backoff
      }
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;
    
    // Capturar parâmetros de auth IMEDIATAMENTE antes que o Supabase os limpe
    const hasInitialAuthParams = window.location.hash.includes('access_token=') || 
                       window.location.hash.includes('type=recovery') ||
                       window.location.hash.includes('type=signup') ||
                       window.location.hash.includes('type=invite') ||
                       window.location.search.includes('token_hash=') ||
                       window.location.search.includes('type=recovery') ||
                       window.location.search.includes('type=signup') ||
                       window.location.search.includes('code=');

    if (hasInitialAuthParams) {
      console.log('🛡️ [SessionProvider] Auth params detected on mount, holding loading state');
    }

    const initializeFull = async () => {
      console.log('🔍 [SessionProvider] Initializing session...');
      try {
        const token = await getValidToken();

        if (token && mounted) {
          const getAuthKey = (storage: Storage) => {
            const projectRef = SUPABASE_URL.match(/https:\/\/(.*?)\.supabase\.co/)?.[1];
            const exactKey = projectRef ? `sb-${projectRef}-auth-token` : null;
            return Object.keys(storage).find(key => exactKey ? key === exactKey : key.includes('auth-token'));
          };
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
            const p = await fetchProfileWithRetry(fullSession.user.id, token);
            if (p && mounted) {
              setProfile(p);
              setOrganizationId(p.organization_id);
            }
            setupTokenRefresh();
          }
        }
      } catch (error) {
        console.error('❌ [SessionProvider] Initialization error:', error);
      } finally {
        if (mounted) {
          // SE existe um hash de auth capturado no mount, NÃO encerramos o loading aqui. 
          // Deixamos o onAuthStateChange cuidar disso após processar o token.
          if (!hasInitialAuthParams) {
            setIsLoading(false);
            console.log('🏁 [SessionProvider] Initialization complete (No hash detected)');
          } else {
            console.log('⏳ [SessionProvider] Auth hash detected on mount, waiting for event to finish loading...');
          }
        }
      }
    };

    const { data: { subscription: authSub } } = supabaseClient.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        console.log(`🔐 [SessionProvider] Event: ${event}`);

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setOrganizationId(null);
          setActiveSubProfile(null);
          localStorage.removeItem('direct_ai_active_sub_profile');
          clearTokenRefresh();
          setIsLoading(false);
        } else if (event === 'PASSWORD_RECOVERY') {
          console.log('🔑 [SessionProvider] Password recovery active');
          setIsLoading(false);
          navigate('/reset-password');
        } else if (currentSession) {
          setSession(prev => (prev?.access_token === currentSession.access_token ? prev : currentSession));
          
          const currentProfile = stateRef.current.profile;
          if (!currentProfile || currentProfile.id !== currentSession.user.id) {
            setIsSyncing(true);
            const p = await fetchProfileWithRetry(currentSession.user.id, currentSession.access_token);
            if (p && mounted) {
              setProfile(p);
              setOrganizationId(p.organization_id);
            }
            setIsSyncing(false);
          }

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setupTokenRefresh();
          }
          setIsLoading(false);
        } else {
          // Se não há sessão, só paramos o loading se NÃO tiver hash pendente no mount
          if (!hasInitialAuthParams) {
            console.log('🏁 [SessionProvider] No session and no initial hash, stopping loading');
            setIsLoading(false);
          } else {
            console.log('⏳ [SessionProvider] No session yet but initial hash existed, keep loading...');
          }
        }
      }
    );

    initializeFull();

    const channel = supabaseClient
      .channel('public:profiles_v2_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles_v2' },
        (payload) => {
          if (mounted && (stateRef.current.session?.user?.id === payload.new.uid || stateRef.current.session?.user?.id === payload.new.id)) {
            console.log('⚡ [SessionProvider] Profile update synced');
            setProfile(prev => prev ? { ...prev, ...payload.new } : (payload.new as Profile));
          }
        }
      ).subscribe();

    return () => {
      mounted = false;
      authSub.unsubscribe();
      supabaseClient.removeChannel(channel);
    };
  }, [navigate]); // Re-subscribe if user ID changes (login/logout)

  // Listener para atualização em tempo real (ex: pelo useRealtimeSync)
  useEffect(() => {
    const handleRefresh = async () => {
      if (session?.user?.id) {
        console.log('🔄 [SessionProvider] Refreshing profile due to external change...');
        const token = await getValidToken();
        if (token) {
          const p = await fetchProfileWithRetry(session.user.id, token);
          if (p) {
            setProfile(p);
          }
        }
      }
    };

    window.addEventListener('refresh-profile', handleRefresh);
    return () => window.removeEventListener('refresh-profile', handleRefresh);
  }, [session?.user?.id]);

  const switchSubProfile = (subProfile: SubProfile | null) => {
    setActiveSubProfile(subProfile);
    if (subProfile) {
      localStorage.setItem('direct_ai_active_sub_profile', JSON.stringify(subProfile));
    } else {
      localStorage.removeItem('direct_ai_active_sub_profile');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('direct_ai_active_sub_profile');
    if (saved) {
      try {
        setActiveSubProfile(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing saved sub profile', e);
      }
    }
  }, []);
  
  const hasPermission = (permission: string): boolean => {
    // 1. Se não houver perfil carregado ainda, negamos por segurança (exceto se estiver carregando)
    if (!profile) return false;

    // 2. Se for o chefe (perfil principal ou sub-perfil chefe), ou se multi-perfil estiver desativado, acesso total
    if (!profile.is_multi_profile_enabled || activeSubProfile?.role === 'chefe') return true;

    // 3. Se multi-perfil está ativo mas nenhum sub-perfil foi selecionado, só deixamos ver o Dashboard/Início
    // por segurança, forçando a seleção de perfil que acontece no Layout/ProfileSelector
    if (!activeSubProfile) return permission === 'view_dashboard';
    
    // 4. Verificar permissões personalizadas do banco
    const customPermissions = profile.role_permissions?.[activeSubProfile.role];
    if (customPermissions && typeof customPermissions === 'object') {
      if (permission in customPermissions) {
        return !!customPermissions[permission];
      }
    }

    // 5. Fallback para permissões padrão se não houver customização ou a chave não existir
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[activeSubProfile.role];
    return !!defaultPermissions?.[permission];
  };

  const memoizedValue = useMemo(() => ({
    session,
    supabase: supabaseClient,
    isLoading,
    isSyncing,
    organizationId,
    profile,
    activeSubProfile,
    switchSubProfile,
    hasPermission,
  }), [session, isLoading, isSyncing, organizationId, profile, activeSubProfile]);

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