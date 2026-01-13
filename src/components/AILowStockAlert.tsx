import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { useInsumos } from '@/hooks/useDataFetch';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const AILowStockAlert = () => {
    const { data: insumos } = useInsumos();
    const [isVisible, setIsVisible] = useState(false);
    const navigate = useNavigate();

    const [currentIndex, setCurrentIndex] = useState(0);

    const lowStockItems = React.useMemo(() => {
        return insumos?.filter(i => (i.quantidade_atual || 0) <= (i.quantidade_minima || 0)) || [];
    }, [insumos]);

    useEffect(() => {
        if (lowStockItems.length > 0) {
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [lowStockItems.length]);

    // Lógica para rotacionar mensagens se houver múltiplos itens
    useEffect(() => {
        if (lowStockItems.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % lowStockItems.length);
        }, 4000);

        return () => clearInterval(interval);
    }, [lowStockItems.length]);

    const currentItem = lowStockItems[currentIndex] || lowStockItems[0];
    if (!currentItem || lowStockItems.length === 0) return null;

    return (
        <div
            className={cn(
                "fixed z-[100] transform transition-all duration-700 ease-in-out cursor-pointer group",
                // Mobile: Centered, slightly lower | Desktop: Bottom-right, bottom-24
                "bottom-20 left-4 right-4 md:left-auto md:right-4 md:bottom-24 md:w-auto",
                isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95 pointer-events-none'
            )}
            onClick={() => navigate('/insumos')}
        >
            <div className="relative max-w-sm mx-auto md:max-w-none">
                {/* Balão com Efeito Liquid Glass Red - Estilo Premium Vibrante */}
                <div className="bg-red-500/80 dark:bg-red-600/80 backdrop-blur-xl text-white px-4 py-3 md:px-6 md:py-3.5 rounded-2xl md:rounded-br-none shadow-[0_20px_50px_rgba(239,68,68,0.4)] border border-white/20 flex items-center gap-3 md:gap-4 animate-bounce-slow">
                    <div className="bg-white/30 backdrop-blur-md p-1.5 md:p-2 rounded-full shadow-inner border border-white/40 flex-shrink-0">
                        <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-white animate-pulse" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/70">IA Monitor</span>
                            <span className="flex h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-white animate-pulse" />
                            {lowStockItems.length > 1 && (
                                <span className="text-[9px] text-white/50 font-bold ml-auto">
                                    {currentIndex + 1}/{lowStockItems.length}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={currentItem.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-xs md:text-sm font-bold leading-tight drop-shadow-sm block"
                                >
                                    {lowStockItems.length === 1
                                        ? `Ei! Notei que o estoque de ${currentItem.nome} está no limite!`
                                        : `Atenção: Estoque de ${currentItem.nome} está acabando!`}
                                </motion.span>
                            </AnimatePresence>
                        </div>
                    </div>
                    <div className="bg-white/10 p-1.5 rounded-lg group-hover:bg-white/20 transition-colors flex-shrink-0 ml-auto">
                        <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                    </div>
                </div>

                {/* Ponta do balão (Triângulo) - Escondido no mobile para visual de badge global */}
                <div className="hidden md:block absolute -bottom-2 right-0 w-5 h-5 bg-red-500/80 dark:bg-red-600/80 backdrop-blur-xl border-r border-b border-white/20 transform rotate-45"></div>

                {/* Intense Glow effect */}
                <div className="absolute -inset-2 bg-red-500/30 blur-2xl rounded-full -z-10 animate-pulse-slow"></div>
            </div>
        </div>
    );
};
