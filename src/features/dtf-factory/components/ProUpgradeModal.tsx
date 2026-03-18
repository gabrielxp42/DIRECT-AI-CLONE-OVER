

import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Check, X, Zap, Sparkles, Image, Wand2, Palette, Download } from 'lucide-react';
import { electronBridge } from '@dtf/lib/electronBridge';

interface ProUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PRO_FEATURES = [
    { icon: Zap, label: 'Nova interface de produção em massa' },
    { icon: Image, label: 'Galeria de imagens finais' },
    { icon: Wand2, label: 'Editar o Halftone de qualquer imagem gerada' },
    { icon: Palette, label: 'Modo estampa colorida' },
    { icon: Download, label: 'Removedor de fundo rápido' },
    { icon: Sparkles, label: 'Gerar múltiplas imagens de uma vez' },
];

export default function ProUpgradeModal({ isOpen, onClose }: ProUpgradeModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 30 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 30 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="bg-gradient-to-b from-gray-900 to-gray-950 border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="relative px-6 pt-6 pb-4">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                            >
                                <X size={18} />
                            </button>

                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                    <Crown className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                                        DTF FACTORY PRO
                                    </h2>
                                    <p className="text-xs text-white/40">Desbloqueie todo o potencial</p>
                                </div>
                            </div>
                        </div>

                        {/* Features */}
                        <div className="px-6 pb-4">
                            <div className="space-y-2.5">
                                {PRO_FEATURES.map((feature, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/5 border border-white/5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                                            <feature.icon className="w-4 h-4 text-cyan-400" />
                                        </div>
                                        <span className="text-sm text-white/80">{feature.label}</span>
                                        <Check className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Plans */}
                        <div className="px-6 pb-6">
                            <div className="grid grid-cols-2 gap-3">
                                {/* Plan 1 */}
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col">
                                    <p className="text-xs font-bold text-white/40 uppercase mb-1">Pro 500</p>
                                    <p className="text-2xl font-extrabold text-white mb-0.5">
                                        R$79<span className="text-sm font-normal text-white/40">/mês</span>
                                    </p>
                                    <p className="text-xs text-cyan-400 mb-3">500 tokens inclusos</p>
                                    <p className="text-[10px] text-white/30 mb-3">Tudo liberado</p>
                                    <button
                                        onClick={() => {
                                            electronBridge.openExternal('https://overpixel.online/software/dtf-factory-pro');
                                            onClose();
                                        }}
                                        className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors mt-auto"
                                    >
                                        Assinar
                                    </button>
                                </div>

                                {/* Plan 2 - Highlighted */}
                                <div className="rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-4 flex flex-col relative overflow-hidden">
                                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                                        <span className="text-[9px] font-bold text-amber-400 uppercase">Popular</span>
                                    </div>
                                    <p className="text-xs font-bold text-amber-400/60 uppercase mb-1">Pro 2000</p>
                                    <p className="text-2xl font-extrabold text-white mb-0.5">
                                        R$159<span className="text-sm font-normal text-white/40">/mês</span>
                                    </p>
                                    <p className="text-xs text-amber-400 mb-3">2.000 tokens inclusos</p>
                                    <p className="text-[10px] text-white/30 mb-3">Tudo liberado + mais tokens</p>
                                    <button
                                        onClick={() => {
                                            electronBridge.openExternal('https://overpixel.online/software/dtf-factory-pro');
                                            onClose();
                                        }}
                                        className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-sm font-bold rounded-xl transition-colors mt-auto shadow-lg shadow-amber-500/20"
                                    >
                                        Assinar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
