import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Trash2, Loader2, LayoutGrid, X, CheckCircle } from 'lucide-react';
import { electronBridge } from '@dtf/lib/electronBridge';
import { useWidgets } from '@dtf/contexts/WidgetContext';
import WidgetCard from './WidgetCard';
import CreateWidgetModal from './CreateWidgetModal';

export default function WidgetGrid() {
    const { 
        widgets, 
        addWidget, 
        clearAllWidgets, 
        triggerAllGenerations, 
        isAnyGenerating,
        selectedIds,
        isSelectionMode,
        setIsSelectionMode,
        clearSelection
    } = useWidgets();
    const [showModal, setShowModal] = useState(false);

    const handleBatchSend = async () => {
        const pathsToSend: string[] = [];
        widgets.forEach(w => {
            if (selectedIds.has(w.id)) {
                // In Web, prefer imageUrl (Base64) because browsers can't fetch C:/ paths. In Electron, prefer savedPath.
                const path = electronBridge.isElectron 
                    ? (w.externalStatus?.savedPath || w.localResult?.savedPath || w.externalStatus?.imageUrl || w.localResult?.imageUrl || (w.uploadedImages && w.uploadedImages[0]))
                    : (w.externalStatus?.imageUrl || w.localResult?.imageUrl || w.externalStatus?.savedPath || w.localResult?.savedPath || (w.uploadedImages && w.uploadedImages[0]));
                
                if (path) pathsToSend.push(path);
            }
        });

        if (pathsToSend.length === 0) {
            clearSelection();
            setIsSelectionMode(false);
            return;
        }

        // Bridge now handles verification, parallel processing and loading UI
        electronBridge.launchMontador(pathsToSend);
        
        clearSelection();
        setIsSelectionMode(false);
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 relative">
            {/* ═══ EMPTY STATE ═══ */}
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
                /* ═══ GRID VIEW ═══ */
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Toolbar */}
                    <div className="px-6 py-4 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-xl flex items-center justify-between shrink-0 z-20">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                                <LayoutGrid className="text-cyan-400" size={18} />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white/90 uppercase tracking-tight">Suas Estampas</h2>
                                <p className="text-[10px] text-white/30 font-mono tracking-widest">{widgets.length} ATIVOS</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={clearAllWidgets}
                                className="px-3 py-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-bold flex items-center gap-1.5 border border-transparent hover:border-red-500/20"
                            >
                                <Trash2 size={14} />
                                <span className="hidden sm:inline">Limpar</span>
                            </button>
                            
                            <button
                                onClick={triggerAllGenerations}
                                disabled={isAnyGenerating}
                                className={`
                                    px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg
                                    ${isAnyGenerating
                                        ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 shadow-white/5'
                                    }
                                `}
                            >
                                {isAnyGenerating ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin text-cyan-400" />
                                        <span>Gerando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={14} className="text-cyan-400" />
                                        <span>Gerar Todos</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-min pb-40">
                            <AnimatePresence mode="popLayout">
                                {widgets.map(w => (
                                    <WidgetCard key={w.id} config={w} />
                                ))}
                            </AnimatePresence>

                            {/* Add Widget Card */}
                            {!isSelectionMode && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(6, 182, 212, 0.05)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowModal(true)}
                                    className="min-h-[300px] rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 group transition-all"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/10 transition-colors">
                                        <Plus size={24} className="text-white/20 group-hover:text-cyan-400 transition-colors" />
                                    </div>
                                    <span className="text-xs font-bold text-white/20 group-hover:text-cyan-400 uppercase tracking-widest transition-colors">Novo Widget</span>
                                </motion.button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ FLOATING ACTION BUTTON (FAB) ═══ */}
            <AnimatePresence>
                {widgets.length > 0 && !isSelectionMode && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0, opacity: 0, y: 20 }}
                        whileHover={{ scale: 1.05, y: -5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsSelectionMode(true)}
                        className="fixed bottom-10 right-10 z-[100] group"
                    >
                        <div className="relative h-20 w-20 flex items-center justify-center">
                            {/* Glow Effect */}
                            <div className="absolute inset-0 bg-orange-500/40 blur-2xl rounded-full animate-pulse group-hover:bg-orange-400/60" />
                            
                            {/* Liquid Glass Body */}
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-600 rounded-[24px] border border-white/30 backdrop-blur-xl shadow-[0_20px_40px_rgba(245,158,11,0.4)] flex flex-col items-center justify-center overflow-hidden">
                                {/* Shine */}
                                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                                
                                <LayoutGrid size={28} className="text-black mb-1 group-hover:rotate-12 transition-transform duration-300" />
                                <span className="text-[10px] font-black text-black px-2 text-center leading-none uppercase">Montar</span>
                            </div>
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ═══ BULK ACTIONS BAR ═══ */}
            <AnimatePresence>
                {isSelectionMode && (
                    <motion.div
                        initial={{ y: 150, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 150, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] w-[95%] max-w-2xl"
                    >
                        <div className="bg-black/80 backdrop-blur-3xl border border-white/20 rounded-3xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative">
                            {/* Animated Background Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-orange-500/5 pointer-events-none" />
                            
                            <div className="flex items-center gap-5 relative">
                                <button
                                    onClick={() => { clearSelection(); setIsSelectionMode(false); }}
                                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/10 group"
                                    title="Sair da Montagem"
                                >
                                    <X size={20} className="group-hover:rotate-90 transition-transform" />
                                </button>
                                <div>
                                    <div className="text-lg font-black text-white flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] animate-pulse" />
                                        {selectedIds.size} {selectedIds.size === 1 ? 'ESTAMPA' : 'ESTAMPAS'}
                                    </div>
                                    <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">Modo de Montagem Ativo</p>
                                </div>
                            </div>

                            <button
                                onClick={handleBatchSend}
                                disabled={selectedIds.size === 0}
                                className={`
                                    relative flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all w-full sm:w-auto overflow-hidden
                                    ${selectedIds.size > 0 
                                        ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-black shadow-[0_15px_30px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95' 
                                        : 'bg-white/5 text-white/10 border border-white/5 cursor-not-allowed'
                                    }
                                `}
                            >
                                <CheckCircle size={22} className={selectedIds.size > 0 ? 'animate-bounce' : ''} />
                                Enviar ao Montador
                                
                                {selectedIds.size > 0 && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent -translate-x-full hover:animate-[shimmer_1.5s_infinite]" />
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CreateWidgetModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onCreate={(ar) => addWidget(ar)}
            />
        </div>
    );
}
