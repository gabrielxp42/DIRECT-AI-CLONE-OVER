import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

export function PWAManager() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered:', r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            toast.info('Nova versão disponível!', {
                description: 'Atualizando o aplicativo...',
                icon: <RefreshCw className="h-4 w-4 animate-spin" />,
                duration: 5000,
            });
            updateServiceWorker(true);
        }
    }, [needRefresh, updateServiceWorker]);

    // Check for updates periodically and on focus
    useEffect(() => {
        const updateSW = async () => {
            if ('serviceWorker' in navigator) {
                const r = await navigator.serviceWorker.getRegistration();
                if (r) {
                    await r.update();
                    console.log('Checked for SW update');
                }
            }
        };

        const interval = setInterval(updateSW, 60 * 60 * 1000); // Check every hour

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateSW();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return null;
}
