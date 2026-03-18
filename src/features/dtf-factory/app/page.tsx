

import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ArrowLeft, Check, Loader2, Settings2, Sparkles, ImageIcon, Bug, Lock, Minus, Coins, RefreshCw, Image as GalleryIcon, Crown, MessageSquare } from 'lucide-react';

import { useDtfPipeline, PipelineStep } from '@dtf/hooks/useDtfPipeline';
import { electronBridge } from '@dtf/lib/electronBridge';
import SettingsPanel, { usePromptStyles } from '@dtf/components/SettingsPanel';
import ProcessingAnimation from '@dtf/components/ProcessingAnimation';
import ResultDisplay from '@dtf/components/ResultDisplay';
import { HalftoneSettings } from '@dtf/services/halftoneService';
import { GalleryItem } from '@dtf/services/galleryService';

const HalftoneSelectorLazy = React.lazy(() => import('@dtf/components/HalftoneSelector'));
const HalftoneSelector = (props: any) => (
  <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-cyan-500" /></div>}>
    <HalftoneSelectorLazy {...props} />
  </Suspense>
);
// import Link from 'next/link'; // Removed
import { Link } from 'react-router-dom';
import PromptHistory from '@dtf/components/PromptHistory';
import PromptIdeas from '@dtf/components/PromptIdeas';
import NotificationToast, { NotificationType } from '@dtf/components/NotificationToast';
import { useContextMode } from '@dtf/hooks/useContextMode';
import { useLauncherAuth } from '@dtf/contexts/LauncherAuthContext';
import { useWidgets } from '@dtf/contexts/WidgetContext';
import WidgetGrid from '@dtf/components/Widget/WidgetGrid';
import GalleryPanel from '@dtf/components/Gallery/GalleryPanel';
import HalftoneEditorOverlay from '@dtf/components/Gallery/HalftoneEditorOverlay';
import ProUpgradeModal from '@dtf/components/ProUpgradeModal';
import ProExpiredModal from '@dtf/components/ProExpiredModal';
import OnboardingTutorial from '@dtf/components/OnboardingTutorial';
import ChatPanel from '@dtf/components/ChatPanel';
import MobileBottomNav from '@dtf/components/MobileBottomNav';

const ThreeBackgroundLazy = React.lazy(() => import('@dtf/components/ThreeBackground'));
const ThreeBackground = (props: any) => (
  <Suspense fallback={<div className="fixed inset-0 -z-10 bg-black" />}>
    <ThreeBackgroundLazy {...props} />
  </Suspense>
);

// Estados do Widget
type WidgetStep = 'input' | 'aspect_ratio' | 'processing' | 'halftone_selection' | 'completed' | 'error';

// Aspect Ratios com preview visual e Max Resolutions (300 DPI target)
const ASPECT_RATIOS = [
  { value: '1:1', label: 'Quadrado', width: 80, height: 80, maxPx: { w: 8192, h: 8192 } },
  { value: '9:16', label: 'Story/Vertical', width: 45, height: 80, maxPx: { w: 6144, h: 11008 } },
  { value: '16:9', label: 'Widescreen', width: 80, height: 45, maxPx: { w: 11008, h: 6144 } },
  { value: '4:3', label: 'Padrão', width: 80, height: 60, maxPx: { w: 9600, h: 7168 } },
  { value: '3:4', label: 'Retrato', width: 60, height: 80, maxPx: { w: 7168, h: 9600 } },
  { value: 'auto', label: 'Automático', width: 50, height: 50, maxPx: { w: 1000, h: 1000 } }, // Placeholder maxPx
];

const DPI = 300;
const CM_TO_PX = DPI / 2.54;

