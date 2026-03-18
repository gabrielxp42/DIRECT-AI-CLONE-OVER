

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Sliders, Check, RotateCcw, ZoomIn, Move, Circle, Square, Triangle, Diamond, Grip, X, Hash, Minus, Sparkles, Loader2, Link2, Link2Off, Monitor, Sun, Moon, RefreshCw, MousePointerClick, Grid, ChevronRight, ChevronDown } from 'lucide-react';
import { HALFTONE_PRESETS, HalftoneSettings, HalftoneLevels, applyHalftoneToBlob } from '@dtf/services/halftoneService';
import { halftoneWorkerCode } from '@dtf/workers/halftoneWorker';
import { fetchWithRetry } from '@dtf/lib/imageUtils';

interface HalftoneSelectorProps {
    imageUrl: string;
    onApply: (preset: string, settings: HalftoneSettings, resizedBlob?: Blob) => void;
    onBack?: () => void;
    garmentMode?: 'black' | 'white' | 'color';
    mode?: 'widget' | 'fullscreen'; // New prop for layout mode
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('HalftoneSelector Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center text-red-400 bg-red-900/10 border border-red-500/20 rounded-xl m-4">
                    <h2 className="text-lg font-bold mb-2">Ops! Algo deu errado.</h2>
                    <p className="text-xs text-white/60 mb-4 max-w-md break-words font-mono bg-black/40 p-2 rounded">
                        {this.state.error?.message || 'Erro desconhecido'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-bold rounded-lg transition-colors text-xs"
                    >
                        Tentar Novamente
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function HalftoneSelectorOriginal({ imageUrl, onApply, onBack, garmentMode, mode = 'widget' }: HalftoneSelectorProps) {
    const [selectedPreset, setSelectedPreset] = useState('halftone_medio_preto');
    const [advancedMode, setAdvancedMode] = useState(false);

    // Safety check for initialization
    const [customSettings, setCustomSettings] = useState<HalftoneSettings>(() => {
        try {
            const initialPreset = (garmentMode === 'white' && HALFTONE_PRESETS['white_shirt']) ? 'white_shirt' : 'halftone_medio_preto';
            return { ...(HALFTONE_PRESETS[initialPreset]?.settings || HALFTONE_PRESETS['default']?.settings || HALFTONE_PRESETS['halftone_medio_preto'].settings) };
        } catch (e) {
            console.error('Failed to init settings:', e);
            return { ...HALFTONE_PRESETS['default'].settings };
        }
    });

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [workerError, setWorkerError] = useState<string | null>(null);
    const [step, setStep] = useState<'setup' | 'preview'>('setup');

    // Cache da imagem original para não fazer fetch repetido
    const [sourceBitmap, setSourceBitmap] = useState<ImageBitmap | null>(null);
    const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);

    // Controlled inputs for Setup
    const [setupWidthCm, setSetupWidthCm] = useState(0);
    const [setupHeightCm, setSetupHeightCm] = useState(0);

    // Worker Ref
    const workerRef = useRef<Worker | null>(null);
    const finalPreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const latestJobId = useRef(0);

    // Zoom e Pan state
    const [zoom, setZoom] = useState(mode === 'fullscreen' ? 1 : 2.5);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const previewContainerRef = useRef<HTMLDivElement>(null);

    // New States for Refinements
    const [lockAspect, setLockAspect] = useState(true);
    const [bgMode, setBgMode] = useState<'black' | 'white' | 'transparent'>(garmentMode === 'white' ? 'white' : 'black');

    // Accordion State for Groups (Moved to main scope to persist)
    const [openGroup, setOpenGroup] = useState<'black' | 'white' | null>(garmentMode === 'white' ? 'white' : 'black');

    // Auto-update default behavior (always true logic implemented via effect)

    const lastSettingsRef = useRef<string>('');

    const handleDimensionChange = (dimension: 'width' | 'height', value: number) => {
        if (!sourceBitmap) return;

        // Ensure value is positive
        const safeValue = Math.max(0, value);

        if (dimension === 'width') {
            setSetupWidthCm(safeValue);
            if (lockAspect && safeValue > 0) {
                const ratio = sourceBitmap.width / sourceBitmap.height;
                setSetupHeightCm(parseFloat((safeValue / ratio).toFixed(2)));
            }
        } else {
            setSetupHeightCm(safeValue);
            if (lockAspect && safeValue > 0) {
                const ratio = sourceBitmap.width / sourceBitmap.height;
                setSetupWidthCm(parseFloat((safeValue * ratio).toFixed(2)));
            }
        }
    };

    // 1. Initialize Worker
    useEffect(() => {
        let worker: Worker | null = null;
        let workerUrl: string | null = null;

        try {
            const blob = new Blob([halftoneWorkerCode], { type: 'application/javascript' });
            workerUrl = URL.createObjectURL(blob);
            worker = new Worker(workerUrl);

            workerRef.current = worker;

            worker.onmessage = (e) => {
                const { id, success, blob, error } = e.data;
                // console.log(`Worker Response for Job ${id}:`, { success });

                if (id !== latestJobId.current) return;

                if (success && blob) {
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(prev => {
                        if (prev) URL.revokeObjectURL(prev);
                        return url;
                    });
                    setIsGenerating(false);
                    setWorkerError(null);
                } else {
                    console.error('Worker Error:', error);
                    setIsGenerating(false);
                    setWorkerError(`Erro no processamento: ${error}`);
                }
            };

            workerRef.current.onerror = (err) => {
                console.error("Worker Global Error:", err);
                setIsGenerating(false);
                setWorkerError("Erro crítico no Worker.");
            };

        } catch (e) {
            console.error("Failed to create worker:", e);
            setWorkerError("Falha ao criar Worker.");
        }

        return () => {
            workerRef.current?.terminate();
            if (workerUrl) URL.revokeObjectURL(workerUrl);
        };
    }, []);

    // 2. Load Source Image Once
    useEffect(() => {
        let active = true;
        const loadSource = async () => {
            if (!imageUrl) return;
            try {
                // const res = await fetch(imageUrl);
                // const blob = await res.blob();
                const blob = await fetchWithRetry(imageUrl);
                const bitmap = await createImageBitmap(blob);
                if (active) {
                    setSourceBitmap(bitmap);
                    setSourceBlob(blob);

                    // Initialize dimensions if not set
                    if (setupWidthCm === 0) {
                        setSetupWidthCm(parseFloat((bitmap.width / 118.11).toFixed(4)));
                        setSetupHeightCm(parseFloat((bitmap.height / 118.11).toFixed(4)));
                    }
                }
            } catch (err) {
                console.error('Falha ao carregar imagem fonte:', err);
                setWorkerError('Falha ao carregar imagem fonte.');
            }
        };
        loadSource();
        return () => { active = false; };
    }, [imageUrl]);

    // 3. Hybrid Preview Generator (Always Auto Update on Change)
    useEffect(() => {
        if (!sourceBitmap || !workerRef.current || step !== 'preview') return;

        const settings = advancedMode ? customSettings : (HALFTONE_PRESETS[selectedPreset]?.settings || HALFTONE_PRESETS['default'].settings);
        const settingsStr = JSON.stringify(settings);

        const isSettingsUpdate = settingsStr !== lastSettingsRef.current;
        const isFirstRun = !previewUrl;

        // Update if settings changed or it's the first run
        if (isSettingsUpdate || isFirstRun) {
            lastSettingsRef.current = settingsStr;

            // Debounce slightly to avoid flicker on rapid changes (though slider commits help)
            if (finalPreviewTimeoutRef.current) clearTimeout(finalPreviewTimeoutRef.current);
            if (!isGenerating) setIsGenerating(true);

            finalPreviewTimeoutRef.current = setTimeout(() => {
                const jobId = ++latestJobId.current;
                if (sourceBlob) {
                    workerRef.current?.postMessage({
                        id: jobId,
                        blob: sourceBlob,
                        settings: settings
                    });
                } else {
                    setIsGenerating(false);
                }
            }, 100); // 100ms debounce
        }
    }, [sourceBitmap, sourceBlob, selectedPreset, advancedMode, customSettings, step]);

    const handleApply = () => {
        const settings = advancedMode ? customSettings : (HALFTONE_PRESETS[selectedPreset]?.settings || HALFTONE_PRESETS['default'].settings);
        onApply(selectedPreset, settings, sourceBlob || undefined);
    };

    const handlePresetChange = (presetId: string) => {
        setSelectedPreset(presetId);

        // Auto-switch background for better visualization
        if (presetId.includes('_branco') || presetId === 'white_shirt') {
            setBgMode('white');
        } else if (presetId.includes('_preto') || presetId === 'removeBlack') {
            setBgMode('black');
        }

        if (!advancedMode) {
            const preset = HALFTONE_PRESETS[presetId];
            if (preset) {
                setCustomSettings({ ...preset.settings });
            }
        }
    };

    const handleSettingChange = (key: keyof HalftoneSettings, value: number | boolean | string | HalftoneLevels) => {
        if (garmentMode === 'white' && (key === 'invertInput' || key === 'invertOutput')) return;
        setCustomSettings(prev => ({ ...prev, [key]: value }));
    };

    const resetToPreset = () => {
        const preset = HALFTONE_PRESETS[selectedPreset];
        if (preset) {
            setCustomSettings({ ...preset.settings });
        }
    };

    // Zoom/Pan Handlers
    const handleZoomIn = () => setZoom(z => Math.min(z + 0.5, 32));
    const handleZoomOut = () => {
        setZoom(z => {
            const newZoom = Math.max(z - 0.5, 0.5);
            if (newZoom <= 1 && z > 1) setPanOffset({ x: 0, y: 0 });
            return newZoom;
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            const maxPan = 500 * zoom;
            setPanOffset(prev => ({
                x: Math.max(-maxPan, Math.min(maxPan, prev.x + dx)),
                y: Math.max(-maxPan, Math.min(maxPan, prev.y + dy))
            }));
        }
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);
    const handleWheel = (e: React.WheelEvent) => {
        if (e.deltaY < 0) setZoom(z => Math.min(z + 0.25, 32));
        else setZoom(z => Math.max(z - 0.25, 0.5));
    };

    const presets = Object.entries(HALFTONE_PRESETS).map(([key, value]) => ({
        id: key,
        name: value.name,
        settings: value.settings,
    }));

    // Group Presets Logic
    const blackPresets = presets.filter(p => p.id.includes('_preto') || p.id === 'removeBlack' || p.id === 'default');
    const whitePresets = presets.filter(p => p.id.includes('_branco') || p.id === 'white_shirt');

    // Helper to render preset button
    const renderPresetButton = (preset: typeof presets[0]) => (
        <motion.button
            key={preset.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handlePresetChange(preset.id)}
            className={`relative p-3 rounded-xl border transition-all text-left w-full mb-2 ${selectedPreset === preset.id
                ? 'bg-cyan-500/20 border-cyan-500'
                : 'bg-white/5 border-white/10 hover:border-white/30'
                }`}
        >
            {selectedPreset === preset.id && (
                <Check size={12} className="absolute top-2 right-2 text-cyan-400" />
            )}
            <p className="font-medium text-xs text-white">{preset.name.replace(' (Preto)', '').replace(' (Branco)', '')}</p>
            <p className="text-[10px] text-white/40 mt-0.5">
                {preset.settings.dotSize}px • {preset.settings.angle}° • {preset.id === 'removeBlack' ? 'Remove Preto' : (preset.settings.shape === 'line' ? 'Linha' : preset.settings.shape === 'square' ? 'Quadrado' : preset.settings.shape === 'spiral' ? 'Espiral' : 'Círculo')}
            </p>
        </motion.button>
    );

    const handleResizeSource = async (newW: number, newH: number) => {
        if (!sourceBitmap) return;

        // Optimization: If dimensions are very close to original, skip resizing and use original blob!
        if (sourceBlob && Math.abs(newW - sourceBitmap.width) < 2 && Math.abs(newH - sourceBitmap.height) < 2) {
            console.log('[Halftone] Skipping resize (dimensions match native)');
            setStep('preview');
            // We already have sourceBlob and sourceBitmap set correctly, just move to next step
            return;
        }

        setIsGenerating(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = newW;
            canvas.height = newH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // High Quality Resampling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(sourceBitmap, 0, 0, newW, newH);
                const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                if (blob) {
                    const newBitmap = await createImageBitmap(blob);
                    setSourceBlob(blob);
                    setSourceBitmap(newBitmap);
                    setStep('preview');
                    setIsGenerating(false);
                }
            }
        } catch (e) {
            console.error("Failed to resize:", e);
            setWorkerError("Falha ao redimensionar: " + String(e));
            setIsGenerating(false);
        }
    };

    // --- RENDER COMPONENTS ---

    const renderPreviewArea = () => (
        <div
            ref={previewContainerRef}
            className={`
                relative w-full overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing
                ${mode === 'fullscreen' ? 'h-full rounded-none border-0 shadow-inner' : 'h-full rounded-xl'}
                ${bgMode === 'white' ? 'bg-white' : bgMode === 'transparent' ? 'bg-[#666666]' : 'bg-black'}
            `}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onDragStart={(e) => e.preventDefault()}
        >
            {/* Background Checkerboard for full transparency feel */}
            {bgMode === 'transparent' && (
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#888 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />
            )}

            {isGenerating && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white/80 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-20 border border-white/10">
                    <Loader2 size={12} className="animate-spin text-white" />
                    Processando...
                </div>
            )}
            {workerError && (
                <div className="absolute top-4 left-4 right-4 bg-red-500/80 backdrop-blur text-white text-xs p-3 rounded-lg z-30 text-center border border-red-500/50">
                    {workerError}
                </div>
            )}

            {/* BG Controls */}
            <div
                className="absolute top-4 left-4 bg-black/60 backdrop-blur rounded-lg p-1 flex gap-1 z-20 border border-white/10"
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
                    title="Fundo Transparente"
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

            {/* Scale/Pan Container */}
            <div
                className="w-full h-full flex items-center justify-center transition-transform duration-75"
                style={{
                    transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                    transformOrigin: 'center center'
                }}
            >
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-w-none object-contain pointer-events-none select-none shadow-2xl"
                        style={{
                            maxHeight: mode === 'fullscreen' ? '90%' : '100%',
                            maxWidth: mode === 'fullscreen' ? '90%' : '100%',
                            imageRendering: zoom > 3 ? 'pixelated' : 'auto'
                        }}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                    />
                ) : (
                    <img
                        src={imageUrl}
                        alt="Original"
                        className="max-w-full max-h-full object-contain opacity-50 pointer-events-none select-none"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                    />
                )}
            </div>

