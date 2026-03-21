'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Sidebar from './sidebar/Sidebar';
import CanvasPreview from './CanvasPreview';
import { LineConfig } from '@/features/montador/lib/types';
import { getImageDimensions } from '@/features/montador/lib/packingEngine';
import { motion, AnimatePresence } from 'framer-motion';

export default function MontadorInterface() {
    // --- State ---
    const [lines, setLines] = useState<LineConfig[]>([]);
    const [canvasWidthCm, setCanvasWidthCm] = useState(57); // Default width
    const [spacingPx, setSpacingPx] = useState(10); // Global horizontal spacing
    const [spacingYPx, setSpacingYPx] = useState(10); // Global vertical spacing
    const [isFreeMode, setIsFreeMode] = useState(false);
    const [themeColor, setThemeColor] = useState('#f97316'); // Default Orange
    const [smoothing, setSmoothing] = useState(false);
    const [totalHeightCm, setTotalHeightCm] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    
    // Mobile Responsive State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // --- Handlers ---

    const handleAddLine = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Process files sequentially or parallel?
        // Parallel is better for UX
        const newLinesPromises = Array.from(files).map(async (file) => {
            try {
                const { dimensions, croppedImageUrl } = await getImageDimensions(file);
                
                // Initial optimization check (dummy result until CanvasPreview calculates it properly)
                // Actually CanvasPreview handles the packing logic. 
                // We just need to initialize the line structure.
                
                return {
                    id: Math.random().toString(36).substr(2, 9),
                    imageUrl: croppedImageUrl,
                    dimensions: dimensions,
                    result: { success: true, copies: 1, rotation: 0 } as any, // Placeholder
                    yOffset: 0,
                    quantity: 1, // Default quantity for free mode
                    spacingPx: undefined // Inherit global
                } as LineConfig;
            } catch (err) {
                console.error('Error processing image:', err);
                return null;
            }
        });

        const newLines = (await Promise.all(newLinesPromises)).filter(Boolean) as LineConfig[];
        
        setLines(prev => [...prev, ...newLines]);
        
        // Reset input
        e.target.value = '';
        
        // On mobile, maybe close sidebar or keep it open to see result?
        // Let's keep it open so user can adjust settings
    };

    const handleRemoveLine = (id: string) => {
        setLines(prev => prev.filter(l => l.id !== id));
        if (selectedLineId === id) setSelectedLineId(null);
    };

    const handleDuplicateLine = (id: string) => {
        const line = lines.find(l => l.id === id);
        if (line) {
            setLines(prev => {
                // Insert after the original
                const idx = prev.findIndex(l => l.id === id);
                const newLine = { ...line, id: Math.random().toString(36).substr(2, 9) };
                const newLines = [...prev];
                newLines.splice(idx + 1, 0, newLine);
                return newLines;
            });
        }
    };

    const handleRotateLine = (id: string) => {
        // Toggle rotation preference? 
        // packingEngine handles rotation automatically in standard mode.
        // In free mode, we might want to force rotation.
        // For now, let's implement a manual rotation toggle in the line config if needed.
        // But LineConfig stores `result` which comes from packing engine.
        // Maybe we store a `forcedRotation` in LineConfig?
        // For simple implementation, let's assume this rotates 90 degrees in Free Mode.
        if (isFreeMode) {
            setLines(prev => prev.map(l => {
                if (l.id === id) {
                    // Swap dimensions just for logic or store a flag?
                    // Swapping dimensions is easier for the engine to consume as "input dimensions"
                    // But we lose original orientation.
                    // Better to update dimensions.
                    return {
                        ...l,
                        dimensions: {
                            ...l.dimensions,
                            widthCm: l.dimensions.heightCm,
                            heightCm: l.dimensions.widthCm,
                            // Recalculate masks? Mask rotation is complex without re-generating.
                            // Ideally packingEngine handles this. 
                            // Let's just swap w/h for now as a simple rotation.
                        }
                    };
                }
                return l;
            }));
        }
    };

    const handleFillMeter = () => {
        // Logic to duplicate lines until 1m is filled? 
        // Or just duplicate the last line?
        // The sidebar says "Preencher 1 Metro".
        // Let's implement basic duplication of the last line until ~100cm height.
        // This is complex because it depends on packing result.
        // For MVP, let's just duplicate the last line 5 times.
        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const newLines = Array.from({ length: 3 }).map(() => ({
                ...lastLine,
                id: Math.random().toString(36).substr(2, 9)
            }));
            setLines(prev => [...prev, ...newLines]);
        }
    };

    const handleUpdateLineWidth = (id: string, widthCm: number) => {
        setLines(prev => prev.map(l => {
            if (l.id === id) {
                const ratio = l.dimensions.widthCm / l.dimensions.heightCm;
                return {
                    ...l,
                    dimensions: {
                        ...l.dimensions,
                        widthCm: widthCm,
                        heightCm: widthCm / ratio
                    }
                };
            }
            return l;
        }));
    };

    const handleUpdateLineQuantity = (id: string, quantity: number) => {
        setLines(prev => prev.map(l => {
            if (l.id === id) {
                return { ...l, quantity };
            }
            return l;
        }));
    };

    const handleUpdateLineSpacing = (id: string, spacingPx: number) => {
        setLines(prev => prev.map(l => {
            if (l.id === id) {
                return { ...l, spacingPx };
            }
            return l;
        }));
    };

    const handleExport = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsExporting(true);

        try {
            // Wait a bit to ensure UI updates
            await new Promise(r => setTimeout(r, 100));

            // Use the new 300 DPI export method exposed by CanvasPreview
            const blob = await (canvas as any).exportToBlob(300);

            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `montagem-dtf-${new Date().getTime()}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            }
            setIsExporting(false);

        } catch (err) {
            console.error('Export failed', err);
            setIsExporting(false);
        }
    }, []);

    // --- OVERPIXEL BRIDGE ---
    useEffect(() => {
        const checkBridge = async () => {
            // Check window global first (avoids localStorage quota limits for large base64 images)
            let bridgeData: any = null;

            if ((window as any).__OVERPIXEL_BRIDGE__) {
                bridgeData = (window as any).__OVERPIXEL_BRIDGE__;
                delete (window as any).__OVERPIXEL_BRIDGE__;
                console.log('[Montador] Bridge state from window global');
            } else {
                const savedState = localStorage.getItem('OVERPIXEL_BRIDGE_STATE');
                if (savedState) {
                    try {
                        bridgeData = JSON.parse(savedState);
                        console.log('[Montador] Bridge state from localStorage');
                    } catch (e) {
                        console.error('[Montador] Failed to parse localStorage bridge state');
                    }
                    localStorage.removeItem('OVERPIXEL_BRIDGE_STATE');
                }
            }

            if (!bridgeData) return;

            try {
                const { type, data } = bridgeData;
                if (type === 'VETORIZA_TO_MONTADOR') {
                    console.log('[Montador] Received design(s)', data);

                    const imagePaths: string[] = data.images || (data.image ? [data.image] : []);
                    
                    const newLinesPromises = imagePaths.map(async (imagePath) => {
                        try {
                            const res = await fetch(imagePath);
                            const blob = await res.blob();
                            const filename = imagePath.split(/[/\\]/).pop() || "design.png";
                            const file = new File([blob], filename, { type: "image/png" });

                            const { dimensions, croppedImageUrl } = await getImageDimensions(file);
                            
                            return {
                                id: Math.random().toString(36).substr(2, 9),
                                imageUrl: croppedImageUrl,
                                dimensions: dimensions,
                                result: { success: true, copies: 1, rotation: 0 } as any,
                                yOffset: 0,
                                quantity: 1,
                                spacingPx: undefined
                            } as LineConfig;
                        } catch (err) {
                            console.error('[Montador] Error processing image:', imagePath, err);
                            return null;
                        }
                    });

                    const processedLines = (await Promise.all(newLinesPromises)).filter(Boolean) as LineConfig[];
                    if (processedLines.length > 0) {
                        setLines(prev => [...prev, ...processedLines]);
                    }
                }
            } catch (err) {
                console.error('[Montador] Bridge error:', err);
            }
        };

        const timer = setTimeout(checkBridge, 1000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="flex flex-col md:flex-row h-full flex-1 w-full bg-[#050505] text-white overflow-hidden font-sans selection:bg-orange-500/30">
            
            {/* Mobile Backdrop & Modal for Sidebar */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[60] flex flex-col md:hidden bg-[#050505] animate-slide-up">
                    {/* Header */}
                    <div className="flex justify-between items-center px-4 py-4 bg-[#0a0a0a] border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--mr-orange)] to-red-600 flex items-center justify-center shadow-[0_0_10px_rgba(249,115,22,0.3)]">
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-black text-white/90 uppercase tracking-widest">Menu Principal</h2>
                        </div>
                        <button 
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-2 text-white/60 hover:text-white bg-white/5 rounded-full active:scale-95 transition-transform"
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 overflow-hidden relative">
                        {/* Override for Sidebar to fill the modal container and remove borders */}
                        <style>{`
                            .mobile-sidebar-override .mr-sidebar {
                                width: 100% !important;
                                min-width: 100% !important;
                                height: 100% !important;
                                border: none !important;
                                border-radius: 0 !important;
                                box-shadow: none !important;
                                margin: 0 !important;
                            }
                            .mobile-sidebar-override .mr-sidebar-outer-glow,
                            .mobile-sidebar-override .mr-sidebar-border {
                                display: none !important;
                            }
                            .mobile-sidebar-override .mr-sidebar-container {
                                border-radius: 0 !important;
                                background: transparent !important;
                            }
                        `}</style>
                        <div className="mobile-sidebar-override w-full h-full pb-safe">
                            <Sidebar
                                lines={lines}
                                onAddLine={handleAddLine}
                                onRemoveLine={handleRemoveLine}
                                onDuplicateLine={handleDuplicateLine}
                                onRotateLine={handleRotateLine}
                                onFillMeter={handleFillMeter}
                                onUpdateLineWidth={handleUpdateLineWidth}
                                onUpdateLineSpacing={handleUpdateLineSpacing}
                                spacingPx={spacingPx}
                                setSpacingPx={setSpacingPx}
                                spacingYPx={spacingYPx}
                                setSpacingYPx={setSpacingYPx}
                                onExport={handleExport}
                                canExport={lines.length > 0}
                                isExporting={isExporting}
                                maxLines={50}
                                smoothing={smoothing}
                                setSmoothing={setSmoothing}
                                themeColor={themeColor}
                                setThemeColor={setThemeColor}
                                canvasWidthCm={canvasWidthCm}
                                setCanvasWidthCm={setCanvasWidthCm}
                                totalHeightCm={totalHeightCm}
                                isFreeMode={isFreeMode}
                                setIsFreeMode={setIsFreeMode}
                                onUpdateLineQuantity={handleUpdateLineQuantity}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop Sidebar Container */}
            <div className="hidden md:block h-full p-4 md:p-6 z-20">
                <Sidebar
                    lines={lines}
                    onAddLine={handleAddLine}
                    onRemoveLine={handleRemoveLine}
                    onDuplicateLine={handleDuplicateLine}
                    onRotateLine={handleRotateLine}
                    onFillMeter={handleFillMeter}
                    onUpdateLineWidth={handleUpdateLineWidth}
                    onUpdateLineSpacing={handleUpdateLineSpacing}
                    spacingPx={spacingPx}
                    setSpacingPx={setSpacingPx}
                    spacingYPx={spacingYPx}
                    setSpacingYPx={setSpacingYPx}
                    onExport={handleExport}
                    canExport={lines.length > 0}
                    isExporting={isExporting}
                    maxLines={50}
                    smoothing={smoothing}
                    setSmoothing={setSmoothing}
                    themeColor={themeColor}
                    setThemeColor={setThemeColor}
                    canvasWidthCm={canvasWidthCm}
                    setCanvasWidthCm={setCanvasWidthCm}
                    totalHeightCm={totalHeightCm}
                    isFreeMode={isFreeMode}
                    setIsFreeMode={setIsFreeMode}
                    onUpdateLineQuantity={handleUpdateLineQuantity}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative z-10">
                {/* Canvas Area */}
                <div className="flex-1 relative p-0 md:p-6 md:pl-0">
                    <CanvasPreview
                        ref={canvasRef}
                        lines={lines}
                        canvasWidthCm={canvasWidthCm}
                        spacingPx={spacingPx}
                        spacingYPx={spacingYPx}
                        smoothing={smoothing}
                        themeColor={themeColor}
                        setTotalHeightCm={setTotalHeightCm}
                        isFreeMode={isFreeMode}
                        onItemClick={setSelectedLineId}
                        selectedLineId={selectedLineId}
                    />
                </div>

                {/* Quick Edit Widget (Mobile only, shows when an item is selected) */}
                <AnimatePresence>
                    {selectedLineId && lines.find(l => l.id === selectedLineId) && (
                        <motion.div 
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            drag
                            dragMomentum={false}
                            className="md:hidden fixed top-20 left-4 right-4 bg-[#111] border border-[var(--mr-orange)]/50 rounded-2xl p-4 z-50 shadow-[0_10px_40px_rgba(0,0,0,0.8)] touch-none cursor-grab active:cursor-grabbing"
                        >
                            {/* Drag Handle Area (Whole top bar) */}
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-white/30">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                    </svg>
                                    <h3 className="text-white font-bold text-sm tracking-wide uppercase">Editar Estampa</h3>
                                </div>
                                <div className="flex gap-2">
                                    {/* Duplicar Button */}
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDuplicateLine(selectedLineId);
                                        }} 
                                        className="text-white/70 hover:text-[var(--mr-orange)] p-1.5 bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-1 transition-colors"
                                    >
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                    {/* Close Button */}
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedLineId(null);
                                        }} 
                                        className="text-white/50 hover:text-white p-1.5 bg-white/5 rounded-lg"
                                    >
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Sliders Area (Stop drag propagation here so sliders work) */}
                            <div onPointerDown={(e) => e.stopPropagation()}>
                                {/* Largura Slider */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs text-white/70 mb-2">
                                        <span>Largura</span>
                                        <span className="font-bold text-[var(--mr-orange)]">{lines.find(l => l.id === selectedLineId)?.dimensions.widthCm.toFixed(1)} cm</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max={canvasWidthCm} 
                                        step="0.5" 
                                        value={lines.find(l => l.id === selectedLineId)?.dimensions.widthCm} 
                                        onChange={(e) => handleUpdateLineWidth(selectedLineId, Number(e.target.value))}
                                        className="w-full h-1.5 bg-[#ffffff20] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--mr-orange)]"
                                    />
                                </div>

                                {/* Quantidade Slider (apenas no modo livre) */}
                                {isFreeMode && (
                                    <div>
                                        <div className="flex justify-between text-xs text-white/70 mb-2">
                                            <span>Quantidade</span>
                                            <span className="font-bold text-[var(--mr-orange)]">{lines.find(l => l.id === selectedLineId)?.quantity || 1}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max="100" 
                                            step="1" 
                                            value={lines.find(l => l.id === selectedLineId)?.quantity || 1} 
                                            onChange={(e) => handleUpdateLineQuantity(selectedLineId, Number(e.target.value))}
                                            className="w-full h-1.5 bg-[#ffffff20] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--mr-orange)]"
                                        />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Bottom Navigation Bar */}
                <div className="md:hidden h-[72px] bg-[#0a0a0a] border-t border-white/5 z-40 flex items-center justify-around px-2 pb-safe shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                    
                    <label className="flex flex-col items-center justify-center w-20 text-white/60 hover:text-[var(--mr-orange)] cursor-pointer transition-colors">
                        <input type="file" accept="image/*" multiple onChange={handleAddLine} className="hidden" />
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mb-1">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-[10px] font-medium tracking-wide">Adicionar</span>
                    </label>
                    
                    <button 
                        onClick={() => setIsSidebarOpen(true)} 
                        className="flex flex-col items-center justify-center relative -top-5"
                    >
                        <div className="bg-gradient-to-br from-[var(--mr-orange)] to-red-600 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.4)] text-white border-4 border-[#050505] active:scale-95 transition-transform">
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-medium tracking-wide text-white/80 mt-1">Configurar</span>
                    </button>

                    <button 
                        onClick={handleExport} 
                        disabled={lines.length === 0 || isExporting} 
                        className={`flex flex-col items-center justify-center w-20 transition-colors ${lines.length === 0 ? 'text-white/20' : 'text-white/60 hover:text-[var(--mr-orange)]'}`}
                    >
                        {isExporting ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-1 animate-spin text-[var(--mr-orange)]">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" strokeWidth="4" />
                                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" opacity="0.75" />
                            </svg>
                        ) : (
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mb-1">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        )}
                        <span className="text-[10px] font-medium tracking-wide">Exportar</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
