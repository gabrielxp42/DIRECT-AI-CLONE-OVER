

import { motion, AnimatePresence } from 'framer-motion';
import { Crown, AlertCircle, ArrowRight, X } from 'lucide-react';
import { electronBridge } from '@dtf/lib/electronBridge';

interface ProExpiredModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProExpiredModal({ isOpen, onClose }: ProExpiredModalProps) {
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
                        className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                        >
                            <X size={18} />
                        </button>

                        {/* Icon */}
                        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                            <AlertCircle className="w-8 h-8 text-amber-400" />
                        </div>

                        <h3 className="text-xl font-bold text-center mb-2 text-white">
                            Assinatura Pro Expirada
                        </h3>
                        <p className="text-white/50 text-center text-sm mb-6 leading-relaxed">
                            Sua assinatura do <span className="text-amber-400 font-semibold">Modo Pro</span> expirou.
                            Você pode continuar utilizando o <span className="text-cyan-400 font-semibold">modo gratuito</span>!
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    electronBridge.openExternal('https://overpixel.online/software/dtf-factory-pro');
                                    onClose();
                                }}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                            >
                                <Crown className="w-4 h-4" />
                                Renovar Pro
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors"
                            >
                                Continuar Grátis
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
