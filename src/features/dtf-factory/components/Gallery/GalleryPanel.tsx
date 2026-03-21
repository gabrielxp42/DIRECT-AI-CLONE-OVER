

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Image as ImageIcon, Trash2, X, Search, FolderOpen,
    Clock, Sparkles, Grid3x3, ChevronDown, ExternalLink, Loader2, Maximize2, Folder, Minus, Move, ZoomIn, ZoomOut, RotateCcw, Moon, Grid, Sun, Sliders, Save, Check, Palette, Layers, CheckSquare, Square, Brush
} from 'lucide-react';
import {
    GalleryItem, getGalleryItems, removeGalleryItem, updateGalleryItem,
    clearGallery, formatTimestamp, syncWithFiles
} from '@dtf/services/galleryService';
import { electronBridge } from '@dtf/lib/electronBridge';
import { fetchWithRetry } from '../../lib/imageUtils';
import InpaintingEditor from '@dtf/components/InpaintingEditor';

interface GalleryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenHalftone?: (imageUrl: string, garmentMode: 'black' | 'white' | 'color', item: GalleryItem) => void;
    onStartInpainting?: (prompt: string, originalBase64: string, maskBase64: string, item: GalleryItem) => void;
    refreshTrigger?: number; // New prop for external refresh
    isProMode?: boolean; // Controle de features PRO
}

