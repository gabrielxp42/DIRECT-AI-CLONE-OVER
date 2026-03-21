

import { motion } from 'framer-motion';
import { FolderOpen, RefreshCw, Sparkles, Sliders, LayoutGrid } from 'lucide-react';
import { electronBridge } from '@dtf/lib/electronBridge';

interface ResultDisplayProps {
    imageUrl: string;
    savedPath?: string | null;
    aspectRatio?: string;
    onNewGeneration: () => void;
    onOpenFolder: () => void;
    onAdjustHalftone?: () => void;
    onRemoveBackground?: () => void;
}

export default function ResultDisplay({
    imageUrl,
    savedPath,
    aspectRatio = '1:1',
    onNewGeneration,
    onOpenFolder,
    onAdjustHalftone,
    onRemoveBackground,
}: ResultDisplayProps) {

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full w-full overflow-hidden p-6 relative font-mono"
        >
            {/* Background Glow */}
            <div
                className="absolute inset-0 blur-3xl opacity-10 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(0,243,255,0.4) 0%, rgba(0,0,0,0) 70%)',
                }}
            />

            {/* Top Area: Badge */}
            <div className="flex-shrink-0 flex justify-center pt-2 mb-4">
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/40 shadow-[0_0_10px_rgba(74,222,128,0.2)]"
                >
                    <Sparkles className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Sucesso no Processamento</span>
                </motion.div>
            </div>

            {/* Main Content: Image Area (This will shrink/grow to fit) */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center relative px-2">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="relative max-h-full max-w-full group"
                >
                    <div className="relative border border-cyan-900/50 bg-black/60 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden">
                        {/* Scanline Sweep Animation */}
                        <motion.div
                            initial={{ top: '-100%', opacity: 1 }}
                            animate={{ top: '100%', opacity: 0 }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                            className="absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent z-20 pointer-events-none"
                        />

                        <motion.img
                            src={imageUrl}
                            alt="Resultado"
                            className="max-w-full max-h-[50vh] object-contain block"
                            style={{
                                maxHeight: 'calc(100vh - 280px)',
                                minHeight: '100px'
                            }}
                        />

                        {/* Overlay Actions */}
                        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                            {onAdjustHalftone && (
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onAdjustHalftone}
                                    title="Ajustar Halftone"
                                    className="p-2 bg-black/80 backdrop-blur-md border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-colors"
                                >
                                    <Sliders size={14} />
                                </motion.button>
                            )}
                            {imageUrl && (
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => electronBridge.launchMontador([imageUrl])}
                                    title="Enviar para Montador"
                                    className="p-2 bg-black/80 backdrop-blur-md border border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-colors"
                                >
                                    <LayoutGrid size={14} />
                                </motion.button>
                            )}
                        </div>

                        {/* Botão Central Gigante de Remover Fundo */}
                        {onRemoveBackground && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm z-30">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={onRemoveBackground}
                                    className="px-8 py-4 bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-lg rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.6)] border-2 border-purple-400 transition-all flex items-center justify-center gap-3"
                                >
                                    <Sparkles size={24} />
                                    CONTINUAR
                                </motion.button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Bottom Area: Buttons & Stats */}
            <div className="flex-shrink-0 flex flex-col items-center pt-6 pb-2">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex items-center gap-3 w-full justify-center px-4"
                >
                    <motion.button
                        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0, 243, 255, 0.4)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onNewGeneration}
                        className="flex-1 max-w-[160px] flex items-center justify-center gap-2 py-2.5 bg-cyan-950 border border-cyan-500/50 text-cyan-400 text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-900 transition-all font-mono"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>NOVO</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(245, 158, 11, 0.4)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => electronBridge.launchMontador([imageUrl])}
                        className="flex-[1.5] max-w-[200px] flex items-center justify-center gap-2 py-3 bg-gradient-to-br from-orange-400 to-amber-600 text-black text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                    >
                        <LayoutGrid className="w-4 h-4" />
                        <span>MONTADOR</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onOpenFolder}
                        className="flex-1 max-w-[160px] flex items-center justify-center gap-2 py-2.5 bg-black border border-white/10 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:border-white/30 hover:text-white transition-all font-mono"
                    >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>PASTA</span>
                    </motion.button>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex gap-6 mt-4 text-[9px] uppercase tracking-[0.2em]"
                >
                    <span className="text-cyan-900/60 border-r border-cyan-900/20 pr-6">{aspectRatio}</span>
                    <span className="text-cyan-900/60 border-r border-cyan-900/20 pr-6">8K SCALE</span>
                    <span className="text-cyan-900/60">300 DPI</span>
                </motion.div>
            </div>
        </motion.div>
    );
}
