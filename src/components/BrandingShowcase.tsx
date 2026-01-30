import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Layout, BarChart, ShoppingBag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const PREVIEW_THEMES = [
    { name: 'Royal Gold', color: '#FFF200', secondary: '#FFD700' },
    { name: 'Electric Blue', color: '#3b82f6', secondary: '#2563eb' },
    { name: 'Vibrant Purple', color: '#a855f7', secondary: '#9333ea' },
    { name: 'Emeral Growth', color: '#10b981', secondary: '#059669' },
    { name: 'Crimson Power', color: '#ef4444', secondary: '#dc2626' },
];

export const BrandingShowcase = () => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % PREVIEW_THEMES.length);
        }, 2500);
        return () => clearInterval(timer);
    }, []);

    const currentTheme = PREVIEW_THEMES[currentIndex];

    return (
        <div className="w-full space-y-6">
            <div className="relative rounded-2xl border border-white/5 bg-zinc-900/50 p-6 overflow-hidden">
                {/* Mirror UI Mockup */}
                <div className="flex gap-4 items-start">
                    <div className="w-1/3 space-y-3">
                        <div className="h-8 rounded-lg bg-white/5 flex items-center px-3 gap-2">
                            <Layout className="w-3 h-3 text-zinc-500" />
                            <div className="h-1.5 w-12 bg-zinc-700 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-6 rounded-lg bg-white/5 flex items-center px-3 gap-2">
                                    <div className="h-1 w-8 bg-zinc-800 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-2/3 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <motion.div
                                animate={{ borderColor: currentTheme.color + '40' }}
                                className="h-20 rounded-xl border bg-white/[0.02] p-3 flex flex-col justify-between"
                            >
                                <BarChart className="w-4 h-4 text-zinc-500" />
                                <motion.div
                                    animate={{ backgroundColor: currentTheme.color }}
                                    className="h-2 w-10 rounded-full"
                                />
                            </motion.div>
                            <motion.div
                                animate={{ borderColor: currentTheme.color + '40' }}
                                className="h-20 rounded-xl border bg-white/[0.02] p-3 flex flex-col justify-between"
                            >
                                <ShoppingBag className="w-4 h-4 text-zinc-500" />
                                <motion.div
                                    animate={{ backgroundColor: currentTheme.color }}
                                    className="h-2 w-14 rounded-full"
                                />
                            </motion.div>
                        </div>

                        <motion.div
                            animate={{ backgroundColor: currentTheme.color }}
                            className="h-10 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                        >
                            <div className="h-2 w-20 bg-zinc-950/20 rounded-full" />
                        </motion.div>
                    </div>
                </div>

                {/* Floating particles */}
                <div className="absolute inset-0 pointer-events-none">
                    <motion.div
                        animate={{
                            backgroundColor: currentTheme.color,
                            opacity: [0.1, 0.2, 0.1],
                            scale: [1, 1.2, 1]
                        }}
                        className="absolute -top-10 -right-10 w-40 h-40 blur-[50px] rounded-full"
                    />
                </div>
            </div>

            {/* Theme Selector Indicators */}
            <div className="flex justify-center gap-3">
                {PREVIEW_THEMES.map((theme, i) => (
                    <div
                        key={theme.name}
                        className={cn(
                            "w-12 h-1.5 rounded-full transition-all duration-500",
                            currentIndex === i ? "bg-white scale-110" : "bg-white/10"
                        )}
                    />
                ))}
            </div>

            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">
                Visualização em Tempo Real • {currentTheme.name}
            </p>
        </div>
    );
};