            {/* Zoom Controls */}
            <div
                className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/60 backdrop-blur rounded-xl px-3 py-1.5 z-20 border border-white/10"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {sourceBitmap && (
                    <span className="text-[10px] text-white/40 mr-2 border-r border-white/10 pr-2">
                        {sourceBitmap.width}x{sourceBitmap.height}px
                    </span>
                )}
                <button onClick={handleZoomOut} className="text-white/60 hover:text-white px-2 py-1">-</button>
                <span className="text-xs text-cyan-400 min-w-[36px] text-center font-mono">{zoom.toFixed(1)}x</span>
                <button onClick={handleZoomIn} className="text-white/60 hover:text-white px-2 py-1">+</button>
            </div>
        </div>
    );

    const renderControlsArea = () => (
        <div className={`
            flex flex-col 
            ${mode === 'fullscreen' ? 'h-full p-6 bg-[#0a0a0a] border-l border-white/10 w-96' : 'h-[280px] pr-2'}
        `}>
            {mode === 'fullscreen' && (
                <div className="mb-6 pb-4 border-b border-white/5 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-bold text-white">Configurações</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setAdvancedMode(!advancedMode)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${advancedMode ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'border-white/20 text-white/50'
                                }`}
                        >
                            {advancedMode ? 'Avançado' : 'Simples'}
                        </button>
                    </div>
                </div>
            )}

            {/* Header for Widget Mode */}
            {mode === 'widget' && (
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">Configurar Halftone</h2>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setAdvancedMode(!advancedMode)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${advancedMode
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                            : 'bg-white/5 border-white/20 text-white/60'
                            }`}
                    >
                        <Settings2 size={14} />
                        Avançado
                    </motion.button>
                </div>
            )}

            <div className={`flex-1 overflow-y-auto custom-scrollbar ${mode === 'fullscreen' ? 'pr-2' : ''}`}>
                <AnimatePresence mode="wait">
                    {!advancedMode ? (
                        <motion.div
                            key="presets"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-2 pb-2"
                        >
                            {/* Group: Camisetas Pretas */}
                            <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                                <button
                                    onClick={() => setOpenGroup(openGroup === 'black' ? null : 'black')}
                                    className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-white hover:bg-white/5 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Moon size={14} className="text-cyan-400" />
                                        Para Camisetas Pretas
                                    </span>
                                    <ChevronDown size={14} className={`transition-transform ${openGroup === 'black' ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {openGroup === 'black' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-2 pt-0 grid grid-cols-1 gap-1">
                                                {blackPresets.map(renderPresetButton)}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Group: Camisetas Brancas */}
                            <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                                <button
                                    onClick={() => setOpenGroup(openGroup === 'white' ? null : 'white')}
                                    className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-white hover:bg-white/5 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Sun size={14} className="text-yellow-400" />
                                        Para Camisetas Brancas
                                    </span>
                                    <ChevronDown size={14} className={`transition-transform ${openGroup === 'white' ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {openGroup === 'white' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-2 pt-0 grid grid-cols-1 gap-1">
                                                {whitePresets.map(renderPresetButton)}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                        </motion.div>
                    ) : (
                        <motion.div
                            key="advanced"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4 pb-2"
                        >

                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-purple-300 flex items-center gap-1">
                                    <Sliders size={12} />
                                    Parâmetros Avançados
                                </span>
                                <button
                                    onClick={resetToPreset}
                                    className="text-[10px] text-white/40 hover:text-white/60 flex items-center gap-1"
                                >
                                    <RotateCcw size={10} />
                                    Reset
                                </button>
                            </div>

                            {/* Shape Selector (Prominent) */}
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { id: 'circle', label: 'Redondo', icon: Circle },
                                    { id: 'line', label: 'Linha', icon: Minus }, // Using Minus for Line
                                    { id: 'square', label: 'Quadrado', icon: Square },
                                    { id: 'spiral', label: 'Espiral', icon: Hash } // Using Hash for Spiral
                                ].map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleSettingChange('shape', s.id)}
                                        className={`
                                                flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all
                                                ${customSettings.shape === s.id
                                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                                                : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'}
                                            `}
                                    >
                                        <s.icon size={18} strokeWidth={2.5} />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">{s.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Settings Controls */}
                            <div className="space-y-4">
                                <div className="p-3 bg-white/5 rounded-lg space-y-3 border border-white/5">
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Retícula</p>
                                    <SliderControl label="Tamanho Ponto (px)" value={customSettings.dotSize} min={3} max={30} onChange={(v) => handleSettingChange('dotSize', v)} />
                                    <SliderControl label="Ângulo" value={customSettings.angle || 45} min={0} max={90} onChange={(v) => handleSettingChange('angle', v)} />

                                    {/* New Min/Max Controls */}
                                    <div className="pt-2 border-t border-white/5">
                                        <SliderControl
                                            label="Tamanho Mínimo (%)"
                                            value={customSettings.dotMinPercent ?? 10}
                                            min={0} max={100}
                                            onChange={(v) => handleSettingChange('dotMinPercent', v)}
                                        />
                                        <SliderControl
                                            label="Tamanho Máximo (%)"
                                            value={customSettings.dotMaxPercent ?? 100}
                                            min={0} max={100}
                                            onChange={(v) => handleSettingChange('dotMaxPercent', v)}
                                        />
                                    </div>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg space-y-3 border border-white/5">
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Cor & Contraste</p>
                                    {/* UPDATED RANGES FOR BRIGHTNESS AND CONTRAST (-100 to 100) */}
                                    <SliderControl label="Brilho" value={customSettings.brightness} min={-100} max={100} onChange={(v) => handleSettingChange('brightness', v)} />
                                    <SliderControl label="Contraste" value={customSettings.contrast} min={-100} max={100} onChange={(v) => handleSettingChange('contrast', v)} />
                                    <SliderControl label="Saturação" value={customSettings.saturation ?? 0} min={-100} max={100} onChange={(v) => handleSettingChange('saturation', v)} />
                                    <SliderControl label="Preto (Sensibilidade)" value={customSettings.blackSensitivity} min={0} max={100} onChange={(v) => handleSettingChange('blackSensitivity', v)} />
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg space-y-3 border border-white/5">
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Níveis (Entrada)</p>
                                    <SliderControl
                                        label="Ponto Preto (Min)"
                                        value={customSettings.levels?.min ?? 0}
                                        min={0} max={255}
                                        onChange={(v) => handleSettingChange('levels', { min: v, max: customSettings.levels?.max ?? 255 })}
                                    />
                                    <SliderControl
                                        label="Ponto Branco (Max)"
                                        value={customSettings.levels?.max ?? 255}
                                        min={0} max={255}
                                        onChange={(v) => handleSettingChange('levels', { min: customSettings.levels?.min ?? 0, max: v })}
                                    />
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg space-y-3 border border-white/5">
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Avançado</p>
                                    <SliderControl label="Edge Contraction" value={customSettings.edgeContraction ?? 2} min={0} max={5} onChange={(v) => handleSettingChange('edgeContraction', v)} />


                                    {/* Advanced Toggles */}
                                    <div className="flex gap-2 pt-2 border-t border-white/5">
                                        <button
                                            onClick={() => handleSettingChange('invertInput', !customSettings.invertInput)}
                                            disabled={garmentMode === 'white'}
                                            className={`flex-1 py-2 rounded text-[10px] font-bold border transition-colors ${customSettings.invertInput
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                                : 'bg-white/5 border-white/10 text-white/40'}`}
                                        >
                                            Inverter Entrada
                                        </button>
                                        <button
                                            onClick={() => handleSettingChange('invertOutput', !customSettings.invertOutput)}
                                            disabled={garmentMode === 'white'}
                                            className={`flex-1 py-2 rounded text-[10px] font-bold border transition-colors ${customSettings.invertOutput
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                                : 'bg-white/5 border-white/10 text-white/40'}`}
                                        >
                                            Inverter Saída
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Actions Footer */}
            <div className={`mt-4 pt-4 border-t border-white/5 ${mode === 'fullscreen' ? '' : 'flex gap-2'}`}>
                {onBack && mode === 'widget' && (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onBack} className="flex-1 px-4 py-2.5 rounded-xl border border-white/20 text-white/60 text-sm hover:bg-white/5">
                        Voltar
                    </motion.button>
                )}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleApply}
                    disabled={isGenerating}
                    className={`
                        w-full px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-bold shadow-lg disabled:opacity-50
                        ${mode === 'fullscreen' ? 'text-base' : ''}
                    `}
                >
                    {mode === 'fullscreen' ? 'Salvar Alterações' : 'Salvar Halftone'}
                </motion.button>
            </div>
        </div>
    );

    // --- SETUP STEP (Resize) ---
    if (step === 'setup') {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex h-full ${mode === 'fullscreen' ? 'items-center justify-center bg-[#050505]' : 'flex-col p-6'}`}>
                <div className={`max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 space-y-6 ${mode === 'widget' ? 'border-none p-0' : 'shadow-2xl'}`}>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white mb-2">Ajuste de Tamanho</h2>
                        <p className="text-white/40 text-xs">Defina o tamanho físico final para a retícula</p>
                    </div>

                    <div className="flex justify-center my-4 flex-col items-center gap-2">
                        <div className="w-32 h-32 bg-black/40 rounded-xl border border-white/10 flex items-center justify-center p-2 relative">
                            {imageUrl && <img src={imageUrl} className="max-w-full max-h-full object-contain" />}
                            <div className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] text-white/60 font-mono border border-white/10">
                                {sourceBitmap ? `${sourceBitmap.width}x${sourceBitmap.height}px` : <Loader2 size={12} className="animate-spin text-white/50" />}
                            </div>
                        </div>
                        {sourceBitmap && (
                            <div className="text-[10px] text-white/40 text-center">
                                <p>Resolução Nativa: <span className="text-cyan-400">{sourceBitmap.width} × {sourceBitmap.height} px</span></p>
                                <p>Se a imagem for menor que 2000px, a qualidade pode cair.</p>
                            </div>
                        )}
                        {workerError && (
                            <div className="text-[10px] text-red-400 text-center bg-red-500/10 p-2 rounded w-full">
                                {workerError}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-xs text-white/40">Largura (cm)</label>
                            <input
                                id="setup-width"
                                type="number"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono"
                                value={setupWidthCm || ''}
                                onChange={(e) => handleDimensionChange('width', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                            />
                        </div>

                        {/* Lock Button */}
                        <div className="pb-3 flex justify-center">
                            <button
                                onClick={() => setLockAspect(!lockAspect)}
                                className={`p-2 rounded-lg transition-colors ${lockAspect ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/20 hover:text-white/40'}`}
                                title={lockAspect ? "Aspecto Bloqueado" : "Aspecto Livre"}
                            >
                                {lockAspect ? <Link2 size={16} /> : <Link2Off size={16} />}
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-white/40">Altura (cm)</label>
                            <input
                                id="setup-height"
                                type="number"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono"
                                value={setupHeightCm || ''}
                                onChange={(e) => handleDimensionChange('height', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            if (setupWidthCm > 0 && setupHeightCm > 0) {
                                handleResizeSource(Math.round(setupWidthCm * 118.11), Math.round(setupHeightCm * 118.11));
                            }
                        }}
                        disabled={!sourceBitmap || setupWidthCm <= 0}
                        className="w-full py-3 bg-cyan-500 rounded-xl text-black font-bold hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sourceBitmap ? 'Continuar' : 'Carregando Imagem...'}
                    </button>
                    {onBack && mode === 'widget' && <button onClick={onBack} className="w-full py-2 text-white/40 text-xs hover:text-white">Voltar</button>}
                </div>
            </motion.div>
        );
    }

    // --- PREVIEW STEP ---
    // Mode Switching Layout
    if (mode === 'fullscreen') {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-row h-full w-full bg-[#0a0a0a]">
                <div className="flex-1 h-full overflow-hidden relative">
                    {renderPreviewArea()}
                </div>
                {renderControlsArea()}
            </motion.div>
        );
    }

    // Widget Mode
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full p-4 overflow-hidden">
            <div className="flex-shrink-0 mb-3 flex-1 min-h-[200px] relative">
                {renderPreviewArea()}
            </div>
            {renderControlsArea()}
        </motion.div>
    );
}

// Improved Slider Control with Commit-on-Release & Numeric Input
function SliderControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; }) {
    const [localValue, setLocalValue] = useState(value);

    // Sync if prop updates externally
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleCommit = () => {
        if (localValue !== value) {
            onChange(localValue);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = Number(e.target.value);
        if (isNaN(v)) v = min; // basic safety
        setLocalValue(v);
    };

    const handleBlur = () => {
        let v = localValue;
        if (v < min) v = min;
        if (v > max) v = max;
        setLocalValue(v);
        if (v !== value) onChange(v);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
    };

    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/60">{label}</span>
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={localValue}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-12 bg-white/5 border border-white/10 rounded px-1 text-right text-cyan-400 focus:outline-none focus:border-cyan-500 font-mono"
                />
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={localValue}
                onChange={(e) => setLocalValue(Number(e.target.value))}
                onMouseUp={handleCommit}
                onTouchEnd={handleCommit}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 hover:[&::-webkit-slider-thumb]:bg-cyan-400"
            />
        </div>
    );
}

// Export default correctly wrapped
export default function HalftoneSelector(props: HalftoneSelectorProps) {
    return (
        <ErrorBoundary>
            <HalftoneSelectorOriginal {...props} />
        </ErrorBoundary>
    );
}
