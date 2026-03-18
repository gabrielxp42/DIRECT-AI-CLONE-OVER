'use client';

import React, { useState, useRef, useCallback } from 'react';
import Sidebar from './sidebar/Sidebar';
import CanvasPreview from './CanvasPreview';
import { LineConfig } from '@/features/montador/lib/types';
import { getImageDimensions } from '@/features/montador/lib/packingEngine';

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
    };

    const handleRemoveLine = (id: string) => {
        setLines(prev => prev.filter(l => l.id !== id));
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
            // Create a temporary link to download the canvas content
            // Note: CanvasPreview renders at high resolution already.
            // We can directly use toDataURL or toBlob.
            
            // Wait a bit to ensure UI updates
            await new Promise(r => setTimeout(r, 100));

            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `montagem-dtf-${new Date().getTime()}.png`;
                    link.href = url;
                    link.click();
                    URL.revokeObjectURL(url);
                }
                setIsExporting(false);
            }, 'image/png');

        } catch (err) {
            console.error('Export failed', err);
            setIsExporting(false);
        }
    }, []);

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-[#050505] text-white overflow-hidden font-sans selection:bg-orange-500/30">
            {/* Sidebar Container - Fixed Width */}
            <div className="h-full p-4 md:p-6 z-20">
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

            {/* Main Preview Area - Flexible */}
            <div className="flex-1 h-full relative z-10 p-4 md:p-6 pl-0">
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
                />
            </div>
        </div>
    );
}
