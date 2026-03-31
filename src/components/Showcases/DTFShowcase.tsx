import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Settings, 
  Layers, 
  Sparkles,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const DTFShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'halftone' | 'white' | 'anti'>('halftone');
  const [showResult, setShowResult] = React.useState(false);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setShowResult(prev => !prev);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const tabTimer = setInterval(() => {
      setActiveTab(prev => {
        if (prev === 'halftone') return 'white';
        if (prev === 'white') return 'anti';
        return 'halftone';
      });
    }, 6000);
    return () => clearInterval(tabTimer);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'halftone':
        return (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-black uppercase text-white/60 tracking-wider">Simulador de Halftone</span>
              </div>
              <div className="px-2 py-0.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                <span className="text-[8px] font-black text-emerald-400">ATIVO</span>
              </div>
            </div>

            <div className="flex-1 relative bg-zinc-900 overflow-hidden flex items-center justify-center p-6">
              {/* Halftone Simulation */}
              <div className="relative w-40 h-40 bg-zinc-800 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                 <img 
                   src="/BAIXA-QUALIDADE-BRASIL.png" 
                   className="w-full h-full object-contain opacity-20"
                   alt="Logo"
                 />
                 
                 <AnimatePresence mode="wait">
                   <motion.div
                     key={showResult ? 'halftoned' : 'original'}
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 flex items-center justify-center"
                   >
                     {showResult ? (
                        <div className="w-full h-full bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1.5px)] bg-[length:4px_4px] opacity-80" />
                     ) : (
                        <div className="w-full h-full bg-emerald-500/40" />
                     )}
                   </motion.div>
                 </AnimatePresence>

                 {/* Scanning Line */}
                 <motion.div 
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-x-0 h-0.5 bg-emerald-400/50 z-10 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                 />
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-1">
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                      animate={{ width: showResult ? '100%' : '0%' }}
                      className="h-full bg-emerald-500" 
                   />
                </div>
                <span className="text-[8px] text-white/40 uppercase font-black text-center">Calculando Retícula de Pontos...</span>
              </div>
            </div>
          </div>
        );

      case 'white':
        return (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-black uppercase text-white/60 tracking-wider">Mapeamento Tinta Branca</span>
              </div>
            </div>

            <div className="flex-1 relative bg-zinc-900 flex items-center justify-center p-4">
               <div className="flex flex-col gap-4 w-full px-4">
                  {[
                    { label: 'Layer CMYK', color: 'bg-gradient-to-r from-cyan-400 to-pink-400', active: true },
                    { label: 'Layer White Ink', color: 'bg-white', active: showResult },
                    { label: 'Layer Varnish', color: 'bg-yellow-200/50', active: false }
                  ].map((layer, i) => (
                    <motion.div 
                      key={i}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: layer.active ? 1 : 0.2 }}
                      className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                         <div className={cn("w-4 h-4 rounded-md shadow-inner", layer.color)} />
                         <span className="text-[9px] font-bold text-white/70 tracking-widest">{layer.label}</span>
                      </div>
                      {layer.active && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </motion.div>
                  ))}
               </div>
            </div>
          </div>
        );

      case 'anti':
        return (
          <div className="flex flex-col h-full bg-[#0a0a0f]">
            <div className="p-6 text-center">
               <div className="inline-flex p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 mb-3">
                  <Zap className="w-5 h-5 text-emerald-400 animate-pulse" />
               </div>
               <h4 className="text-xs font-black text-white uppercase tracking-tighter">Anti-Transparency Pro</h4>
            </div>

            <div className="flex-1 px-6 flex flex-col justify-center gap-4">
                <div className="relative aspect-square bg-zinc-900 rounded-3xl border border-white/5 overflow-hidden flex items-center justify-center shadow-inner">
                   <AnimatePresence mode="wait">
                      <motion.div
                        key={showResult ? 'clean' : 'raw'}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.1, opacity: 0 }}
                        className="relative w-3/4 h-3/4 flex items-center justify-center"
                      >
                         <img 
                           src="/BAIXA-QUALIDADE-BRASIL.png" 
                           className={cn("w-full h-full object-contain transition-all duration-700", showResult ? "brightness-100" : "brightness-50 grayscale")}
                           alt="Preview"
                         />
                         
                         {!showResult && (
                            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                               <Sparkles className="w-6 h-6 text-emerald-400/40" />
                            </div>
                         )}

                         {showResult && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="absolute inset-0 border-2 border-emerald-400 rounded-2xl"
                            />
                         )}
                      </motion.div>
                   </AnimatePresence>
                </div>

                <button className="w-full py-4 bg-emerald-600 rounded-2xl text-[10px] font-black text-black uppercase tracking-widest shadow-lg shadow-emerald-900/20">
                   {showResult ? "Pixel Cleanup Concluído ✅" : "Otimizando Fundo..."}
                </button>
            </div>
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
          {['halftone', 'white', 'anti'].map((tab) => (
             <div 
               key={tab} 
               className={cn(
                 "h-1 flex-1 rounded-full transition-all duration-500",
                 activeTab === tab ? "bg-emerald-500" : "bg-white/10"
               )} 
             />
          ))}
       </div>
    </div>
  );
};
