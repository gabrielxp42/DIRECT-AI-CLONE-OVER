import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Search, 
  CloudRain, 
  Zap,
  CheckCircle2,
  Image as ImageIcon,
  MousePointer2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const MelhoradorShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'upscale' | 'remaster' | 'cloud'>('upscale');
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const tabTimer = setInterval(() => {
      setActiveTab(prev => {
        if (prev === 'upscale') return 'remaster';
        if (prev === 'remaster') return 'cloud';
        return 'upscale';
      });
    }, 7000);
    return () => clearInterval(tabTimer);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'upscale':
        return (
          <div className="flex flex-col h-full bg-[#0a0a0f]">
            <div className="p-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-rose-400" />
                <span className="text-[9px] font-black uppercase text-white/80 tracking-wider">Remasterização AI</span>
              </div>
              <div className="px-2 py-0.5 bg-rose-500/20 rounded-full border border-rose-500/40">
                <span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter">HD Ativo</span>
              </div>
            </div>

            <div className="flex-1 relative bg-zinc-900/50 p-6 flex flex-col items-center justify-center space-y-4">
              <div className="relative w-48 aspect-square bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
                 <img 
                    src="/BAIXA-QUALIDADE-BRASIL.png" 
                    className={cn("w-full h-full object-contain p-6 transition-all duration-[2000ms]", progress > 50 ? "scale-105 saturate-150 brightness-110 blur-none" : "scale-100 grayscale brightness-50 blur-sm")}
                    alt="Logo"
                 />
                 
                 {/* Magnifying Glass following scan */}
                 <motion.div 
                    animate={{ 
                       left: ['10%', '90%', '10%'],
                       top: ['10%', '10%','90%', '90%', '10%']
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute w-12 h-12 bg-white/10 border border-white/20 rounded-full backdrop-blur-sm z-30 flex items-center justify-center shadow-lg"
                 >
                    <Search className="w-4 h-4 text-rose-400" />
                 </motion.div>

                 {/* Scan Bar */}
                 <motion.div 
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-x-0 h-0.5 bg-rose-400/50 z-20 shadow-[0_0_15px_rgba(251,113,133,0.5)]"
                 />

                 {/* Sparkle particles during upscale */}
                 {progress > 40 && progress < 60 && (
                    <motion.div 
                      key="sparkle"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [1.2, 1], opacity: [0, 1, 0] }}
                      className="absolute inset-0 flex items-center justify-center z-40 bg-rose-500/10"
                    >
                       <Zap className="w-12 h-12 text-rose-400 fill-rose-500/20" />
                    </motion.div>
                 )}
              </div>

              <div className="w-full px-4 space-y-2">
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                       animate={{ width: `${progress}%` }}
                       className="h-full bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.5)]"
                    />
                 </div>
                 <div className="flex justify-between items-center px-1">
                    <span className="text-[7px] text-white/30 font-black tracking-widest uppercase">Processando...</span>
                    <span className="text-[7px] text-rose-400 font-black">{progress}%</span>
                 </div>
              </div>
            </div>
          </div>
        );

      case 'remaster':
        return (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudRain className="w-3 h-3 text-rose-400" />
                <span className="text-[9px] font-black uppercase text-white/80 tracking-wider">Otimização de Textura</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                <div className="flex gap-2 w-full">
                   <div className="flex-1 aspect-video bg-white/5 rounded-xl border border-white/10 flex flex-col items-center justify-center gap-2 overflow-hidden relative">
                      <ImageIcon className="w-6 h-6 text-white/10" />
                      <span className="text-[7px] font-black text-white/20 uppercase">Original</span>
                      <div className="absolute inset-0 bg-red-900/5 backdrop-blur-[1px]" />
                   </div>
                   <div className="flex-1 aspect-video bg-white/5 rounded-xl border border-rose-500/30 flex flex-col items-center justify-center gap-2 overflow-hidden">
                      <Sparkles className="w-6 h-6 text-rose-400" />
                      <span className="text-[7px] font-black text-rose-400 uppercase">Remasterizado</span>
                      <motion.div 
                         animate={{ opacity: [0.1, 0.3, 0.1] }}
                         transition={{ duration: 2, repeat: Infinity }}
                         className="absolute inset-0 bg-rose-500/10"
                      />
                   </div>
                </div>

                <div className="w-full space-y-3">
                   {[
                     "Remoção de Ruído (Denoise)",
                     "Correção de Pixels Mortos",
                     "Equilíbrio de Cores AI"
                   ].map((item, i) => (
                     <motion.div 
                       key={i}
                       initial={{ x: -10, opacity: 0 }}
                       animate={{ x: 0, opacity: 1 }}
                       transition={{ delay: i * 0.2 }}
                       className="flex items-center gap-2"
                     >
                        <CheckCircle2 className="w-3 h-3 text-rose-500" />
                        <span className="text-[8px] font-bold text-white/60 tracking-wider uppercase">{item}</span>
                     </motion.div>
                   ))}
                </div>
            </div>
          </div>
        );

      case 'cloud':
        return (
          <div className="flex flex-col h-full bg-[#0a0a0f] p-8 space-y-6">
             <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
                <div className="relative group">
                   <div className="absolute -inset-4 bg-rose-600/20 rounded-full blur-2xl group-hover:bg-rose-500/30 transition-all" />
                   <div className="relative w-20 h-20 bg-zinc-900 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
                      <Zap className="w-10 h-10 text-rose-400 fill-rose-500/20" />
                      
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-1 border border-rose-500/20 border-dashed rounded-3xl"
                      />
                   </div>
                </div>

                <div className="space-y-2">
                   <h4 className="text-sm font-black text-white tracking-widest uppercase">MELHORADOR CLOUD PRO</h4>
                   <p className="text-[9px] text-white/40 leading-relaxed max-w-[200px] mx-auto text-center font-medium">Use todo o poder de nossas GPUs na nuvem para transformar suas fotos em artes de cinema.</p>
                </div>
             </div>

             <button className="w-full py-5 bg-rose-600 rounded-2xl text-[11px] font-black text-black uppercase tracking-widest shadow-xl shadow-rose-900/40 active:scale-[0.98] transition-transform">
                Liberar Acesso Cloud
             </button>
          </div>
        );
    }
  };

  return (
    <div className="relative h-full flex flex-col">
       <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
       </div>

       {/* Tab Navigation */}
       <div className="p-4 bg-black/40 border-t border-white/5 flex gap-2">
          {['upscale', 'remaster', 'cloud'].map((tab) => (
             <div 
               key={tab} 
               className={cn(
                 "h-1 flex-1 rounded-full transition-all duration-500",
                 activeTab === tab ? "bg-rose-500" : "bg-white/10"
               )} 
             />
          ))}
       </div>
    </div>
  );
};
