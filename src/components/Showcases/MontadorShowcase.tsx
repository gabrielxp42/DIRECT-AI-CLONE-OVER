import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Maximize2, 
  Grid2X2, 
  Table, 
  Move,
  CheckCircle2,
  MoreVertical,
  Layout as LayoutIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const MontadorShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'nesting' | 'sheet' | 'export'>('nesting');
  const [isNesting, setIsNesting] = React.useState(false);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setIsNesting(prev => !prev);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const tabTimer = setInterval(() => {
      setActiveTab(prev => {
        if (prev === 'nesting') return 'sheet';
        if (prev === 'sheet') return 'export';
        return 'nesting';
      });
    }, 8000);
    return () => clearInterval(tabTimer);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'nesting':
        return (
          <div className="flex flex-col h-full bg-[#0a0a0f]">
            <div className="p-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid2X2 className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-black uppercase text-white/80 tracking-wider">Algoritmo de Nesting</span>
              </div>
              <div className="px-2 py-0.5 bg-blue-500/20 rounded-full border border-blue-500/40 animate-pulse">
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Otimizando Meta...</span>
              </div>
            </div>

            <div className="flex-1 relative bg-zinc-900/50 p-6 flex items-center justify-center">
              {/* Print Sheet Simulation (60cm x N) */}
              <div className="relative w-48 h-72 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col items-center p-2">
                 {/* The "Shapes" moving */}
                 <div className="grid grid-cols-2 gap-2 w-full">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          x: isNesting ? 0 : (i % 2 === 0 ? 40 : -40),
                          y: isNesting ? 0 : (i > 3 ? -100 : 100),
                          rotate: isNesting ? 0 : 45,
                          opacity: isNesting ? 1 : 0.4
                        }}
                        transition={{ 
                           duration: 1.5, 
                           type: "spring", 
                           stiffness: 100, 
                           damping: 10,
                           delay: i * 0.1 
                        }}
                        className="aspect-square bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center"
                      >
                         <img src="/BAIXA-QUALIDADE-BRASIL.png" className="w-1/2 opacity-50 grayscale brightness-200" alt="Logo" />
                      </motion.div>
                    ))}
                 </div>

                 {/* Success Badge */}
                 <AnimatePresence>
                    {isNesting && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] flex items-center justify-center"
                      >
                         <div className="bg-blue-600 p-2 rounded-full shadow-lg">
                            <CheckCircle2 className="w-6 h-6 text-white" />
                         </div>
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>

              <div className="absolute top-10 left-10 flex flex-col gap-1">
                 <div className="w-10 h-0.5 bg-blue-500/40" />
                 <span className="text-[7px] text-blue-400/60 font-black">LARGURA: 600mm</span>
              </div>
            </div>
          </div>
        );

      case 'sheet':
        return (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-black uppercase text-white/80 tracking-wider">Métricas de Produção</span>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-4 justify-center">
                {[
                  { label: "METROS NECESSÁRIOS", value: "4.5m", color: "text-blue-400" },
                  { label: "PREÇO ESTIMADO", value: "R$ 215,90", color: "text-emerald-400" },
                  { label: "APROVEITAMENTO", value: "98.2%", color: "text-blue-400" }
                ].map((stat, i) => (
                  <motion.div 
                    key={i}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.2 }}
                    className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col gap-1"
                  >
                     <span className="text-[7px] font-black text-white/30 tracking-widest uppercase">{stat.label}</span>
                     <span className={cn("text-lg font-black tracking-tighter tabular-nums", stat.color)}>{stat.value}</span>
                  </motion.div>
                ))}
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="flex flex-col h-full bg-[#0a0a0f] p-8 space-y-6">
             <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
                <div className="w-20 h-24 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center relative overflow-hidden">
                   <Table className="w-8 h-8 text-white/20" />
                   {isNesting && (
                     <motion.div 
                       initial={{ y: 50 }}
                       animate={{ y: 0 }}
                       className="absolute inset-0 bg-emerald-500/20 flex flex-col items-center justify-center"
                     >
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        <span className="text-[8px] font-black text-emerald-400 mt-1 uppercase">Sincronizado</span>
                     </motion.div>
                   )}
                </div>
                <div className="space-y-1">
                   <h4 className="text-sm font-black text-white">EXPORTAR PLANILHA</h4>
                   <p className="text-[9px] text-white/40 leading-relaxed max-w-[180px]">Gere arquivos CSV/EXCEL para controle Total da sua gráfica em 1 clique.</p>
                </div>
             </div>

             <button 
               className={cn(
                 "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                 isNesting ? "bg-emerald-600 text-black" : "bg-blue-600 text-white"
               )}
             >
                {isNesting ? "Planilha Gerada com Sucesso 📥" : "Clique para Exportar"}
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
          {['nesting', 'sheet', 'export'].map((tab) => (
             <div 
               key={tab} 
               className={cn(
                 "h-1 flex-1 rounded-full transition-all duration-500",
                 activeTab === tab ? "bg-blue-500" : "bg-white/10"
               )} 
             />
          ))}
       </div>
    </div>
  );
};