export default function HomePage() {
  // Estado do widget
  const [widgetStep, setWidgetStep] = useState<WidgetStep>('input');
  const [showGallery, setShowGallery] = useState(false);
  const [halftoneEditorState, setHalftoneEditorState] = useState<{ isOpen: boolean; imageUrl: string; garmentMode: 'black' | 'white' | 'color'; item?: GalleryItem | null }>({ isOpen: false, imageUrl: '', garmentMode: 'black', item: null });
  // Gallery Refresh Trigger
  const [galleryRefreshTrigger, setGalleryRefreshTrigger] = useState(0);

  // Dados do formulário
  const [prompt, setPrompt] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [promptStyle, setPromptStyle] = useState('none');
  const [halftonePreset, setHalftonePreset] = useState('halftone_medio_preto');
  const [edgeContraction, setEdgeContraction] = useState(2);
  const [garmentMode, setGarmentMode] = useState<'black' | 'white' | 'color'>('black');
  const [aspectRatio, setAspectRatio] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>('nano-banana-2');
  
  // API Request State (Moved to top to avoid TDZ)
  const activeRequestRef = useRef(false);
  const [apiProcessingWidgetId, setApiProcessingWidgetId] = useState<string | null>(null);

  // Resize States
  const [widthCm, setWidthCm] = useState<number>(0);
  const [heightCm, setHeightCm] = useState<number>(0);
  const [maxDimensions, setMaxDimensions] = useState({ wCm: 0, hCm: 0, wPx: 0, hPx: 0 });
  const [isLocked, setIsLocked] = useState(true);

  const MAX_IMAGES = 5;

  // Configurações
  const [showSettings, setShowSettings] = useState(false);
  const [showNoTokens, setShowNoTokens] = useState(false);

  // Notificações
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: NotificationType }>({
    show: false,
    message: '',
    type: 'info'
  });

  const showNotification = (message: string, type: NotificationType = 'info') => {
    setNotification({ show: true, message, type });
  };

  // Auth & Tokens
  const { tokenBalance, session, refreshBalance, updateBalanceOptimistically, hasLicense, isProExpired, proTier } = useLauncherAuth();

  // Modo Pro: se tem licença ativa E não forçou Free, usa fullscreen (Pro). Senão, widget (Free).
  const [forceFreeMode, setForceFreeMode] = useState(false);
  const isProMode = hasLicense && !forceFreeMode;

  // ==== HOOKS QUE PRECISAM ESTAR NO TOPO ====
  // Escutar requisições de geração da CLI (API Externa)
  const { addWidget, updateWidget, setWidgetGenerating, isAnyGenerating } = useWidgets(); // Reusing the global widget context

  // States para modais Pro
  const [showProUpgrade, setShowProUpgrade] = useState(false);
  const [showProExpired, setShowProExpired] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Mostrar modal de expiração na primeira abertura
  useEffect(() => {
    if (isProExpired) {
      setShowProExpired(true);
    }
  }, [isProExpired]);

  // Sincronizar tamanho da janela com o modo (Pro = fullscreen, Free = widget)
  useEffect(() => {
    electronBridge.toggleWidgetMode(isProMode ? 'desktop' : 'widget');
  }, [isProMode]);

  // Estilos de prompt (gerenciados pelo hook)
  const { styles, updateStyles } = usePromptStyles();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, run, reset, reprocessHalftone, setTargetDimensions } = useDtfPipeline();

  // Hook para detectar modo contexto (chamado via menu de contexto do Windows)
  const { isReady: contextReady, isContextMode, isAutoMode, contextImages, contextFolder, savePath: contextSavePath, loadedImages, isWidgetMode } = useContextMode();
  const contextInitializedRef = useRef(false);
  const hydrationDoneRef = useRef(false);

  const PAGE_STORAGE_KEY = 'dtf-widget-state';

  // Handlers
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limitar a MAX_IMAGES
    const newFiles = files.slice(0, MAX_IMAGES - imageFiles.length);

    newFiles.forEach(file => {
      setImageFiles(prev => [...prev, file].slice(0, MAX_IMAGES));
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreviews(prev => [...prev, reader.result as string].slice(0, MAX_IMAGES));
      };
      reader.readAsDataURL(file);
    });

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imageFiles.length]);

  const handleRemoveImage = useCallback((index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!prompt.trim() && imageFiles.length === 0) return;
    setWidgetStep('aspect_ratio');
  }, [prompt, imageFiles.length]);

  const handleSelectAspectRatio = useCallback((ar: string) => {
    setAspectRatio(ar);

    // Set default max dimensions
    const config = ASPECT_RATIOS.find(r => r.value === ar)!;

    if (ar === 'auto') {
      // In Auto mode, we allow the user to set dimensions freely up to a reasonable max
      // We set high limits effectively allowing any size within reason
      const maxW = 300; // 3m wide? Safe enough
      const maxH = 1000; // 10m long?

      setMaxDimensions({
        wCm: maxW,
        hCm: maxH,
        wPx: Math.round(maxW * CM_TO_PX),
        hPx: Math.round(maxH * CM_TO_PX)
      });

      // Don't force reset, leave what was there or set defaults if 0
      if (widthCm === 0) setWidthCm(30); // Default suggestion
      if (heightCm === 0) setHeightCm(40);
      return;
    }

    const maxW = parseFloat((config.maxPx.w / CM_TO_PX).toFixed(2));
    const maxH = parseFloat((config.maxPx.h / CM_TO_PX).toFixed(2));

    setMaxDimensions({
      wCm: maxW,
      hCm: maxH,
      wPx: config.maxPx.w,
      hPx: config.maxPx.h
    });

    setWidthCm(maxW);
    setHeightCm(maxH);
  }, []);

  const handleResizeInputChange = (dim: 'width' | 'height', val: string) => {
    let num = parseFloat(val);
    if (isNaN(num)) num = 0; // Don't crash on bad input

    // Clamp to max? Maybe later, for now just logic

    if (dim === 'width') {
      setWidthCm(num);
      // Only lock ratio if NOT auto and locked
      const shouldLock = isLocked && aspectRatio !== 'auto';

      if (shouldLock && maxDimensions.wCm > 0) {
        const ratio = maxDimensions.hCm / maxDimensions.wCm;
        setHeightCm(parseFloat((num * ratio).toFixed(2)));
      }
    } else {
      setHeightCm(num);
      // Only lock ratio if NOT auto and locked
      const shouldLock = isLocked && aspectRatio !== 'auto';

      if (shouldLock && maxDimensions.hCm > 0) {
        const ratio = maxDimensions.wCm / maxDimensions.hCm;
        setWidthCm(parseFloat((num * ratio).toFixed(2)));
      }
    }
  };

  const handleStartGeneration = useCallback(async () => {
    if (!aspectRatio) return;

    // Calculate target pixels
    const targetW = Math.round(widthCm * CM_TO_PX);
    const targetH = Math.round(heightCm * CM_TO_PX);

    // Validate? (Ideally show error if > max)
    if (targetW > maxDimensions.wPx * 1.05 || targetH > maxDimensions.hPx * 1.05) {
      // Allow small margin of error, but general rule is don't upscale beyond max
    }

    setWidgetStep('processing');

    // Aplicar sufixo do estilo de prompt
    const style = styles.find(s => s.id === promptStyle);
    const finalPrompt = prompt.trim() + (style?.suffix || '');

    // CHECK TOKENS
    if ((tokenBalance || 0) < 20) {
      setShowNoTokens(true);
      setWidgetStep('input'); // Voltar para input se tiver avançado (embora visualmente n mude mto)
      return;
    }

    try {
      console.log('[PAGE] Calling run pipeline...');

      // Salvar prompt no histórico
      if (prompt.trim()) {
        electronBridge.savePromptHistory(prompt.trim());
      }

      // Notificar débito de tokens (Visual + State)
      showNotification('Debitando 20 tokens...', 'coins');
      updateBalanceOptimistically(-20); // Atualização imediata do saldo na UI

      await run({
        prompt: finalPrompt || 'Enhance image quality',
        imageFiles,
        aspectRatio: aspectRatio,
        halftonePreset,
        targetWidth: targetW,
        targetHeight: targetH,
        edgeContraction: edgeContraction,
        garmentMode: garmentMode,
        modelId: modelId
      }, session?.access_token);

      console.log('[PAGE] Run completed successfully. Refreshing balance.');
      // Atualizar saldo após sucesso (ou erro com estorno)
      refreshBalance();

      // Notificar via Windows se não estiver em foco
      const isFocused = await electronBridge.isWindowFocused();
      if (!isFocused) {
        electronBridge.showNotification('Geração Concluída!', 'Sua arte DTF está pronta. Clique para visualizar.');
      }
    } catch (e) {
      console.error('[PAGE] Error running pipeline:', e);
      // Estornar visualmente se falhar (embora o pipeline já deva ter estornado no DB)
      updateBalanceOptimistically(20);
      showNotification('⚠️ Tokens estornados! +20 tokens devolvidos ao seu saldo.', 'success');
      // Ensure UI knows about error if run didn't handle it
      // run() handles its own state, but if it threw synchronously...
    }
  }, [aspectRatio, widthCm, heightCm, prompt, imageFiles, halftonePreset, promptStyle, styles, run, maxDimensions, session, refreshBalance, updateBalanceOptimistically, edgeContraction]);

  const handleBack = useCallback(() => {
    if (widgetStep === 'aspect_ratio') {
      setWidgetStep('input');
    }
  }, [widgetStep]);

  const handleReset = useCallback(() => {
    setWidgetStep('input');
    setPrompt('');
    setImageFiles([]);
    setImagePreviews([]);
    setAspectRatio(null);
    setModelId('nano-banana-2');
    setPromptStyle('none');
    reset();
  }, [reset]);

  // Retry: preserva o prompt e imagens, só reseta o pipeline
  const handleRetry = useCallback(() => {
    setWidgetStep('input');
    // Mantém prompt, imageFiles, imagePreviews, promptStyle
    setAspectRatio(null);
    reset();
  }, [reset]);

  const handleOpenFolder = useCallback(() => {
    electronBridge.openFolder();
  }, []);

  // Carregar imagens do contexto (Open With / Drag & Drop no EXE)


  const handleStartInpainting = useCallback(async (promptText: string, originalBase64: string, maskBase64: string, item: GalleryItem) => {
    setShowGallery(false);
    
    // Converter originalBase64 para File
    const res = await fetch(originalBase64);
    const blob = await res.blob();
    const file = new File([blob], "original.png", { type: "image/png" });

    const targetW = Math.round(item.widthCm * CM_TO_PX);
    const targetH = Math.round(item.heightCm * CM_TO_PX);

    // Se for PRO mode, cria um widget novo para o Inpaint
    let targetWidgetId: string | null = null;
    
    if (isProMode) {
        targetWidgetId = addWidget(item.aspectRatio || '1:1');
        updateWidget(targetWidgetId, {
            prompt: promptText,
            widthCm: item.widthCm,
            heightCm: item.heightCm,
            garmentMode: item.garmentMode as any,
            uploadedImages: [originalBase64] // Set the base image for visual context if needed
        });
        setWidgetGenerating(targetWidgetId, true);
        setApiProcessingWidgetId(targetWidgetId); // Link pipeline state to this widget
    } else {
        // Free Mode: usa a tela principal
        setPrompt(promptText);
        setImageFiles([file]);
        setImagePreviews([originalBase64]);
        setAspectRatio(item.aspectRatio);
        setGarmentMode(item.garmentMode as any);
        setWidthCm(item.widthCm);
        setHeightCm(item.heightCm);
        setWidgetStep('processing');
    }

    // Iniciar Pipeline
    setTimeout(async () => {
        try {
            showNotification('Iniciando Edição Inteligente...', 'info');
            const result = await run({
                prompt: promptText,
                imageFiles: [file], // Original como input
                maskImage: maskBase64, // Máscara para inpainting
                aspectRatio: item.aspectRatio,
                halftonePreset: item.halftonePreset,
                targetWidth: targetW,
                targetHeight: targetH,
                garmentMode: item.garmentMode as any,
                modelId: 'nano-banana-2' // Ou manter o do item se tiver
            }, session?.access_token);
            
            refreshBalance();

            if (targetWidgetId) {
                setApiProcessingWidgetId(null);
                if (result.success && result.savedPath) {
                    updateWidget(targetWidgetId, {
                        uploadedImages: [`file://${result.savedPath.replace(/\\/g, '/')}`],
                        externalStatus: {
                            step: 'completed',
                            progress: 100,
                            message: 'Pronto!',
                            imageUrl: `file://${result.savedPath.replace(/\\/g, '/')}`,
                            savedPath: result.savedPath
                        }
                    });
                } else {
                    updateWidget(targetWidgetId, {
                        externalStatus: {
                            step: 'error',
                            progress: 0,
                            message: 'Erro no Inpaint',
                            error: result.error || 'Erro desconhecido'
                        }
                    });
                }
            }

            electronBridge.showNotification('Edição Concluída!', 'Sua imagem editada está pronta.');
        } catch (e: any) {
            console.error("Erro no inpainting:", e);
            showNotification('Erro na edição.', 'error');
            
            if (targetWidgetId) {
                setApiProcessingWidgetId(null);
                updateWidget(targetWidgetId, {
                    externalStatus: {
                        step: 'error',
                        progress: 0,
                        message: 'Erro no Inpaint',
                        error: e.message
                    }
                });
            }
        }
    }, 500);

  }, [run, session, refreshBalance, isProMode, addWidget, updateWidget, setWidgetGenerating, setApiProcessingWidgetId]);

  // Handle Paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (widgetStep !== 'input') return; // Só cola no passo de input

      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files).filter(file => file.type.startsWith('image/'));

        if (files.length > 0) {
          e.preventDefault();
          // Simula evento de input file
          const dummyEvent = { target: { files } } as any;
          handleFileChange(dummyEvent);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFileChange, widgetStep]);

  // Handle Automatic Resumption - REMOVIDO para evitar reinícios indesejados
  // Agora confiamos no Tray para manter o processo vivo em background sem recarregar a página.

  // Inicializar automaticamente se em modo contexto (Inicialização E Live Update)
  useEffect(() => {
    // Se temos imagens carregadas do contexto
    if (contextReady && isContextMode && loadedImages.length > 0) {

      // Lógica de "Novo Contexto Detectado"
      // Se o widgetStep for 'completed' ou se for a primeira vez, vamos resetar/iniciar
      // Ou se simplesmente as imagens carregadas mudaram (length > 0 e diferentes do atual state?)
      // Vamos simplificar: Se loadedImages mudar, assumimos que é uma nova intenção do usuário via "Open With".

      // Flag para evitar loop infinito se loadedImages não mudar
      // Como loadedImages vem do hook e só muda quando o Electron manda, é seguro assumir que mudança = nova ação.

      console.log('Contexto ativo/atualizado. Processando...', loadedImages.length, 'imagens');

      // Resetar step se estiver no fim
      if (widgetStep === 'completed' || widgetStep === 'error') {
        setWidgetStep('input');
      }

      // Evitar execução duplicada (Race Condition com Auth)
      if (contextInitializedRef.current && isAutoMode) {
        console.log('AutoMode já inicializado. Ignorando chamada duplicada.');
        return;
      }
      contextInitializedRef.current = true;

      const convertToFile = async (dataUrl: string, filename: string): Promise<File> => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
      };

      const initContextMode = async () => {
        try {
          const files = await Promise.all(
            loadedImages.map(img => convertToFile(img.data, img.filename))
          );

          setImageFiles(files);
          setImagePreviews(loadedImages.map(img => img.data));

          // --- Lógica de Detecção de Tamanho (Comum para Auto e Manual) ---
          let detectedW = 30; // Default
          let detectedH = 40;
          let resolvedAR: string | null = null; // Default null for manual (force user to pick or auto detects)

          if (files.length > 0) {
            try {
              const imgBitmap = await createImageBitmap(files[0]);
              const w = imgBitmap.width;
              const h = imgBitmap.height;

              const rawCmW = w / CM_TO_PX;
              const rawCmH = h / CM_TO_PX;

              if (w > 2000 || h > 2000) {
                detectedW = parseFloat(rawCmW.toFixed(1));
                detectedH = parseFloat(rawCmH.toFixed(1));
              } else {
                const ratio = w / h;
                detectedW = 28;
                detectedH = parseFloat((detectedW / ratio).toFixed(1));
              }

              console.log(`[ContextMode] Detected Size: ${w}x${h}px -> Sugerido: ${detectedW}x${detectedH}cm`);

              // Tentar detectar Aspect Ratio pelo tamanho
              const ratio = w / h;
              // Tolerância parecida
              if (Math.abs(ratio - 1) < 0.1) resolvedAR = '1:1';
              else if (Math.abs(ratio - (9 / 16)) < 0.1) resolvedAR = '9:16';
              else if (Math.abs(ratio - (16 / 9)) < 0.1) resolvedAR = '16:9';
              else if (Math.abs(ratio - (3 / 4)) < 0.1) resolvedAR = '3:4';
              else if (Math.abs(ratio - (4 / 3)) < 0.1) resolvedAR = '4:3';

            } catch (err) {
              console.error("Erro ao detectar tamanho:", err);
            }
          }

          if (isAutoMode) {
            // Modo Automático
            // CHECK AUTH: Esperar sessão carregar
            if (!session) {
              console.log('[PAGE] AutoMode em pausa: aguardando sessão...');
              return;
            }

            const autoPrompt = "Faça uma ilustração digital utilizando a imagem com fundo preto sólido";
            setPrompt(autoPrompt);
            setAspectRatio('auto'); // Força Auto
          } else {
            // Modo Manual (Contexto Normal)
            // Usa o AR detectado (ou null se não bateu com nenhum)
            setAspectRatio(resolvedAR);
          }

          // Avançar SEMPRE para a tela ajustada
          setWidgetStep('aspect_ratio');

          // Setar dimensões iniciais sugeridas
          setWidthCm(detectedW);
          setHeightCm(detectedH);

          // Configurar limites (Max Dimensions)
          const maxW = 300;
          const maxH = 1000;
          setMaxDimensions({
            wCm: maxW,
            hCm: maxH,
            wPx: Math.round(maxW * CM_TO_PX),
            hPx: Math.round(maxH * CM_TO_PX)
          });

          if (isAutoMode) {
            showNotification('Modo Auto: Configure o tamanho e clique em Gerar', 'info');
          }

        } catch (error) {
          console.error('Erro ao inicializar modo contexto:', error);
        }
      };

      initContextMode();
    }
  }, [contextReady, isContextMode, loadedImages, isAutoMode, run, halftonePreset, session]);

  // --- OVERPIXEL BRIDGE LISTENER ---
  useEffect(() => {
    const checkBridge = async () => {
      const savedState = localStorage.getItem('OVERPIXEL_BRIDGE_STATE');
      if (!savedState) return;

      try {
        const { type, data } = JSON.parse(savedState);
        if (type === 'VETORIZA_TO_FACTORY') {
          console.log('[DTF Factory] Received design from Vetoriza AI', data);
          
          // Clear the bridge state so it doesn't reload on every mount
          localStorage.removeItem('OVERPIXEL_BRIDGE_STATE');
          
          showNotification('Design recebido do Vetoriza AI!', 'success');

          // Helper to convert URL to File
          const convertToFile = async (url: string): Promise<File> => {
            const res = await fetch(url);
            const blob = await res.blob();
            return new File([blob], "vetoriza-design.png", { type: "image/png" });
          };

          const file = await convertToFile(data.image);

          if (isProMode) {
            // Add a new widget for this design
            const newId = addWidget('auto');
            updateWidget(newId, {
              prompt: data.prompt,
              uploadedImages: [data.image],
              halftonePreset: data.halftonePreset || 'halftone_medio_preto'
            });
            // Auto open the new widget logic could go here if needed
          } else {
            // Standard Mode: Load into the main screen
            setPrompt(data.prompt);
            setImageFiles([file]);
            setImagePreviews([data.image]);
            setHalftonePreset(data.halftonePreset || 'halftone_medio_preto');
            setAspectRatio('auto');
            setWidgetStep('aspect_ratio');
            
            // Suggest dimensions based on aspect ratio
            const img = new Image();
            img.onload = () => {
              const ratio = img.width / img.height;
              const w = 30; // 30cm default
              const h = parseFloat((w / ratio).toFixed(1));
              setWidthCm(w);
              setHeightCm(h);
              setMaxDimensions({
                wCm: 300,
                hCm: 1000,
                wPx: Math.round(300 * CM_TO_PX),
                hPx: Math.round(1000 * CM_TO_PX)
              });
            };
            img.src = data.image;
          }
        }
      } catch (err) {
        console.error('[DTF Factory] Bridge error:', err);
      }
    };

    // Delay slightly to ensure contexts are ready
    const timer = setTimeout(checkBridge, 1000);
    return () => clearTimeout(timer);
  }, [isProMode, addWidget, updateWidget, session]);

  // Sync pipeline state to widget (for Pro Mode visualization)
  useEffect(() => {
    if (apiProcessingWidgetId && state.step !== 'idle') {
      updateWidget(apiProcessingWidgetId, {
        externalStatus: {
          step: state.step as any,
          progress: state.progress,
          message: state.message,
          error: state.error || undefined,
          imageUrl: state.imageUrl || undefined,
          savedPath: state.savedPath || undefined
        }
      });
    }
  }, [state, apiProcessingWidgetId, updateWidget]);

  useEffect(() => {
    // Definir handler
    const handleApiRequest = async ({ requestId, data }: { requestId: string, data: any }) => {
      console.log('[API] Requisição recebida:', requestId, data);

      if (activeRequestRef.current) {
        console.warn('[API] Bloqueando requisição simultânea duplicada:', requestId);
        await electronBridge.sendApiGenerateResponse(requestId, { success: false, error: 'Já existe uma geração em andamento. Aguarde terminar.' });
        return;
      }

      // === VALIDAR SESSÃO: Tokens são debitados normalmente da conta logada ===
      if (!session?.access_token) {
        await electronBridge.sendApiGenerateResponse(requestId, { success: false, error: 'Usuário não autenticado. Abra o Overpixel Launcher e faça login.' });
        return;
      }

      activeRequestRef.current = true;

      try {
        const promptFromCli   = data.prompt || 'Uma linda ilustração dtf';
        const arFromCli       = data.aspectRatio || '1:1';
        const garmentModeApi  = (data.garmentMode || 'black') as 'black' | 'white' | 'color';
        const modelIdApi      = data.modelId || 'nano-banana-2';
        const halftoneApi     = data.halftonePreset || halftonePreset;

        // === CONVERTER CM → PIXELS (300 DPI: 1cm = 118.11px) ===
        // Aceita widthCm/heightCm (centímetros) — preferido
        // Fallback para targetWidth/targetHeight (pixels) para compatibilidade
        let targetW: number | undefined;
        let targetH: number | undefined;

        if (data.widthCm && data.heightCm) {
          targetW = Math.round(data.widthCm * CM_TO_PX);
          targetH = Math.round(data.heightCm * CM_TO_PX);
          console.log(`[API] Dimensões: ${data.widthCm}x${data.heightCm}cm → ${targetW}x${targetH}px`);
        } else if (data.targetWidth && data.targetHeight) {
          // Compatibilidade legada com pixels diretos
          targetW = data.targetWidth;
          targetH = data.targetHeight;
          console.log(`[API] Dimensões (px legado): ${targetW}x${targetH}px`);
        }

        // Se estiver no modo Pro, não deve usar o pipeline do modo widget "atual" (que mostraria tela de carregamento principal)
        // Deve criar um novo widget e gerar dentro dele
        if (isProMode) {
             console.log('[API] Modo Pro detectado. Criando widget separado.');
        } else {
             // Se estiver no modo Widget (Free), muda o estado da tela principal para feedback
             setWidgetStep('processing');
        }

        const newWidgetId = addWidget(arFromCli);
        updateWidget(newWidgetId, {
          prompt: promptFromCli,
          garmentMode: garmentModeApi,
          halftonePreset: halftoneApi,
          widthCm: data.widthCm || (targetW ? targetW / CM_TO_PX : 0),
          heightCm: data.heightCm || (targetH ? targetH / CM_TO_PX : 0),
        });
        setWidgetGenerating(newWidgetId, true);
        setApiProcessingWidgetId(newWidgetId);

        // === EXECUTAR PIPELINE (tokens debitados da conta logada) ===
        console.log('[API] Iniciando pipeline com token da conta logada...');
        const result = await run(
          {
            prompt: promptFromCli,
            aspectRatio: arFromCli,
            halftonePreset: halftoneApi,
            targetWidth: targetW,
            targetHeight: targetH,
            garmentMode: garmentModeApi,
            modelId: modelIdApi,
          },
          session.access_token  // Token real — debita 20 tokens da conta logada
        );

        setApiProcessingWidgetId(null); // Stop syncing status

        if (result.success && result.savedPath) {
          updateWidget(newWidgetId, {
            uploadedImages: [`file://${result.savedPath.replace(/\\/g, '/')}`],
            externalStatus: {
              step: 'completed',
              progress: 100,
              message: 'Pronto!',
              imageUrl: `file://${result.savedPath.replace(/\\/g, '/')}`,
              savedPath: result.savedPath
            } // Force explicit status update
          });
          console.log('[API] Geração concluída. Arquivo:', result.savedPath);
          // Notificar se app estiver em segundo plano
          const isFocused = await electronBridge.isWindowFocused();
          if (!isFocused) {
            electronBridge.showNotification('Geração via API Concluída!', 'Sua arte DTF está pronta.');
          }
        } else {
          console.error('[API] Falha na geração:', result.error);
        }

        await electronBridge.sendApiGenerateResponse(requestId, result);

      } catch (err: any) {
        console.error('[API] Erro inesperado:', err);
        await electronBridge.sendApiGenerateResponse(requestId, { success: false, error: err.message });
      } finally {
        activeRequestRef.current = false;
        setApiProcessingWidgetId(null);
        if (!isProMode) {
            setWidgetStep('input');
        }
      }
    };

    // Registrar listener
    electronBridge.onApiGenerateRequest(handleApiRequest);
    
    // Cleanup: importante para evitar duplicação se o componente desmontar/remontar
    return () => {
        // Como o electronBridge não tem um método off explícito exposto facilmente aqui sem refatorar o preload,
        // confiamos que o activeRequestRef vai barrar, mas o ideal seria remover o listener.
        // Dado a arquitetura atual, o activeRequestRef é a nossa barreira de proteção principal.
    };

  }, [run, session, halftonePreset, addWidget, updateWidget, setWidgetGenerating, isProMode]);

  // Fechar notificação de débito quando progresso passar de 5%
  useEffect(() => {
    if (state.progress > 5 && notification.show && notification.type === 'coins') {
      setNotification(prev => ({ ...prev, show: false }));
    }
  }, [state.progress, notification.show, notification.type]);

  // Atualizar widgetStep baseado no pipeline state
  if (widgetStep === 'processing') {
    // REMOVIDO: if (state.step === 'completed') setWidgetStep('completed');
    // Agora o ProcessingAnimation decide quando ir para 'completed' após a Supernova

    if (state.step === 'error') {
      setWidgetStep('error');
    }
  }

  return (
    <div className={`text-white overflow-hidden ${!isProMode ? 'h-screen w-screen flex flex-col bg-[#09090b]' : 'min-h-screen'}`}>
      {isProMode && widgetStep !== 'processing' && <ThreeBackground />}
      {isProMode && widgetStep === 'processing' && (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-black to-gray-900 -z-10" />
      )}

      {/* Header - Apenas modo Pro (Desktop) */}
      {isProMode && (
        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-black/20 backdrop-blur-xl border-b border-white/5" style={{ paddingTop: '40px' }}>
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.dispatchEvent(new CustomEvent('toggle-launcher'))}>
            <img src="./logo.png" alt="Overpixel" className="w-10 h-10 rounded-xl" />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Gerador DTF
              </h1>
              <p className="text-xs text-white/40">Overpixel Studio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop Only Controls (Tokens, Gallery, Chat) - Mobile uses BottomNav */}
            <div className="hidden md:flex items-center gap-2">
              <button 
                onClick={() => window.open('https://overpixel.online/tokens', '_blank')}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2 backdrop-blur-md mr-1 hover:bg-white/10 transition-colors cursor-pointer"
                title="Recarregar Tokens"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)] animate-pulse" />
                <span className="text-sm font-medium text-white/90">
                  {tokenBalance} <span className="text-white/40 ml-1">Tokens</span>
                </span>
              </button>

              <button
                onClick={() => setShowGallery(true)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 transition-all text-white/70 hover:text-cyan-400 text-sm font-medium flex items-center gap-1.5"
              >
                <GalleryIcon size={16} />
                Galeria
              </button>
              <button
                onClick={() => setShowChat(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-all ${showChat
                  ? 'bg-violet-500/20 border-violet-500/30 text-violet-400'
                  : 'bg-white/5 hover:bg-violet-500/10 border-white/10 hover:border-violet-500/30 text-white/70 hover:text-violet-400'
                  }`}
              >
                <MessageSquare size={16} />
                Chat IA
              </button>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            >
              <Settings2 size={20} />
            </button>
            
            {/* Electron Window Controls - Desktop Only */}
            <button
              onClick={() => electronBridge.minimizeWindow()}
              className="hidden md:block p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/40 hover:text-white"
              title="Minimizar"
            >
              <Minus size={20} />
            </button>
            <button
              onClick={() => electronBridge.closeApp()}
              className="hidden md:block p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Settings Panel Modal */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        styles={styles}
        onStylesChange={updateStyles}
        isWidgetMode={!isProMode}
        isProMode={isProMode}
        hasLicense={hasLicense}
        onToggleMode={() => {
          const goingToFree = !forceFreeMode;
          setForceFreeMode(goingToFree);
          electronBridge.toggleWidgetMode(goingToFree ? 'widget' : 'desktop');
        }}
      />

      {/* No Tokens Modal */}
      <AnimatePresence>
        {showNoTokens && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
            onClick={() => setShowNoTokens(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                <Coins size={32} className="text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Seus Tokens Acabaram!</h3>
              <p className="text-white/60 text-center text-sm mb-6">
                Para continuar utilizando no modo gratuito, recarregue seus tokens. Ou assine o <span className="text-amber-400 font-semibold">Modo Pro</span> para ter mais tokens e ferramentas exclusivas!
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    electronBridge.openExternal('https://overpixel.online/tokens');
                    setShowNoTokens(false);
                  }}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  Recarregar Tokens
                </button>
                <button
                  onClick={() => {
                    setShowNoTokens(false);
                    setShowProUpgrade(true);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Crown className="w-4 h-4" />
                  Assinar Modo Pro
                </button>
                <button
                  onClick={() => setShowNoTokens(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pro Upgrade Modal */}
      <ProUpgradeModal isOpen={showProUpgrade} onClose={() => setShowProUpgrade(false)} />

      {/* Pro Expired Modal */}
      <ProExpiredModal isOpen={showProExpired} onClose={() => setShowProExpired(false)} />

      {/* Onboarding Tutorial (apenas modo Free, primeiro acesso) */}
      {!isProMode && <OnboardingTutorial onComplete={() => { }} />}

      <NotificationToast
        message={notification.message}
        type={notification.type}
        isVisible={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />


      {/* Gallery Panel */}
      <GalleryPanel
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        refreshTrigger={galleryRefreshTrigger}
        isProMode={isProMode} // <-- Adicionado para controlar UI de Inpaint
        onStartInpainting={handleStartInpainting}
        onOpenHalftone={(imageUrl, garmentMode, item) => {
          // setShowGallery(false); // REMOVED: Keep gallery open in background
          setHalftoneEditorState({ isOpen: true, imageUrl, garmentMode, item });
        }}
      />

      {/* Halftone Editor Overlay (standalone, from gallery) */}
      <HalftoneEditorOverlay
        isOpen={halftoneEditorState.isOpen}
        imageUrl={halftoneEditorState.imageUrl}
        garmentMode={halftoneEditorState.garmentMode}
        item={halftoneEditorState.item}
        onClose={() => setHalftoneEditorState(prev => ({ ...prev, isOpen: false }))}
        onSaveSuccess={() => setGalleryRefreshTrigger(prev => prev + 1)}
      />

      {/* Chat Panel — Somente no modo Pro */}
      {isProMode && (
        <ChatPanel isOpen={showChat} onClose={() => setShowChat(false)} />
      )}

      {/* Main Content */}
      {isProMode ? (
        /* ══════════ MODO PRO: Multi-Widget Grid ══════════ */
        <main className="flex-1 flex flex-col h-screen pt-0 overflow-hidden md:pb-0 pb-20">
          <WidgetGrid />
        </main>
      ) : (
        /* ══════════ MODO FREE: Single Widget ══════════ */
        <main className="flex-1 flex flex-col items-center justify-center p-0">
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden shadow-2xl shadow-cyan-500/5 w-full h-full flex flex-col bg-[#09090b]"
          >
            {/* Letreiro LED Marquee */}
            <div className="w-full overflow-hidden bg-black/40 border-b border-white/5" style={{ height: '22px' }}>
              <div className="marquee-track whitespace-nowrap flex items-center h-full" style={{ width: 'max-content' }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: isProMode ? '#f59e0b' : '#06b6d4', textShadow: isProMode ? '0 0 8px rgba(245,158,11,0.6)' : '0 0 8px rgba(6,182,212,0.6)', padding: '0 16px' }}>
                    {isProMode ? '★ MODO PRO ★' : '● PLANO GRÁTIS — ASSINE O PRO PARA DESBLOQUEAR TUDO ●'}
                  </span>
                ))}
              </div>
              <style>{`
                  .marquee-track {
                    animation: marquee-scroll 30s linear infinite;
                  }
                  @keyframes marquee-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                `}</style>
            </div>

            {/* Custom Frame Header para Widget */}
            <div
              className="px-6 py-3 flex items-center justify-between border-b border-white/5 bg-white/5 select-none"
              style={{ WebkitAppRegion: 'drag' } as any}
            >
              <div className="flex items-center gap-2">
                <img src="./logo.png" alt="Overpixel" className="w-6 h-6 rounded-lg" />
                <span className="text-sm font-bold text-white/80">Gerador DTF</span>
              </div>
              <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>

                {/* Token Display + Badge PRO inline */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowProUpgrade(true)}
                    className="px-2 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer animate-pulse"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.2))',
                      border: '1px solid rgba(245,158,11,0.5)',
                      boxShadow: '0 0 16px rgba(245,158,11,0.3), 0 0 4px rgba(245,158,11,0.2)',
                    }}
                    title="Assinar Modo Pro"
                  >
                    <Crown className="w-3 h-3 text-amber-400" style={{ filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.8))' }} />
                    <span className="text-[9px] font-extrabold tracking-wider uppercase text-amber-400" style={{ textShadow: '0 0 6px rgba(245,158,11,0.6)' }}>
                      PRO
                    </span>
                  </button>
                  <div className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)] animate-pulse" />
                    <span className="text-xs font-medium text-white/90">
                      {tokenBalance} <span className="text-white/40 ml-0.5">Tokens</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                >
                  <Settings2 size={16} />
                </button>
                <button
                  onClick={() => electronBridge.minimizeWindow()}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                  title="Minimizar"
                >
                  <Minus size={16} />
                </button>
                <button
                  onClick={() => electronBridge.closeApp()}
                  className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors text-white/40"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="relative flex-1 overflow-y-auto custom-scrollbar p-0">
              <AnimatePresence mode="wait">

                {/* STEP 1: INPUT */}
                {widgetStep === 'input' && (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-6 space-y-5"
                  >
                    {/* Input de texto grande com área de imagem acoplada */}
                    <div className="relative">
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

                      <div className="relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">

                        {/* Área de texto maior */}
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Descreva a imagem que deseja criar..."
                          rows={4}
                          className="w-full px-5 py-4 bg-transparent text-white placeholder-white/30 focus:outline-none resize-none text-lg"
                        />

                        {/* Barra inferior com imagem e botão enviar */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/[0.02]">

                          {/* Área de imagens acopladas (até 5) */}
                          <div className="flex items-center gap-2">
                            {imagePreviews.map((preview, index) => (
                              <motion.div
                                key={index}
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="relative w-10 h-10 rounded-lg overflow-hidden border border-cyan-500/30"
                              >
                                <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                                <button
                                  onClick={() => handleRemoveImage(index)}
                                  className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full hover:bg-red-400 transition-colors"
                                >
                                  <X size={8} />
                                </button>
                              </motion.div>
                            ))}
                            {imagePreviews.length < MAX_IMAGES && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => fileInputRef.current?.click()}
                                className="w-10 h-10 rounded-lg border-2 border-dashed border-white/20 hover:border-cyan-500/50 transition-all flex items-center justify-center text-white/40 hover:text-cyan-400"
                                title={`Adicionar imagem (${imagePreviews.length}/${MAX_IMAGES})`}
                              >
                                <ImageIcon size={16} />
                              </motion.button>
                            )}
                            <span className="text-xs text-white/30">{imagePreviews.length > 0 ? `${imagePreviews.length}/${MAX_IMAGES}` : 'Até 5 imagens'}</span>

                            {/* Histórico de Prompts */}
                            <PromptHistory
                              onSelectPrompt={setPrompt}
                              currentPrompt={prompt}
                            />

                            {/* Templates/Ideias */}
                            <PromptIdeas onSelectPrompt={setPrompt} />
                          </div>

                          {/* Botão Enviar e Tokens */}
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)] animate-pulse" />
                              <span className="text-xs font-medium text-white/90">
                                {tokenBalance} <span className="text-white/40">Tokens</span>
                              </span>
                            </div>

                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleSubmit}
                              disabled={!prompt.trim() && imageFiles.length === 0}
                              className="p-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:cursor-not-allowed rounded-xl transition-colors"
                            >
                              <Send size={20} />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>


                    {/* Modo de Camiseta */}
                    <div className="pb-2">
                      <label className="block text-sm font-medium text-white/40 mb-3 uppercase tracking-wider text-[10px]">Tipo de Camiseta (Preset)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setGarmentMode('black')}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${garmentMode === 'black'
                            ? 'bg-zinc-800 border-white/20 text-white'
                            : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'
                            }`}
                        >
                          <div className="w-10 h-10 bg-black rounded-lg border border-white/10 shadow-lg flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white/20 rounded-sm" />
                          </div>
                          <span className="text-xs font-bold">Camiseta Preta</span>
                          <p className="text-[9px] opacity-40 text-center">Fundo Preto + DTF Normal</p>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setGarmentMode('white')}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${garmentMode === 'white'
                            ? 'bg-zinc-100 border-white/80 text-black'
                            : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'
                            }`}
                        >
                          <div className="w-10 h-10 bg-white rounded-lg border border-black/10 shadow-lg flex items-center justify-center text-black">
                            <div className="w-6 h-6 border-2 border-black/20 rounded-sm" />
                          </div>
                          <span className="text-xs font-bold">Camiseta Branca</span>
                          <p className="text-[9px] opacity-60 text-center">Fundo Branco + Inverter DTF</p>
                        </motion.button>
                      </div>
                    </div>

                    {/* Estilo de Prompt */}
                    <div className="pb-2">
                      <label className="block text-sm font-medium text-white/40 mb-3 uppercase tracking-wider text-[10px]">Estilo Sugerido</label>
                      <div className="flex flex-wrap gap-2">
                        {styles.map((style) => {
                          const isSelected = promptStyle === style.id;
                          return (
                            <motion.button
                              key={style.id}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setPromptStyle(style.id)}
                              className={`px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${isSelected
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                                }`}
                            >
                              {style.name}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Modelo de IA Avançada */}
                    <div className="pb-2 mt-2">
                      <label className="block text-sm font-medium text-white/40 mb-3 uppercase tracking-wider text-[10px]">Modelo de IA Avançada</label>
                      <div className="flex flex-wrap gap-2">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setModelId('nano-banana-2')}
                          className={`px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${modelId === 'nano-banana-2'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                            : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                            }`}
                        >
                          Nano Banana 2 (Padrão)
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setModelId('nano-banana-pro')}
                          className={`px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${modelId === 'nano-banana-pro'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                            : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                            }`}
                        >
                          Nano Banana Pro
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: ASPECT RATIO */}
                {widgetStep === 'aspect_ratio' && (
                  <motion.div
                    key="aspect"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-6"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <button
                        onClick={handleBack}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <div>
                        <h2 className="text-lg font-bold">Escolha o Formato</h2>
                        <p className="text-sm text-white/50">Selecione a proporção da imagem</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {ASPECT_RATIOS.map((ar) => {
                        const isSelected = aspectRatio === ar.value;
                        return (
                          <motion.button
                            key={ar.value}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelectAspectRatio(ar.value)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group ${isSelected ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/10' : 'bg-white/5 border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10'}`}
                          >
                            <div
                              className={`border rounded-lg transition-all flex items-center justify-center ${isSelected ? 'bg-cyan-500/50 border-cyan-400' : 'bg-gradient-to-br from-cyan-500/30 to-cyan-600/30 border-cyan-500/30 group-hover:from-cyan-500/50 group-hover:to-cyan-600/50'}`}
                              style={{ width: ar.width, height: ar.height }}
                            >
                              {ar.value === 'auto' && <RefreshCw size={20} className={isSelected ? 'text-white' : 'text-cyan-300'} />}
                            </div>
                            <span className={`text-xs font-medium transition-colors ${isSelected ? 'text-cyan-300' : 'text-white/60 group-hover:text-cyan-300'}`}>{ar.value}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-cyan-400/70' : 'text-white/30 group-hover:text-white/50'}`}>{ar.label}</span>
                          </motion.button>
                        )
                      })}
                    </div>

                    {/* RESIZE CONTROLS (Only if AR selected) */}
                    <AnimatePresence>
                      {aspectRatio && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-white/5 rounded-2xl p-5 border border-white/10 overflow-hidden"
                        >
                          <div className="flex items-center gap-2 mb-4 text-cyan-400">
                            <Settings2 size={16} />
                            <span className="text-sm font-bold uppercase tracking-wider">Tamanho de Impressão (300 DPI)</span>
                          </div>

                          <div className="flex items-end gap-3">
                            {/* Width */}
                            <div className="flex-1">
                              <label className="text-[10px] text-white/40 font-bold mb-1 block uppercase">Largura (cm)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={widthCm}
                                // disabled={aspectRatio === 'auto'} // ENABLED FOR AUTO
                                onChange={(e) => handleResizeInputChange('width', e.target.value)}
                                className={`w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white font-mono outline-none transition-all text-sm focus:border-cyan-500/50`}
                              />
                              <div className="text-[9px] text-white/20 mt-1 text-right">Max: {maxDimensions.wCm > 0 ? `${maxDimensions.wCm}cm` : '--'}</div>
                            </div>

                            {/* Lock */}
                            <div className={`pb-3 transition-opacity ${aspectRatio === 'auto' ? 'opacity-20' : 'opacity-100'}`}>
                              <div className="h-4 w-[1px] bg-white/10 mx-auto mb-1" />
                              <div title="Proporção Livre no Automático" className="cursor-help">
                                {aspectRatio === 'auto' ? <Settings2 size={14} className="text-white/20" /> : <Lock size={14} />}
                              </div>
                              <div className="h-4 w-[1px] bg-white/10 mx-auto mt-1" />
                            </div>

                            {/* Height */}
                            <div className="flex-1">
                              <label className="text-[10px] text-white/40 font-bold mb-1 block uppercase">Altura (cm)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={heightCm}
                                // disabled={aspectRatio === 'auto'} // ENABLED FOR AUTO
                                onChange={(e) => handleResizeInputChange('height', e.target.value)}
                                className={`w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white font-mono outline-none transition-all text-sm focus:border-cyan-500/50`}
                              />
                              <div className="text-[9px] text-white/20 mt-1 text-right">Max: {maxDimensions.hCm > 0 ? `${maxDimensions.hCm}cm` : '--'}</div>
                            </div>
                          </div>

                          {aspectRatio === 'auto' && (
                            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center gap-3 text-cyan-200">
                              <Sparkles size={20} />
                              <p className="text-xs">O sistema identificará a melhor proporção automaticamente baseada nas suas fotos.</p>
                            </div>
                          )}

                          <button
                            onClick={handleStartGeneration}
                            className="w-full mt-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95"
                          >
                            <Sparkles size={18} />
                            INICIAR GERAÇÃO (-20 Tokens)
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* STEP 3: PROCESSING */}
                {widgetStep === 'processing' && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-0 h-full w-full flex flex-col items-center justify-center"
                  >
                    <div className="w-full flex-1 flex items-center justify-center min-h-0">
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative w-full mx-auto flex items-center justify-center bg-black/40 rounded-2xl overflow-hidden border border-white/10"
                        style={{
                          aspectRatio: (aspectRatio || '1:1').replace(':', '/'),
                          maxWidth: aspectRatio === '16:9' ? '640px' : aspectRatio === '9:16' ? '300px' : '450px',
                          maxHeight: 'calc(100vh - 350px)'
                        }}
                      >
                        <ProcessingAnimation
                          step={state.step}
                          progress={state.progress}
                          message={'GERANDO IMAGEM DTF...'}
                          aspectRatio={aspectRatio || '1:1'}
                          imageUrl={state.imageUrl}
                          onAnimationComplete={() => {
                            if (state.step === 'completed' || state.step === 'saving') {
                              setWidgetStep('completed');
                            }
                          }}
                        />
                      </motion.div>
                    </div>

                    {/* Barra de Progresso e Steps - Centralizados abaixo */}
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 mb-8 space-y-4 w-full max-w-md px-6"
                    >
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${state.progress}%` }}
                          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                        />
                      </div>

                      <div className="text-center">
                        <motion.p
                          key={state.step}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-white/70"
                        >
                          {state.message || (getStepMessage(state.step).includes('Nano Banana') ? 'Processando...' : getStepMessage(state.step))}
                        </motion.p>
                      </div>

                      <div className="flex justify-center gap-2 flex-wrap">
                        {['generating', 'analyzing', 'fixing_background', 'upscaling', 'halftoning', 'saving'].map((step) => {
                          const isPast = getStepOrder(state.step) > getStepOrder(step as PipelineStep);
                          const isCurrent = state.step === step;

                          return (
                            <div
                              key={step}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${isPast ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                                isCurrent ? 'bg-cyan-500 text-white animate-pulse shadow-lg shadow-cyan-500/20' :
                                  'bg-white/5 text-white/30 border border-white/5'
                                }`}
                            >
                              {isPast && <Check size={12} className="inline mr-1" />}
                              {getStepLabel(step as PipelineStep)}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>

                    {/* DYNAMIC RESIZE CONTROLS (Live) - Only for Auto Mode */}
                    {aspectRatio === 'auto' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mb-6 w-full max-w-sm"
                      >
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-1">
                              <Settings2 size={10} />
                              Tamanho Final (Opcional)
                            </label>
                            {/* Indicator that it's live/editable */}
                            <span className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">
                              Editável em tempo real
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <input
                                type="number"
                                value={widthCm || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setWidthCm(val);
                                  // Sync single dim or both if user edits valid values
                                  // If 0, it clears the target
                                  setTargetDimensions(
                                    val > 0 ? Math.round(val * CM_TO_PX) : undefined,
                                    heightCm > 0 ? Math.round(heightCm * CM_TO_PX) : undefined
                                  );
                                }}
                                placeholder="Largura (cm)"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:border-cyan-500/50 outline-none"
                              />
                              <span className="absolute right-2 top-1.5 text-[9px] text-white/20">cm</span>
                            </div>
                            <div className="flex items-center text-white/20">x</div>
                            <div className="flex-1 relative">
                              <input
                                type="number"
                                value={heightCm || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setHeightCm(val);
                                  setTargetDimensions(
                                    widthCm > 0 ? Math.round(widthCm * CM_TO_PX) : undefined,
                                    val > 0 ? Math.round(val * CM_TO_PX) : undefined
                                  );
                                }}
                                placeholder="Altura (cm)"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:border-cyan-500/50 outline-none"
                              />
                              <span className="absolute right-2 top-1.5 text-[9px] text-white/20">cm</span>
                            </div>
                          </div>
                          <p className="text-[9px] text-white/30 mt-1.5 text-center">
                            Se deixar vazio ou 0, manterá a resolução original do upscale.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* STEP 3.5: HALFTONE SELECTION */}
                {widgetStep === 'halftone_selection' && (state.upscaledImageUrl || state.imageUrl) && (
                  <motion.div
                    key="halftone_selection"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <HalftoneSelector
                      imageUrl={state.upscaledImageUrl || state.imageUrl!}
                      garmentMode={garmentMode}
                      onApply={(_preset: string, settings: HalftoneSettings) => {
                        // Reprocessar halftone com novas settings e salvar
                        setWidgetStep('processing');
                        reprocessHalftone(settings);
                      }}
                      onBack={() => setWidgetStep('completed')}
                    />
                  </motion.div>
                )}

                {/* STEP 4: COMPLETED */}
                {widgetStep === 'completed' && state.imageUrl && (
                  <motion.div
                    key="completed"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <ResultDisplay
                      imageUrl={state.imageUrl}
                      savedPath={state.savedPath}
                      aspectRatio={aspectRatio || '1:1'}
                      onNewGeneration={handleRetry}
                      onOpenFolder={handleOpenFolder}
                      onAdjustHalftone={state.upscaledImageUrl && garmentMode !== 'color' ? () => setWidgetStep('halftone_selection') : undefined}
                      onRemoveBackground={garmentMode === 'color' ? () => {
                        setHalftoneEditorState({
                          isOpen: true,
                          imageUrl: state.upscaledImageUrl || state.imageUrl!,
                          garmentMode: 'color',
                          item: null
                        });
                      } : undefined}
                    />
                  </motion.div>
                )}

                {/* STEP: ERROR */}
                {widgetStep === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6"
                  >
                    <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-4 animate-pulse">
                      <Bug size={48} className="text-red-500" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-red-400">Ops! Algo deu errado.</h2>
                      <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-xl max-w-sm mx-auto overflow-hidden">
                        <p className="text-red-200/80 text-sm font-mono break-all line-clamp-6">
                          {state.error && state.error.includes('JWT expired')
                            ? 'Seu acesso expirou (já faz 1 hora que está com o aplicativo aberto). Por favor, feche e abra novamente para renovar sua sessão.'
                            : (state.error || 'Erro desconhecido durante o processamento.')}
                        </p>
                      </div>
                      
                      {/* FALLBACK FELIZ! SE HOUVER URL MAS FALHOU ALGUM EFEITO */}
                      {state.fallbackUrl ? (
                         <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl max-w-sm mx-auto text-center shadow-lg shadow-green-500/10">
                            <Sparkles className="mx-auto mb-2 text-green-400" size={24} />
                            <h3 className="text-green-400 font-bold mb-1">A boa notícia!</h3>
                            <p className="text-green-200/80 text-xs mb-4">Sua imagem pesada está pronta e salva na nuvem da Overpixel, só faltou memória pro aplicativo baixá-la inteira!</p>
                            <a 
                               href={state.fallbackUrl} 
                               target="_blank"
                               rel="noopener noreferrer"
                               onClick={() => electronBridge.openExternal(state.fallbackUrl!)}
                               className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors w-full"
                            >
                               Baixar Pelo Navegador
                            </a>
                         </div>
                      ) : (
                         <p className="text-white/40 text-xs mt-4">
                           Verifique sua conexão e tente novamente. Se persistir, contate o suporte.
                         </p>
                      )}
                    </div>

                    <div className="flex gap-3 mt-8">
                      <button
                        onClick={handleRetry}
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-600/20 flex items-center gap-2"
                      >
                        <RefreshCw size={18} />
                        Tentar Novamente
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors"
                      >
                        Voltar ao Início
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </main>
      )}
      {/* Mobile Bottom Navigation (Apenas telas pequenas) */}
      <MobileBottomNav 
        onOpenGallery={() => setShowGallery(prev => !prev)}
        onOpenChat={() => setShowChat(prev => !prev)}
        tokenBalance={tokenBalance}
        activeTab={showGallery ? 'gallery' : showChat ? 'chat' : null}
      />

    </div >
  );
}

