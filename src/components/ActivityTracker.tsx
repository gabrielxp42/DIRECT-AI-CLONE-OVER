import { useEffect, useRef } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { getValidToken } from '@/utils/tokenGuard';

export function ActivityTracker() {
    const { profile, session } = useSession();
    const location = useLocation();
    const lastPathRef = useRef<string | null>(null);

    useEffect(() => {
        if (!profile?.id || !session?.user?.id) return;

        // 1. Supabase Presence (Online Status)
        const channel = supabase.channel('global-presence');

        channel
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: profile.id,
                        email: session.user.email,
                        company_name: profile.company_name,
                        current_path: location.pathname,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, session?.user?.id, location.pathname]);

    useEffect(() => {
        if (!profile?.id && profile?.is_admin) return; // maybe don't track admin

        // 2. Page View Tracking (to give admin better visibility)
        const trackPageView = async () => {
            if (lastPathRef.current === location.pathname) return;
            lastPathRef.current = location.pathname;

            try {
                const token = await getValidToken();
                if (!token) return;
                const url = `${SUPABASE_URL}/rest/v1/system_logs?apikey=${SUPABASE_ANON_KEY}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify([{
                        category: 'page_view',
                        message: `O cliente acessou a página: ${location.pathname}`,
                        user_id: profile?.id,
                        resolved: true
                    }])
                });
                if (!res.ok) {
                    console.warn('Failed to log page view (REST):', res.status, await res.text());
                }
            } catch (err) {
                console.error('Failed to log page view:', err);
            }
        };

        if (profile?.id && !profile?.is_admin) {
            // Just delay it slightly to avoid tracking immediate redirects
            const timer = setTimeout(trackPageView, 2000);
            return () => clearTimeout(timer);
        }
    }, [profile?.id, location.pathname]);

    return null;
}
