import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, X, ImageIcon, Loader2, Check, Sparkles, Bug,
    RefreshCw, Lock, Settings2, Trash2, Grid3x3, LayoutGrid, Ruler, Copy, ChevronDown,
    Square, CheckSquare
} from 'lucide-react';
import { useDtfPipeline, PipelineStep } from '@dtf/hooks/useDtfPipeline';
import { electronBridge } from '@dtf/lib/electronBridge';
import { useLauncherAuth } from '@dtf/contexts/LauncherAuthContext';
import { processImageForStorage } from '@dtf/utils/imageUtils';

import { useWidgets, WidgetConfig } from '@dtf/contexts/WidgetContext';
import { usePromptStyles } from '@dtf/components/SettingsPanel';
import PromptIdeas from '@dtf/components/PromptIdeas';
import PromptHistory from '@dtf/components/PromptHistory';
import { HalftoneSettings, HALFTONE_PRESETS } from '@dtf/services/halftoneService';
import { saveGalleryItem, createThumbnail } from '@dtf/services/galleryService';
import { dataURItoBlob } from '@dtf/lib/imageUtils';
import ProcessingAnimation from '../ProcessingAnimation';
import InsufficientTokensModal from '../InsufficientTokensModal';

const HalftoneSelectorLazy = React.lazy(() => import('@dtf/components/HalftoneSelector'));
const HalftoneSelector = (props: any) => (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-cyan-500" /></div>}>
        <HalftoneSelectorLazy {...props} />
    </Suspense>
);

const HalftoneEditorOverlayLazy = React.lazy(() => import('@dtf/components/Gallery/HalftoneEditorOverlay'));
const HalftoneEditorOverlay = (props: any) => (
    <Suspense fallback={null}>
        <HalftoneEditorOverlayLazy {...props} />
    </Suspense>
);

type CardStep = 'config' | 'processing' | 'halftone' | 'completed' | 'error';

// Aspect Ratios (com visual preview) - INCLUI 2:3 e 3:2
const ASPECT_RATIOS = [
    { value: '1:1', label: 'Quadrado', width: 40, height: 40, maxPx: { w: 8192, h: 8192 } },
    { value: '3:2', label: 'Paisagem', width: 48, height: 32, maxPx: { w: 9600, h: 6400 } },
    { value: '2:3', label: 'Retrato', width: 32, height: 48, maxPx: { w: 6400, h: 9600 } },
    { value: '9:16', label: 'Story', width: 27, height: 48, maxPx: { w: 6144, h: 11008 } },
    { value: '16:9', label: 'Wide', width: 48, height: 27, maxPx: { w: 11008, h: 6144 } },
    { value: '4:3', label: 'Padrão', width: 44, height: 33, maxPx: { w: 9600, h: 7168 } },
    { value: '3:4', label: 'Vertical', width: 33, height: 44, maxPx: { w: 7168, h: 9600 } },
    { value: 'auto', label: 'Auto', width: 36, height: 36, maxPx: { w: 1000, h: 1000 } },
];

const DPI = 300;
const CM_TO_PX = DPI / 2.54;
const MAX_IMAGES = 5;

interface WidgetCardProps {
    config: WidgetConfig;
}

