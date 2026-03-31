import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Bot, 
  MessageSquare, 
  Truck, 
  Calculator, 
  Sparkles,
  Search,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DirectAIShowcaseProps {
  slideIndex?: number;
  showAfter?: boolean;
}

export const DirectAIShowcase: React.FC<DirectAIShowcaseProps> = ({ slideIndex = 0, showAfter = false }) => {
  const [activeFeature, setActiveFeature] = React.useState<string>('gabi');

  const features = [
    { id: 'gabi', title: 'Gabi Assistente', icon: Bot },
    { id: 'finance', title: 'Financeiro IA', icon: Zap },
    { id: 'whatsapp', title: 'WhatsApp Pro', icon: MessageSquare },
    { id: 'logistica', title: 'Logística 5.0', icon: Truck },
    { id: 'metro', title: 'Cálculo de Metro', icon: Calculator },
    { id: 'vetoriza', title: 'Vetoriza AI', icon: Sparkles }
  ];

  // Internal auto-cycling for the DirectAI features to keep it "alive"
  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature(prev => {
        const idx = features.findIndex(f => f.id === prev);
        return features[(idx + 1) % features.length].id;
      });
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const renderShowcase = () => {
    switch (activeFeature) {
      case 'gabi':
        return (
          <div className="space-y-4 pt-2">
            <motion.div 
              initial={{ x: -20, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }}
              className="bg-white/10 p-3 rounded-2xl rounded-bl-none max-w-[85%] border border-white/10"
            >
              <p className="text-[11px] text-white/80">"Gabi, como está a produção hoje?"</p>
            </motion.div>
            
            <motion.div 
              initial={{ x: 20, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-emerald-500/20 p-3 rounded-2xl rounded-br-none ml-auto max-w-[85%] border border-emerald-500/30"
            >
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Gabi Assistente</span>
              </div>
              <p className="text-[11px] text-white/90">"Tudo sob controle! 📈 Já rodamos **42 metros** hoje. Notei também **3 clientes** no WhatsApp sem resposta aguardando orçamento automático."</p>
            </motion.div>

            <motion.div 
              initial={{ x: 20, opacity: 0, y: 10 }} 
              animate={{ x: 0, opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="bg-amber-500/10 p-3 rounded-2xl rounded-br-none ml-auto max-w-[85%] border border-amber-500/20"
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Alerta de Estoque</span>
              </div>
              <p className="text-[11px] text-white/80 italic">"Ah! Seu **Filme DTF Têxtil 60cm** está acabando. Restam apenas 12 metros no estoque."</p>
            </motion.div>
          </div>
        );
      case 'finance':
        return (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-[8px] text-white/40 uppercase font-black tracking-widest">Metros Rodados</div>
                <div className="text-xl font-black text-emerald-400">124.5m</div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-[8px] text-white/40 uppercase font-black tracking-widest">Camisas Vendidas</div>
                <div className="text-xl font-black text-blue-400">86 unid</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Produção por Material</div>
              {[
                { label: 'DTF Têxtil', value: 85, color: 'bg-emerald-500' },
                { label: 'DTF UV', value: 45, color: 'bg-blue-500' },
                { label: 'Vinil Adesivo', value: 30, color: 'bg-orange-500' }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/60">{item.label}</span>
                    <span className="text-white/80 font-bold">{item.value}m</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.value/100)*100}%` }}
                      className={cn("h-full rounded-full", item.color)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Lucro Líquido Real</span>
                <span className="text-sm font-black text-white">R$ 2.450,12</span>
              </div>
            </div>
          </div>
        );
      case 'whatsapp':
        return (
          <div className="space-y-3 pt-2">
             <div className="flex items-center gap-3 mb-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-green-500/20">JS</div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-white">João Silva</span>
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    online
                  </span>
                </div>
             </div>
             
             <motion.div 
              initial={{ scale: 0.8, opacity: 0, x: -10 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              className="bg-white/10 p-3 rounded-2xl rounded-bl-none text-[11px] text-white/90 border border-white/5 max-w-[85%]"
            >
              "Oi! Como está meu pedido de **10 metros de DTF Têxtil**?"
            </motion.div>

            <motion.div 
              initial={{ scale: 0.8, opacity: 0, x: 10 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              transition={{ delay: 1 }}
              className="bg-emerald-600/30 p-3 rounded-2xl rounded-br-none text-[11px] text-white/90 ml-auto border border-white/10 max-w-[85%] text-right"
            >
              <div className="flex items-center justify-end gap-2 mb-1 text-emerald-400">
                <Bot className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase">Gabi Assistant</span>
              </div>
              "Olá João! Seu pedido já está na **impressão**! 🖨️ Assim que finalizar o acabamento eu te aviso aqui."
            </motion.div>

            <motion.div 
              initial={{ scale: 0.8, opacity: 0, x: 10 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              transition={{ delay: 2 }}
              className="bg-emerald-600 p-3 rounded-2xl rounded-br-none text-[11px] text-black font-bold ml-auto shadow-lg shadow-emerald-500/20 max-w-[80%]"
            >
              "João, seu pedido está **PRONTO**! 🚀 Pode passar para retirar."
            </motion.div>
          </div>
        );
      case 'logistica':
        return (
          <div className="flex flex-col h-full space-y-4 pt-2">
            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-4">
               <div className="flex justify-between items-center">
                  <div className="space-y-1 text-left">
                    <div className="text-[10px] text-white/40 uppercase font-bold">Pedido #2942</div>
                    <div className="text-xs font-black text-white">João Silva - SEDEX</div>
                  </div>
                  <div className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-[9px] font-black uppercase border border-blue-500/30">
                    Pago
                  </div>
               </div>
               
               <motion.button
                whileTap={{ scale: 0.95 }}
                className="w-full bg-blue-500 h-10 rounded-xl font-black text-xs text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
               >
                 <Truck className="w-4 h-4" />
                 Gerar Etiqueta
               </motion.button>
            </div>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-emerald-500/20 p-3 rounded-2xl rounded-br-none ml-auto max-w-[90%] border border-emerald-500/30 text-right"
            >
              <div className="flex items-center justify-end gap-2 mb-1">
                <Bot className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Gabi Proativa</span>
              </div>
              <p className="text-[11px] text-white/90 italic">"Chefe, etiqueta gerada! Já enviei o código de rastreio pro João no WhatsApp e avisei que o prazo é de 3 dias úteis. ✅"</p>
            </motion.div>
          </div>
        );
      case 'metro':
        return (
          <div className="space-y-4 pt-2 text-left">
            <motion.div 
              initial={{ x: -20, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }}
              className="bg-white/10 p-3 rounded-2xl rounded-bl-none max-w-[85%] border border-white/10"
            >
              <p className="text-[11px] text-white/80">"Gabi, quantas logos **5x5 cm** cabem em 1 metro de DTF?"</p>
            </motion.div>

            <motion.div 
              initial={{ x: 20, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-emerald-500/20 p-4 rounded-2xl rounded-br-none ml-auto border border-emerald-500/30 text-right"
            >
              <div className="flex items-center justify-end gap-2 mb-3">
                <Calculator className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-black text-emerald-400 uppercase">Cálculo Inteligente</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/60 italic">No filme de 60cm:</span>
                  <span className="text-white font-black">216 Unidades</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[90%] bg-emerald-500" />
                </div>
                <p className="text-[10px] text-emerald-400/80 leading-relaxed">
                  "Dispostas em 12 colunas de 18 linhas. Sobram 8cm de margem de segurança."
                </p>
              </div>
            </motion.div>
          </div>
        );
      case 'vetoriza':
        const slides = [
          {
            title: 'Remasterização HD',
            beforeImg: '/BAIXA-QUALIDADE-BRASIL.png',
            afterImg: '/ALTA-QUALIDADE-BRASIL.png',
            beforeLabel: 'Imagem Baixa Resolução',
            afterLabel: 'Vetorizado em 8K ⚡',
            color: 'text-purple-400'
          },
          {
            title: 'Efeito Bordado 3D',
            beforeImg: '/START-BUCKS - NAO-BORDADO.png',
            afterImg: '/START-BUCKS - BORDADO.png',
            beforeLabel: 'Arte Original',
            afterLabel: 'Bordado Digitalizado 🧵',
            color: 'text-emerald-400'
          }
        ];
        const currentSlide = slides[slideIndex % slides.length];

        return (
          <div className="relative h-full flex flex-col space-y-4">
             <div className="relative flex-1 bg-black/40 rounded-3xl border border-white/10 overflow-hidden flex flex-col pt-4">
                <div className="px-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className={cn("w-4 h-4", currentSlide.color)} />
                      <span className="text-[10px] font-black uppercase text-white/80">{currentSlide.title}</span>
                    </div>
                  </div>
                </div>

                <div className="relative flex-1 bg-zinc-900 mx-4 mb-4 rounded-2xl overflow-hidden border border-white/5 shadow-inner">
                   <AnimatePresence mode="wait">
                      <motion.div
                        key={`${slideIndex}-${showAfter}`}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        className="absolute inset-0 flex items-center justify-center p-4"
                      >
                        <img 
                          src={showAfter ? currentSlide.afterImg : currentSlide.beforeImg} 
                          className="w-full h-full object-contain"
                          alt={currentSlide.title}
                        />
                        <div className="absolute bottom-4 left-4 right-4 px-3 py-2 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 text-[9px] font-black uppercase text-center">
                          <span className={cn(showAfter ? currentSlide.color : 'text-white/40')}>
                            {showAfter ? currentSlide.afterLabel : currentSlide.beforeLabel}
                          </span>
                        </div>
                      </motion.div>
                   </AnimatePresence>
                   
                   <motion.div 
                    animate={{ left: ['0%', '100%', '0%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-0.5 bg-gradient-to-b from-transparent via-white/20 to-transparent z-10"
                   />
                </div>
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full p-3 md:p-4 flex flex-col">
       <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
             <motion.div
                key={activeFeature}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="h-full"
             >
                {renderShowcase()}
             </motion.div>
          </AnimatePresence>
       </div>

       {/* Interactive Feature Selector Buttons */}
       <div className="mt-3 md:mt-4 flex gap-1 md:gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {features.map((f) => {
             const Icon = f.icon;
             const isActive = activeFeature === f.id;
             return (
               <button
                 key={f.id}
                 onClick={() => setActiveFeature(f.id)}
                 onMouseEnter={() => setActiveFeature(f.id)}
                 className={cn(
                   "flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl transition-all duration-300 whitespace-nowrap shrink-0",
                   "border text-[9px] md:text-[10px] font-bold uppercase tracking-wider",
                   isActive
                     ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10 scale-[1.02]"
                     : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.06] hover:text-white/50 hover:border-white/10"
                 )}
               >
                 <Icon className={cn("w-3 h-3 md:w-3.5 md:h-3.5 shrink-0", isActive ? "text-emerald-400" : "text-white/20")} />
                 <span className="hidden sm:inline">{f.title}</span>
               </button>
             );
          })}
       </div>
    </div>
  );
};
