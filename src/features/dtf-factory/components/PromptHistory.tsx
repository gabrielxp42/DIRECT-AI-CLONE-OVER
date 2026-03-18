

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, Clock, Trash2 } from 'lucide-react';
import { electronBridge } from '@dtf/lib/electronBridge';

interface PromptHistoryProps {
    onSelectPrompt: (prompt: string) => void;
    currentPrompt?: string;
}

export default function PromptHistory({ onSelectPrompt, currentPrompt }: PromptHistoryProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const result = await electronBridge.getPromptHistory();
        if (result.success && result.history) {
            setHistory(result.history);
        }
    };

    const handleSelect = (prompt: string) => {
        onSelectPrompt(prompt);
        setIsOpen(false);
    };

    const clearHistory = async () => {
        // Clear via localStorage fallback or add IPC
        localStorage.removeItem('promptHistory');
        setHistory([]);
    };

    if (history.length === 0) return null;

    if (history.length === 0) return null;

    return (
        <div className="relative">
            {/* Botão de abrir histórico */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
                title="Histórico de Prompts"
            >
                <History size={16} />
            </motion.button>

            {/* Dropdown de histórico via Portal para evitar corte */}
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                        className="w-[90vw] max-w-[360px] max-h-[280px] overflow-hidden rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                            <div className="flex items-center gap-2 text-sm text-white/90 font-bold">
                                <Clock size={14} className="text-cyan-400" />
                                <span>Histórico de Prompts</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearHistory();
                                    }}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Limpar histórico"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Lista de prompts */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {history.map((prompt, idx) => (
                                <motion.button
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.02 }}
                                    onClick={() => handleSelect(prompt)}
                                    className={`w-full text-left px-4 py-3 text-sm rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 ${currentPrompt === prompt ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' : 'text-white/70'
                                        }`}
                                >
                                    <p className="line-clamp-3 leading-relaxed">{prompt}</p>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
