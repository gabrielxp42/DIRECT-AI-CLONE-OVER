

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PipelineStep } from '@dtf/hooks/useDtfPipeline';

/**
 * ProcessingAnimation v3 — Modern Loop.
 * 
 * Sem barras de progresso ou números.
 * Apenas animação contínua e status.
 */

interface ProcessingAnimationProps {
    progress: number; // Mantido para compatibilidade, mas não usado visualmente
    message: string;
    aspectRatio?: string;
    imageUrl?: string | null;
    onAnimationComplete?: () => void;
    step?: PipelineStep | string;
    garmentMode?: 'black' | 'white' | 'color';
}

// Mapeia steps do pipeline para labels amigáveis
const STEP_INFO: Record<string, { label: string; icon: string }> = {
    idle: { label: 'Pronto', icon: '⏳' },
    generating: { label: 'Gerando Arte', icon: '🎨' },
    analyzing: { label: 'Analisando Imagem', icon: '🔍' },
    fixing_background: { label: 'Tratando Fundo', icon: '🖌️' },
    upscaling: { label: 'Melhorando Qualidade', icon: '✨' },
    halftoning: { label: 'Aplicando Retículas', icon: '🔲' },
    saving: { label: 'Finalizando', icon: '💾' },
    completed: { label: 'Pronto!', icon: '✅' },
    error: { label: 'Erro', icon: '❌' },
};

export default function ProcessingAnimation({
    message,
    imageUrl,
    onAnimationComplete,
    step = 'idle',
    garmentMode = 'black'
}: ProcessingAnimationProps) {
    const completedRef = useRef(false);

    // Trigger completion callback
    // Trigger completion callback
    useEffect(() => {
        // Se já chegou como completed
        if (step === 'completed' && !completedRef.current) {
            completedRef.current = true;
            // Pequeno delay para garantir que a UI atualizou visualmente para 100%
            const timer = setTimeout(() => {
                onAnimationComplete?.();
            }, 500);
            return () => clearTimeout(timer);
        }

        // Reset se sair do estado de completed (ex: nova geração)
        if (step !== 'completed' && step !== 'saving') {
            completedRef.current = false;
        }
    }, [step, onAnimationComplete]);

    const stepInfo = STEP_INFO[step] || STEP_INFO.idle;
    const isCompleted = step === 'completed';

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center select-none">
            {/* Center content */}
            <motion.div
                className="relative z-10 flex flex-col items-center gap-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
                {/* Image preview or Animated Loader */}
                <AnimatePresence mode="wait">
                    {imageUrl ? (
                        <motion.div
                            key="image"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group"
                            style={{
                                maxWidth: '280px',
                                maxHeight: '280px',
                            }}
                        >
                            <img
                                src={imageUrl}
                                alt="Preview"
                                className="w-full h-auto object-contain"
                                style={{ 
                                    maxHeight: '280px',
                                    backgroundColor: garmentMode === 'white' ? '#ffffff' : 'transparent',
                                }}
                            />
                            {/* Glow border on complete */}
                            {isCompleted && (
                                <motion.div
                                    className="absolute inset-0 rounded-2xl border-2 border-green-500/50"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 1, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="loader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="relative w-32 h-32 flex items-center justify-center"
                        >
                            {/* Core Glow */}
                            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full animate-pulse" />

                            {/* Rotating Rings */}
                            <div className="absolute inset-0 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin-slow" />
                            <div className="absolute inset-4 border-2 border-indigo-500/30 border-b-indigo-400 rounded-full animate-spin-reverse-slow" />

                            {/* Center Icon/Orb */}
                            <div className="relative z-10 w-16 h-16 bg-white/5 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center shadow-inner">
                                <span className="text-3xl animate-pulse">{stepInfo.icon}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Status Text - No numbers */}
                <motion.div
                    className="text-center space-y-2"
                    layout
                >
                    <motion.h3
                        key={stepInfo.label}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-lg font-bold text-white tracking-wide"
                    >
                        {stepInfo.label}
                    </motion.h3>

                    <motion.p
                        key={message}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-cyan-200/60 max-w-[280px] leading-relaxed font-medium"
                    >
                        {message}
                    </motion.p>

                    {isCompleted && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-xs rounded-lg transition-colors cursor-pointer border border-white/5"
                            onClick={() => onAnimationComplete?.()}
                        >
                            Clique aqui se não avançar...
                        </motion.button>
                    )}
                </motion.div>
            </motion.div>
        </div>
    );
}