export default function GalleryPanel({ isOpen, onClose, onOpenHalftone, onStartInpainting, refreshTrigger = 0, isProMode = false }: GalleryPanelProps) {
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [search, setSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
    const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
    
    // Multi-selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSendingBatch, setIsSendingBatch] = useState(false);

    // Auto-refresh trigger
    const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);
    const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);

    // Full Screen Preview State
    const [fullScreenItem, setFullScreenItem] = useState<GalleryItem | null>(null);
    const [highResImage, setHighResImage] = useState<string | null>(null);
    const [loadingHighRes, setLoadingHighRes] = useState(false);

    // Load gallery items and Sync
    useEffect(() => {
        if (isOpen) {
            console.log('[Gallery] Loading items (Trigger:', refreshTrigger, ')');
            setItems(getGalleryItems());

            // Sync with physical folder
            if (electronBridge.isElectron && electronBridge.scanOriginalsFolder) {
                electronBridge.scanOriginalsFolder().then(res => {
                    if (res.success && res.files) {
                        const count = syncWithFiles(res.files);
                        if (count > 0) {
                            setItems(getGalleryItems()); // Reload
                        }
                    }
                }).catch(err => console.error('Gallery sync error:', err));
            }
        }
    }, [isOpen, refreshTrigger, localRefreshTrigger]); // Add local refresh trigger dependency

    // Handle Escape Key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (fullScreenItem) setFullScreenItem(null);
                else onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, fullScreenItem, onClose]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Update selectedItem if it changes in the list (e.g. via Sync)
    useEffect(() => {
        if (selectedItem) {
            const fresh = items.find(i => i.id === selectedItem.id);
            if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedItem)) {
                console.log('[Gallery] Refreshing selected item from sync');
                setSelectedItem(fresh);
            }
        }
    }, [items, selectedItem]);

    // Full Screen Image Loader
    useEffect(() => {
        if (fullScreenItem) {
            setLoadingHighRes(true);
            setHighResImage(null);

            const loadHighRes = async () => {
                try {
                    // Prefer savedPath (Final Art) for preview
                    const path = fullScreenItem.savedPath || fullScreenItem.masterFilePath;
                    if (path) {
                        const res = await electronBridge.readImageFile(path);
                        if (res.success && res.data) {
                            setHighResImage(res.data);
                        } else {
                            setHighResImage(fullScreenItem.thumbnail); // Fallback to thumbnail
                        }
                    } else {
                        setHighResImage(fullScreenItem.thumbnail);
                    }
                } catch (e) {
                    console.error("Failed to load high res image", e);
                    setHighResImage(fullScreenItem.thumbnail);
                } finally {
                    setLoadingHighRes(false);
                }
            };
            loadHighRes();
        }
    }, [fullScreenItem]);

    // Filtered items
    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter(
            item => item.prompt.toLowerCase().includes(q) ||
                item.aspectRatio.includes(q) ||
                item.garmentMode.includes(q)
        );
    }, [items, search]);

    const handleDelete = useCallback((id: string) => {
        removeGalleryItem(id);
        setItems(prev => prev.filter(i => i.id !== id));
        if (selectedItem?.id === id) setSelectedItem(null);
    }, [removeGalleryItem, selectedItem]);

    const detailContent = useCallback((item: GalleryItem) => (
        <div className="space-y-4">
            <div className="group relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '10px 10px' }}
                />
                <img
                    src={item.thumbnail}
                    alt={item.prompt}
                    className="w-full h-auto object-contain max-h-[320px] relative z-10"
                />

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 cursor-pointer"
                    onClick={() => setFullScreenItem(item)}>
                    <div className="flex flex-col items-center gap-2 text-white scale-90 group-hover:scale-100 transition-transform">
                        <Maximize2 size={32} />
                        <span className="text-xs font-bold">Ver Tela Cheia</span>
                    </div>
                </div>
            </div>

            <div>
                <label className="text-[9px] uppercase tracking-wider text-white/25 font-bold">Prompt</label>
                <p className="text-xs text-white/80 mt-1 leading-relaxed bg-white/5 rounded-lg p-3">
                    {item.prompt || '—'}
                </p>
            </div>

            <div>
                <label className="text-[9px] uppercase tracking-wider text-white/25 font-bold">Arquivo Final</label>
                <p className="text-[10px] text-white/50 mt-1 font-mono truncate select-all cursor-text bg-black/20 p-1.5 rounded border border-white/5">
                    {item.savedPath?.split(/[/\\]/).pop() || '—'}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <MetaBox label="Aspect Ratio" value={item.aspectRatio} />
                <MetaBox label="Camiseta" value={item.garmentMode === 'white' ? '⬜ Branca' : item.garmentMode === 'color' ? '🎨 Colorida' : '⬛ Preta'} />
                <MetaBox label="Tamanho" value={`${item.widthCm} × ${item.heightCm} cm`} />
                <MetaBox label="Halftone" value={item.halftonePreset} />
                <MetaBox label="Data" value={new Date(item.timestamp).toLocaleString('pt-BR')} />
                {item.upscaleFactor !== undefined && (
                    <MetaBox label="Upscale" value={item.upscaleFactor === 0 ? 'Pulado ⚡' : `${item.upscaleFactor}x`} />
                )}
            </div>

            <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                    {item.savedPath && (
                        <button
                            onClick={() => electronBridge.showItemInFolder(item.savedPath!)}
                            className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <FolderOpen size={14} />
                            Pasta Final
                        </button>
                    )}
                    {item.masterFilePath && (
                        <button
                            onClick={() => electronBridge.showItemInFolder(item.masterFilePath!)}
                            className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Folder size={14} />
                            Pasta Original
                        </button>
                    )}
                </div>

                <OpenHalftoneButton
                    item={item}
                    onOpen={onOpenHalftone}
                />

                {isProMode ? (
                    <button
                        onClick={() => setEditingItem(item)}
                        className="w-full py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 hover:text-purple-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Brush size={14} />
                        Editar Imagem (Inpainting)
                    </button>
                ) : (
                    <button
                        disabled
                        title="Recurso exclusivo do Plano PRO"
                        className="w-full py-2.5 bg-white/5 border border-white/5 text-white/30 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                        <Brush size={14} className="opacity-50" />
                        Editar Imagem (PRO)
                    </button>
                )}

                <SendToMontadorButton item={item} />

                <button
                    onClick={() => handleDelete(item.id)}
                    className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 text-red-400/60 hover:text-red-400 text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={14} />
                    Remover
                </button>
            </div>
        </div>
    ), [handleDelete, isProMode, onOpenHalftone, setFullScreenItem]);

    const handleClearAll = useCallback(() => {
        clearGallery();
        setItems([]);
        setSelectedItem(null);
        setSelectedIds(new Set());
        setShowConfirmClear(false);
    }, []);

    const toggleSelection = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleBatchSend = async () => {
        if (selectedIds.size === 0) return;
        setIsSendingBatch(true);

        const pathsToSend: string[] = [];
        selectedIds.forEach(id => {
            const item = items.find(i => i.id === id);
            // In Web, prefer treatedUrl (halftone-treated image) over masterUrl (raw)
            const path = electronBridge.isElectron
                ? (item?.savedPath || item?.masterFilePath || item?.treatedUrl || item?.masterUrl || item?.thumbnail)
                : (item?.treatedUrl || item?.masterUrl || item?.thumbnail || item?.savedPath);
            if (path) {
                pathsToSend.push(path);
            }
        });

        const verifiedPaths: string[] = [];
        const currentGallery = items; // Capture current items for fallback

        // Validate blobs
        for (const path of pathsToSend) {
            if (path.startsWith('blob:')) {
                try {
                    const res = await fetch(path);
                    if (!res.ok) throw new Error();
                    verifiedPaths.push(path);
                } catch (err) {
                    // Find matching item's thumbnail
                    const item = currentGallery.find(g => g.masterUrl === path);
                    if (item && item.thumbnail) {
                        verifiedPaths.push(item.thumbnail);
                    }
                }
            } else {
                verifiedPaths.push(path);
            }
        }

        if (verifiedPaths.length === 0) {
            setSelectedIds(new Set()); // Clear selection if no valid paths
            setIsSendingBatch(false);
            return;
        }

        if (electronBridge.launchMontador) {
            try {
                const res = await electronBridge.launchMontador(verifiedPaths);
                if (res.success) {
                    console.log(`[Gallery] Batch enviado com sucesso (${verifiedPaths.length} imagens)`);
                    setTimeout(() => {
                        setSelectedIds(new Set());
                        setIsSendingBatch(false);
                    }, 500);
                } else {
                    console.error('[Gallery] Batch Falhou:', res.error);
                    setIsSendingBatch(false);
                }
            } catch (e) {
                console.error('[Gallery] Erro no batch:', e);
                setIsSendingBatch(false);
            }
        } else {
            setIsSendingBatch(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col"
            >
                {/* ═══ Header ═══ */}
                <div className="flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-4 border-b border-white/5 bg-black/60 pt-safe-top md:pt-11 gap-4 md:gap-0">
                    
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hidden md:block">
                                <FolderOpen size={24} />
                            </div>
                            <div className="flex-1 md:flex-none">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="md:hidden text-cyan-400"><FolderOpen size={20} /></span>
                                    Galeria de Finais
                                </h2>
                                <p className="text-xs text-white/40">{items.length} gerações salvas</p>
                            </div>
                        </div>
                        
                        {/* Mobile Close Button (Top Right) */}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/5 text-white/60 md:hidden"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto hidden md:flex">
                        <div className="relative flex-1 md:w-64 group"> 
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-white/20"
                            />
                        </div>

                        {items.length > 0 && (
                            <button
                                onClick={() => setShowConfirmClear(true)}
                                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors whitespace-nowrap text-xs md:text-sm flex items-center gap-1 ml-auto md:ml-0"
                                title="Limpar tudo"
                            >
                                <Trash2 size={16} />
                                <span className="hidden md:inline">Limpar tudo</span>
                            </button>
                        )}
                        
                        <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />

                        <button
                            onClick={() => electronBridge.openFolder()}
                            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all text-xs font-medium"
                            title="Abrir pasta de saídas (Prints)"
                        >
                            <FolderOpen size={16} />
                            Ver na pasta
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors hidden md:block"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* ═══ Content ═══ */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pb-28 md:pb-5">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                    <ImageIcon size={36} className="text-white/20" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white/40">
                                        {search ? 'Nenhum resultado encontrado' : 'Galeria vazia'}
                                    </p>
                                    <p className="text-xs text-white/20 mt-1">
                                        {search ? 'Tente outro termo de busca' : 'Suas gerações aparecerão aqui automaticamente'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {filtered.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        onClick={() => setSelectedItem(item)}
                                        className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all duration-700 hover:scale-[1.02] ${recentlySavedId === item.id
                                            ? 'border-yellow-400 ring-2 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] z-20 scale-[1.03]'
                                            : selectedIds.has(item.id) 
                                                ? 'border-amber-500/80 ring-2 ring-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                                                : selectedItem?.id === item.id
                                                    ? 'border-cyan-500/50 ring-1 ring-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/10'
                                                    : 'border-white/5 hover:border-white/15 hover:shadow-lg hover:shadow-white/5'
                                            }`}
                                    >
                                        {/* Thumbnail force 3:4 aspect for DTF vertical style */}
                                        <div className="aspect-[3/4] bg-black/40 relative overflow-hidden">
                                            <img
                                                src={item.thumbnail}
                                                alt={item.prompt}
                                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                                loading="lazy"
                                            />
                                            {/* Overlay on hover */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                            {/* Corner Icon indicating it's final (transparent bg usually) -> Repurposed to Checkbox */}
                                            <div 
                                                className="absolute top-2 left-2 z-10"
                                                onClick={(e) => toggleSelection(e, item.id)}
                                            >
                                                {selectedIds.has(item.id) ? (
                                                    <div className="w-5 h-5 rounded flex items-center justify-center bg-amber-500 text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-110">
                                                        <CheckSquare size={14} strokeWidth={3} />
                                                    </div>
                                                ) : (
                                                    <div className="w-5 h-5 rounded flex items-center justify-center bg-black/40 backdrop-blur border border-white/20 text-white/50 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:border-white/60 hover:text-white">
                                                        <Square size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Info bar */}
                                        <div className="p-2.5 bg-white/[0.03]">
                                            <p className="text-[10px] text-white/60 truncate leading-tight">
                                                {item.prompt || 'Sem prompt'}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/80 font-mono">
                                                    {item.aspectRatio}
                                                </span>
                                                <span className="text-[8px] text-white/20">
                                                    {formatTimestamp(item.timestamp)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Delete button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                            className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ═══ Detail Sidebar ═══ */}
                    <AnimatePresence>
                        {!!selectedItem && !isMobile && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 360, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="border-l border-white/5 bg-white/[0.02] overflow-hidden flex flex-col"
                            >
                                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                                    {detailContent(selectedItem)}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {!!selectedItem && isMobile && (
                            <motion.div
                                initial={{ y: 40, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 40, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                                className="fixed inset-x-0 bottom-0 top-24 z-[55] bg-black/85 backdrop-blur-xl border-t border-white/10 rounded-t-3xl overflow-hidden flex flex-col"
                            >
                                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                                            <Grid3x3 size={18} className="text-cyan-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Detalhes</div>
                                            <div className="text-[10px] text-white/40">{formatTimestamp(selectedItem.timestamp)}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-28">
                                    {detailContent(selectedItem)}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ═══ Batch Send Floating Bar ═══ */}
                <AnimatePresence>
                    {selectedIds.size > 0 && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 p-2.5 rounded-2xl shadow-2xl flex items-center gap-4 z-[60]"
                        >
                            <div className="flex items-center gap-2 pl-2">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold ring-1 ring-amber-500/50">
                                    {selectedIds.size}
                                </div>
                                <span className="text-sm text-white/80 font-medium">selecionadas</span>
                            </div>

                            <div className="h-6 w-px bg-white/10" />

                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="text-xs text-white/40 hover:text-white/80 px-2 py-1 transition-colors"
                            >
                                Limpar
                            </button>

                            <button
                                onClick={handleBatchSend}
                                disabled={isSendingBatch}
                                className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isSendingBatch ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                                {isSendingBatch ? 'Enviando...' : `Enviar p/ Montador`}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Confirm Clear Modal */}
                <AnimatePresence>
                    {showConfirmClear && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                            onClick={() => setShowConfirmClear(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4"
                            >
                                <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                    <Trash2 size={24} className="text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Limpar Galeria?</h3>
                                    <p className="text-xs text-white/40 mt-1">
                                        Isso removerá todos os {items.length} registros da galeria. As imagens salvas no disco não serão afetadas.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowConfirmClear(false)}
                                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs rounded-xl"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleClearAll}
                                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl"
                                    >
                                        Limpar Tudo
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══ FULL SCREEN MODAL ═══ */}
                <AnimatePresence>
                    {fullScreenItem && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[70] bg-[#050505]/95 backdrop-blur-xl flex flex-col"
                        // onClick={() => setFullScreenItem(null)} // Removed to prevent closing when panning
                        >
                            {/* Toolbar */}
                            <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/40 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                        <Maximize2 size={20} className="text-cyan-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">{fullScreenItem.prompt || 'Sem título'}</h3>
                                        <p className="text-xs text-white/40 font-mono">
                                            {fullScreenItem.widthCm}x{fullScreenItem.heightCm}cm • {fullScreenItem.halftonePreset}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setFullScreenItem(null)}
                                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Image Container with Zoom/Pan */}
                            <FullScreenImageViewer
                                item={fullScreenItem}
                                imageSrc={highResImage || fullScreenItem.thumbnail}
                                onClose={() => setFullScreenItem(null)}
                                onSaveSuccess={(newItem) => {
                                    setLocalRefreshTrigger(prev => prev + 1);
                                    setFullScreenItem(null); // Fechar o preview
                                    setSelectedItem(newItem); // Focar na nova imagem salva na galeria
                                    setRecentlySavedId(newItem.id); // Destacar com brilho
                                    setTimeout(() => setRecentlySavedId(null), 3000); // Tira o brilho dps de 3s
                                }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══ Inpainting Editor Modal ═══ */}
                <AnimatePresence>
                    {editingItem && (
                        <InpaintingEditor
                            isOpen={true}
                            onClose={() => setEditingItem(null)}
                            originalItem={editingItem}
                            onStartInpainting={(prompt, originalBase64, maskBase64) => {
                                if (onStartInpainting) {
                                    onStartInpainting(prompt, originalBase64, maskBase64, editingItem);
                                    setEditingItem(null); // Fecha o editor
                                    onClose(); // Fecha a galeria para mostrar o processo na Home
                                } else {
                                    console.error("onStartInpainting não definido no GalleryPanel");
                                }
                            }}
                        />
                    )}
                </AnimatePresence>

            </motion.div>
        </AnimatePresence>
    );
}

export interface ColorFilterDef {
    id: string;
    name: string;
    filter: string;
    category: 'Básico' | 'Temperatura' | 'Filme' | 'Urbano' | 'Natureza' | 'Arte';
}

const COLOR_FILTERS: ColorFilterDef[] = [
    // Básicos
    { id: 'normal', name: 'Nenhum', category: 'Básico', filter: '' },
    { id: 'grayscale', name: 'P&B', category: 'Básico', filter: 'grayscale(100%)' },
    { id: 'sepia', name: 'Sépia', category: 'Básico', filter: 'sepia(100%)' },

    // Temperatura e Luz
    { id: 'fogo_toxico', name: 'Chama Tóxica', category: 'Temperatura', filter: 'saturate(300%) hue-rotate(320deg) brightness(80%) contrast(150%)' },
    { id: 'hora_dourada_inv', name: 'Ocaso Invert', category: 'Temperatura', filter: 'sepia(80%) hue-rotate(180deg) saturate(150%) brightness(90%)' },
    { id: 'bioluminescencia', name: 'Biolumen', category: 'Temperatura', filter: 'brightness(60%) contrast(150%) saturate(300%) hue-rotate(90deg)' },
    { id: 'neon_queimado', name: 'Neon Toxic', category: 'Temperatura', filter: 'saturate(300%) hue-rotate(270deg) contrast(150%) brightness(80%)' },

    // Filmes e Químicos
    { id: 'cross_process', name: 'Laboratório', category: 'Filme', filter: 'contrast(130%) saturate(150%) sepia(50%) hue-rotate(45deg)' },
    { id: 'vhs_80s', name: 'VHS 1980', category: 'Filme', filter: 'sepia(50%) saturate(200%) hue-rotate(-20deg) contrast(120%) brightness(90%)' },
    { id: 'fita_velha', name: 'Fita Velha', category: 'Filme', filter: 'grayscale(30%) sepia(60%) saturate(150%) contrast(140%) brightness(80%)' },
    { id: 'cianotipo', name: 'Cianótipo', category: 'Filme', filter: 'grayscale(100%) sepia(100%) hue-rotate(180deg) saturate(300%) contrast(120%)' },

    // Urbano e Digital
    { id: 'cyberpunk', name: 'Blade', category: 'Urbano', filter: 'hue-rotate(180deg) saturate(200%) contrast(120%)' },
    { id: 'vaporwave', name: 'VHS 1987', category: 'Urbano', filter: 'saturate(150%) hue-rotate(290deg) contrast(80%) brightness(110%)' },
    { id: 'glitch', name: 'Terminal', category: 'Urbano', filter: 'sepia(100%) hue-rotate(70deg) saturate(300%) contrast(150%) brightness(80%)' },

    // Natureza e Fenômenos
    { id: 'eclipse', name: 'Eclipse', category: 'Natureza', filter: 'sepia(100%) hue-rotate(-15deg) saturate(250%) contrast(150%) brightness(70%)' },
    { id: 'fundo_mar', name: 'Abissal', category: 'Natureza', filter: 'sepia(50%) hue-rotate(150deg) saturate(120%) contrast(90%) brightness(80%)' },
    { id: 'chernobyl', name: 'Fallout', category: 'Natureza', filter: 'grayscale(80%) sepia(50%) hue-rotate(70deg) contrast(130%) brightness(90%)' },

    // Artísticos
    { id: 'duotone', name: 'Duotone', category: 'Arte', filter: 'grayscale(100%) sepia(100%) hue-rotate(20deg) saturate(400%) contrast(150%)' },
    { id: 'cinematic', name: 'Filme Arruinado', category: 'Arte', filter: 'saturate(50%) sepia(40%) contrast(160%) brightness(70%) hue-rotate(-10deg)' },
    { id: 'lavado', name: 'Sol Lavado', category: 'Arte', filter: 'saturate(60%) sepia(30%) contrast(90%) brightness(120%)' },
    { id: 'veludo', name: 'Veludo', category: 'Arte', filter: 'contrast(150%) saturate(150%) sepia(30%) hue-rotate(320deg) brightness(70%)' },
];

// Sub-component for Full Screen Image Logic to keep main component clean
function FullScreenImageViewer({ item, imageSrc, onClose, onSaveSuccess }: { item: GalleryItem, imageSrc: string, onClose: () => void, onSaveSuccess?: (newItem: GalleryItem) => void }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [bgMode, setBgMode] = useState<'black' | 'white' | 'transparent'>('transparent');

    const [colorFilter, setColorFilter] = useState('');
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const filterStyle = `${colorFilter} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`.trim();

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        if (e.deltaY < 0) {
            setZoom(z => Math.min(z + 0.25, 32)); // Zoom In Max 32x
        } else {
            setZoom(z => {
                const newZoom = Math.max(z - 0.25, 0.5); // Zoom Out
                if (newZoom <= 1) setPan({ x: 0, y: 0 }); // Reset pan if zoomed out
                return newZoom;
            });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setLastMousePos({ x: e.clientX, y: e.clientY });
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Load original image
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = imageSrc;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            // Draw to offscreen canvas
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get context");

            // Apply filter context
            ctx.filter = filterStyle;
            ctx.drawImage(img, 0, 0);

            // Convert back to blob
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
            if (!blob) throw new Error("Could not convert to blob");

            // Apply DPI
            const { setPngDpi } = await import('@dtf/services/halftoneService');
            const finalBlob = await setPngDpi(blob, 300);

            // Save via electron
            const buffer = await finalBlob.arrayBuffer();
            const filename = `dtf-filter-${Date.now()}.png`;

            const result = await electronBridge.saveImage(buffer, filename);

            if (result.success) {
                // Update gallery item
                const { saveGalleryItem, createThumbnail } = await import('@dtf/services/galleryService');
                const thumbDataUrl = URL.createObjectURL(finalBlob);
                const thumbnail = await createThumbnail(thumbDataUrl);
                URL.revokeObjectURL(thumbDataUrl);

                const newItemBase = {
                    prompt: item.prompt + ' (Filtros)',
                    timestamp: Date.now(),
                    savedPath: result.path || filename,
                    masterFilePath: item.masterFilePath,
                    thumbnail,
                    aspectRatio: item.aspectRatio,
                    garmentMode: item.garmentMode,
                    widthCm: item.widthCm,
                    heightCm: item.heightCm,
                    halftonePreset: item.halftonePreset,
                    upscaleFactor: item.upscaleFactor
                };

                const savedItem = saveGalleryItem(newItemBase);

                setSaveSuccess(true);
                setTimeout(() => {
                    setSaveSuccess(false);
                    if (onSaveSuccess) onSaveSuccess(savedItem);
                }, 1000); // Dá um segundo para ver o feedback 'Salvo!' antes de fechar
            }
        } catch (error) {
            console.error("Filter Save Error:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            className={`flex-1 overflow-hidden flex items-center justify-center p-0 relative ${bgMode === 'white' ? 'bg-white' : bgMode === 'transparent' ? 'bg-[#666666]' : 'bg-black'}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            {/* Background Checkerboard for full transparency feel */}
            {bgMode === 'transparent' && (
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#888 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />
            )}

            {/* BG Controls */}
            <div
                className="absolute top-6 left-6 bg-black/60 backdrop-blur rounded-lg p-1 flex gap-1 z-50 border border-white/10"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button
                    onClick={() => setBgMode('black')}
                    className={`p-1.5 rounded ${bgMode === 'black' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'}`}
                    title="Fundo Preto"
                >
                    <Moon size={14} />
                </button>
                <button
                    onClick={() => setBgMode('transparent')}
                    className={`p-1.5 rounded ${bgMode === 'transparent' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'}`}
                    title="Fundo Transparente (Cinza)"
                >
                    <Grid size={14} />
                </button>
                <button
                    onClick={() => setBgMode('white')}
                    className={`p-1.5 rounded ${bgMode === 'white' ? 'bg-white text-black' : 'text-white/40 hover:text-white/80'}`}
                    title="Fundo Branco"
                >
                    <Sun size={14} />
                </button>
            </div>

            <div
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    imageRendering: zoom > 3 ? 'pixelated' : 'auto' // Photoshop-like pixel grid
                }}
                className="max-w-full max-h-full flex items-center justify-center p-8"
            >
                <img
                    src={imageSrc}
                    alt="Full Screen Preview"
                    className="max-w-[80vw] max-h-[90vh] object-contain shadow-2xl rounded-sm pointer-events-none select-none transition-[filter] duration-100"
                    style={{ filter: filterStyle, paddingRight: '280px' }}
                    draggable={false}
                />
            </div>

            {/* Sidebar Filtros */}
            <div
                className={`absolute right-0 top-0 bottom-0 w-80 bg-black/80 backdrop-blur-xl border-l border-white/10 flex flex-col z-[60] p-5 shadow-2xl`}
                onWheel={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Sliders size={18} className="text-cyan-400" />
                        Filtros
                    </h3>
                </div>

                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Lista Vertical de Presets (Scrollável) */}
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-4 space-y-5">
                        {Array.from(new Set(COLOR_FILTERS.map(f => f.category))).map(category => (
                            <div key={category} className="space-y-2">
                                <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider sticky top-0 bg-black/80 py-1 z-10 backdrop-blur-sm">{category}</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {COLOR_FILTERS.filter(f => f.category === category).map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => {
                                                setColorFilter(preset.filter);
                                                setBrightness(100);
                                                setContrast(100);
                                                setSaturation(100);
                                            }}
                                            className={`relative flex flex-col items-center gap-1.5 group transition-all`}
                                            title={preset.name}
                                        >
                                            <div
                                                className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 ${colorFilter === preset.filter
                                                    ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-105'
                                                    : 'border-white/10 group-hover:border-white/40 bg-white/5'
                                                    }`}
                                            >
                                                <img
                                                    src={item.thumbnail || imageSrc}
                                                    alt={preset.name}
                                                    className="w-full h-full object-cover"
                                                    style={{ filter: preset.filter || 'none' }}
                                                    draggable={false}
                                                />
                                            </div>
                                            <span className={`text-[9px] font-medium text-center leading-tight w-full truncate px-1 ${colorFilter === preset.filter ? 'text-cyan-400' : 'text-white/50 group-hover:text-white/80'
                                                }`}>
                                                {preset.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="h-px bg-white/10 w-full my-4 flex-shrink-0" />

                    {/* Ajustes Manuais Fixos no Fundo */}
                    <div className="flex-shrink-0 space-y-4 pb-2">
                        <div className="space-y-3">
                            <div className="flex justify-between items-end text-xs text-white/60">
                                <label className="font-bold uppercase tracking-wider text-white/40 text-[10px]">Brilho</label>
                                <span className="font-mono text-cyan-400">{brightness}%</span>
                            </div>
                            <input type="range" min="0" max="200" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-end text-xs text-white/60">
                                <label className="font-bold uppercase tracking-wider text-white/40 text-[10px]">Contraste</label>
                                <span className="font-mono text-cyan-400">{contrast}%</span>
                            </div>
                            <input type="range" min="0" max="200" value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-end text-xs text-white/60">
                                <label className="font-bold uppercase tracking-wider text-white/40 text-[10px]">Saturação</label>
                                <span className="font-mono text-cyan-400">{saturation}%</span>
                            </div>
                            <input type="range" min="0" max="200" value={saturation} onChange={e => setSaturation(Number(e.target.value))} className="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                        </div>

                        <button onClick={() => { setColorFilter(''); setBrightness(100); setContrast(100); setSaturation(100); }} className="mt-2 text-[11px] text-white/40 hover:text-white transition flex items-center gap-1.5 w-full justify-center py-2 bg-white/5 hover:bg-white/10 rounded-xl font-bold uppercase tracking-wider">
                            <RotateCcw size={14} /> Resetar Filtros
                        </button>
                    </div>
                </div>

                <div className="mt-2 pt-4 border-t border-white/10 flex-shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || (colorFilter === '' && brightness === 100 && contrast === 100 && saturation === 100)}
                        className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:opacity-90 disabled:opacity-50 disabled:grayscale rounded-xl font-bold flex items-center justify-center gap-2 text-sm text-white transition-all shadow-lg shadow-cyan-900/30"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : (saveSuccess ? <Check size={16} /> : <Save size={16} />)}
                        {isSaving ? 'Salvando...' : (saveSuccess ? 'Salvo!' : 'Salvar Filtros')}
                    </button>
                </div>
            </div>

            {/* Zoom Controls Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-[calc(50%+144px)] flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-50">
                <button
                    onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))}
                    className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors"
                    title="Diminuir Zoom"
                >
                    <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono w-12 text-center text-white/90 font-bold">{Math.round(zoom * 100)}%</span>
                <button
                    onClick={() => setZoom(z => Math.min(z + 0.5, 32))} // Increased Max Zoom
                    className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors"
                    title="Aumentar Zoom"
                >
                    <ZoomIn size={16} />
                </button>
                <div className="w-px h-4 bg-white/20 mx-1" />
                <button
                    onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                    className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors flex items-center gap-1"
                    title="Resetar visualização"
                >
                    <RotateCcw size={14} />
                </button>
            </div>

            {/* Close Hint */}


            {/* Pan Hint */}
            <div className="absolute top-6 left-6 z-40 bg-black/30 text-white/30 px-3 py-1.5 rounded-full text-[10px] backdrop-blur border border-white/5 pointer-events-none flex items-center gap-2">
                <Move size={12} />
                Arraste para mover • Scroll para Zoom
            </div>
        </div>
    );
}

// Small metadata box
function MetaBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
            <label className="text-[8px] uppercase tracking-wider text-white/20 font-bold">{label}</label>
            <p className="text-[11px] text-white/70 mt-0.5 font-medium truncate">{value}</p>
        </div>
    );
}

function OpenHalftoneButton({ item, onOpen }: { item: GalleryItem, onOpen?: (url: string, mode: 'black' | 'white' | 'color', item: GalleryItem) => void }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // If no handler, don't show button
    if (!onOpen) return null;

    const handleClick = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const isWebUrl = (value: string | null | undefined) => {
                if (!value) return false;
                return value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:');
            };

            const webSourceUrl =
                item.masterUrl ||
                (isWebUrl(item.masterFilePath ?? null) ? (item.masterFilePath as string) : null) ||
                (isWebUrl(item.savedPath) ? (item.savedPath as string) : null) ||
                item.thumbnail ||
                null;

            const localPath = item.masterFilePath || item.savedPath;
            const isMaster = !!item.masterFilePath;

            if (!electronBridge.isElectron) {
                if (!webSourceUrl) {
                    setError('Arquivo perdido.');
                    return;
                }

                try {
                    const blob = await fetchWithRetry(webSourceUrl, 2, 350);
                    const objectUrl = URL.createObjectURL(blob);
                    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10 * 60 * 1000);
                    onOpen(objectUrl, item.garmentMode, item);
                } catch {
                    onOpen(webSourceUrl, item.garmentMode, item);
                }
                return;
            }

            if (localPath) {
                console.log('[Gallery] Loading image from:', localPath);
                let result = await electronBridge.readImageFile(localPath);

                if (result.success && result.data) {
                    // Check if auto-recovered by Main process
                    if (result.recoveredPath) {
                        console.log('[Gallery] 🟢 Path auto-recovered by Main:', result.recoveredPath);
                        if (isMaster) {
                            updateGalleryItem(item.id, { masterFilePath: result.recoveredPath });
                            item.masterFilePath = result.recoveredPath;
                        } else {
                            updateGalleryItem(item.id, { savedPath: result.recoveredPath });
                            item.savedPath = result.recoveredPath;
                        }
                    }
                    onOpen(result.data, item.garmentMode, item);
                } else {
                    console.error('[Gallery] Failed to read file:', result.error);
                    if (webSourceUrl) {
                        onOpen(webSourceUrl, item.garmentMode, item);
                        return;
                    }
                    setError(`Original não encontrado.\n(${localPath})`);
                }
            } else {
                console.warn('[Gallery] No file path available');
                if (webSourceUrl) {
                    onOpen(webSourceUrl, item.garmentMode, item);
                    return;
                }
                setError('Arquivo perdido.');
            }
        } catch (e) {
            console.error('[Gallery] Error loading image:', e);
            setError('Erro ao carregar.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-1">
            <button
                onClick={handleClick}
                disabled={isLoading}
                className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Grid3x3 size={14} />}
                {isLoading ? 'Carregando Original...' : 'Abrir no Editor Halftone'}
            </button>
            {error && (
                <div className="flex flex-col gap-1 text-[10px] text-red-400 text-center bg-red-500/10 p-2 rounded border border-red-500/20">
                    <p className="font-bold">{error}</p>
                    {onOpen && (
                        <button
                            onClick={() => onOpen(item.thumbnail, item.garmentMode, item)}
                            className="underline hover:text-red-300"
                        >
                            Abrir qualidade baixa (Thumbnail)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function SendToMontadorButton({ item }: { item: GalleryItem }) {
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Show if there's a file to send
    const pathToSend = item.treatedUrl || item.masterFilePath || item.savedPath;
    if (!pathToSend) return null;

    const handleClick = async () => {
        setStatus('sending');
        setErrorMsg(null);

        try {
            const path = electronBridge.isElectron
                ? (item.savedPath || item.masterFilePath || item.treatedUrl || item.masterUrl || item.thumbnail)
                : (item.treatedUrl || item.masterUrl || item.thumbnail || item.savedPath);

            let finalPath = path;

            if (finalPath && finalPath.startsWith('blob:')) {
                try {
                    const res = await fetch(finalPath);
                    if (!res.ok) throw new Error("Blob URL not accessible");
                } catch (err) {
                    // Blob expired (common in web fallback after reload). Use thumbnail.
                    console.warn("Blob URL expired or inaccessible, falling back to thumbnail.");
                    finalPath = item.thumbnail;
                }
            }

            if (!finalPath) {
                throw new Error("No valid path to send.");
            }

            const result = await electronBridge.launchMontador(finalPath);

            if (result.success) {
                console.log('[Gallery] Imagem enviada ao Montador:', finalPath);
                setStatus('sent');
                setTimeout(() => setStatus('idle'), 2500);
            } else {
                console.error('[Gallery] Montador error:', result.error);
                setStatus('error');
                setErrorMsg(result.error || 'Erro ao abrir Montador');
            }
        } catch (e) {
            console.error('[Gallery] Montador launch failed:', e);
            setStatus('error');
            setErrorMsg('Falha ao iniciar o Montador');
        }
    };

    return (
        <div className="space-y-1">
            <button
                onClick={handleClick}
                disabled={status === 'sending'}
                className={`w-full py-2.5 border text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                    status === 'sent'
                        ? 'bg-green-500/15 border-green-500/30 text-green-400'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 text-amber-400 hover:text-amber-300'
                }`}
            >
                {status === 'sending' && <Loader2 size={14} className="animate-spin" />}
                {status === 'sent' && <Check size={14} />}
                {(status === 'idle' || status === 'error') && <Layers size={14} />}
                {status === 'sending' ? 'Abrindo Montador...' : status === 'sent' ? 'Enviado!' : 'Enviar p/ Montador'}
            </button>
            {status === 'error' && errorMsg && (
                <p className="text-[10px] text-red-400 text-center bg-red-500/10 p-1.5 rounded border border-red-500/20 font-medium">
                    {errorMsg}
                </p>
            )}
        </div>
    );
}
