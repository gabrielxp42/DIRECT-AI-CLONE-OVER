import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wand2, Pipette, Undo2, Trash2, Download, Image as ImageIcon, Eraser, Check, Moon, Sun, Grid, ZoomIn, Minus } from 'lucide-react';
import ResizeModal from '@dtf/components/ResizeModal';
import { setPngDpi } from '@dtf/services/halftoneService';
import { fetchWithRetry } from '@dtf/lib/imageUtils';

interface AntiTransparencyEditorProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (processedBlob: Blob) => void;
    skipResize?: boolean;
}

export default function AntiTransparencyEditor({ imageUrl, onClose, onSave, skipResize }: AntiTransparencyEditorProps) {
    const [step, setStep] = useState<'setup' | 'editor'>(skipResize ? 'editor' : 'setup');
    const [workingImageUrl, setWorkingImageUrl] = useState<string>(imageUrl);

    const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
    const [previewImageData, setPreviewImageData] = useState<Uint8ClampedArray | null>(null);
    const [previewDim, setPreviewDim] = useState({ w: 0, h: 0, scale: 1 });

    const [settings, setSettings] = useState<any>({
        mode: 'magicWand',
        backgroundColor: '#00ff00',
        chromaTolerance: 50,
        shadowTolerance: 0,
        erosion: 0, 
        magicPoints: [],
        alphaThreshold: 10,
        softness: 15
    });

    const [isPickingColor, setIsPickingColor] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const processedCanvasRef = useRef<HTMLCanvasElement | null>(null); // To store ref to the canvas being drawn on

    // Zoom & Pan State
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [bgMode, setBgMode] = useState<'black' | 'white' | 'transparent'>('transparent');
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);
    const previewContainerRef = useRef<HTMLDivElement>(null);

    // Load Image
    useEffect(() => {
        let mounted = true;

        const loadImage = async () => {
            try {
                // Use fetchWithRetry to bypass Electron local file restrictions via main process
                const blob = await fetchWithRetry(workingImageUrl);
                if (!mounted) return;

                const blobUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    if (!mounted) return;
                    setOriginalImage(img);

                    // Calcular tamanho do proxy (preview)
                    const MAX_PREVIEW = 1200;
                    let scale = 1;
                    if (img.width > MAX_PREVIEW || img.height > MAX_PREVIEW) {
                        scale = Math.min(MAX_PREVIEW / img.width, MAX_PREVIEW / img.height);
                    }
                    const pw = Math.max(1, Math.round(img.width * scale));
                    const ph = Math.max(1, Math.round(img.height * scale));

                    setPreviewDim({ w: pw, h: ph, scale });

                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = pw;
                    offCanvas.height = ph;
                    const ctx = offCanvas.getContext('2d')!;
                    // Smooth scaling
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, pw, ph);
                    setPreviewImageData(ctx.getImageData(0, 0, pw, ph).data);

                    URL.revokeObjectURL(blobUrl); // Libera a memória
                };
                img.onerror = () => {
                    console.error('Failed to parse loaded image blob map');
                    URL.revokeObjectURL(blobUrl);
                };
                img.src = blobUrl;
            } catch (error) {
                console.error('Failed to load image in AntiTransparencyEditor:', error);
            }
        };

        loadImage();

        return () => {
            mounted = false;
        };
    }, [workingImageUrl]);

    // Helpers
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 255, b: 0 };
    }

    const rgbToHex = (r: number, g: number, b: number) => {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    // Os pontos de processamento agora estão no serviço externo antiTransparencyService

    // Live Preview Effect (Renderiza no canvas de baixa resolução pro usuário interagir)
    useEffect(() => {
        if (!previewImageData || !canvasRef.current || previewDim.scale === 0) return;

        const processPreview = () => {
            try {
                const canvas = canvasRef.current!;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return;

                if (canvas.width !== previewDim.w || canvas.height !== previewDim.h) {
                    canvas.width = previewDim.w;
                    canvas.height = previewDim.h;
                }

                const outputImageData = runInternalProcessing(
                    previewImageData,
                    previewDim.w,
                    previewDim.h,
                    settings,
                    1
                );

                ctx.putImageData(outputImageData, 0, 0);
            } catch (err) {
                console.error("Erro ao processar preview Anti-Transparência:", err);
            }
        };

        processPreview();

    }, [previewImageData, previewDim, settings]);

    const handleCanvasClick = (clientX: number, clientY: number) => {
        if (!isPickingColor && settings.mode !== 'magicWand') return;
        if (!previewImageData || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = Math.floor((clientX - rect.left) * scaleX);
        const y = Math.floor((clientY - rect.top) * scaleY);

        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            const idx = (y * canvas.width + x) * 4;
            const r = previewImageData[idx];
            const g = previewImageData[idx + 1];
            const b = previewImageData[idx + 2];

            const hex = rgbToHex(r, g, b);

            if (settings.mode === 'chromaKey') {
                setSettings(prev => ({ ...prev, backgroundColor: hex }));
                // setIsPickingColor(false); // Keep picking active
            } else {
                // Magic Wand: Add point
                setSettings(prev => ({
                    ...prev,
                    backgroundColor: hex, // Also set reference color?
                    magicPoints: [...prev.magicPoints, { x, y }]
                }));
                // setIsPickingColor(false); // Keep picking active
            }
        }
    };

    // Zoom/Pan Handlers (multiplicativo para suavidade em todos os níveis)
    const handleZoomIn = () => setZoom(z => Math.min(z * 1.25, 32));
    const handleZoomOut = () => {
        setZoom(z => {
            const newZoom = Math.max(z / 1.25, 0.05);
            if (newZoom <= 1 && z > 1) setPanOffset({ x: 0, y: 0 });
            return newZoom;
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        hasMoved.current = false;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        dragStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;

            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true;

            lastMousePos.current = { x: e.clientX, y: e.clientY };
            // Pan sem limite — o usuário controla livremente
            setPanOffset(prev => ({
                x: prev.x + dx,
                y: prev.y + dy
            }));
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setIsDragging(false);
        if (!hasMoved.current) {
            // It was a click!
            handleCanvasClick(e.clientX, e.clientY);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        setZoom(z => Math.min(Math.max(z * factor, 0.05), 32));
    };

    const handleSave = async () => {
        if (!originalImage || previewDim.scale === 0) return;
        setIsProcessing(true);

        try {
            // Em vez de salvar de um canvasRef (que está na resolucao de preview limitadora)
            // Lemos a imagem original grande real, desenhamos num canvas invisível temporario
            // Rodamos o `runProcessing` com as dimensões totais nela
            console.log('Rodando salvamento total na imagem Original High-Res:', originalImage.width, 'x', originalImage.height);

            // Pausa um pouco pra UI conseguir mostrar o loading state (setIsProcessing)
            await new Promise(r => setTimeout(r, 100));

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = originalImage.width;
            tempCanvas.height = originalImage.height;
            const tCtx = tempCanvas.getContext('2d')!;
            tCtx.drawImage(originalImage, 0, 0);

            const originalData = tCtx.getImageData(0, 0, originalImage.width, originalImage.height).data;
            const scaleToOriginal = 1 / previewDim.scale;

            const outputData = runInternalProcessing(
                originalData,
                originalImage.width,
                originalImage.height,
                settings,
                scaleToOriginal
            );

            tCtx.putImageData(outputData, 0, 0);

            const blob = await new Promise<Blob | null>((resolve) => {
                tempCanvas.toBlob(resolve, 'image/png');
            });

            if (blob) {
                // Apply 300 DPI metadata
                const finalBlob = await setPngDpi(blob, 300);
                onSave(finalBlob);
            }
        } catch (error) {
            console.error("Failed to solve high-res transparent processing:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    if (step === 'setup') {
        return (
            <div className="w-full h-full relative z-[60]">
                {/* 
                  Close button to leave if user doesn't want to proceed with resize
                */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[70] p-2 bg-black/50 hover:bg-black/80 text-white rounded-xl backdrop-blur transition-all"
                >
                    <Undo2 size={20} />
                </button>

                <ResizeModal
                    imageUrl={imageUrl}
                    onConfirm={(resizedUrl) => {
                        setWorkingImageUrl(resizedUrl);
                        setStep('editor');
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex w-full h-full bg-black/90 text-white overflow-hidden">
            {/* Controls Left Panel */}
            <div className="w-80 flex-shrink-0 border-r border-white/10 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-6 bg-zinc-900/50 backdrop-blur-md">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Eraser className="w-5 h-5 text-cyan-400" />
                        Anti-Transparência
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
                        <Undo2 className="w-4 h-4" /> Voltar
                    </button>
                </div>

                {/* Mode Selector */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase">Modo de Operação</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setSettings(s => ({ ...s, mode: 'magicWand' }))}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${settings.mode === 'magicWand'
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            <Wand2 className="mb-1 w-5 h-5" />
                            <span className="text-xs font-medium">Varinha Mágica</span>
                        </button>
                        <button
                            onClick={() => setSettings(s => ({ ...s, mode: 'chromaKey' }))}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${settings.mode === 'chromaKey'
                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            <Pipette className="mb-1 w-5 h-5" />
                            <span className="text-xs font-medium">Cor Global</span>
                        </button>
                    </div>
                </div>

                {/* Magic Wand Controls */}
                {settings.mode === 'magicWand' && (
                    <div className="space-y-3 bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium">Pontos Selecionados: {settings.magicPoints.length}</label>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setSettings(s => ({ ...s, magicPoints: s.magicPoints.slice(0, -1) }))}
                                    disabled={settings.magicPoints.length === 0}
                                    className="p-1.5 bg-white/10 rounded hover:bg-white/20 disabled:opacity-30"
                                    title="Desfazer último"
                                >
                                    <Undo2 className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => setSettings(s => ({ ...s, magicPoints: [] }))}
                                    disabled={settings.magicPoints.length === 0}
                                    className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-30"
                                    title="Limpar todos"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                        <p className="text-[10px] text-white/40 leading-tight">
                            Clique na imagem com a ferramenta ativada para remover áreas conectadas.
                        </p>
                    </div>
                )}

                {/* Color Picker & Tolerance */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase">
                            {settings.mode === 'chromaKey' ? 'Cor para Remover (Global)' : 'Cor Alvo (Varinha)'}
                        </label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsPickingColor(!isPickingColor)}
                                className={`w-full py-3 flex items-center justify-center gap-2 rounded-lg border font-medium transition-all ${isPickingColor
                                    ? 'bg-red-500/20 border-red-500 text-red-500'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                <Pipette className="w-4 h-4" />
                                {isPickingColor ? 'Parar Seleção' : 'Selecionar Cor'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                            <label>Tolerância de Cor</label>
                            <span className="text-cyan-400">{settings.chromaTolerance}</span>
                        </div>
                        <input
                            type="range" min="0" max="255"
                            value={settings.chromaTolerance}
                            onChange={(e) => setSettings(s => ({ ...s, chromaTolerance: parseInt(e.target.value) }))}
                            className="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                            <label>Suavização (Softness)</label>
                            <span className="text-purple-400">{settings.softness}</span>
                        </div>
                        <input
                            type="range" min="0" max="100"
                            value={settings.softness}
                            onChange={(e) => setSettings(s => ({ ...s, softness: parseInt(e.target.value) }))}
                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                        />
                        <p className="text-[10px] text-white/30 italic">Ideal para fumaça, chamas e contornos suaves.</p>
                    </div>

                    {settings.mode === 'chromaKey' && (
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                                <label>Tolerância de Sombra</label>
                                <span className="text-cyan-400">{settings.shadowTolerance}</span>
                            </div>
                            <input
                                type="range" min="0" max="100"
                                value={settings.shadowTolerance}
                                onChange={(e) => setSettings(s => ({ ...s, shadowTolerance: parseInt(e.target.value) }))}
                                className="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                    )}

                    <div className="space-y-3 pt-2 border-t border-white/5">
                        <div className="flex justify-between text-xs">
                            <label>Erosão (Bordas)</label>
                            <span className="text-cyan-400">{settings.erosion} px</span>
                        </div>
                        <input
                            type="range" min="0" max="20"
                            value={settings.erosion}
                            onChange={(e) => setSettings(s => ({ ...s, erosion: parseInt(e.target.value) }))}
                            className="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>
                </div>

                <div className="mt-auto pt-6 flex flex-col gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isProcessing}
                        className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                    >
                        {isProcessing ? (
                            <>
                                <span className="animate-spin text-white">⏳</span>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                Salvar e Continuar
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div
                ref={previewContainerRef}
                className={`flex-1 relative overflow-hidden flex items-center justify-center
                    ${bgMode === 'white' ? 'bg-white' : bgMode === 'transparent' ? 'bg-[#333]' : 'bg-black'}
                `}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setIsDragging(false)}
                onWheel={handleWheel}
                onDragStart={(e) => e.preventDefault()}
            >
                {/* Background Checkerboard for full transparency feel */}
                {bgMode === 'transparent' && (
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(#888 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                    />
                )}

                {/* BG Controls */}
                <div
                    className="absolute top-4 right-4 bg-black/60 backdrop-blur rounded-lg p-1 flex gap-1 z-20 border border-white/10"
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

                {/* Zoom Controls */}
                <div
                    className="absolute bottom-4 right-4 flex gap-2 z-20"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button onClick={handleZoomOut} className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur border border-white/10">
                        <Minus size={16} />
                    </button>
                    <div className="px-3 py-2 bg-black/60 text-white text-xs font-mono rounded-lg backdrop-blur border border-white/10 flex items-center">
                        {Math.round(zoom * 100)}%
                    </div>
                    <button onClick={handleZoomIn} className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur border border-white/10">
                        <ZoomIn size={16} />
                    </button>
                </div>


                {/* Transform Container */}
                <div
                    className="transition-transform duration-75 relative"
                    style={{
                        transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                        transformOrigin: 'center center',
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        className={`shadow-2xl border border-white/5 transition-cursor ${settings.mode === 'magicWand' || isPickingColor ? 'cursor-crosshair' : 'cursor-default'}`}
                        style={{ imageRendering: 'pixelated' }}
                    />
                </div>

                {/* Floating Hint */}
                {isPickingColor && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-500 text-black px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce pointer-events-none z-30">
                        Clique na imagem para selecionar a cor
                    </div>
                )}
            </div>
        </div>
    );

    function runInternalProcessing(
        sourceData: Uint8ClampedArray,
        width: number,
        height: number,
        settingsToUse: any,
        pointScale: number
    ): ImageData {
        const outputImageData = new ImageData(width, height);
        const outputData = outputImageData.data;

        const hexToRgbLocal = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 0, g: 255, b: 0 };
        };

        const bgColor = hexToRgbLocal(settingsToUse.backgroundColor || '#00ff00');
        const erosion = settingsToUse.erosion || 0;
        const threshold = settingsToUse.alphaThreshold || 10;
        const mode = settingsToUse.mode;
        const chromaTolerance = settingsToUse.chromaTolerance || 50;
        const shadowTolerance = settingsToUse.shadowTolerance || 0;
        const softness = settingsToUse.softness || 0;
        const rawMagicPoints = settingsToUse.magicPoints || [];

        const magicPoints = rawMagicPoints.map((p: any) => ({
            x: Math.round(p.x * pointScale),
            y: Math.round(p.y * pointScale)
        }));

        let finalAlpha = new Uint8Array(width * height);

        if (mode === 'magicWand' && magicPoints.length > 0) {
            for (let i = 0; i < width * height; i++) {
                const idx = i * 4;
                const r = sourceData[idx];
                const g = sourceData[idx + 1];
                const b = sourceData[idx + 2];
                const a = sourceData[idx + 3];
                if (a <= threshold) {
                    finalAlpha[i] = 0;
                    continue;
                }
                finalAlpha[i] = a; 
                if (softness > 0) {
                    const bgColor_raw = hexToRgbLocal(settingsToUse.backgroundColor || '#000000');
                    const dr = r - bgColor_raw.r;
                    const dg = g - bgColor_raw.g;
                    const db = b - bgColor_raw.b;
                    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
                    if (dist < chromaTolerance) {
                        const ramp = (softness / 100) * 128;
                        const diff = chromaTolerance - dist;
                        const softAlpha = Math.max(0, 255 - (diff / ramp) * 255);
                        finalAlpha[i] = Math.min(a, Math.round(softAlpha));
                    }
                }
            }

            const stack: { x: number, y: number, startR: number, startG: number, startB: number }[] = [];
            const visited = new Uint8Array(width * height);

            for (const point of magicPoints) {
                if (point.x >= 0 && point.x < width && point.y >= 0 && point.y < height) {
                    const idx = point.y * width + point.x;
                    stack.push({
                        x: point.x,
                        y: point.y,
                        startR: sourceData[idx * 4],
                        startG: sourceData[idx * 4 + 1],
                        startB: sourceData[idx * 4 + 2]
                    });
                    visited[idx] = 1;
                }
            }

            while (stack.length > 0) {
                const { x: cx, y: cy, startR, startG, startB } = stack.pop()!;
                const cIdx = cy * width + cx;
                finalAlpha[cIdx] = 0; 
                const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const nIdx = ny * width + nx;
                        if (visited[nIdx]) continue;
                        const na = sourceData[nIdx * 4 + 3];
                        if (na <= threshold) continue;
                        const nr = sourceData[nIdx * 4], ng = sourceData[nIdx * 4 + 1], nb = sourceData[nIdx * 4 + 2];
                        const dist = Math.sqrt(Math.pow(nr - startR, 2) + Math.pow(ng - startG, 2) + Math.pow(nb - startB, 2));
                        if (dist < chromaTolerance) {
                            visited[nIdx] = 1;
                            stack.push({ x: nx, y: ny, startR, startG, startB });
                        }
                    }
                }
            }
        } else if (mode === 'magicWand' && magicPoints.length === 0) {
            for (let i = 0; i < width * height; i++) {
                finalAlpha[i] = sourceData[i * 4 + 3] > threshold ? 255 : 0;
            }
        } else if (mode === 'chromaKey') {
            for (let i = 0; i < width * height; i++) {
                const idx = i * 4;
                const r = sourceData[idx], g = sourceData[idx + 1], b = sourceData[idx + 2], a = sourceData[idx + 3];
                if (a <= threshold) {
                    finalAlpha[i] = 0;
                    continue;
                }
                const dr = r - bgColor.r, dg = g - bgColor.g, db = b - bgColor.b;
                const rgbDistance = Math.sqrt(dr * dr + dg * dg + db * db);
                const pixelLuma = 0.299 * r + 0.587 * g + 0.114 * b;
                const targetLuma = 0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b;
                let effectiveTolerance = chromaTolerance;
                if (pixelLuma < targetLuma) {
                    const shadowFactor = 1 + (shadowTolerance / 50);
                    effectiveTolerance *= shadowFactor;
                }
                if (rgbDistance < effectiveTolerance) {
                    if (softness === 0) finalAlpha[i] = 0;
                    else {
                        const ramp = (softness / 100) * 128;
                        const diff = effectiveTolerance - rgbDistance;
                        const alpha = Math.max(0, 255 - (diff / ramp) * 255);
                        finalAlpha[i] = Math.round(alpha);
                    }
                } else finalAlpha[i] = 255;
            }
        }

        if (erosion > 0) {
            let currentAlpha = new Uint8Array(finalAlpha);
            for (let pass = 0; pass < erosion; pass++) {
                currentAlpha.set(finalAlpha);
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = y * width + x;
                        if (currentAlpha[idx] === 0) continue;
                        let isEdge = false;
                        if (y > 0 && currentAlpha[idx - width] === 0) isEdge = true;
                        else if (y < height - 1 && currentAlpha[idx + width] === 0) isEdge = true;
                        else if (x > 0 && currentAlpha[idx - 1] === 0) isEdge = true;
                        else if (x < width - 1 && currentAlpha[idx + 1] === 0) isEdge = true;
                        if (isEdge) finalAlpha[idx] = 0;
                    }
                }
            }
        }

        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            const alpha = finalAlpha[i];
            if (alpha > 0) {
                outputData[idx] = sourceData[idx];
                outputData[idx + 1] = sourceData[idx + 1];
                outputData[idx + 2] = sourceData[idx + 2];
                outputData[idx + 3] = alpha;
            } else {
                outputData[idx] = outputData[idx+1] = outputData[idx+2] = outputData[idx+3] = 0;
            }
        }
        return outputImageData;
    }
}
