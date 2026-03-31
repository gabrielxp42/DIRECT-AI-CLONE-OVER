import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, 
    ShieldCheck, 
    ArrowRight, 
    Bot, 
    Wallet, 
    MessageSquare, 
    Truck, 
    Calculator,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionProvider';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  appId: string;
  requiredPlan: 'factory' | 'direct_ai' | 'full';
  trialTokensRemaining?: number;
  onConsumeTrial?: () => void;
}

export const UpgradeModal = ({ 
  isOpen, 
  onClose, 
  appName, 
  appId, 
  requiredPlan,
  trialTokensRemaining = 0,
  onConsumeTrial
}: UpgradeModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useSession();

  const handleUpgrade = async (planType: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          planType, 
          successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: window.location.href
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Falha ao gerar checkout Stripe:', err);
      // Fallback fallback error
    } finally {
      setIsLoading(false);
    }
  };

  const hasTrials = trialTokensRemaining > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99998] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-[#0e0e12] border border-white/10 rounded-3xl p-8 z-[99999] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] pointer-events-none" />

            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/25">
                <Zap className="w-8 h-8 text-white fill-white/20" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-6 leading-tight">
                {appName} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    Gestão no Piloto Automático
                </span>
              </h1>
              
              <div className="grid gap-4 mb-10 text-left">
                  {[
                      { 
                          icon: Wallet, 
                          text: "Gestão Financeira IA: Controle de lucro e caixa em tempo real.",
                          color: "text-emerald-400" 
                      },
                      { 
                          icon: MessageSquare, 
                          text: "Integração WhatsApp Oficial: Notificações automáticas de pedidos e cobranças.",
                          color: "text-blue-400" 
                      },
                      { 
                          icon: Truck, 
                          text: "Logística DTF 5.0: Emissão de etiquetas e cotação de frete instantânea.",
                          color: "text-purple-400" 
                      },
                      { 
                          icon: Calculator, 
                          text: "Calculadora de Metros: Orçamentos visuais precisos instantâneos.",
                          color: "text-orange-400" 
                      },
                      { 
                          icon: Bot, 
                          text: "Gabi Assistente 24/7: Inteligência que entende áudios e fotos de pedidos.",
                          color: "text-cyan-400" 
                      },
                  ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                          <feature.icon className={`w-6 h-6 ${feature.color}`} />
                          <span className="text-white/80 font-medium">{feature.text}</span>
                      </div>
                  ))}
              </div>
            </div>

            <div className="space-y-4 relative">
              {hasTrials && onConsumeTrial ? (
                <Button 
                  onClick={onConsumeTrial}
                  className="w-full h-14 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-lg font-semibold transition-all hover:scale-[1.02]"
                >
                  Gastar 1 Crédito e Testar Agora
                </Button>
              ) : null}

              <Button 
                onClick={() => handleUpgrade(requiredPlan)}
                disabled={isLoading}
                className="w-full h-14 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-lg font-bold shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Assinar e Liberar Acesso Definitivo
                  </>
                )}
              </Button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40 font-medium">
              <span>Pagamento seguro via</span>
              <span className="text-white/60">Stripe</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
