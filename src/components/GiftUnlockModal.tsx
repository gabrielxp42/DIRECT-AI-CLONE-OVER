import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, ChevronRight, X, Palette, Brush, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BrandingShowcase } from './BrandingShowcase';

interface GiftUnlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    userName?: string;
}

export const GiftUnlockModal = ({ isOpen, onClose, userName }: GiftUnlockModalProps) => {
    const [isOpened, setIsOpened] = useState(false);
    const [showShowcase, setShowShowcase] = useState(false);
    const navigate = useNavigate();

    const handleOpenGift = () => {
        setIsOpened(true);
        // Wait for animation
        setTimeout(() => {
            setShowShowcase(true);
        }, 1500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-3xl"
                    />

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 50 }}
                        className="relative w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden"
                    >
                        {/* Background elements */}
                        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none" />

                        <div className="relative p-8 md:p-12 flex flex-col items-center text-center">
                            {!isOpened ? (
                                <div className="space-y-8 py-10">
                                    <motion.div
                                        animate={{
                                            y: [0, -20, 0],
                                            rotate: [0, -5, 5, 0]
                                        }}
                                        transition={{
                                            duration: 4,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                        className="relative"
                                    >
                                        <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-primary via-[#ffd93d] to-primary flex items-center justify-center shadow-[0_0_50px_rgba(255,242,0,0.3)] relative z-10">
                                            <Gift className="w-20 h-20 text-zinc-950 fill-zinc-950/20" />
                                        </div>
                                        {/* Ring effects */}
                                        <div className="absolute inset-0 -m-8 border-2 border-primary/20 rounded-[3rem] animate-pulse" />
                                        <div className="absolute inset-x-0 bottom-0 h-10 bg-yellow-400 blur-3xl opacity-30" />
                                    </motion.div>

                                    <div className="space-y-4">
                                        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">
                                            UM PRESENTE <br />
                                            <span className="text-primary italic">PARA VOCÊ</span>!
                                        </h2>
                                        <p className="text-zinc-400 font-medium max-w-sm mx-auto">
                                            {userName}, você acaba de ganhar um presente especial! O sistema agora é 100% a sua cara com personalização liberada.
                                        </p>
                                    </div>

                                    <Button
                                        onClick={handleOpenGift}
                                        className="w-full max-w-xs h-16 rounded-2xl bg-primary hover:bg-primary/90 text-zinc-950 font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(255,242,0,0.2)] group"
                                    >
                                        ABRIR PRESENTE
                                        <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="w-full space-y-8">
                                    {showShowcase ? (
                                        <div className="animate-in fade-in zoom-in duration-700">
                                            <div className="flex flex-col items-center gap-4 mb-8">
                                                <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                                                    <Palette className="w-8 h-8" />
                                                </div>
                                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                                                    ESSE É O NOSSO JEITO!
                                                </h2>
                                                <p className="text-zinc-400 text-sm max-w-sm">
                                                    Como agradecimento por sua parceria, liberamos a personalização completa. Escolha suas cores, sua logo e domine o mercado!
                                                </p>
                                            </div>

                                            <BrandingShowcase />

                                            <div className="mt-8 flex flex-col gap-4">
                                                <Button
                                                    onClick={() => {
                                                        onClose();
                                                        navigate('/settings');
                                                    }}
                                                    className="w-full h-14 rounded-xl bg-white text-zinc-950 font-black uppercase tracking-widest hover:bg-zinc-200"
                                                >
                                                    COMEÇAR A PERSONALIZAR
                                                </Button>
                                                <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">
                                                    DESBLOQUEADO POR MÉRITO • PERFORMANCE ELITE
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-80 flex items-center justify-center">
                                            <motion.div
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                                                transition={{ duration: 1, repeat: Infinity }}
                                                className="text-primary"
                                            >
                                                <Sparkles className="w-20 h-20 fill-primary" />
                                            </motion.div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
