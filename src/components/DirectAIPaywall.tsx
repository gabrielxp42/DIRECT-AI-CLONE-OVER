import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Shield, 
  ChevronRight, 
  Lock, 
  ArrowLeft, 
  Wallet, 
  MessageSquare, 
  Truck, 
  Calculator, 
  Bot,
  X,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DirectAIPaywallProps {
  isVisible: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}

export const DirectAIPaywall: React.FC<DirectAIPaywallProps> = ({ isVisible, onUpgrade, onClose }) => {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = React.useState<string>('gabi');
  const [showAfter, setShowAfter] = React.useState(false);
  const [slideIndex, setSlideIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setShowAfter(prev => !prev);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const slideTimer = setInterval(() => {
      setSlideIndex(prev => (prev + 1) % 2);
    }, 6000);
    return () => clearInterval(slideTimer);
  }, []);

  if (!isVisible) return null;

  const features = [
    { id: 'finance', icon: Wallet, title: "Financeiro IA", desc: "Caixa e lucro automático", color: "from-emerald-500 to-teal-500" },
    { id: 'whatsapp', icon: MessageSquare, title: "WhatsApp Pro", desc: "Status & cobrança", color: "from-green-500 to-emerald-600" },
    { id: 'logistica', icon: Truck, title: "Logística 5.0", desc: "Etiquetas e fretes", color: "from-blue-500 to-indigo-600" },
    { id: 'metro', icon: Calculator, title: "Cálculo de Metro", desc: "Visual e intuitivo", color: "from-orange-500 to-red-600" },
    { id: 'gabi', icon: Bot, title: "Gabi Assistente", desc: "Entende áudio e fotos", color: "from-cyan-500 to-blue-600" },
    { id: 'vetoriza', icon: Zap, title: "Vetoriza AI", desc: "Artes em alta definição", color: "from-purple-500 to-pink-600" }
  ];

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
                      transition={{ delay: i * 0.2, duration: 1 }}
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
                <div className="flex flex-col">
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
              transition={{ delay: 0.2 }}
              className="bg-white/10 p-3 rounded-2xl rounded-bl-none text-[11px] text-white/90 border border-white/5 max-w-[85%]"
            >
              "Oi! Como está meu pedido de **10 metros de DTF Têxtil**?"
            </motion.div>

            <motion.div 
              initial={{ scale: 0.8, opacity: 0, x: 10 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              transition={{ delay: 1 }}
              className="bg-emerald-600/30 p-3 rounded-2xl rounded-br-none text-[11px] text-white/90 ml-auto border border-white/10 max-w-[85%]"
            >
              <div className="flex items-center gap-2 mb-1 text-emerald-400">
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
                  <div className="space-y-1">
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
              className="bg-emerald-500/20 p-3 rounded-2xl rounded-br-none ml-auto max-w-[90%] border border-emerald-500/30"
            >
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Gabi Proativa</span>
              </div>
              <p className="text-[11px] text-white/90 italic">"Chefe, etiqueta gerada! Já enviei o código de rastreio pro João no WhatsApp e avisei que o prazo é de 3 dias úteis. ✅"</p>
            </motion.div>
          </div>
        );
      case 'metro':
        return (
          <div className="space-y-4 pt-2">
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
              className="bg-emerald-500/20 p-4 rounded-2xl rounded-br-none ml-auto border border-emerald-500/30"
            >
              <div className="flex items-center gap-2 mb-3">
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
        const currentSlide = slides[slideIndex];

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
                        transition={{ duration: 0.4 }}
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
                   
                   {/* Progress indicators for slides */}
                   <div className="absolute top-4 right-4 flex gap-1 z-20">
                      {slides.map((_, i) => (
                        <div key={i} className={cn("h-1 w-4 rounded-full transition-all duration-300", i === slideIndex ? "bg-white/60" : "bg-white/10")} />
                      ))}
                   </div>

                   <motion.div 
                    animate={{ left: ['0%', '100%', '0%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-0.5 bg-gradient-to-b from-transparent via-white/20 to-transparent z-10"
                   />
                </div>
             </div>
             <p className="text-[10px] text-center text-white/30 italic">Passe de fotos simples para artes profissionais em 1 clique</p>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-white/20">
            <Zap className="w-12 h-12" />
          </div>
        );
    }
  };

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4 md:p-8">
          {/* Liquid Glass Background */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-[40px] bg-[#0a0a0f]/80"
            style={{
              backgroundImage: `radial-gradient(circle at 10% 10%, rgba(16, 185, 129, 0.1) 0%, transparent 40%),
                                radial-gradient(circle at 90% 90%, rgba(20, 184, 166, 0.1) 0%, transparent 40%)`
            }}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="relative w-full max-w-[1000px] bg-white/[0.02] border border-white/10 rounded-[40px] shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col md:flex-row"
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Main Content Side */}
            <div className="flex-1 p-8 md:p-12 flex flex-col justify-between">
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30">
                    <Lock className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Premium Access Required</span>
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 tracking-tighter leading-tight">
                    Direct AI: Gestão no <br />
                    <span className="text-emerald-400 italic">Piloto Automático</span>
                  </h1>
                  <p className="text-white/50 text-base max-w-md leading-relaxed">
                    O único sistema especializado em gráficas DTF. Automatize seu financeiro, WhatsApp e logística em um só lugar.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  {features.map((feature) => (
                    <button 
                      key={feature.id} 
                      onMouseEnter={() => setActiveFeature(feature.id)}
                      onClick={() => setActiveFeature(feature.id)}
                      className={cn(
                        "bg-white/5 border p-3 rounded-2xl transition-all duration-300 text-left group",
                        activeFeature === feature.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/5 hover:border-white/20"
                      )}
                    >
                      <feature.icon className={cn(
                        "w-5 h-5 mb-2 transition-transform duration-300 group-hover:scale-110",
                        activeFeature === feature.id ? "text-emerald-400" : "text-white/40"
                      )} />
                      <h3 className={cn("font-bold text-xs", activeFeature === feature.id ? "text-white" : "text-white/60")}>{feature.title}</h3>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={onUpgrade}
                    className="w-full sm:flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black h-14 rounded-2xl flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] shadow-lg shadow-emerald-500/30 text-base"
                  >
                    Assinar Direct AI Completo
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  
                  <button
                    onClick={() => navigate('/')}
                    className="w-full sm:w-auto px-6 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    Voltar ao Launcher
                  </button>
                </div>
                <p className="text-[10px] text-white/30 text-center md:text-left flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  Pagamento seguro via Stripe • Upgrade instantâneo
                </p>
              </div>
            </div>

            {/* Showcase Side */}
            <div className="hidden md:flex w-[400px] bg-black/40 border-l border-white/5 p-8 flex-col justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
              
              {/* Mock iPhone Frame */}
              <div className="relative w-full h-[500px] bg-zinc-900 rounded-[3rem] border-[6px] border-zinc-800 shadow-2xl p-6 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-800 rounded-b-2xl z-20" />
                <div className="relative h-full z-10 flex flex-col justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeFeature}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                      className="h-full pt-4"
                    >
                      {renderShowcase()}
                    </motion.div>
                  </AnimatePresence>
                </div>
                
                {/* Internal Mock Glow */}
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
              </div>

              {/* Showcase Caption */}
              <div className="mt-8 text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Interativo</span>
                </div>
                <p className="text-xs text-white/30 font-medium italic">Veja como a Gabi automatiza sua gráfica</p>
              </div>

              {/* Abstract Decorative Elements */}
              <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>, document.body
  );
};
