import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { LineConfig, FinalLayout } from '@/features/montador/lib/types';
import { generateFinalLayout, cmToPx, optimizeLayout, packFreeMode } from '@/features/montador/lib/packingEngine';

// Função auxiliar para injetar o chunk pHYs (DPI) no arquivo PNG exportado
const changeDpiBlob = (blob: Blob, dpi: number): Promise<Blob> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            
            // Verifica se é um PNG válido (assinatura 89 50 4E 47 0D 0A 1A 0A)
            if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4E || data[3] !== 0x47) {
                resolve(blob); // Não é PNG, retorna o original
                return;
            }

            // Calcula pixels por metro
            const ppm = Math.round((dpi / 2.54) * 100);
            
            // Cria chunk pHYs
            const physChunk = new Uint8Array(21);
            // length (9)
            physChunk[0] = 0; physChunk[1] = 0; physChunk[2] = 0; physChunk[3] = 9;
            // 'pHYs'
            physChunk[4] = 112; physChunk[5] = 72; physChunk[6] = 89; physChunk[7] = 115;
            // ppm X
            physChunk[8] = (ppm >>> 24) & 0xFF;
            physChunk[9] = (ppm >>> 16) & 0xFF;
            physChunk[10] = (ppm >>> 8) & 0xFF;
            physChunk[11] = ppm & 0xFF;
            // ppm Y
            physChunk[12] = (ppm >>> 24) & 0xFF;
            physChunk[13] = (ppm >>> 16) & 0xFF;
            physChunk[14] = (ppm >>> 8) & 0xFF;
            physChunk[15] = ppm & 0xFF;
            // unit (metros) = 1
            physChunk[16] = 1;
            
            // CRC calculation
            let crc = -1;
            for (let i = 4; i < 17; i++) {
                crc ^= physChunk[i];
                for (let j = 0; j < 8; j++) {
                    crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
                }
            }
            crc ^= -1;
            
            physChunk[17] = (crc >>> 24) & 0xFF;
            physChunk[18] = (crc >>> 16) & 0xFF;
            physChunk[19] = (crc >>> 8) & 0xFF;
            physChunk[20] = crc & 0xFF;

            // Encontra o fim do chunk IHDR para inserir logo depois
            let ihdrEnd = 8;
            let foundIHDR = false;
            while (ihdrEnd < data.length) {
                const length = (data[ihdrEnd] << 24) | (data[ihdrEnd+1] << 16) | (data[ihdrEnd+2] << 8) | data[ihdrEnd+3];
                const type = String.fromCharCode(data[ihdrEnd+4], data[ihdrEnd+5], data[ihdrEnd+6], data[ihdrEnd+7]);
                ihdrEnd += 12 + length;
                if (type === 'IHDR') {
                    foundIHDR = true;
                    break;
                }
            }

            if (!foundIHDR) {
                resolve(blob);
                return;
            }

            // Verifica se já existe um chunk pHYs para substituir ou ignora e insere novo
            // Para simplificar, vamos apenas inserir (pode haver duplicata, mas a maioria dos leitores pega o primeiro/último ou a API toBlob do navegador não coloca)
            
            const newData = new Uint8Array(data.length + 21);
            newData.set(data.subarray(0, ihdrEnd), 0);
            newData.set(physChunk, ihdrEnd);
            newData.set(data.subarray(ihdrEnd), ihdrEnd + 21);

            resolve(new Blob([newData], { type: 'image/png' }));
        };
        reader.readAsArrayBuffer(blob);
    });
};

interface CanvasPreviewProps {
    lines: LineConfig[];
    canvasWidthCm: number;
    spacingPx: number;
    spacingYPx: number; // Novo espaçamento vertical global
    scale?: number; // Ignored, internal state used
    smoothing?: boolean;
    themeColor: string;
    setTotalHeightCm: (h: number) => void;
    isFreeMode: boolean; // Novo modo
    onItemClick?: (lineId: string | null) => void;
    selectedLineId?: string | null;
}