const WidgetCard = React.forwardRef<HTMLDivElement, WidgetCardProps>(({ config }, ref) => {
    const { 
        updateWidget, 
        removeWidget, 
        duplicateWidget, 
        globalGenerationTimestamp, 
        setWidgetGenerating,
        selectedIds,
        isSelectionMode,
        toggleWidgetSelection 
    } = useWidgets();
    const isSelected = selectedIds.has(config.id);
    const { tokenBalance, session, refreshBalance, updateBalanceOptimistically } = useLauncherAuth();
    const { styles } = usePromptStyles();

    // Card local state
    // Se não tiver status externo (API) nem estiver processando, volta pra config sempre
    const [cardStep, setCardStep] = useState<CardStep>(config.externalStatus?.step === 'completed' ? 'completed' : 'config');
    const [prompt, setPrompt] = useState(config.prompt);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [garmentMode, setGarmentMode] = useState<'black' | 'white' | 'color'>(config.garmentMode || 'black');
    const [aspectRatio, setAspectRatio] = useState<string>(config.aspectRatio);
    const [modelId, setModelId] = useState<string>('nano-banana-2');
    // Initialize with config values to ensure duplication works
    const [widthCm, setWidthCm] = useState(config.widthCm || 0);
    const [heightCm, setHeightCm] = useState(config.heightCm || 0);

    const { state: pipelineState, run, reprocessHalftone, reset } = useDtfPipeline();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const gallerySavedRef = useRef(false);

    // Override local state with external status (Remote Control for Pro Mode API)
    useEffect(() => {
        if (config.externalStatus) {
            const status = config.externalStatus;
            
            // Map external pipeline step to card step
            if (['generating', 'analyzing', 'fixing_background', 'upscaling', 'halftoning', 'saving'].includes(status.step)) {
                setCardStep('processing');
            } else if (status.step === 'completed') {
                setCardStep('completed');
            } else if (status.step === 'error') {
                setCardStep('error');
            }
        }
    }, [config.externalStatus]);

    // Use derived state for rendering if external status is present
    const activeState = config.externalStatus ? {
        step: config.externalStatus.step as PipelineStep,
        progress: config.externalStatus.progress,
        message: config.externalStatus.message,
        error: config.externalStatus.error || null,
        // Garante que a imagem renderize mesmo que externalStatus.imageUrl esteja vazio mas uploadedImages não
        imageUrl: config.externalStatus.imageUrl || (config.uploadedImages && config.uploadedImages.length > 0 ? config.uploadedImages[0] : null),
        upscaledImageUrl: null, 
        savedPath: config.externalStatus.savedPath || null,
    } : pipelineState;

    // Sync context → local state (quando a IA atualiza via updateWidget)
    useEffect(() => {
        if (config.prompt && config.prompt !== prompt && cardStep === 'config') {
            setPrompt(config.prompt);
        }
    }, [config.prompt]);

    useEffect(() => {
        if (config.garmentMode && config.garmentMode !== garmentMode) {
            setGarmentMode(config.garmentMode);
        }
    }, [config.garmentMode]);

    const [maxDimensions, setMaxDimensions] = useState({ wCm: 0, hCm: 0, wPx: 0, hPx: 0 });
    const [isLocked] = useState(true);
    const [editingSize, setEditingSize] = useState(false);
    const [showHalftoneDropdown, setShowHalftoneDropdown] = useState(false); // New state for custom dropdown
    const [isInsufficientTokensModalOpen, setIsInsufficientTokensModalOpen] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-swap halftone preset suffix when garmentMode changes (preto ↔ branco)
    useEffect(() => {
        if (garmentMode === 'color') return;
        const currentPreset = config.halftonePreset || 'halftone_medio_preto';
        const targetSuffix = garmentMode === 'white' ? '_branco' : '_preto';
        const oppositeSuffix = garmentMode === 'white' ? '_preto' : '_branco';
        if (currentPreset.endsWith(oppositeSuffix)) {
            const swapped = currentPreset.replace(oppositeSuffix, targetSuffix);
            updateWidget(config.id, { halftonePreset: swapped });
        }
    }, [garmentMode]);

    // Track previous config values to detect REAL server-side changes
    const prevConfigRef = useRef({ w: config.widthCm, h: config.heightCm, ar: config.aspectRatio });

    useEffect(() => {
        const prev = prevConfigRef.current;
        const currW = config.widthCm;
        const currH = config.heightCm;
        const currAr = config.aspectRatio;

        // Check if config ACTUALLY changed from server side (AI or other widget update)
        // Use loose equality to handle string/number differences
        const wChanged = currW !== undefined && currW != prev.w;
        const hChanged = currH !== undefined && currH != prev.h;
        const arChanged = currAr !== undefined && currAr != prev.ar;

        // Ensure we calculate if ONE dimension is 0 but the other is valid (and not just changed)
        const hasZeroW = (currW === 0 || !currW) && currH !== undefined && currH > 0;
        const hasZeroH = (currH === 0 || !currH) && currW !== undefined && currW > 0;

        // If nothing changed in config AND we don't have a zero-fix needed, do nothing
        if (!wChanged && !hChanged && !arChanged && !hasZeroW && !hasZeroH) return;

        // Update ref for next render
        prevConfigRef.current = { w: currW, h: currH, ar: currAr };

        const targetAspectRatio = currAr || aspectRatio;

        // LOGIC: Only update local state if the CONFIG changed. 
        // This means the change came from the Server/AI, not the user typing locally.

        if (wChanged && hChanged) {
            const valW = Number(currW!);
            const valH = Number(currH!);

            // If only one is valid > 0 (and other is 0), treat as partial update to calc the other
            if (valW > 0 && valH > 0) {
                if (currW !== widthCm) setWidthCm(valW);
                if (currH !== heightCm) setHeightCm(valH);
            } else if (valW > 0 && valH === 0 && targetAspectRatio !== 'auto') {
                // AI sent W=57, H=0 (example) -> Calc Height
                if (currW !== widthCm) setWidthCm(valW);
                const [arW, arH] = targetAspectRatio.split(':').map(Number);
                if (arW && arH) {
                    const ratio = arH / arW;
                    const newH = parseFloat((valW * ratio).toFixed(2));
                    if (Math.abs(newH - heightCm) > 0.01) setHeightCm(newH);
                }
            } else if (valH > 0 && valW === 0 && targetAspectRatio !== 'auto') {
                // AI sent H=57, W=0 -> Calc Width
                if (currH !== heightCm) setHeightCm(valH);
                const [arW, arH] = targetAspectRatio.split(':').map(Number);
                if (arW && arH) {
                    const ratio = arW / arH;
                    const newW = parseFloat((valH * ratio).toFixed(2));
                    if (Math.abs(newW - widthCm) > 0.01) setWidthCm(newW);
                }
            }
        } else if (wChanged || hasZeroH) {
            const valW = Number(currW!);
            if (valW > 0) {
                if (currW !== widthCm) setWidthCm(valW);
                if (targetAspectRatio !== 'auto') {
                    const [arW, arH] = targetAspectRatio.split(':').map(Number);
                    if (arW && arH) {
                        const ratio = arH / arW;
                        const newH = parseFloat((valW * ratio).toFixed(2));
                        if (Math.abs(newH - heightCm) > 0.01) setHeightCm(newH);
                    }
                }
            }
        } else if (hChanged || hasZeroW) {
            const valH = Number(currH!);
            if (valH > 0) {
                if (currH !== heightCm) setHeightCm(valH);
                if (targetAspectRatio !== 'auto') {
                    const [arW, arH] = targetAspectRatio.split(':').map(Number);
                    if (arW && arH) {
                        const ratio = arW / arH;
                        const newW = parseFloat((valH * ratio).toFixed(2));
                        if (Math.abs(newW - widthCm) > 0.01) setWidthCm(newW);
                    }
                }
            }
        } else if (arChanged) {
            // Aspect Ratio changed by AI
            // Update local AspectRatio state
            setAspectRatio(currAr || '2:3');

            // Recalc dimensions based on current width (or default) IF no explicit dimensions were sent
            if (targetAspectRatio !== 'auto' && widthCm > 0) {
                const [arW, arH] = targetAspectRatio.split(':').map(Number);
                if (arW && arH) {
                    const ratio = arH / arW;
                    const newH = parseFloat((widthCm * ratio).toFixed(2));
                    setHeightCm(newH);
                }
            }
        }
    }, [config.widthCm, config.heightCm, config.aspectRatio, aspectRatio]);

    // Initialize images from config (Deep Copy / Persistence support)
    useEffect(() => {
        if (imageFiles.length === 0 && config.uploadedImages && config.uploadedImages.length > 0) {
            const loadImages = async () => {
                const files = await Promise.all(config.uploadedImages.map(async (dataUrl, i) => {
                    const blob = await dataURItoBlob(dataUrl);
                    return new File([blob], `image_${i}.png`, { type: 'image/png' });
                }));
                setImageFiles(files);
                setImagePreviews(config.uploadedImages);
            };
            loadImages();
        }
    }, [config.uploadedImages]);

    // Set default sizes when AR changes
    // Calc Max Dimensions & Init Default Size (Only if 0,0)
    useEffect(() => {
        if (!aspectRatio) return;
        const arConfig = ASPECT_RATIOS.find(r => r.value === aspectRatio);
        if (!arConfig) return;

        // Calculate defaults
        let newMaxDims = { wCm: 0, hCm: 0, wPx: 0, hPx: 0 };
        let newWCm = 0;
        let newHCm = 0;

        if (aspectRatio === 'auto') {
            newMaxDims = { wCm: 300, hCm: 1000, wPx: Math.round(300 * CM_TO_PX), hPx: Math.round(1000 * CM_TO_PX) };
            newWCm = 30;
            newHCm = 40;
        } else {
            const maxW = parseFloat((arConfig.maxPx.w / CM_TO_PX).toFixed(2));
            const maxH = parseFloat((arConfig.maxPx.h / CM_TO_PX).toFixed(2));
            newMaxDims = { wCm: maxW, hCm: maxH, wPx: arConfig.maxPx.w, hPx: arConfig.maxPx.h };
            newWCm = maxW;
            newHCm = maxH;
        }
        setMaxDimensions(newMaxDims);

        // Only set defaults if we are completely uninitialized (0,0)
        // We DO NOT override if config.aspectRatio changes, because that is handled by the main sync useEffect above.
        if (widthCm === 0 && heightCm === 0) {
            setWidthCm(newWCm);
            setHeightCm(newHCm);
            // Updating context here is safe for init
            updateWidget(config.id, { widthCm: newWCm, heightCm: newHCm });
        }
    }, [aspectRatio, widthCm, heightCm, config.id, updateWidget]);

    // SYNC PROMPT & SIZES TO CONTEXT (Debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (prompt !== config.prompt) {
                updateWidget(config.id, { prompt });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [prompt, config.id, config.prompt, updateWidget]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (widthCm !== config.widthCm || heightCm !== config.heightCm) {
                updateWidget(config.id, { widthCm, heightCm });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [widthCm, heightCm, config.id, config.widthCm, config.heightCm, updateWidget]);

    // Sync pipeline state with card step
    useEffect(() => {
        // Skip if controlled externally
        if (config.externalStatus) return;

        if (cardStep === 'processing') {
            if (pipelineState.step === 'completed' || pipelineState.step === 'saving') {
                setTimeout(() => setCardStep('completed'), 500);
            }
            if (pipelineState.step === 'error') {
                setCardStep('error');
            }
        }
        if (cardStep === 'processing' || pipelineState.step === 'saving') {
            setWidgetGenerating(config.id, true);
        } else {
            setWidgetGenerating(config.id, false);
        }
    }, [pipelineState.step, cardStep, config.id, setWidgetGenerating, config.externalStatus]);

    // Handle Global Generation Trigger
    useEffect(() => {
        // Skip if controlled externally
        if (config.externalStatus) return;

        if (globalGenerationTimestamp > 0 && cardStep === 'config') {
            if (prompt.trim() || imageFiles.length > 0) {
                handleGenerate();
            }
        }
    }, [globalGenerationTimestamp, config.externalStatus]);

    // Helpers for temp item
    const tempGalleryItem = activeState.imageUrl ? {
        id: `temp-${Date.now()}`,
        prompt: prompt,
        timestamp: Date.now(),
        savedPath: activeState.savedPath,
        masterFilePath: activeState.savedMasterPath || activeState.savedPath || null,
        masterUrl: activeState.upscaledImageUrl || activeState.imageUrl,
        thumbnail: '',
        aspectRatio: aspectRatio,
        garmentMode: garmentMode,
        widthCm: widthCm,
        heightCm: heightCm,
        halftonePreset: 'none',
        upscaleFactor: 4 // Assuming default
    } : null;

    // Auto-save to gallery & Sync Local Result
    useEffect(() => {
        // Verifica se terminou e se TEM imagem gerada (ignora imagens que o usuário fez upload manual)
        // Usa activeState.savedPath como indicador forte de que foi gerado agorinha
        if (activeState.step === 'completed' && activeState.imageUrl && activeState.savedPath && !gallerySavedRef.current) {
            gallerySavedRef.current = true;
            
            // Send local result up to context so the Grid can access them for Batch Send
            // IMPORTANT: Use activeState.imageUrl (the TREATED/halftone image), NOT upscaledImageUrl (raw)
            updateWidget(config.id, {
                localResult: {
                    imageUrl: activeState.imageUrl,
                    savedPath: activeState.savedPath
                }
            });

            createThumbnail(activeState.imageUrl).then(thumbnail => {
                saveGalleryItem({
                    prompt: prompt,
                    timestamp: Date.now(),
                    savedPath: activeState.savedPath || null,
                    masterFilePath: (activeState as any).savedMasterPath || activeState.savedPath || null,
                    masterUrl: (activeState as any).upscaledImageUrl || activeState.imageUrl,
                    treatedUrl: activeState.imageUrl, // The FINAL treated (halftone) image URL
                    thumbnail,
                    aspectRatio,
                    garmentMode,
                    widthCm,
                    heightCm,
                    halftonePreset: config.halftonePreset,
                });
                console.log('[WidgetCard] ✅ Saved to gallery & Synced Local Result');
            }).catch(err => console.warn('[WidgetCard] Gallery save failed:', err));
        }
        
        // Reset do ref apenas quando o processo REALMENTE reinicia ou volta pro começo
        if (activeState.step === 'idle' || activeState.step === 'analyzing') {
            gallerySavedRef.current = false;
        }
    }, [activeState.step, activeState.imageUrl, activeState.savedPath, prompt, aspectRatio, garmentMode, widthCm, heightCm, config.halftonePreset, config.id, updateWidget]);

    // File handlers
    const updateWidgetImages = (newPreviews: string[]) => {
        updateWidget(config.id, { uploadedImages: newPreviews });
    };

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const currentFiles = imageFiles;
        const availableSlots = MAX_IMAGES - currentFiles.length;
        const newFiles = files.slice(0, availableSlots);
        if (newFiles.length === 0) return;

        // Optimistic UI update
        const updatedFiles = [...currentFiles, ...newFiles];
        setImageFiles(updatedFiles);

        // Process images for storage (resize & compress)
        try {
            const newPreviews = await Promise.all(newFiles.map(file => processImageForStorage(file)));

            // Combine with existing previews if needed (but logic here seems to replace/append differently)
            // Existing logic was: newPreviews.push... then setImagePreviews(newPreviews) which implies it was REPLACING or APPENDING?
            // Wait, existing logic was pushing into `newPreviews` array which started empty.
            // But usually we want to KEEP existing previews.
            // Let's check `imagePreviews` state usage.
            // Ah, `imagePreviews` is state.
            // The original code was: `updatedFiles.forEach` -> `newPreviews.push`. 
            // So it was regenerating previews for ALL files including existing ones?
            // "updatedFiles" contains BOTH current and new.
            // So yes, it was regenerating everything. That's inefficient but safe.

            // Let's optimize: Keep existing previews, only process NEW files.
            // But wait, `updatedFiles` is a mix.
            // Actually, `processImageForStorage` returns a Data URL string.
            // We should process NEW files, and append to EXISTING previews.

            const processedNewPreviews = await Promise.all(newFiles.map(file => processImageForStorage(file)));
            const allPreviews = [...imagePreviews, ...processedNewPreviews];

            setImagePreviews(allPreviews);
            updateWidgetImages(allPreviews);

        } catch (error) {
            console.error("Error processing images", error);
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [imageFiles, imagePreviews, config.id, updateWidget]);

    const handleRemoveImage = useCallback((index: number) => {
        const newFiles = imageFiles.filter((_, i) => i !== index);
        const newPreviews = imagePreviews.filter((_, i) => i !== index);
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
        updateWidgetImages(newPreviews);
    }, [imageFiles, imagePreviews, config.id, updateWidget]);

    // Resize handler
    const handleResizeInputChange = (dim: 'width' | 'height', val: string) => {
        let num = parseFloat(val);
        if (isNaN(num)) num = 0;
        if (dim === 'width') {
            setWidthCm(num);
            if (isLocked && aspectRatio !== 'auto' && maxDimensions.wCm > 0) {
                const ratio = maxDimensions.hCm / maxDimensions.wCm;
                setHeightCm(parseFloat((num * ratio).toFixed(2)));
            }
        } else {
            setHeightCm(num);
            if (isLocked && aspectRatio !== 'auto' && maxDimensions.hCm > 0) {
                const ratio = maxDimensions.wCm / maxDimensions.hCm;
                setWidthCm(parseFloat((num * ratio).toFixed(2)));
            }
        }
    };

    // Start generation
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim() && imageFiles.length === 0) return;
        const targetW = Math.round(widthCm * CM_TO_PX);
        const targetH = Math.round(heightCm * CM_TO_PX);

        if ((tokenBalance || 0) < 20) {
            setIsInsufficientTokensModalOpen(true);
            return;
        }

        setCardStep('processing');
        const style = styles.find(s => s.id === config.promptStyle);
        let suffix = style?.suffix || '';
        if (garmentMode === 'color') {
            suffix += " Crie um traçado que contraste com o fundo, deixe o fundo solido de uma cor que separe o desenho do fundo";
        }
        const finalPrompt = prompt.trim() + suffix;

        if (prompt.trim()) electronBridge.savePromptHistory(prompt.trim());
        updateBalanceOptimistically(-20);

        try {
            await run({
                prompt: finalPrompt || 'Enhance image quality',
                imageFiles,
                aspectRatio,
                halftonePreset: config.halftonePreset,
                targetWidth: targetW,
                targetHeight: targetH,
                edgeContraction: config.edgeContraction,
                garmentMode: garmentMode,
                modelId: modelId,
            }, session?.access_token);

            refreshBalance();
            const isFocused = await electronBridge.isWindowFocused();
            if (!isFocused) {
                electronBridge.showNotification('Geração Concluída!', 'Sua arte DTF está pronta.');
            }
        } catch (e) {
            console.error('[WidgetCard] Pipeline error:', e);
            updateBalanceOptimistically(20);
            electronBridge.showNotification('Tokens Estornados', '+20 tokens devolvidos ao seu saldo.');
        }
    }, [prompt, imageFiles, widthCm, heightCm, aspectRatio, garmentMode, config, styles, run, session, tokenBalance, refreshBalance, updateBalanceOptimistically]);

    const handleRetry = useCallback(() => {
        // Limpar imagens geradas da UI local
        updateWidget(config.id, {
            externalStatus: undefined // Remove o status de 'completed' da API
        });
        
        // Se a geração não foi via API (foi manual local), limpamos o pipeline local
        reset();
        
        // Voltar para a tela inicial
        setCardStep('config');
    }, [reset, config.id, updateWidget]);

    const handleRemove = () => {
        if (cardStep === 'processing') return;
        removeWidget(config.id);
    };

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            const availableSlots = MAX_IMAGES - imageFiles.length;
            const newFiles = files.slice(0, availableSlots);
            if (newFiles.length === 0) return;
            const updatedFiles = [...imageFiles, ...newFiles];
            setImageFiles(updatedFiles);
            const newPreviews: string[] = [];
            let processedCount = 0;
            updatedFiles.forEach((file) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const result = ev.target?.result as string;
                    if (result) newPreviews.push(result);
                    processedCount++;
                    if (processedCount === updatedFiles.length) {
                        setImagePreviews(newPreviews);
                        updateWidgetImages(newPreviews);
                    }
                };
                reader.readAsDataURL(file);
            });
            setCardStep('config');
        }
    }, [imageFiles, config.id, updateWidget]);

    return (
        <>
            <motion.div
                ref={ref}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`relative rounded-2xl border overflow-hidden backdrop-blur-2xl flex flex-col transition-all duration-300 ${
                    isSelected 
                        ? 'border-orange-500 ring-4 ring-orange-500/20 z-10 scale-[1.02] shadow-[0_0_40px_rgba(249,115,22,0.4)]' 
                        : isSelectionMode
                            ? 'border-white/20 bg-black/40 scale-[0.98] grayscale-[0.3]'
                            : cardStep === 'processing'
                                ? 'border-cyan-500/30 bg-black/90 shadow-cyan-500/5'
                                : cardStep === 'completed'
                                    ? 'border-green-500/20 bg-black/80 shadow-2xl'
                                    : cardStep === 'error'
                                        ? 'border-red-500/20 bg-black/80'
                                        : 'border-white/10 bg-black/80'
                } ${isSelectionMode ? 'cursor-pointer hover:border-orange-500/50' : ''}`}
                tabIndex={0}
                onPaste={handlePaste}
                onClick={() => isSelectionMode && toggleWidgetSelection(config.id)}
            >
                {/* ═══ SELECTION OVERLAY ═══ */}
                <AnimatePresence>
                    {isSelectionMode && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[50] pointer-events-none"
                        >
                            {/* Indicador de Seleção Superior Esquerdo */}
                            <div className="absolute top-4 left-4 z-[51]">
                                {isSelected ? (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="w-8 h-8 rounded-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)] flex items-center justify-center text-black"
                                    >
                                        <Check size={20} strokeWidth={4} />
                                    </motion.div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full border-2 border-white/30 bg-black/20 backdrop-blur-md" />
                                )}
                            </div>

                            {/* Tint Overlay when NOT selected in selection mode */}
                            {!isSelected && (
                                <div className="absolute inset-0 bg-black/40" />
                            )}
                            
                            {/* Glow for selected state */}
                            {isSelected && (
                                <div className="absolute inset-0 border-[4px] border-orange-500/20 pointer-events-none" />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══ TOP BAR ═══ */}
                <div className="px-4 py-3 border-b border-white/5 bg-white/[0.03]">
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                                {aspectRatio}
                            </span>
                            <span className="text-[10px] text-white/30">
                                {garmentMode === 'white' ? '⬜ Branca' : garmentMode === 'color' ? '🎨 Colorida' : '⬛ Preta'}
                            </span>
                            {/* Halftone Preset Selector (Custom Dropdown) */}
                            {garmentMode !== 'color' ? (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowHalftoneDropdown(!showHalftoneDropdown)}
                                        onBlur={() => setTimeout(() => setShowHalftoneDropdown(false), 200)}
                                        className="text-[9px] pl-2 pr-1 py-0.5 rounded bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5 min-w-[100px] justify-between"
                                    >
                                        <span className="truncate max-w-[80px]">
                                            {(config.halftonePreset === 'removeBlack' ? '🚫 Remover Preto' :
                                                HALFTONE_PRESETS[config.halftonePreset || 'halftone_medio_preto']?.name.replace(/\s*\(.*\)/, '') || 'Retícula Médio')}
                                            {(config.halftonePreset?.includes('medio') || !config.halftonePreset) && ' ★'}
                                        </span>
                                        <ChevronDown size={10} className={`text-cyan-400 transition-transform ${showHalftoneDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {showHalftoneDropdown && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                                transition={{ duration: 0.1 }}
                                                className="absolute top-full left-0 mt-1 w-48 bg-[#09090b] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-[300px] overflow-y-auto"
                                            >
                                                <div className="px-2 py-1.5 text-[9px] font-bold text-white/30 uppercase tracking-wider">Opções</div>

                                                <button
                                                    onClick={() => { updateWidget(config.id, { halftonePreset: 'removeBlack' }); setShowHalftoneDropdown(false); }}
                                                    className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/5 transition-colors flex items-center gap-2 ${config.halftonePreset === 'removeBlack' ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/70'}`}
                                                >
                                                    <span>🚫</span> Remover Preto
                                                </button>

                                                <div className="h-px bg-white/5 my-1" />

                                                {['Retícula (Círculo)', 'Hachura (Linha)', 'Quadrado', 'Espiral'].map((group) => (
                                                    <div key={group}>
                                                        <div className="px-2 py-1 text-[9px] font-bold text-cyan-500/50 uppercase mt-1">{group}</div>
                                                        {Object.entries(HALFTONE_PRESETS)
                                                            .filter(([key, val]) => {
                                                                if (config.garmentMode === 'white' && !key.includes('branco')) return false;
                                                                if (config.garmentMode !== 'white' && !key.includes('preto')) return false;
                                                                if (group.includes('Retícula') && !val.name.includes('Retícula')) return false;
                                                                if (group.includes('Hachura') && !val.name.includes('Hachura')) return false;
                                                                if (group.includes('Quadrado') && !val.name.includes('Quadrado')) return false;
                                                                if (group.includes('Espiral') && !val.name.includes('Espiral')) return false;
                                                                return true;
                                                            })
                                                            .map(([key, val]) => (
                                                                <button
                                                                    key={key}
                                                                    onClick={() => { updateWidget(config.id, { halftonePreset: key }); setShowHalftoneDropdown(false); }}
                                                                    className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/5 transition-colors flex items-center justify-between ${config.halftonePreset === key ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/70'}`}
                                                                >
                                                                    <span>{val.name.split(' - ')[1].replace(/\(.*\)/, '')}</span>
                                                                    {key.includes('medio') && <span className="text-[8px] text-yellow-500/50">★</span>}
                                                                </button>
                                                            ))}
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                    Remover BG
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => duplicateWidget(config.id)} className="p-1.5 rounded-lg text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors" title="Duplicar widget"><Copy size={14} /></button>
                            <button onClick={handleRemove} disabled={cardStep === 'processing'} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-20" title="Remover widget"><Trash2 size={14} /></button>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-xl border border-white/8 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-2">
                            <Ruler size={12} className="text-cyan-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Tamanho de Impressão</span>
                            <span className="text-[9px] text-white/20 ml-auto">300 DPI</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <input type="number" step="0.1" value={widthCm} onChange={(e) => handleResizeInputChange('width', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs outline-none focus:border-cyan-500/50 transition-all text-center" />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-white/20 pointer-events-none">cm</span>
                            </div>
                            <div className="text-white/20 flex-shrink-0">{aspectRatio === 'auto' ? <Settings2 size={12} /> : <Lock size={12} />}</div>
                            <div className="flex-1 relative">
                                <input type="number" step="0.1" value={heightCm} onChange={(e) => handleResizeInputChange('height', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs outline-none focus:border-cyan-500/50 transition-all text-center" />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-white/20 pointer-events-none">cm</span>
                            </div>
                        </div>
                        <p className="text-[8px] text-white/15 text-center mt-1.5">Máx: {maxDimensions.wCm > 0 ? `${maxDimensions.wCm} × ${maxDimensions.hCm} cm` : '—'}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {/* CONFIG STEP */}
                        {cardStep === 'config' && (
                            <motion.div key="config" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="p-4 space-y-4 overflow-y-auto custom-scrollbar max-h-[520px]">
                                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all">
                                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onPaste={handlePaste} placeholder="Descreva a arte DTF que deseja criar..." rows={4} className="w-full px-4 py-3 bg-transparent text-white placeholder-white/30 focus:outline-none resize-none text-sm leading-relaxed" />
                                    <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/5 bg-white/[0.02]">
                                        <div className="flex items-center gap-2">
                                            {imagePreviews.map((preview, index) => (
                                                <div key={index} className="relative w-9 h-9 group flex-shrink-0">
                                                    <div className="w-full h-full rounded-lg overflow-hidden border border-cyan-500/30"><img src={preview} alt="" className="w-full h-full object-cover" /></div>
                                                    <button onClick={() => handleRemoveImage(index)} className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 rounded-full shadow-sm z-20 hover:scale-110 transition-transform flex items-center justify-center cursor-pointer" title="Remover imagem"><X size={8} className="text-white" /></button>
                                                </div>
                                            ))}
                                            {imagePreviews.length < MAX_IMAGES && (
                                                <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-lg border border-dashed border-white/20 hover:border-cyan-500/50 flex items-center justify-center text-white/40 hover:text-cyan-400 transition-all" title={`Adicionar imagem (${imagePreviews.length}/${MAX_IMAGES})`}><ImageIcon size={14} /></button>
                                            )}
                                            <span className="text-[10px] text-white/25">{imagePreviews.length > 0 ? `${imagePreviews.length}/${MAX_IMAGES}` : 'Até 5 imgs'}</span>
                                        </div>
                                        <div className="flex items-center gap-1"><PromptHistory onSelectPrompt={setPrompt} currentPrompt={prompt} /><PromptIdeas onSelectPrompt={setPrompt} /></div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setGarmentMode('black')} className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-medium ${garmentMode === 'black' ? 'bg-zinc-800 border-white/20 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}`}><div className="w-5 h-5 bg-black rounded border border-white/10" />Preta</button>
                                    <button onClick={() => setGarmentMode('white')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider ${garmentMode === 'white' ? 'bg-zinc-100 border-white/80 text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:bg-white/10'}`}><div className="w-3.5 h-3.5 bg-white rounded-sm border border-black/20" />Branca</button>
                                    <button onClick={() => setGarmentMode('color')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider ${garmentMode === 'color' ? 'bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 border-white/30 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:bg-white/10'}`}><div className="w-3.5 h-3.5 rounded-sm border border-white/20 bg-gradient-to-tr from-blue-400 via-purple-400 to-red-400" />Colorida</button>
                                </div>
                                <div className="flex gap-2 pb-1">
                                    <button onClick={() => setModelId('nano-banana-2')} className={`flex-1 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase ${modelId === 'nano-banana-2' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}>Nano Banana 2 (C/ Web Search)</button>
                                    <button onClick={() => setModelId('nano-banana-pro')} className={`flex-1 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase ${modelId === 'nano-banana-pro' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}>Nano Banana Pro</button>
                                </div>
                                <button onClick={handleGenerate} disabled={(!prompt.trim() && imageFiles.length === 0)} className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:cursor-not-allowed text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] text-sm"><Sparkles size={16} />GERAR (-20 Tokens)</button>
                            </motion.div>
                        )}

                        {/* PROCESSING STEP */}
                        {(cardStep === 'processing' && config.externalStatus?.step !== 'completed') && (
                            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full min-h-[300px] flex items-center justify-center">
                                <ProcessingAnimation message={activeState.message} progress={activeState.progress} step={activeState.step} imageUrl={activeState.imageUrl} garmentMode={garmentMode} />
                            </motion.div>
                        )}

                        {/* HALFTONE STEP */}
                        {cardStep === 'halftone' && (activeState.upscaledImageUrl || activeState.imageUrl) && (
                            <motion.div key="halftone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <HalftoneSelector imageUrl={activeState.upscaledImageUrl || activeState.imageUrl!} garmentMode={garmentMode} onApply={(_preset: string, settings: HalftoneSettings) => { setCardStep('processing'); reprocessHalftone(settings); }} onBack={() => setCardStep('completed')} />
                            </motion.div>
                        )}

                        {/* COMPLETED STEP */}
                        {(cardStep === 'completed' || config.externalStatus?.step === 'completed') && activeState.imageUrl && (
                            <motion.div key="completed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 relative group">
                                    <img src={activeState.imageUrl} alt="Resultado" className="w-full h-auto max-h-[300px] object-contain" />
                                    {activeState.savedPath && (<div className="absolute top-2 left-2 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center gap-1 text-green-400 text-[10px]"><Check size={10} /> Salvo</div>)}

                                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                                        {activeState.upscaledImageUrl && garmentMode !== 'color' && (
                                            <button onClick={() => setCardStep('halftone')} title="Editar Halftone" className="p-2.5 bg-black/80 backdrop-blur-md border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-colors rounded-lg flex items-center justify-center">
                                                <Grid3x3 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    {garmentMode === 'color' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm z-30">
                                            <button onClick={() => setIsEditorOpen(true)} className="px-6 py-3 bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-cyan-400 hover:scale-105 transition-all flex items-center justify-center gap-2">
                                                <Sparkles size={18} />
                                                CONTINUAR
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => electronBridge.openFolder()} className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-medium rounded-xl transition-colors flex items-center justify-center">Abrir Pasta</button>
                                    <button
                                        onClick={() => activeState.imageUrl && electronBridge.launchMontador([activeState.imageUrl])}
                                        className="w-full py-2.5 bg-gradient-to-br from-orange-400 to-amber-600 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_10px_20px_rgba(245,158,11,0.2)] hover:scale-105 active:scale-[0.98] flex items-center justify-center gap-1.5"
                                    >
                                        <LayoutGrid size={14} />
                                        Montador
                                    </button>
                                </div>
                                <button onClick={handleRetry} className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"><RefreshCw size={14} />Nova Geração</button>
                            </motion.div>
                        )}

                        {/* ERROR STEP */}
                        {cardStep === 'error' && (
                            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 flex flex-col items-center justify-center gap-4 min-h-[220px] text-center">
                                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20"><Bug size={32} className="text-red-500" /></div>
                                <div className="space-y-1.5">
                                    <h3 className="text-sm font-bold text-red-400">Ops! Algo deu errado</h3>
                                    <p className="text-xs text-red-200/60 max-w-[240px] leading-relaxed">{activeState.error?.includes('JWT expired') ? 'Seu acesso expirou. Feche e abra novamente.' : (activeState.error || 'Erro desconhecido')}</p>
                                </div>
                                <button onClick={handleRetry} className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"><RefreshCw size={14} />Tentar Novamente</button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Editor Overlay */}
                {activeState.imageUrl && (
                    <HalftoneEditorOverlay
                        isOpen={isEditorOpen}
                        imageUrl={activeState.upscaledImageUrl || activeState.imageUrl}
                        garmentMode={garmentMode}
                        item={tempGalleryItem as any}
                        onClose={() => setIsEditorOpen(false)}
                    />
                )}
            </motion.div >

            {/* Insufficient Tokens Modal */}
            <InsufficientTokensModal
                isOpen={isInsufficientTokensModalOpen}
                onClose={() => setIsInsufficientTokensModalOpen(false)}
            />
        </>
    );
});

WidgetCard.displayName = 'WidgetCard';
export default WidgetCard;
