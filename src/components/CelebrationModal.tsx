import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, Star, Target, TrendingUp, Users, Crown, Medal, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CelebrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    milestone: {
        id: string;
        title: string;
        description: string;
        icon: any;
        category: 'production' | 'growth' | 'sales';
    } | null;
}

export const CelebrationModal = ({ isOpen, onClose, milestone }: CelebrationModalProps) => {
    if (!milestone) return null;

    const Icon = milestone.icon;

    const categoryColors = {
        production: 'from-blue-600 to-cyan-400',
        growth: 'from-purple-600 to-pink-400',
        sales: 'from-emerald-600 to-primary'
    };

    const categoryText = {
        production: 'Produção Industrial',
        growth: 'Expansão de Mercado',
        sales: 'Performance Comercial'
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop with extreme blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-2xl"
                    />

                    {/* Content Container */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 40 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 40 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="relative w-full max-w-lg bg-zinc-950/80 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden"
                    >
                        {/* Liquid Glass Background Effects */}
                        <div className={cn(
                            "absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[100px] opacity-20 animate-pulse",
                            milestone.category === 'production' && "bg-blue-600",
                            milestone.category === 'growth' && "bg-purple-600",
                            milestone.category === 'sales' && "bg-emerald-600"
                        )} />
                        <div className={cn(
                            "absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-[100px] opacity-20 animate-pulse delay-700",
                            milestone.category === 'production' && "bg-cyan-400",
                            milestone.category === 'growth' && "bg-pink-400",
                            milestone.category === 'sales' && "bg-primary"
                        )} />

                        {/* Sparkling Particles */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{
                                        x: Math.random() * 500,
                                        y: Math.random() * 500,
                                        scale: 0,
                                        opacity: 0
                                    }}
                                    animate={{
                                        y: [null, Math.random() * -100],
                                        scale: [0, 1, 0],
                                        opacity: [0, 1, 0]
                                    }}
                                    transition={{
                                        duration: 2 + Math.random() * 2,
                                        repeat: Infinity,
                                        delay: Math.random() * 2
                                    }}
                                    className="absolute w-1 h-1 bg-white rounded-full"
                                />
                            ))}
                        </div>

                        <div className="relative p-8 md:p-12 flex flex-col items-center text-center space-y-8">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
                            >
                                <X className="w-4 h-4 text-white/50" />
                            </button>

                            {/* Icon Logic */}
                            <motion.div
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ delay: 0.3, type: "spring", damping: 12 }}
                                className="relative"
                            >
                                <div className={cn(
                                    "w-24 h-24 rounded-[2rem] bg-gradient-to-br flex items-center justify-center p-6 shadow-2xl relative z-10",
                                    categoryColors[milestone.category]
                                )}>
                                    <Icon className="w-full h-full text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]" />
                                </div>
                                {/* Outer Rings */}
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute inset-0 -m-4 border border-white/10 rounded-[2.5rem]"
                                />
                                <motion.div
                                    animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute inset-0 -m-8 border border-white/5 rounded-[3rem]"
                                />
                            </motion.div>

                            <div className="space-y-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <span className={cn(
                                        "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-inner",
                                        milestone.category === 'production' && "bg-blue-500/10 border-blue-500/20 text-blue-400",
                                        milestone.category === 'growth' && "bg-purple-500/10 border-purple-500/20 text-purple-400",
                                        milestone.category === 'sales' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                                    )}>
                                        {categoryText[milestone.category]}
                                    </span>
                                    <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter leading-tight">
                                        Meta Batida! <br />
                                        <span className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
                                            {milestone.title}
                                        </span>
                                    </h2>
                                </motion.div>

                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.7 }}
                                    className="text-zinc-400 font-medium text-sm md:text-base leading-relaxed max-w-[280px] mx-auto"
                                >
                                    {milestone.description}
                                </motion.p>
                            </div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.9 }}
                                className="w-full pt-4"
                            >
                                <Button
                                    onClick={onClose}
                                    className={cn(
                                        "w-full h-16 rounded-[1.2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 group overflow-hidden relative",
                                        milestone.category === 'production' && "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20",
                                        milestone.category === 'growth' && "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20",
                                        milestone.category === 'sales' && "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 text-white",
                                    )}
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        Continuar Vencendo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                    <motion.div
                                        className="absolute inset-0 bg-white/20 translate-x-[-100%]"
                                        animate={{ x: '100%' }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 1 }}
                                    />
                                </Button>
                                <p className="mt-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                                    Direct AI • Sistema de Reconhecimento
                                </p>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};
