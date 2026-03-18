

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Plus, Sparkles, RefreshCw } from 'lucide-react';

const ASPECT_RATIO_OPTIONS = [
    { value: '1:1', label: 'Quadrado', w: 50, h: 50 },
    { value: '3:2', label: 'Paisagem', w: 60, h: 40 },
    { value: '2:3', label: 'Retrato', w: 40, h: 60 },
    { value: '4:3', label: 'Padrão', w: 56, h: 42 },
    { value: '3:4', label: 'Vertical', w: 42, h: 56 },
    { value: '9:16', label: 'Story', w: 34, h: 60 },
    { value: '16:9', label: 'Widescreen', w: 60, h: 34 },
    { value: 'auto', label: 'Automático', w: 50, h: 50 },
];

interface CreateWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (aspectRatio: string) => void;
}

export default function CreateWidgetModal({ isOpen, onClose, onCreate }: CreateWidgetModalProps) {
    const [selected, setSelected] = useState('3:2');

    const handleCreate = () => {
        onCreate(selected);
        onClose();
        setSelected('3:2');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-[440px] max-w-[90vw] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-lg font-bold">Novo Widget</h2>
                                <p className="text-xs text-white/40 mt-0.5">Escolha o aspect ratio para a arte</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Aspect Ratio Grid */}
                        <div className="grid grid-cols-4 gap-2.5 mb-6">
                            {ASPECT_RATIO_OPTIONS.map((ar) => {
                                const isActive = selected === ar.value;
                                return (
                                    <motion.button
                                        key={ar.value}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setSelected(ar.value)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group ${isActive
                                                ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/10'
                                                : 'bg-white/5 border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10'
                                            }`}
                                    >
                                        {/* Ratio preview box */}
                                        <div
                                            className={`border rounded-lg transition-all flex items-center justify-center ${isActive
                                                    ? 'bg-cyan-500/50 border-cyan-400'
                                                    : 'bg-gradient-to-br from-cyan-500/30 to-cyan-600/30 border-cyan-500/30 group-hover:from-cyan-500/50 group-hover:to-cyan-600/50'
                                                }`}
                                            style={{ width: ar.w * 0.7, height: ar.h * 0.7 }}
                                        >
                                            {ar.value === 'auto' && <RefreshCw size={16} className={isActive ? 'text-white' : 'text-cyan-300'} />}
                                        </div>
                                        <span className={`text-xs font-medium transition-colors ${isActive ? 'text-cyan-300' : 'text-white/60 group-hover:text-cyan-300'
                                            }`}>
                                            {ar.value}
                                        </span>
                                        <span className={`text-[9px] ${isActive ? 'text-cyan-400/70' : 'text-white/30'}`}>
                                            {ar.label}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>

                        {/* Create Button */}
                        <button
                            onClick={handleCreate}
                            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/20 active:scale-95"
                        >
                            <Plus size={18} />
                            Criar Widget
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