const CanvasPreview = forwardRef<HTMLCanvasElement, CanvasPreviewProps>(({
    lines,
    canvasWidthCm,
    spacingPx,
    spacingYPx,
    smoothing = false,
    themeColor,
    setTotalHeightCm,
    isFreeMode,
    onItemClick,
    selectedLineId
}, ref) => {
    const internalCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [finalLayout, setFinalLayout] = useState<FinalLayout | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Zoom & Pan State
    const [scale, setScale] = useState(0.2);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const DPI = 72; // Using screen DPI for preview rendering to match original logic

    // Cache images to avoid reloading
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // Expose internal methods to parent
    useImperativeHandle(ref, () => ({
        // @ts-ignore - Exposing custom method along with canvas element
        ...internalCanvasRef.current,
        exportToBlob: async (dpi: number = 300) => {
            if (!finalLayout) throw new Error("Layout not ready");
            
            const exportCanvas = document.createElement('canvas');
            const widthPx = cmToPx(finalLayout.canvasWidth, dpi);
            const heightPx = cmToPx(finalLayout.canvasHeight, dpi);
            
            exportCanvas.width = widthPx;
            exportCanvas.height = heightPx;
            const ctx = exportCanvas.getContext('2d');
            if (!ctx) throw new Error("Could not create context");

            // Fill transparent background (optional, or white if needed for some printers)
            // ctx.clearRect(0, 0, widthPx, heightPx);

            ctx.imageSmoothingEnabled = smoothing;
            ctx.imageSmoothingQuality = 'high';

            const drawPromises = finalLayout.items.map(async (item) => {
                let img = imageCache.current.get((item as any).imageUrl);
                
                if (!img) {
                    // Fallback load if not in cache
                    img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = (item as any).imageUrl;
                    await new Promise((resolve, reject) => {
                        img!.onload = resolve;
                        img!.onerror = reject;
                    });
                } else if (!img.complete) {
                     await new Promise((resolve) => { img!.onload = resolve; });
                }

                if (img) {
                    const xPx = cmToPx(item.x, dpi);
                    const yPx = cmToPx(item.y, dpi);
                    const wPx = cmToPx(item.width, dpi);
                    const hPx = cmToPx(item.height, dpi);
                    
                    const centerX = xPx + wPx / 2;
                    const centerY = yPx + hPx / 2;

                    ctx.save();
                    ctx.translate(centerX, centerY);
                    ctx.rotate((item.rotation * Math.PI) / 180);
                    
                    const isRotated = item.rotation === 90 || item.rotation === 270;
                    const drawW = isRotated ? hPx : wPx;
                    const drawH = isRotated ? wPx : hPx;
                    
                    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                    ctx.restore();
                }
            });

            await Promise.all(drawPromises);

            return new Promise<Blob | null>((resolve) => {
                exportCanvas.toBlob(async (blob) => {
                    if (blob) {
                        const newBlob = await changeDpiBlob(blob, dpi);
                        resolve(newBlob);
                    } else {
                        resolve(null);
                    }
                }, 'image/png');
            });
        }
    }) as any);

    // Load images
    useEffect(() => {
        lines.forEach(line => {
            if (!imageCache.current.has(line.imageUrl)) {
                const img = new Image();
                img.crossOrigin = 'anonymous'; // Good practice
                img.src = line.imageUrl;
                img.onload = () => {
                    imageCache.current.set(line.imageUrl, img);
                    // Force re-render if needed (could add a dummy state update here)
                };
            }
        });
    }, [lines]);

    // Layout Calculation Logic
    useEffect(() => {
        setIsGenerating(true);
        const timer = setTimeout(() => {
            if (lines.length === 0) {
                setFinalLayout(null);
                setTotalHeightCm(0);
                setIsGenerating(false);
                return;
            }

            let layout: FinalLayout | null = null;

            if (isFreeMode) {
                // MODO LIVRE: Juntar tudo e rodar bin packing 2D
                const itemsToPack = lines.flatMap(line => {
                    // Se a linha já tem resultado otimizado (via parent ou cálculo prévio), usa-se as dimensões do stamp
                    // Caso contrário, usa dimensions originais.
                    // Aqui, recalculamos optimizeLayout para garantir consistência
                    const lineSpacingPx = line.spacingPx ?? spacingPx;
                    const optimizedResult = optimizeLayout(line.dimensions, lineSpacingPx, canvasWidthCm);
                    
                    const qty = line.quantity || 1;
                    return Array.from({ length: qty }).map((_, i) => ({
                        id: `${line.id}-${i}`,
                        lineId: line.id,
                        url: line.imageUrl,
                        // Usamos as dimensões otimizadas (que podem ter rotação)
                        widthCm: optimizedResult.stampWidthCm,
                        heightCm: optimizedResult.stampHeightCm,
                        spacingPx: lineSpacingPx,
                        rotation: optimizedResult.rotation || 0
                    }));
                });

                layout = packFreeMode(itemsToPack, canvasWidthCm, spacingYPx);

            } else {
                // MODO PADRÃO: Linha por linha (Stack vertical)
                const layoutItems: any[] = [];
                let currentY = 0; // cm
                const spacingYCm = (spacingYPx / 300) * 2.54;

                lines.forEach((line, index) => {
                    const lineSpacingPx = line.spacingPx ?? spacingPx;
                    const result = optimizeLayout(line.dimensions, lineSpacingPx, canvasWidthCm);
                    const rowLayout = generateFinalLayout(result, lineSpacingPx);

                    if (rowLayout) {
                        // Apply spacing BEFORE the row if it's not the first one
                        if (index > 0) {
                             currentY += spacingYCm;
                        }

                        const lineStartOffsetY = currentY;

                        // Add items with current Y offset
                        rowLayout.items.forEach(item => {
                            layoutItems.push({
                                ...item,
                                y: item.y + lineStartOffsetY,
                                lineId: line.id,
                                imageUrl: line.imageUrl
                            });
                        });

                        // Advance Y by the STAMP height (content height), NOT the full row height with bleed
                        // This matches the reference logic to avoid double margins/gaps
                        const lineHeight = result.stampHeightCm || 10;
                        currentY += lineHeight;
                    }
                });

                layout = {
                    canvasWidth: canvasWidthCm,
                    canvasHeight: Math.max(currentY, 10),
                    items: layoutItems,
                    totalCopies: layoutItems.length
                };
            }

            setFinalLayout(layout);
            setTotalHeightCm(layout?.canvasHeight || 0);
            setIsGenerating(false);
        }, 100); 

        return () => clearTimeout(timer);
    }, [lines, canvasWidthCm, spacingPx, spacingYPx, isFreeMode, setTotalHeightCm]);

    // Fit to Screen Logic
    const fitToScreen = useCallback(() => {
        if (!finalLayout || !containerRef.current) return;
        const container = containerRef.current;
        const padding = 40;
        const containerW = container.clientWidth;
        const containerH = container.clientHeight;
        if (containerW === 0 || containerH === 0) return;

        const layoutW = cmToPx(finalLayout.canvasWidth, DPI);
        const layoutH = cmToPx(finalLayout.canvasHeight, DPI);

        const scaleW = (containerW - padding * 2) / layoutW;
        const scaleH = (containerH - padding * 2) / layoutH;
        const fitScale = Math.max(0.02, Math.min(scaleW, scaleH, 1.0));

        setScale(fitScale);

        const contentW = layoutW * fitScale;
        const contentH = layoutH * fitScale;
        setOffset({
            x: (containerW - contentW) / 2,
            y: (containerH - contentH) / 2
        });
    }, [finalLayout, DPI]);

    // Auto-fit on layout change
    const hasAutoFitted = useRef(false);
    useEffect(() => {
        if (finalLayout) {
            // Reset auto-fit flag when layout changes significantly (optional, but good for UX)
            // For now, we fit every time layout changes to ensure visibility
            const timer = setTimeout(fitToScreen, 50);
            return () => clearTimeout(timer);
        }
    }, [finalLayout, fitToScreen]);

    // Resize Observer
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(() => fitToScreen());
        observer.observe(container);
        return () => observer.disconnect();
    }, [fitToScreen]);

    // Canvas Rendering
    useEffect(() => {
        const canvas = internalCanvasRef.current;
        if (!canvas || !finalLayout) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const widthPx = cmToPx(finalLayout.canvasWidth, DPI);
        const heightPx = cmToPx(finalLayout.canvasHeight, DPI);

        canvas.width = widthPx;
        canvas.height = heightPx;
        ctx.clearRect(0, 0, widthPx, heightPx);
        ctx.imageSmoothingEnabled = smoothing;
        ctx.imageSmoothingQuality = 'high';

        finalLayout.items.forEach(item => {
            // Get image from cache or try to load
            let img = imageCache.current.get((item as any).imageUrl);
            
            if (!img) {
                img = new Image();
                img.src = (item as any).imageUrl;
            }

            if (img.complete) {
                const xPx = cmToPx(item.x, DPI);
                const yPx = cmToPx(item.y, DPI);
                const wPx = cmToPx(item.width, DPI);
                const hPx = cmToPx(item.height, DPI);
                
                const centerX = xPx + wPx / 2;
                const centerY = yPx + hPx / 2;

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate((item.rotation * Math.PI) / 180);
                
                const isRotated = item.rotation === 90 || item.rotation === 270;
                const drawW = isRotated ? hPx : wPx;
                const drawH = isRotated ? wPx : hPx;
                
                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                
                if (selectedLineId && (item as any).lineId === selectedLineId) {
                    ctx.strokeStyle = themeColor;
                    ctx.lineWidth = 4;
                    ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
                    ctx.fillStyle = themeColor + '33'; // 20% opacity
                    ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
                }
                
                ctx.restore();
            } else {
                img.onload = () => {
                     // Trigger re-render by forcing update or just draw
                     // Since we are in a loop, forcing update is tricky.
                     // We just draw it here.
                     const xPx = cmToPx(item.x, DPI);
                     const yPx = cmToPx(item.y, DPI);
                     const wPx = cmToPx(item.width, DPI);
                     const hPx = cmToPx(item.height, DPI);
                     const centerX = xPx + wPx / 2;
                     const centerY = yPx + hPx / 2;
     
                     ctx.save();
                     ctx.translate(centerX, centerY);
                     ctx.rotate((item.rotation * Math.PI) / 180);
                     const isRotated = item.rotation === 90 || item.rotation === 270;
                     const drawW = isRotated ? hPx : wPx;
                     const drawH = isRotated ? wPx : hPx;
                     ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                     
                     if (selectedLineId && (item as any).lineId === selectedLineId) {
                         ctx.strokeStyle = themeColor;
                         ctx.lineWidth = 4;
                         ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
                         ctx.fillStyle = themeColor + '33'; // 20% opacity
                         ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
                     }
                     
                     ctx.restore();
                };
            }
        });

    }, [finalLayout, smoothing, DPI, selectedLineId, themeColor]);

    // Zoom/Pan Handlers
    const handleWheel = (e: React.WheelEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.02, Math.min(3, scale * delta));
        setScale(newScale);
        setOffset({
            x: mouseX - canvasX * newScale,
            y: mouseY - canvasY * newScale
        });
    };

    const [rawDragStart, setRawDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        setRawDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !containerRef.current || !finalLayout) return;
        setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setIsDragging(false);
        const dx = e.clientX - rawDragStart.x;
        const dy = e.clientY - rawDragStart.y;
        if (Math.sqrt(dx * dx + dy * dy) < 5) {
            handleCanvasClick(e);
        }
    };
    
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (!containerRef.current || !finalLayout || !onItemClick) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;
        
        for (let i = finalLayout.items.length - 1; i >= 0; i--) {
            const item = finalLayout.items[i];
            const xPx = cmToPx(item.x, DPI);
            const yPx = cmToPx(item.y, DPI);
            const wPx = cmToPx(item.width, DPI);
            const hPx = cmToPx(item.height, DPI);
            
            const centerX = xPx + wPx / 2;
            const centerY = yPx + hPx / 2;
            
            const isRotated = item.rotation === 90 || item.rotation === 270;
            const drawW = isRotated ? hPx : wPx;
            const drawH = isRotated ? wPx : hPx;
            
            const left = centerX - drawW / 2;
            const right = centerX + drawW / 2;
            const top = centerY - drawH / 2;
            const bottom = centerY + drawH / 2;
            
            if (canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom) {
                onItemClick((item as any).lineId);
                return;
            }
        }
        
        onItemClick(null);
    };

    // Touch Zoom/Pan Handlers
    const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
    const [touchStartScale, setTouchStartScale] = useState<number>(1);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
            setRawDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setTouchStartDist(dist);
            setTouchStartScale(scale);
            setIsDragging(false);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!containerRef.current || !finalLayout) return;
        
        if (e.touches.length === 1 && isDragging) {
            setOffset({ 
                x: e.touches[0].clientX - dragStart.x, 
                y: e.touches[0].clientY - dragStart.y 
            });
        } else if (e.touches.length === 2 && touchStartDist !== null) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = dist / touchStartDist;
            const newScale = Math.max(0.02, Math.min(3, touchStartScale * delta));
            
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = centerX - rect.left;
            const mouseY = centerY - rect.top;
            
            const canvasX = (mouseX - offset.x) / scale;
            const canvasY = (mouseY - offset.y) / scale;

            setScale(newScale);
            setOffset({
                x: mouseX - canvasX * newScale,
                y: mouseY - canvasY * newScale
            });
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (e.touches.length < 2) {
            setTouchStartDist(null);
        }
        if (e.touches.length === 0) {
            setIsDragging(false);
            if (e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - rawDragStart.x;
                const dy = e.changedTouches[0].clientY - rawDragStart.y;
                if (Math.sqrt(dx * dx + dy * dy) < 5) {
                    // Simulate click
                    const simulatedEvent = {
                        clientX: e.changedTouches[0].clientX,
                        clientY: e.changedTouches[0].clientY
                    } as React.MouseEvent;
                    handleCanvasClick(simulatedEvent);
                }
            }
        }
    };

    if (!finalLayout && lines.length > 0) {
        return (
            <div className="flex items-center justify-center h-full text-white/50 animate-pulse">
                Calculando layout...
            </div>
        );
    }

    if (lines.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full select-none pointer-events-none p-4 text-center">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--mr-red)] to-[var(--mr-orange)] blur-3xl opacity-10 rounded-full" />
                    <h2 className="relative text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/20 mb-2 tracking-widest uppercase break-words leading-tight">
                        Aguardando<br className="md:hidden" /> Arquivos
                    </h2>
                </div>
            </div>
        );
    }

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full min-h-0 overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: Number.isNaN(offset.x) ? 0 : offset.x,
                    top: Number.isNaN(offset.y) ? 0 : offset.y,
                    transform: `scale(${Number.isNaN(scale) ? 1 : scale})`,
                    transformOrigin: 'top left',
                    willChange: 'transform, left, top',
                }}
            >
                {/* Wrapper do Canvas com Neon e Quadriculado */}
                <div
                    style={{
                        boxShadow: '0 0 0 4px #f97316, 0 0 50px 10px rgba(249, 115, 22, 0.5), 0 0 100px 20px rgba(249, 115, 22, 0.15)',
                        backgroundColor: '#2a2a2a',
                        backgroundImage: `
                            repeating-linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%, #333),
                            repeating-linear-gradient(45deg, #333 25%, #2a2a2a 25%, #2a2a2a 75%, #333 75%, #333)
                        `,
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 10px 10px',
                    }}
                >
                    <canvas
                        ref={internalCanvasRef}
                        style={{
                            display: 'block',
                            imageRendering: scale < 0.5 ? 'auto' : 'auto',
                        }}
                    />
                </div>
            </div>

            {/* Botão de reset view */}
            <button
                onClick={fitToScreen}
                style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    zIndex: 10,
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#fff',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4), 0 0 20px rgba(249, 115, 22, 0.2)',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(249, 115, 22, 0.5), 0 0 30px rgba(249, 115, 22, 0.3)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.4), 0 0 20px rgba(249, 115, 22, 0.2)';
                }}
                title="Ajustar à tela"
            >
                ⊡ Fit
            </button>
        </div>
    );
});

CanvasPreview.displayName = 'CanvasPreview';

export default CanvasPreview;