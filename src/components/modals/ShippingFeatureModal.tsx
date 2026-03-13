import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, X, ArrowRight, Zap, Target, ShoppingBag, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShippingAnimation } from '@/components/marketing/ShippingAnimation';
import { OrderCreationAnimation } from '@/components/marketing/OrderCreationAnimation';
import { useModalQueue } from '@/contexts/ModalQueueContext';

interface ShippingFeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShippingFeatureModal = ({ isOpen, onClose }: ShippingFeatureModalProps) => {
    const [step, setStep] = useState(1);
    const totalSteps = 2;
    const { register, deregister, isAllowed } = useModalQueue();
    const MODAL_ID = 'shipping-feature';

    useEffect(() => {
        if (isOpen) {
            register(MODAL_ID, 5);
        } else {
            deregister(MODAL_ID);
        }
    }, [isOpen]);

    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {(isOpen && isAllowed(MODAL_ID)) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Content Container - Liquid Glass Style */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className={cn(
                            "relative w-full max-w-md overflow-hidden",
                            "bg-white/5 backdrop-blur-xl border border-white/20",
                            "rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]",
                            "ring-1 ring-white/10"
                        )}
                    >
                        {/* Glow Effects - Liquid */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFF200]/10 rounded-full blur-[100px] pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative p-8 flex flex-col items-center text-center space-y-6">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-colors z-20 group"
                            >
                                <X className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                            </button>

                            {/* Badge */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-wider shadow-inner">
                                <Zap className="w-3 h-3 text-[#FFF200] fill-current" />
                                Novidade v3.0
                            </div>

                            {/* Content Swipe Container */}
                            <div className="w-full relative min-h-[380px]">
                                <AnimatePresence mode="wait">
                                    {step === 1 ? (
                                        <motion.div
                                            key="step1"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <h2 className="text-3xl font-black text-white leading-tight tracking-tight">
                                                    Frete Inteligente
                                                </h2>
                                                <p className="text-zinc-300 text-sm font-medium">
                                                    Gabi AI agora cota e gera etiquetas de envio automaticamente.
                                                </p>
                                            </div>

                                            <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                                                <ShippingAnimation />
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="step2"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <h2 className="text-3xl font-black text-white leading-tight tracking-tight">
                                                    Automação Completa
                                                </h2>
                                                <p className="text-zinc-300 text-sm font-medium">
                                                    Do pedido ao rastreio no WhatsApp do cliente. <span className="text-[#FFF200]">Tudo automático.</span>
                                                </p>
                                            </div>

                                            <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                                                <OrderCreationAnimation />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Pagination Dots */}
                            <div className="flex gap-2 justify-center">
                                {[1, 2].map((i) => (
                                    <button
                                        key={i}
                                        onClick={() => setStep(i)}
                                        className={cn(
                                            "h-2 rounded-full transition-all duration-300 cursor-pointer hover:bg-[#FFF200]/50",
                                            step === i ? "w-6 bg-[#FFF200]" : "w-2 bg-white/20"
                                        )}
                                        aria-label={`Ir para o passo ${i}`}
                                    />
                                ))}
                            </div>

                            {/* Action Button */}
                            <Button
                                onClick={handleNext}
                                className={cn(
                                    "w-full h-14 rounded-2xl font-bold text-base uppercase tracking-wide transition-all shadow-xl",
                                    "bg-white text-black hover:bg-zinc-100",
                                    step === 1 ? "hover:scale-[1.02]" : "bg-[#FFF200] hover:bg-[#ffe600]"
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    {step === 1 ? 'Próximo' : 'Começar a Usar'}
                                    {step === 1 ? <ChevronRight className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                </span>
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
