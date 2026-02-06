import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useAIInsights } from '@/hooks/useAIInsights';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_MESSAGES = [
    "Ei! Tenho insights pra você! 👀",
    "Clica aqui, descobri algo importante! 💡",
    "Psiu! Vamos vender mais hoje? 🚀",
    "Separei umas dicas de ouro! ✨",
    "Análise fresquinha pra você! 📊",
];

export const AIAttentionBubble = () => {
    const { visibleInsights, isLoading } = useAIInsights();
    const [message, setMessage] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isInternalVisible, setIsInternalVisible] = useState(false);

    useEffect(() => {
        if (isLoading) return;

        const getCleanText = (text: string) => {
            return text.replace(/\*\*/g, '').replace(/🚨|📦|💎|📈|📉|📊|⚠️/g, '').trim();
        };

        const updateMessage = (index: number) => {
            let displayMsg = "";
            if (visibleInsights.length > 0) {
                const insight = visibleInsights[index % visibleInsights.length];
                const cleanText = getCleanText(insight.text);
                const truncated = cleanText.length > 40 ? cleanText.substring(0, 37) + "..." : cleanText;
                displayMsg = `${truncated} (clique para ver)`;
            } else {
                displayMsg = DEFAULT_MESSAGES[Math.floor(Math.random() * DEFAULT_MESSAGES.length)];
            }
            setMessage(displayMsg);
        };

        // Inicializar
        updateMessage(currentIndex);
        const entryTimer = setTimeout(() => setIsInternalVisible(true), 1000);

        // Se houver múltiplos insights, rodar o carrossel com reinicialização da animação
        let interval: NodeJS.Timeout;
        if (visibleInsights.length > 1) {
            interval = setInterval(() => {
                // 1. Esconde o balão primeiro
                setIsInternalVisible(false);

                // 2. Troca a mensagem e mostra de novo após um pequeno delay
                setTimeout(() => {
                    setCurrentIndex(prev => {
                        const next = (prev + 1) % visibleInsights.length;
                        updateMessage(next);
                        return next;
                    });
                    setIsInternalVisible(true);
                }, 500); // Tempo para o balão sumir completamente

            }, 6000); // Aumentado um pouco para dar tempo do balão "viver" antes de sumir
        }

        return () => {
            if (interval) clearInterval(interval);
            clearTimeout(entryTimer);
        };
    }, [isLoading, visibleInsights.length]);

    if (!message || isLoading) return null;

    return (
        <AnimatePresence>
            {isInternalVisible && (
                <motion.div
                    initial={{ y: 20, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 15, opacity: 0, scale: 0.9 }}
                    transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25
                    }}
                    className="absolute -top-12 right-4 z-20 cursor-pointer"
                    onClick={() => {
                        const element = document.getElementById('ai-insights-section');
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('animate-pulse');
                            setTimeout(() => element.classList.remove('animate-pulse'), 2000);
                        }
                    }}
                >
                    <div className="relative group">
                        {/* Balão com animação bounce nativa do dashboard */}
                        <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-2 rounded-2xl rounded-br-none shadow-lg border border-slate-100 dark:border-slate-700 flex items-center gap-2 animate-bounce-slow group-hover:scale-105 transition-transform">
                            <Sparkles className="w-4 h-4 text-primary shrink-0 fill-primary" />
                            <span className="text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[250px]">
                                {message}
                            </span>
                        </div>

                        {/* Ponta do balão (Triângulo) */}
                        <div className="absolute -bottom-2 right-0 w-4 h-4 bg-white dark:bg-slate-800 border-r border-b border-slate-100 dark:border-slate-700 transform rotate-45"></div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