// Helpers
function getStepOrder(step: PipelineStep): number {
  const order: Record<PipelineStep, number> = {
    idle: 0,
    generating: 1,
    analyzing: 2,
    fixing_background: 3,
    upscaling: 4,
    halftoning: 5,
    saving: 6,
    completed: 7,
    error: -1,
  };
  return order[step] || 0;
}

function getStepLabel(step: PipelineStep): string {
  const labels: Record<PipelineStep, string> = {
    idle: 'Aguardando',
    generating: 'Gerando',
    analyzing: 'Analisando',
    fixing_background: 'Fundo',
    upscaling: 'Upscale',
    halftoning: 'Halftone',
    saving: 'Salvando',
    completed: 'Pronto',
    error: 'Erro',
  };
  return labels[step] || step;
}

function getStepMessage(step: PipelineStep): string {
  const messages: Record<PipelineStep, string> = {
    idle: 'Pronto para iniciar',
    generating: 'Gerando imagem com IA...',
    analyzing: 'Analisando fundo preto...',
    fixing_background: 'Adicionando fundo preto...',
    upscaling: 'Melhorando resolução...',
    halftoning: 'Aplicando halftone DTF...',
    saving: 'Salvando imagem...',
    completed: 'Concluído!',
    error: 'Ocorreu um erro',
  };
  return messages[step] || '';
}
