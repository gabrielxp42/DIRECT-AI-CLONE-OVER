import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { hapticTap } from '@/utils/haptic';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Detectar iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(iOS);

        // Detectar se já está instalado
        const standalone = window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(standalone);

        // Listener para o evento de instalação (Android/Desktop)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            const promptEvent = e as BeforeInstallPromptEvent;
            setDeferredPrompt(promptEvent);

            // Mostrar prompt após 10 segundos (não ser muito agressivo)
            setTimeout(() => {
                setShowPrompt(true);
            }, 10000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Mostrar prompt iOS após 15 segundos se não estiver instalado
        if (iOS && !standalone) {
            setTimeout(() => {
                setShowPrompt(true);
            }, 15000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        hapticTap();

        if (deferredPrompt) {
            // Android/Desktop
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('PWA instalado com sucesso');
            }

            setDeferredPrompt(null);
            setShowPrompt(false);
        }
    };

    const handleDismiss = () => {
        hapticTap();
        setShowPrompt(false);

        // Não mostrar novamente nesta sessão
        sessionStorage.setItem('install-prompt-dismissed', 'true');
    };

    // Não mostrar se já estiver instalado ou se foi dispensado
    if (isStandalone || !showPrompt || sessionStorage.getItem('install-prompt-dismissed')) {
        return null;
    }

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
            <div className="bg-gradient-to-r from-primary/90 to-primary rounded-lg shadow-2xl p-4 backdrop-blur-sm border border-primary/20">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <Download className="h-5 w-5 text-primary-foreground" />
                            <h3 className="font-semibold text-primary-foreground">
                                Instalar DIRECT AI
                            </h3>
                        </div>

                        {isIOS ? (
                            <p className="text-sm text-primary-foreground/90">
                                Toque em <span className="font-bold">Compartilhar</span> e depois em{' '}
                                <span className="font-bold">"Adicionar à Tela Inicial"</span> para instalar o app.
                            </p>
                        ) : (
                            <p className="text-sm text-primary-foreground/90 mb-3">
                                Instale o app para acesso rápido e experiência completa, mesmo offline!
                            </p>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                        onClick={handleDismiss}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {!isIOS && deferredPrompt && (
                    <Button
                        onClick={handleInstallClick}
                        className="w-full mt-3 bg-background text-foreground hover:bg-background/90"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Instalar Agora
                    </Button>
                )}
            </div>
        </div>
    );
}
