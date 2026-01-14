"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

import { createPortal } from 'react-dom';

export interface TutorialStep {
    targetId: string;
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TutorialGuideProps {
    steps: TutorialStep[];
    isOpen: boolean;
    currentStep: number;
    onNext: () => void;
    onPrev: () => void;
    onClose: (completed: boolean) => void;
}

export const TutorialGuide: React.FC<TutorialGuideProps> = ({
    steps,
    isOpen,
    currentStep,
    onNext,
    onPrev,
    onClose
}) => {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Desabilitar scroll do corpo quando o tutorial está aberto para evitar glitches
    useEffect(() => {
        if (isOpen && mounted) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [isOpen, mounted]);

    const step = steps[currentStep];

    useEffect(() => {
        if (!isOpen || !step?.targetId) return;

        const updateRect = () => {
            const targets = step.targetId.split(',');
            let element: Element | null = null;

            for (const t of targets) {
                const trimmed = t.trim();
                const el = document.getElementById(trimmed) || document.querySelector(trimmed);

                if (el && el.getBoundingClientRect().height > 2) {
                    element = el;
                    break;
                }
            }

            if (element) {
                setTargetRect(element.getBoundingClientRect());
            } else {
                setTargetRect(null);
            }
        };

        // Salto imediato para o elemento no início do passo
        const initialElement = step.targetId.split(',').map(t => document.getElementById(t.trim()) || document.querySelector(t.trim())).find(el => el && el.getBoundingClientRect().height > 2);
        if (initialElement) {
            initialElement.scrollIntoView({ behavior: 'auto', block: 'center' });
        }

        updateRect();
        window.addEventListener('resize', updateRect);

        // Polling é suficiente para manter a posição quando o scroll está travado
        const interval = setInterval(updateRect, 100);

        return () => {
            window.removeEventListener('resize', updateRect);
            clearInterval(interval);
        };
    }, [currentStep, isOpen, step?.targetId]);

    const handleNext = () => {
        onNext();
    };

    const handleBack = () => {
        onPrev();
    };

    if (!isOpen || !step || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden select-none">
            {/* Click Blocker Overlay - This prevents ANY interaction with the underlying app */}
            <div className="absolute inset-0 pointer-events-auto bg-transparent z-[100]" />

            {/* Dark Backdrop with Hole */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{
                    opacity: 1,
                    clipPath: targetRect
                        ? `polygon(0% 0%, 0% 100%, ${targetRect.left}px 100%, ${targetRect.left}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.bottom}px, ${targetRect.left}px ${targetRect.bottom}px, ${targetRect.left}px 100%, 100% 100%, 100% 0%)`
                        : 'polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 100%, 100% 100%, 100% 0%)'
                }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto"
            />

            {/* Floating HUD */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        ...getHudPositionStyle(targetRect, step.position)
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={cn(
                        "fixed pointer-events-auto z-[101] flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 rounded-2xl border border-primary/30 bg-background/95 shadow-[0_0_50px_-12px_rgba(255,242,0,0.3)] w-[calc(100vw-2rem)] sm:max-w-sm backdrop-blur-md",
                        "after:absolute after:inset-0 after:rounded-2xl after:border after:border-white/5 after:pointer-events-none"
                    )}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 text-primary drop-shadow-[0_0_8px_rgba(255,242,0,0.5)]">
                            <Sparkles className="h-5 w-5 animate-pulse" />
                            <h3 className="font-bold text-lg tracking-tight uppercase">{step.title}</h3>
                        </div>
                        <button
                            onClick={() => onClose(false)}
                            className="p-1 hover:bg-muted rounded-full transition-colors group"
                        >
                            <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </button>
                    </div>

                    <p className="text-muted-foreground/90 text-sm leading-relaxed font-medium">
                        {step.description}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-4">
                            {currentStep > 0 && (
                                <button
                                    onClick={handleBack}
                                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors active:scale-95"
                                >
                                    <ChevronLeft className="h-3 w-3" />
                                    Voltar
                                </button>
                            )}
                            <div className="flex gap-1.5 pt-0.5">
                                {steps.map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "h-1.5 rounded-full transition-all duration-500",
                                            i === currentStep
                                                ? "w-8 bg-primary shadow-[0_0_10px_rgba(255,242,0,0.8)]"
                                                : "w-2 bg-muted/50"
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                        <Button
                            onClick={handleNext}
                            size="sm"
                            className="group shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                        >
                            <span className="font-bold uppercase tracking-wider text-[10px]">
                                {currentStep === steps.length - 1 ? "Finalizar" : "Próximo"}
                            </span>
                            <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                    </div>

                    {/* HUD Decorative Elements */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg shadow-[-2px_-2px_10px_rgba(255,242,0,0.3)]" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg shadow-[2px_2px_10px_rgba(255,242,0,0.3)]" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary/40 m-2" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary/40 m-2" />
                </motion.div>
            </AnimatePresence>

            {/* Target Highlight Ring */}
            <AnimatePresence>
                {targetRect && (
                    <motion.div
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            top: targetRect.top - 4,
                            left: targetRect.left - 4,
                            width: targetRect.width + 8,
                            height: targetRect.height + 8,
                        }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute border-2 border-primary rounded-lg shadow-[0_0_15px_rgba(255,242,0,0.5)] pointer-events-none z-[102]"
                    >
                        <motion.div
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 bg-primary/10 rounded-lg"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>,
        document.body
    );
};

function getHudPositionStyle(rect: DOMRect | null, position?: string): any {
    if (!rect) return { top: '50%', left: '50%', x: '-50%', y: '-50%' };

    const padding = 32; // Increased padding for better separation
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    if (isMobile) {
        const targetCenterY = rect.top + rect.height / 2;
        const viewportHeight = window.innerHeight;

        if (targetCenterY < viewportHeight / 2) {
            return { bottom: 24, left: 16, right: 16, top: 'auto', y: 0, x: 0 };
        } else {
            return { top: 24, left: 16, right: 16, bottom: 'auto', y: 0, x: 0 };
        }
    }

    const targetCenterX = rect.left + rect.width / 2;
    const targetCenterY = rect.top + rect.height / 2;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1000;

    const hudWidth = 400;
    const hudHeight = 280;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    let effectivePosition = position;
    if (!effectivePosition) {
        if (spaceBelow > hudHeight + 40) effectivePosition = 'bottom';
        else if (spaceAbove > hudHeight + 40) effectivePosition = 'top';
        else if (spaceRight > hudWidth + 40) effectivePosition = 'right';
        else if (spaceLeft > hudWidth + 40) effectivePosition = 'left';
        else effectivePosition = 'bottom';
    }

    if (effectivePosition === 'bottom' && spaceBelow < hudHeight && spaceAbove > hudHeight) effectivePosition = 'top';
    if (effectivePosition === 'top' && spaceAbove < hudHeight && spaceBelow > hudHeight) effectivePosition = 'bottom';

    const getClampedX = (idealX: number) => {
        const halfWidth = hudWidth / 2;
        return Math.min(viewportWidth - halfWidth - 20, Math.max(halfWidth + 20, idealX));
    };

    const getClampedY = (idealY: number, height: number, isBottomTrigger: boolean) => {
        if (isBottomTrigger) {
            return Math.min(viewportHeight - height - 20, Math.max(20, idealY));
        } else {
            return Math.min(viewportHeight - 20, Math.max(height + 20, idealY));
        }
    };

    switch (effectivePosition) {
        case 'top':
            return {
                top: getClampedY(rect.top - padding, hudHeight, false),
                left: getClampedX(targetCenterX),
                x: '-50%',
                y: '-100%',
                bottom: 'auto'
            };
        case 'bottom':
            return {
                top: getClampedY(rect.bottom + padding, hudHeight, true),
                left: getClampedX(targetCenterX),
                x: '-50%',
                y: 0,
                bottom: 'auto'
            };
        case 'left':
            if (spaceLeft < hudWidth + 20) {
                const useBottom = spaceBelow > spaceAbove;
                return {
                    top: getClampedY(useBottom ? rect.bottom + padding : rect.top - padding, hudHeight, useBottom),
                    left: getClampedX(targetCenterX),
                    x: '-50%',
                    y: useBottom ? 0 : '-100%',
                };
            }
            return {
                top: Math.min(viewportHeight - hudHeight / 2 - 20, Math.max(hudHeight / 2 + 20, targetCenterY)),
                left: rect.left - padding,
                x: '-100%',
                y: '-50%',
                right: 'auto'
            };
        case 'right':
            if (spaceRight < hudWidth + 20) {
                const useBottom = spaceBelow > spaceAbove;
                return {
                    top: getClampedY(useBottom ? rect.bottom + padding : rect.top - padding, hudHeight, useBottom),
                    left: getClampedX(targetCenterX),
                    x: '-50%',
                    y: useBottom ? 0 : '-100%',
                };
            }
            return {
                top: Math.min(viewportHeight - hudHeight / 2 - 20, Math.max(hudHeight / 2 + 20, targetCenterY)),
                left: rect.right + padding,
                x: 0,
                y: '-50%',
                right: 'auto'
            };
        case 'center':
            return { top: '50%', left: '50%', x: '-50%', y: '-50%' };
        default:
            return {
                top: getClampedY(rect.bottom + padding, hudHeight, true),
                left: getClampedX(targetCenterX),
                x: '-50%',
                y: 0
            };
    }
}
