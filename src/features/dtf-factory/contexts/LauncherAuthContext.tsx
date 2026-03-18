import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@dtf/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { useSessionContext } from '@supabase/auth-helpers-react'; // Tentar usar helper padrão se existir, ou usar contexto local

// Tentar importar do contexto local do Launcher-web se possível, mas como não sei o export exato, 
// vou usar a sessão do supabase diretamente que deve estar sincronizada.

type ProTier = 'free' | 'pro-500' | 'pro-2000';

interface LauncherAuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    error: string | null;
    hasLicense: boolean;
    proTier: ProTier;
    isProExpired: boolean;
    tokenBalance: number;
    refreshBalance: () => Promise<void>;
    updateBalanceOptimistically: (amount: number) => void;
}

const LauncherAuthContext = createContext<LauncherAuthContextType>({
    user: null,
    session: null,
    loading: true,
    error: null,
    hasLicense: false,
    proTier: 'free',
    isProExpired: false,
    tokenBalance: 0,
    refreshBalance: async () => { },
    updateBalanceOptimistically: () => { },
});

export const useLauncherAuth = () => useContext(LauncherAuthContext);

export const LauncherAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasLicense, setHasLicense] = useState(true); // Default true for Web integration
    const [proTier, setProTier] = useState<ProTier>('pro-500'); // Default Pro for Web
    const [isProExpired, setIsProExpired] = useState(false);
    const [tokenBalance, setTokenBalance] = useState(0);

    // Monitorar sessão via Supabase Client diretamente
    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            
            if (session?.user) {
                fetchBalance(session.user.id);
            }
        };

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchBalance(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchBalance = async (userId: string) => {
        try {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('token_balance')
                .eq('uid', userId)
                .single();

            if (userData) {
                setTokenBalance(Number(userData.token_balance) || 0);
            }
        } catch (tokenErr) {
            console.error('Error fetching tokens:', tokenErr);
        }
    };

    const refreshBalance = async () => {
        if (user) {
            await fetchBalance(user.id);
        }
    };

    const updateBalanceOptimistically = (amount: number) => {
        setTokenBalance(prev => prev + amount);
    };

    const value = {
        user,
        session,
        loading,
        error: null,
        hasLicense,
        proTier,
        isProExpired,
        tokenBalance,
        refreshBalance,
        updateBalanceOptimistically
    };

    return <LauncherAuthContext.Provider value={value}>{children}</LauncherAuthContext.Provider>;
};
