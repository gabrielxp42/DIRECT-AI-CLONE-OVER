'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette, FileUp, Sparkles, Package, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pedido } from '@/types/pedido';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface OrderArtActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido;
  initialItemId?: string;
}


export const OrderArtActionModal: React.FC<OrderArtActionModalProps> = ({
  isOpen,
  onClose,
  pedido,
  initialItemId
}) => {

  const navigate = useNavigate();
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [transitionTarget, setTransitionTarget] = React.useState<'factory' | 'montador' | null>(null);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(
    initialItemId || (pedido.pedido_items?.length === 1 ? pedido.pedido_items[0].id : null)
  );
  
  // Sincronizar item selecionado quando o prop mudar ou o modal abrir
  React.useEffect(() => {
    if (isOpen) {
      setSelectedItemId(initialItemId || (pedido.pedido_items?.length === 1 ? pedido.pedido_items[0].id : null));
    }
  }, [isOpen, initialItemId, pedido.pedido_items]);





  const handleAction = (target: 'factory' | 'montador') => {
    setIsTransitioning(true);
    setTransitionTarget(target);

    // Sincronizar com navegação (simulando o loading fiel solicitado)
    setTimeout(() => {
      const route = target === 'factory' ? '/dtf-factory' : '/montador';
      const itemParam = selectedItemId ? `&itemId=${selectedItemId}` : '';
      navigate(`${route}?orderId=${pedido.id}&orderNumber=${pedido.order_number}${itemParam}`);
      onClose();
    }, 1500);

  };

  if (!isOpen && !isTransitioning) return null;

  return (
    <AnimatePresence>
      {(isOpen || isTransitioning) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isTransitioning ? onClose : undefined}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              "relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur-2xl sm:p-8",
              isTransitioning && "pointer-events-none"
            )}
          >
            {/* Glow Effect */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-[80px]" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-orange-500/10 blur-[80px]" />

            {!isTransitioning ? (
              <>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                      <Palette className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">
                        Handoff de <span className="text-primary italic-normal">Arte</span>
                      </h3>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        Pedido #{pedido.order_number}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="rounded-full h-10 w-10 hover:bg-white/5 text-zinc-400"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-zinc-400 font-medium px-1">
                    Como deseja prosseguir com a arte deste pedido? Escolha uma opção abaixo:
                  </p>

                  <div className="grid gap-3">
                    {/* Visual Hint for selection if missing */}
                    {!selectedItemId && pedido.pedido_items && pedido.pedido_items.length > 1 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center"
                      >
                         <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest">
                           ⚠️ Selecione o item abaixo para continuar
                         </p>
                      </motion.div>
                    )}

                    {/* Opção 1: Já tenho o arquivo */}
                    <button
                      onClick={() => handleAction('montador')}
                      disabled={!selectedItemId}
                      className={cn(
                        "group relative flex items-center gap-4 w-full p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden",
                        selectedItemId 
                          ? "border-white/5 bg-white/5 hover:bg-white/10 hover:border-orange-500/30" 
                          : "opacity-40 grayscale cursor-not-allowed border-white/5 bg-white/5"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 group-hover:scale-110 transition-transform">
                        <FileUp className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white uppercase tracking-tight">Já tenho os arquivos</div>
                        <div className="text-[10px] text-zinc-500 font-medium">Ir direto para o Montador para organizar a impressão.</div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-orange-500 transition-colors" />
                    </button>


                    {/* Opção 2: Criar uma estampa */}
                    <button
                      onClick={() => handleAction('factory')}
                      disabled={!selectedItemId}
                      className={cn(
                        "group relative flex items-center gap-4 w-full p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden",
                        selectedItemId
                          ? "border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40"
                          : "opacity-40 grayscale cursor-not-allowed border-primary/20 bg-primary/5"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 text-primary group-hover:scale-110 transition-transform">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white uppercase tracking-tight">Criar uma estampa</div>
                        <div className="text-[10px] text-zinc-500 font-medium">Usar o DTF Factory para gerar artes exclusivas com IA.</div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
                    </button>

                  </div>

                  {/* Detalhes do Pedido Minimalista */}
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4 text-zinc-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Itens do Pedido</span>
                    </div>
                    <div className="max-h-[140px] overflow-y-auto px-1 space-y-2 pr-2">
                       {pedido.pedido_items?.map((item, idx) => (
                         <div 
                           key={idx} 
                           onClick={() => setSelectedItemId(item.id)}
                           className={cn(
                             "flex items-center justify-between text-[11px] h-10 px-3 rounded-lg border transition-all cursor-pointer",
                             selectedItemId === item.id 
                               ? "bg-primary/10 border-primary/30 text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]" 
                               : "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10"
                           )}
                         >
                           <div className="flex items-center gap-2 truncate">
                             <div className={cn(
                               "w-1.5 h-1.5 rounded-full",
                               selectedItemId === item.id ? "bg-primary" : "bg-zinc-700"
                             )} />
                             <span className="truncate max-w-[220px] font-bold uppercase tracking-tight">{item.produto_nome}</span>
                           </div>
                           <span className={cn(
                             "font-black",
                             selectedItemId === item.id ? "text-primary" : "text-zinc-600"
                           )}>{item.quantidade}x</span>
                         </div>
                       ))}
                    </div>

                  </div>
                </div>
              </>
            ) : (
              /* Transition State (Fiel ao loading do factory) */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="relative mb-8">
                  {/* Outer Rings */}
                  <motion.div
                    className="absolute inset-[-20px] rounded-full border border-primary/10"
                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.div
                    className="absolute inset-[-40px] rounded-full border border-orange-500/5"
                    animate={{ rotate: -360, scale: [1, 1.05, 1] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  />
                  
                  {/* Central Icon */}
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl animate-pulse rounded-full" />
                    {transitionTarget === 'factory' ? (
                      <Sparkles className="h-10 w-10 text-primary relative z-10" />
                    ) : (
                      <Package className="h-10 w-10 text-orange-500 relative z-10" />
                    )}
                  </div>

                  {/* Loader */}
                  <div className="absolute -bottom-2 -right-2 bg-zinc-950 p-1 rounded-full border border-white/10 shadow-lg">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-lg font-black italic tracking-tighter uppercase text-white">
                    {transitionTarget === 'factory' ? 'Iniciando Laboratório' : 'Preparando Montador'}
                  </h4>
                  <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">
                    {transitionTarget === 'factory' ? 'Integrando contexto do pedido...' : 'Organizando área de trabalho...'}
                  </p>
                </div>

                {/* Simulated Progress Bar */}
                <div className="w-48 h-1 bg-white/5 rounded-full mt-8 overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r",
                      transitionTarget === 'factory' ? "from-primary to-cyan-400" : "from-orange-500 to-amber-400"
                    )}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
