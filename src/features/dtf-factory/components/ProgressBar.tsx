

import { motion } from 'framer-motion';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { PipelineStep } from '@dtf/hooks/useDtfPipeline';

interface ProgressBarProps {
    step: PipelineStep;
    progress: number;
    message: string;
}

const STEPS = [
    { key: 'generating', label: 'Gerando', icon: '🎨' },
    { key: 'analyzing', label: 'Analisando', icon: '🔍' },
    { key: 'fixing_background', label: 'Fundo Preto', icon: '⬛' },
    { key: 'upscaling', label: 'Upscale', icon: '📈' },
    { key: 'halftoning', label: 'Halftone', icon: '✨' },
    { key: 'saving', label: 'Salvando', icon: '💾' },
];

function getStepIndex(step: PipelineStep): number {
    const index = STEPS.findIndex(s => s.key === step);
    return index >= 0 ? index : -1;
}

export default function ProgressBar({ step, progress, message }: ProgressBarProps) {
    const currentIndex = getStepIndex(step);
    const isCompleted = step === 'completed';
    const isError = step === 'error';
    const isIdle = step === 'idle';

    if (isIdle) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto"
        >
            {/* Steps */}
            <div className="flex items-center justify-between mb-6">
                {STEPS.map((s, index) => {
                    const isDone = isCompleted || index < currentIndex;
                    const isCurrent = index === currentIndex && !isCompleted && !isError;
                    const isPending = index > currentIndex && !isCompleted;

                    return (
                        <div key={s.key} className="flex flex-col items-center gap-2">
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isCurrent ? 1.1 : 1,
                                    opacity: isPending ? 0.3 : 1,
                                }}
                                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg
                  ${isDone ? 'bg-cyan-500 text-white' : ''}
                  ${isCurrent ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400' : ''}
                  ${isPending ? 'bg-white/5 border border-white/10 text-white/30' : ''}
                  ${isError && index === currentIndex ? 'bg-red-500/20 border-2 border-red-500 text-red-400' : ''}
                `}
                            >
                                {isDone ? (
                                    <CheckCircle size={20} />
                                ) : isCurrent ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Loader2 size={20} />
                                    </motion.div>
                                ) : isError && index === currentIndex ? (
                                    <AlertCircle size={20} />
                                ) : (
                                    <span>{s.icon}</span>
                                )}
                            </motion.div>
                            <span className={`text-xs font-medium ${isDone ? 'text-cyan-400' :
                                    isCurrent ? 'text-white' :
                                        'text-white/30'
                                }`}>
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Progress bar */}
            <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                    className={`absolute inset-y-0 left-0 rounded-full ${isError ? 'bg-red-500' :
                            isCompleted ? 'bg-green-500' :
                                'bg-gradient-to-r from-cyan-500 to-cyan-400'
                        }`}
                />
            </div>

            {/* Message */}
            <motion.p
                key={message}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-center text-sm ${isError ? 'text-red-400' :
                        isCompleted ? 'text-green-400' :
                            'text-white/60'
                    }`}
            >
                {message}
            </motion.p>
        </motion.div>
    );
}
