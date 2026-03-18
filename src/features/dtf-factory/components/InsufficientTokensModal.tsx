

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, ExternalLink, RefreshCw } from 'lucide-react';
import { electronBridge } from '@dtf/lib/electronBridge';

interface InsufficientTokensModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function InsufficientTokensModal({ isOpen, onClose }: InsufficientTokensModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="bg-neutral-900 border border-red-500/30 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                        >
                            <X size={16} />
                        </button>

                        <div className="p-6 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                <AlertCircle className="w-8 h-8 text-red-500" />
                            </div>

                            <h2 className="text-xl font-bold text-white mb-2">Tokens Insuficientes</h2>

                            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                Você precisa de pelo menos <span className="text-white font-semibold">20 tokens</span> para gerar uma nova arte. Seu saldo atual é insuficiente.
                            </p>

                            <div className="w-full space-y-3">
                                <button
                                    onClick={() => {
                                        electronBridge.openExternal('https://overpixel.online/tokens');
                                        onClose();
                                    }}
                                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={16} />
                                    Recarregar Tokens
                                </button>

                                <button
                                    onClick={onClose}
                                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium rounded-xl transition-colors"
                                >
                                    Fechar e Voltar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
