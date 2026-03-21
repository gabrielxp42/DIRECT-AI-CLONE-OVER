

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, Download, CheckCircle2, AlertCircle, Grid3x3, Wand2 } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { HalftoneSettings, applyHalftoneToBlob } from '@dtf/services/halftoneService';
import { electronBridge } from '@dtf/lib/electronBridge';
import { fetchWithRetry } from '@dtf/lib/imageUtils';
import { saveGalleryItem, createThumbnail, GalleryItem } from '@dtf/services/galleryService';
import { ErrorBoundary } from '@dtf/components/ErrorBoundary';

const HalftoneSelectorLazy = React.lazy(() => import('@dtf/components/HalftoneSelector'));
const HalftoneSelector = (props: any) => (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-cyan-500" /></div>}>
        <HalftoneSelectorLazy {...props} />
    </Suspense>
);

const AntiTransparencyEditorLazy = React.lazy(() => import('@dtf/components/AntiTransparencyEditor'));
const AntiTransparencyEditor = (props: any) => (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-purple-500" /></div>}>
        <AntiTransparencyEditorLazy {...props} />
    </Suspense>
);

interface HalftoneEditorOverlayProps {
    isOpen: boolean;
    imageUrl: string;
    garmentMode: 'black' | 'white' | 'color';
    item?: GalleryItem | null;
    onClose: () => void;
    onSaveSuccess?: () => void;
}

/**
 * Full-screen editor for Gallery images.
 * Allows re-processing the Master image with new halftone settings OR Anti-Transparency mask.
 */
