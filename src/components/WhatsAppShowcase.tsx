import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Zap, Send, CheckCheck, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOCK_STEPS = [
    { type: 'status', text: 'Status Alterado: PRONTO P/ RETIRADA', icon: ShoppingBag, color: 'text-blue-400' },
    { type: 'system', text: 'Gabi Agilizando: Enviando alerta...', icon: BellRing, color: 'text-emerald-400' },
    { type: 'ai', text: 'Eai Gabriel! Seu pedido tá prontinho aqui na loja te esperando! 😊🚀', sender: 'Gabi Engine' },
];

export const WhatsAppShowcase = () => {
    const [step, setStep] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setStep((prev) => (prev + 1) % (MOCK_STEPS.length + 1));
        }, 2500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="w-full space-y-4">
            <div className="relative rounded-2xl border border-emerald-500/10 bg-zinc-900/50 p-4 overflow-hidden min-h-[200px]">
                <div className="flex flex-col gap-3">
                    <AnimatePresence mode="popLayout">
                        {MOCK_STEPS.slice(0, step).map((msg, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: msg.type === 'ai' ? 20 : -20, y: 10 }}
                                animate={{ opacity: 1, x: 0, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={cn(
                                    "max-w-[90%] rounded-2xl p-3 text-xs font-medium shadow-lg",
                                    msg.type === 'status'
                                        ? "bg-blue-500/10 text-blue-400 self-start border border-blue-500/20 flex items-center gap-2"
                                        : msg.type === 'system'
                                            ? "bg-emerald-500/10 text-emerald-400 self-center py-2 px-4 italic flex items-center gap-2 border border-emerald-500/20"
                                            : "bg-emerald-600 text-white self-end shadow-emerald-900/40"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    {msg.icon && <msg.icon className={cn("w-3.5 h-3.5", msg.type === 'system' && "animate-bounce")} />}
                                    <p>{msg.text}</p>
                                </div>
                                {msg.type === 'ai' && (
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-[8px] opacity-60">22:45h</span>
                                        <CheckCheck className="w-3 h-3 text-emerald-200" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Background glow */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <motion.div
                        animate={{
                            opacity: [0.1, 0.2, 0.1],
                            scale: [1, 1.2, 1]
                        }}
                        className="absolute -bottom-10 -right-10 w-40 h-40 blur-[40px] rounded-full bg-emerald-500/20"
                    />
                </div>
            </div>

            {/* Steps Indicators */}
            <div className="flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-8 h-1 rounded-full transition-all duration-500",
                            (step > i) ? "bg-emerald-500 w-12" : "bg-white/10"
                        )}
                    />
                ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-emerald-500/80">
                <Zap className="w-3 h-3 fill-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center">
                    Gabi Agiliza • Produtividade no Talo
                </p>
            </div>
        </div>
    );
};
