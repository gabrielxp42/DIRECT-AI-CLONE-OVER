import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Trash2, Loader2 } from 'lucide-react';
import { useWidgets } from '@dtf/contexts/WidgetContext';
import WidgetCard from './WidgetCard';
import CreateWidgetModal from './CreateWidgetModal';

export default function WidgetGrid() {
    const { widgets, addWidget, clearAllWidgets, triggerAllGenerations, isAnyGenerating } = useWidgets();
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            {/* Empty state */}
            {widgets.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col items-center justify-center gap-6"
                >
                    <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                        <Sparkles size={36} className="text-cyan-500/60" />
                    </div>
                    <div className="text-center space-y-1">
                        <h2 className="text-lg font-bold text-white/80">Nenhum widget ativo</h2>
                        <p className="text-sm text-white/40 max-w-[280px]">
                            Crie um widget para começar a gerar artes DTF profissionais
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowModal(true)}
                        className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl flex items-center gap-2 shadow-lg hover:shadow-cyan-500/20 transition-all"
                    >
                        <Plus size={18} />
                        Criar Widget
                    </motion.button>
                </motion.div>
            ) : (
                /* Grid with cards */
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Toolbar */}
                    <div className="px-6 py-4 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur flex items-center justify-between shrink-0 z-10">
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-medium text-white/70">WIDGETS ATIVOS</h2>
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/50 border border-white/5">
                                {widgets.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearAllWidgets}
                                className="px-3 py-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-white/40 text-xs font-medium transition-colors flex items-center gap-1.5"
                            >
                                <Trash2 size={14} />
                                Limpar Tudo
                            </button>
                            <div className="h-4 w-px bg-white/10 mx-1" />
                            <button
                                onClick={triggerAllGenerations}
                                disabled={isAnyGenerating}
                                className={`
                                    px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg
                                    ${isAnyGenerating
                                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white shadow-cyan-500/20'
                                    }
                                `}
                            >
                                {isAnyGenerating ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Gerando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={14} />
                                        Gerar Todos
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-min pb-20">
                            <AnimatePresence mode="popLayout">
                                {widgets.map(w => (
                                    <WidgetCard key={w.id} config={w} />
                                ))}
                            </AnimatePresence>

                            {/* Add Widget Button (inline no grid) */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowModal(true)}
                                className="min-h-[280px] rounded-2xl border-2 border-dashed border-white/10 hover:border-cyan-500/40 bg-white/[0.02] hover:bg-cyan-500/5 transition-all flex flex-col items-center justify-center gap-3 group"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-cyan-500/20 flex items-center justify-center transition-all">
                                    <Plus size={24} className="text-white/30 group-hover:text-cyan-400 transition-colors" />
                                </div>
                                <span className="text-xs font-medium text-white/30 group-hover:text-cyan-400 transition-colors">
                                    Novo Widget
                                </span>
                            </motion.button>
                        </div>
                    </div>
                </div>
            )}

            <CreateWidgetModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onCreate={(ar) => addWidget(ar)}
            />
        </>
    );
}