export default function HalftoneEditorOverlay({ isOpen, imageUrl, garmentMode, item, onClose, onSaveSuccess }: HalftoneEditorOverlayProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Initialize tool based on garmentMode
    // Default to 'mask' (Anti-Transparency) only if in 'color' mode, but allow switching.
    const [activeTool, setActiveTool] = useState<'halftone' | 'mask'>('halftone');

    // Reset/Set tool when opening
    useEffect(() => {
        if (isOpen) {
            setActiveTool(garmentMode === 'color' ? 'mask' : 'halftone');
        }
    }, [isOpen, garmentMode]);


    // Helper to fetch blob from base64/url
    const getBlob = async (url: string) => {
        return fetchWithRetry(url);
    };

    const handleApply = useCallback(async (_preset: string, settings: HalftoneSettings, resizedBlob?: Blob) => {
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            // 1. Get original blob (or use the already resized one from Setup)
            const originalBlob = resizedBlob || await getBlob(imageUrl);

            // 2. Apply halftone (re-process)
            const halftoneBlob = await applyHalftoneToBlob(originalBlob, settings);

            // 3. Save to disk
            const buffer = await halftoneBlob.arrayBuffer();
            const filename = `dtf-edit-${Date.now()}.png`;

            const result = await electronBridge.saveImage(buffer, filename);

            if (result.success) {
                // 4. Save to Gallery if we have item context
                if (item) {
                    try {
                        const thumbDataUrl = URL.createObjectURL(halftoneBlob);
                        const thumbnail = await createThumbnail(thumbDataUrl);
                        URL.revokeObjectURL(thumbDataUrl);

                        const treatedBlobUrl = URL.createObjectURL(halftoneBlob);

                        saveGalleryItem({
                            prompt: item.prompt,
                            timestamp: Date.now(),
                            savedPath: result.path || filename,
                            masterFilePath: item.masterFilePath, // Keep linkage to master!
                            treatedUrl: treatedBlobUrl, // The treated/halftone image URL for web
                            thumbnail,
                            aspectRatio: item.aspectRatio,
                            garmentMode: garmentMode, // Uses the mode selected in editor
                            widthCm: item.widthCm,
                            heightCm: item.heightCm,
                            halftonePreset: _preset, // Store the new preset name
                            upscaleFactor: item.upscaleFactor
                        });
                        console.log('[Editor] Saved new version to gallery');
                    } catch (e) {
                        console.error('[Editor] Failed to update gallery:', e);
                    }
                }

                setSaveStatus('success');
                if (onSaveSuccess) onSaveSuccess();
                setTimeout(() => {
                    setSaveStatus('idle');
                    onClose();
                }, 1500);
            } else {
                setSaveStatus('error');
            }

        } catch (error) {
            console.error('Failed to save halftone edit:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    }, [imageUrl, onClose, item, garmentMode, onSaveSuccess]);

    const handleAntiTransparencySave = useCallback(async (processedBlob: Blob) => {
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            const buffer = await processedBlob.arrayBuffer();
            const filename = `dtf-color-edit-${Date.now()}.png`;

            const result = await electronBridge.saveImage(buffer, filename);

            if (result.success) {
                if (item) {
                    try {
                        const thumbDataUrl = URL.createObjectURL(processedBlob);
                        const thumbnail = await createThumbnail(thumbDataUrl);
                        URL.revokeObjectURL(thumbDataUrl);

                        const treatedBlobUrl = URL.createObjectURL(processedBlob);

                        saveGalleryItem({
                            prompt: item.prompt,
                            timestamp: Date.now(),
                            savedPath: result.path || filename,
                            // CRÍTICO: Substitui o masterFilePath pela própria imagem limpa
                            masterFilePath: result.path || filename,
                            treatedUrl: treatedBlobUrl, // The treated image URL for web
                            thumbnail,
                            aspectRatio: item.aspectRatio,
                            garmentMode: 'color', // Explicitly color
                            widthCm: item.widthCm,
                            heightCm: item.heightCm,
                            halftonePreset: 'Anti-Transparency',
                            upscaleFactor: item.upscaleFactor
                        });
                        console.log('[Editor] Saved Color Edit to gallery');
                    } catch (e) {
                        console.error('[Editor] Failed to update gallery:', e);
                    }
                }
                setSaveStatus('success');
                if (onSaveSuccess) onSaveSuccess();
                setTimeout(() => {
                    setSaveStatus('idle');
                    onClose();
                }, 1500);
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('Failed to save anti-transparency edit:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    }, [item, onSaveSuccess, onClose]);

    // ... (rest of imports)

    if (!isOpen) return null;

    // Use Portal to escape parent stacking context (e.g. WidgetCard Generic transforms)
    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-stretch"
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} // Reinforce fixed
            >
                {/* ═══ Tool Switcher (Floating) ═══ */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[80] flex gap-1 bg-black/80 backdrop-blur border border-white/10 p-1 rounded-xl shadow-2xl">
                    <button
                        onClick={() => setActiveTool('halftone')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTool === 'halftone'
                            ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <Grid3x3 size={14} />
                        Halftone
                    </button>
                    <button
                        onClick={() => setActiveTool('mask')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTool === 'mask'
                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <Wand2 size={14} />
                        Remover Fundo
                    </button>
                </div>

                {/* Visual Feedback for Save Status (Outside content area mainly for ATE which hides top bar) */}
                <div className="absolute top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
                    {isSaving && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-black/80 text-yellow-500 rounded-lg text-sm font-medium animate-pulse border border-yellow-500/20 shadow-xl backdrop-blur">
                            <Loader2 size={16} className="animate-spin" />
                            Salvando...
                        </div>
                    )}
                    {saveStatus === 'success' && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-black/80 text-green-500 rounded-lg text-sm font-medium border border-green-500/20 shadow-xl backdrop-blur">
                            <CheckCircle2 size={16} />
                            Salvo!
                        </div>
                    )}
                    {saveStatus === 'error' && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-black/80 text-red-500 rounded-lg text-sm font-medium border border-red-500/20 shadow-xl backdrop-blur">
                            <AlertCircle size={16} />
                            Erro na Salva
                        </div>
                    )}
                </div>


                {/* ═══ Content Area ═══ */}
                <div className="flex-1 w-full h-full relative">
                    {activeTool === 'halftone' ? (
                        <div className="flex flex-col h-full">
                            {/* Top Bar for Halftone (Only visible in Halftone mode, matches original layout) */}
                            <div className="h-16 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between px-6 flex-shrink-0" style={{ paddingTop: '0px' }}>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div>
                                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                                            Editor de Halftone
                                        </h1>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden relative">
                                <ErrorBoundary>
                                    <HalftoneSelector
                                        imageUrl={imageUrl}
                                        onApply={handleApply}
                                        onBack={onClose}
                                        garmentMode={garmentMode}
                                        mode="fullscreen"
                                    />
                                </ErrorBoundary>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full relative z-[60]">
                            {/* AntiTransparencyEditor takes full space. We wrap it in ErrorBoundary. */}
                            <ErrorBoundary>
                                <AntiTransparencyEditor
                                    imageUrl={imageUrl}
                                    onClose={onClose}
                                    onSave={handleAntiTransparencySave}
                                />
                            </ErrorBoundary>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
