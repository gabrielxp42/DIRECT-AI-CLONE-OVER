import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Home, Loader2, Sparkles, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionProvider';

export default function SuccessCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchSession } = useSession();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Apenas aguarda 3 segundos para ler o banco atualizado pelo Webhook 
    // ou faz um fetchSession manual para limpar cache local
    const verifyPurchase = async () => {
      try {
        if (fetchSession) {
          await fetchSession();
        }
      } catch (e) {
        console.error('Error refreshing session:', e);
      } finally {
        setTimeout(() => {
          setIsVerifying(false);
          // Efeito sonoro de sucesso mágico
          const audio = new Audio('/click.mp3');
          audio.play().catch(() => {});
        }, 2000);
      }
    };

    verifyPurchase();
  }, [fetchSession]);

  return (
    <div className="min-h-screen bg-[#0e0e12] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos Cinematográficos */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.15),transparent_70%)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Partículas ou enfeites visuais */}
      {!isVerifying && (
        <motion.div 
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="absolute -top-20 -right-20 text-emerald-500/20 rotate-12"
        >
          <PartyPopper size={300} />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-3xl shadow-2xl relative z-10 text-center"
      >
        {isVerifying ? (
          <div className="flex flex-col items-center py-10">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
              <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="text-emerald-500 w-8 h-8 animate-pulse" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Preparando sua Conta...</h1>
            <p className="text-white/50 text-sm font-medium">Validando pagamento e destravando recursos intergaláticos.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.6 }}
              className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 border border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.3)]"
            >
              <CheckCircle2 size={48} />
            </motion.div>
            
            <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Upgrade Concluído!</h1>
            <p className="text-white/60 text-lg leading-relaxed mb-8">
              Sua conta foi turbinada com sucesso. Os novos módulos já estão liberados e prontos para decolar no seu painel.
            </p>

            <Button 
              onClick={() => navigate('/')}
              className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-lg rounded-xl shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              <Home size={20} />
              Acessar Launcher
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
