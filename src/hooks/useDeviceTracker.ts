import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionProvider';

export const useDeviceTracker = () => {
    const { session, profile } = useSession();

    useEffect(() => {
        // Só roda se o usuário estiver logado
        if (!session?.user?.id || !profile?.id) return;

        const trackDevice = async () => {
            try {
                const appVersion = import.meta.env.VITE_APP_VERSION || '0.0.0';

                // Verifica se a versão mudou muito ou se já faz tempo desde o último update
                // Para não martelar o banco, vamos atualizar apenas se:
                // 1. A versão for diferente da atual no banco.
                // 2. Ou se faz mais de 30 minutos desde o último "last_active_at". Mas como não temos o anterior em memória de forma fácil sempre,
                // uma chamada de RPC simples ou Update direto no mount do app já é o suficiente para ter uma ideia de usuários ativos.

                // Vamos checar diretamente o localStorage para fazer throttle dessa chamada de heartbeat,
                // garantindo que não bata no supabase em TODO refresh/navegação
                const lastTracked = localStorage.getItem('last_device_track');
                const now = Date.now();
                const THROTTLE_MS = 1000 * 60 * 15; // 15 minutos

                if (!lastTracked || (now - parseInt(lastTracked)) > THROTTLE_MS || profile.pwa_version !== appVersion) {

                    await supabase
                        .from('profiles')
                        .update({
                            pwa_version: appVersion,
                            last_active_at: new Date().toISOString()
                        })
                        .eq('id', session.user.id);

                    localStorage.setItem('last_device_track', now.toString());
                }

            } catch (err) {
                console.error('Falha ao rastrear dispositivo/versão:', err);
            }
        };

        trackDevice();
    }, [session?.user?.id, profile?.id]);
};

export const DeviceTracker = () => {
    useDeviceTracker();
    return null;
};
