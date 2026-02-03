import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Bot, Sparkles, CheckCircle2, Zap, ArrowRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface GabiSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GabiSuccessModal({ isOpen, onClose }: GabiSuccessModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none overflow-visible">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 20 }}
                            className="relative"
                        >
                            {/* Glow Effects */}
                            <div className="absolute -inset-4 bg-gradient-to-tr from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] blur-3xl opacity-30 animate-pulse" />

                            <div className="relative bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
                                {/* Header / Bot Icon */}
                                <div className="h-48 bg-gradient-to-br from-slate-900 to-slate-950 relative flex items-center justify-center overflow-hidden">
                                    {/* Abstract Background Shapes */}
                                    <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                                        <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-purple-500 rounded-full blur-[80px]" />
                                        <div className="absolute bottom-[-20%] right-[-10%] w-64 h-64 bg-orange-500 rounded-full blur-[80px]" />
                                    </div>

                                    <motion.div
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.2, type: "spring" }}
                                        className="relative"
                                    >
                                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-[#FF6B6B] to-[#ffd93d] p-0.5 shadow-2xl">
                                            <div className="w-full h-full rounded-[1.9rem] bg-slate-950 flex items-center justify-center">
                                                <Bot className="w-12 h-12 text-white" />
                                            </div>
                                        </div>
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1.5 border-4 border-slate-950"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                        </motion.div>
                                    </motion.div>
                                </div>

                                {/* Content */}
                                <div className="p-8 text-center space-y-6">
                                    <div className="space-y-2">
                                        <Badge className="bg-gradient-to-r from-[#FF6B6B] to-[#ffd93d] text-slate-950 border-0 font-black uppercase tracking-widest px-4 py-1">
                                            MODO PLUS ATIVADO
                                        </Badge>
                                        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none pt-2">
                                            CONEXÃO <br />
                                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B6B] to-[#ffd93d]">ESTABELECIDA!</span>
                                        </h2>
                                    </div>

                                    <p className="text-slate-400 text-sm font-bold italic leading-relaxed px-4">
                                        "Uhuul! Agora estou oficialmente conectada. Meus botões premium já apareceram por todo o sistema. Vamos voar! 🚀"
                                    </p>

                                    {/* Features Recap */}
                                    <div className="grid grid-cols-2 gap-3 text-left">
                                        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                            <div className="flex items-center gap-2 text-primary">
                                                <Zap className="w-3 h-3 text-[#ffd93d]" />
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Ação Instantânea</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-medium">Basta um clique para cobrar clientes.</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                            <div className="flex items-center gap-2 text-primary">
                                                <Star className="w-3 h-3 text-[#FF6B6B]" />
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Design Premium</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-medium">Botões exclusivos da Gabi AI ativos.</p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={onClose}
                                        className="w-full h-14 bg-white hover:bg-slate-200 text-slate-950 font-black uppercase tracking-widest rounded-2xl transition-all hover:scale-[1.02] shadow-xl gap-2 mt-4"
                                    >
                                        Começar agora
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>

                                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em]">
                                        Powered by Gabi Intelligence
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
