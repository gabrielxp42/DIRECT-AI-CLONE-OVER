

import { useState, useCallback, useRef, useEffect } from 'react';
import { generateWithKieModel, addBlackBackground, addWhiteBackground } from '@dtf/services/kieService';
import { enhanceImageFromUrl, calculateUpscaleFactor } from '@dtf/services/esrganService';
import { applyHalftoneToBlob, getHalftonePreset, HalftoneSettings } from '@dtf/services/halftoneService';
import { electronBridge } from '@dtf/lib/electronBridge';
import { fetchWithRetry } from '@dtf/lib/imageUtils';

import { debitTokens, creditTokens } from '@dtf/actions/token-actions';

export type PipelineStep =
    | 'idle'
    | 'generating'
    | 'analyzing'
    | 'fixing_background'
    | 'upscaling'
    | 'halftoning'
    | 'saving'
    | 'completed'
    | 'error';

export interface PipelineState {
    step: PipelineStep;
    progress: number;
    message: string;
    imageUrl: string | null;
    upscaledImageUrl: string | null;
    savedPath: string | null;
    savedMasterPath?: string | null; // Caminho da imagem original (sem halftone)
    error: string | null;
    fallbackUrl?: string | null;
    lastRunOptions?: PipelineOptions; // Persist options to resume
}

export interface PipelineOptions {
    prompt: string;
    imageFiles?: File[]; // Até 5 imagens de referência
    maskImage?: string; // Máscara Base64 para inpainting
    aspectRatio: string;
    halftonePreset: string;
    targetWidth?: number; // Pixels
    targetHeight?: number; // Pixels
    edgeContraction?: number; // pixels to erode
    garmentMode?: 'black' | 'white' | 'color';
    modelId?: string;
}

// Analisar se imagem tem fundo preto ou branco
async function analyzeBackground(imageUrl: string, targetColor: 'black' | 'white' | 'color' = 'black'): Promise<{ hasTargetBackground: boolean; width: number; height: number }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            // Amostrar pixels das bordas para verificar fundo
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            let targetPixels = 0;
            let totalSamples = 0;
            const blackThreshold = 30;
            const whiteThreshold = 225;

            // Amostrar bordas
            for (let x = 0; x < canvas.width; x += 10) {
                // Topo
                const topIdx = x * 4;
                const effectiveColor = targetColor === 'color' ? 'black' : targetColor;
                if (effectiveColor === 'black') {
                    if (data[topIdx] < blackThreshold && data[topIdx + 1] < blackThreshold && data[topIdx + 2] < blackThreshold) targetPixels++;
                } else {
                    if (data[topIdx] > whiteThreshold && data[topIdx + 1] > whiteThreshold && data[topIdx + 2] > whiteThreshold) targetPixels++;
                }
                totalSamples++;

                // Base
                const bottomIdx = ((canvas.height - 1) * canvas.width + x) * 4;
                if (targetColor === 'black') {
                    if (data[bottomIdx] < blackThreshold && data[bottomIdx + 1] < blackThreshold && data[bottomIdx + 2] < blackThreshold) targetPixels++;
                } else {
                    if (data[bottomIdx] > whiteThreshold && data[bottomIdx + 1] > whiteThreshold && data[bottomIdx + 2] > whiteThreshold) targetPixels++;
                }
                totalSamples++;
            }

            for (let y = 0; y < canvas.height; y += 10) {
                // Esquerda
                const leftIdx = y * canvas.width * 4;
                if (targetColor === 'black') {
                    if (data[leftIdx] < blackThreshold && data[leftIdx + 1] < blackThreshold && data[leftIdx + 2] < blackThreshold) targetPixels++;
                } else {
                    if (data[leftIdx] > whiteThreshold && data[leftIdx + 1] > whiteThreshold && data[leftIdx + 2] > whiteThreshold) targetPixels++;
                }
                totalSamples++;

                // Direita
                const rightIdx = (y * canvas.width + canvas.width - 1) * 4;
                if (targetColor === 'black') {
                    if (data[rightIdx] < blackThreshold && data[rightIdx + 1] < blackThreshold && data[rightIdx + 2] < blackThreshold) targetPixels++;
                } else {
                    if (data[rightIdx] > whiteThreshold && data[rightIdx + 1] > whiteThreshold && data[rightIdx + 2] > whiteThreshold) targetPixels++;
                }
                totalSamples++;
            }

            const ratio = targetPixels / totalSamples;
            resolve({
                hasTargetBackground: ratio > 0.6,
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };
        img.onerror = () => resolve({ hasTargetBackground: false, width: 0, height: 0 });
        img.src = imageUrl;
    });
}

// Converter File para base64
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Wrapper para compatibilidade com código existente (apenas chama a nova função)

// Wrapper para compatibilidade com código existente (apenas chama a nova função)
const fetchBlob = (url: string) => fetchWithRetry(url);

// Helper to resize image if Needed
async function resizeImageIfNecessary(imageUrl: string, targetW?: number, targetH?: number): Promise<string> {
    if (!targetW || !targetH) return imageUrl;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Only resize if target is smaller (downscale) or specific size requested
            // Logic: Force resize to target dimensions
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(imageUrl);
                return;
            }
            // High quality downscaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 0, 0, targetW, targetH);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => reject(e);
        img.src = imageUrl;
    });
}

export function useDtfPipeline() {
    const [state, setState] = useState<PipelineState>({
        step: 'idle',
        progress: 0,
        message: '',
        imageUrl: null,
        upscaledImageUrl: null,
        savedPath: null,
        error: null,
    });

    // Sync Tray status with Main
    useEffect(() => {
        const isProcessing = ['generating', 'analyzing', 'fixing_background', 'upscaling', 'halftoning', 'saving'].includes(state.step);
        electronBridge.setGenerationStatus(isProcessing);
    }, [state.step]);

    const updateState = (updates: Partial<PipelineState>) => {
        setState(prev => ({ ...prev, ...updates }));
    };

    // Ref para controlar o intervalo de progresso
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const currentProgressRef = useRef<number>(0);

    // Sincroniza a ref com o state
    useEffect(() => {
        currentProgressRef.current = state.progress;
    }, [state.progress]);

    // Ref para controlar dimensões de saída dinâmicas (permite alteração durante geração)
    const targetDimensionsRef = useRef<{ width?: number; height?: number }>({});

    const setTargetDimensions = useCallback((width?: number, height?: number) => {
        targetDimensionsRef.current = { width, height };
        console.log('[PIPELINE] Target dimensions updated:', { width, height });
    }, []);

    // Função assíncrona que anima o progresso até um alvo em X segundos.
    // Retorna uma Promise que resolve quando atingir o alvo.
    const animateProgressTo = useCallback((targetProgress: number, durationMs: number): Promise<void> => {
        return new Promise((resolve) => {
            // Limpar qualquer animação anterior
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }

            const startProgress = currentProgressRef.current;

            // Se já passamos do alvo, resolve imediatamente
            if (startProgress >= targetProgress) {
                resolve();
                return;
            }

            const startTime = Date.now();
            const progressRange = targetProgress - startProgress;

            // Usar requestAnimationFrame-like timing com setInterval a 60fps
            const intervalMs = 16; // ~60fps

            progressIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const ratio = Math.min(elapsed / durationMs, 1);

                // Easing suave (easeOutQuad)
                const eased = 1 - (1 - ratio) * (1 - ratio);
                const newProgress = startProgress + (progressRange * eased);

                currentProgressRef.current = newProgress;
                setState(prev => ({ ...prev, progress: newProgress }));

                if (ratio >= 1) {
                    if (progressIntervalRef.current) {
                        clearInterval(progressIntervalRef.current);
                        progressIntervalRef.current = null;
                    }
                    setState(prev => ({ ...prev, progress: targetProgress }));
                    currentProgressRef.current = targetProgress;
                    resolve();
                }
            }, intervalMs);
        });
    }, []);

    const reset = useCallback(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setState({
            step: 'idle',
            progress: 0,
            message: '',
            imageUrl: null,
            upscaledImageUrl: null,
            savedPath: null,
            error: null,
        });
    }, []);

    // Inicia progresso contínuo de 0 a 95% em X segundos (deixa 5% pro final)
    const startContinuousProgress = useCallback((totalDurationMs: number = 30000, startProgress: number = 0) => {
        // Limpar qualquer animação anterior
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }

        const startTime = Date.now();
        console.log('[PROGRESS] Starting continuous progress from', startProgress, '%, duration:', totalDurationMs, 'ms');
        const maxProgress = 95; // Deixa 5% pro final
        const intervalMs = 50; // 20fps - suave e leve

        // Se já passamos do maxProgress, não fazemos nada (esperamos o finishProgress)
        if (startProgress >= maxProgress) return;

        currentProgressRef.current = startProgress;
        setState(prev => ({ ...prev, progress: startProgress }));

        progressIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            // Ajustar ratio para levar em conta o progresso inicial
            const initialRatio = startProgress / maxProgress;
            const currentRatio = initialRatio + (Math.min(elapsed / totalDurationMs, 1) * (1 - initialRatio));

            // Easing: começa devagar, acelera no meio, desacelera no fim
            const eased = currentRatio < 0.5
                ? 2 * currentRatio * currentRatio
                : 1 - Math.pow(-2 * currentRatio + 2, 2) / 2;

            const newProgress = eased * maxProgress;

            currentProgressRef.current = newProgress;
            setState(prev => ({ ...prev, progress: newProgress }));

            // Se chegou ao fim do tempo estimado ou do progresso máximo
            if (currentRatio >= 1) {
                clearInterval(progressIntervalRef.current!);
                progressIntervalRef.current = null;
            }
        }, intervalMs);
    }, []);

    // Para o progresso e vai pra 100%
    const finishProgress = useCallback(async () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }

        // Anima suavemente de onde está até 100%
        const current = currentProgressRef.current;
        const steps = 20;
        const stepDuration = 50;

        for (let i = 1; i <= steps; i++) {
            await new Promise(resolve => setTimeout(resolve, stepDuration));
            const newProgress = current + ((100 - current) * i / steps);
            currentProgressRef.current = newProgress;
            setState(prev => ({ ...prev, progress: newProgress }));
        }
    }, []);

    const run = useCallback(async (options: PipelineOptions, accessToken?: string): Promise<{ success: boolean; savedPath?: string; error?: string }> => {
        const { prompt, imageFiles, maskImage, aspectRatio, halftonePreset, targetWidth, targetHeight, edgeContraction, garmentMode = 'black', modelId = 'nano-banana-2' } = options; // Added edgeContraction
        let tokensDebited = false;

        console.log('[PIPELINE] Starting run with:', { prompt, aspectRatio, hasToken: !!accessToken, isInpainting: !!maskImage });

        try {
            // Initialize target dimensions ref
            targetDimensionsRef.current = { width: targetWidth, height: targetHeight };

            // === ETAPA 0: DÉBITO DE TOKENS ===
            // Update state FIRST to show activity immediately
            updateState({
                step: 'generating',
                message: 'Validando saldo...',
                progress: 1,
                error: null,
                imageUrl: null, // Clear previous results
                upscaledImageUrl: null,
                savedPath: null,
                lastRunOptions: options,
            });

            if (!accessToken) {
                throw new Error('Usuário não autenticado. Faça login no Launcher.');
            }

            // Se for requisição da API local, pulamos o débito de tokens (ou implementamos lógica própria na API)
            if (accessToken === 'local-api') {
                 console.log('[PIPELINE] Bypassing token debit for local-api request');
                 updateState({ message: 'Preparando via API Local...' });
            } else {
                 updateState({
                     message: 'Debitando 20 tokens...',
                 });

                 // Start progress animation early to show liveliness
                 startContinuousProgress(30000, state.progress || 0);

                 await debitTokens(accessToken, 20, 'Geração de Imagem DTF');
                 tokensDebited = true;
            }

            // Signal start of generation for Tray
            electronBridge.setGenerationStatus(true);

            // Small delay to let user see the "Debiting" message
            await new Promise(resolve => setTimeout(resolve, 200));

            // === ETAPA 1: GERAÇÃO (COM RETRY AUTOMÁTICO FELIZ) ===
            let startTime = Date.now();
            let timerInterval: NodeJS.Timeout | null = null;

            const updateGenerationMessage = () => {
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                let newMessage = 'Gerando imagem... Preparando pincéis virtuais!';

                if (elapsedSeconds >= 180) { // 3 min
                    newMessage = "Ainda estou aqui! Finalizando os detalhes da sua arte incrível...";
                } else if (elapsedSeconds >= 120) { // 2 min
                    newMessage = "A magia as vezes demora, mas não se preocupe que estamos cuidando de tudo!";
                } else if (elapsedSeconds >= 60) { // 1 min
                    newMessage = "Já passei de 1 minuto caprichando no seu pedido, quase lá!";
                }

                setState(prev => {
                    if (prev.step === 'generating' && prev.message !== newMessage) {
                        return { ...prev, message: newMessage };
                    }
                    return prev;
                });
            };

            updateState({
                step: 'generating',
                message: 'Iniciando criação na Overpixel...',
                error: null,
            });

            // Iniciar cronômetro de mensagens
            timerInterval = setInterval(updateGenerationMessage, 5000);

            // === RESOLUÇÃO E UPSCALE INTELIGENTE ===
            // DPI: 300 dpi → 1cm = 11.81px
            // Resolução nativa gerada pela IA:
            //   1K → ~1024px no lado maior
            //   2K → ~2048px no lado maior  
            //   4K → ~4096–6144px dependendo do aspect ratio
            //
            // Limites 4K por aspect ratio + 5% tolerância:
            //   1:1   → base=4096px  → threshold ~4301px (~36.4cm)
            //   9:16  → base=6144px  → threshold ~6451px (~54.6cm)
            //   16:9  → base=6144px  → threshold ~6451px (~54.6cm)
            //   4:3   → base=5760px  → threshold ~6048px (~51.2cm)
            //   3:4   → base=5760px  → threshold ~6048px (~51.2cm)
            //   outros → base=5120px  → threshold ~5376px (~45.5cm)

            // === LÓGICA DE UPSCALE INTELIGENTE (Atualizada 2025) ===
            // Regra baseada em tamanhos de impressão (CM) @ 300 DPI
            // < 12cm (1417px) -> Gerar em 1K (mais rápido)
            // 12cm - 22cm (2598px) -> Gerar em 2K
            // 22cm - 45cm (5315px) -> Gerar em 4K
            // > 45cm -> Gerar em 4K + Upscale

            const PX_PER_CM = 118.11; // 300 DPI
            const LIMIT_1K_CM = 12;
            const LIMIT_2K_CM = 22;
            const LIMIT_4K_CM = 45; // Acima disso = Upscale

            const targetMaxPx = (targetWidth && targetHeight) ? Math.max(targetWidth, targetHeight) : 0;
            const targetMaxCm = targetMaxPx / PX_PER_CM;

            let genResolution: '1K' | '2K' | '4K' = '1K';
            let willNeedUpscale = false;

            if (targetMaxPx > 0) {
                if (targetMaxCm <= LIMIT_1K_CM) {
                    genResolution = '1K';
                    willNeedUpscale = false;
                } else if (targetMaxCm <= LIMIT_2K_CM) {
                    genResolution = '2K';
                    willNeedUpscale = false;
                } else if (targetMaxCm <= LIMIT_4K_CM) {
                    genResolution = '4K';
                    willNeedUpscale = false;
                } else {
                    genResolution = '4K'; // Melhor base possível para o upscale
                    willNeedUpscale = true;
                }
            } else {
                // Sem tamanho definido, padrão seguro (1K)
                genResolution = '1K';
            }

            console.log(`[PIPELINE] 📏 Smart Upscale Logic: Alvo=${targetMaxCm.toFixed(1)}cm (${targetMaxPx}px)`);
            console.log(`[PIPELINE] 🎯 Decisão: Resolução=${genResolution} | Upscale=${willNeedUpscale ? 'SIM (8x)' : 'NÃO (Nativo)'}`);

            // Trabalho Real
            let imageRefs: string[] = [];
            if (imageFiles && imageFiles.length > 0) {
                for (const file of imageFiles) {
                    const base64 = await fileToBase64(file);
                    imageRefs.push(base64);
                }
            }

            // Se for inpainting (maskImage presente), a imagem original JÁ DEVE estar em imageRefs[0] (ou imageFiles[0])
            // O componente que chama deve garantir que se maskImage existe, imageFiles[0] é a imagem original.
            // O kieService espera image_urls = [original] e mask_image = mask
            // Vamos garantir que imageRefs tenha a imagem original.

            let generatedUrl = '';
            let maxGenTries = 2; // Tentamos gerar até 2x de graça sem bater no saldo
            let genAttempt = 0;

            while (genAttempt < maxGenTries) {
                try {
                    genAttempt++;
                    generatedUrl = await generateWithKieModel(
                        prompt,
                        aspectRatio,
                        imageRefs.length > 0 ? imageRefs : undefined,
                        garmentMode === 'white' ? 'Solid Plain White Background, High Contrast, No Shadows, Pure White' : 'Solid Black Background',
                        genResolution,
                        modelId,
                        maskImage // Passando a máscara
                    );
                    break; // Sucesso, sai do LAÇO
                } catch (genError) {
                    console.error(`[PIPELINE_WARN][OVERPIXEL_CREATE] Falha na tentativa ${genAttempt}:`, genError);
                    if (genAttempt >= maxGenTries) {
                        throw new Error(`Overpixel lotado no momento, mas garantimos que seus tokens não foram descontados. Tente novamente!`);
                    } else {
                        // Tentar de novo
                        updateState({
                            message: 'As linhas da internet oscilaram! Pedindo para a Overpixel desenhar novamente...'
                        });
                        // Dar 2 segundos de respiro
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }

            // Limpar cronômetro assim que a geração terminar (loop do while completado/sucesso)
            if (timerInterval) clearInterval(timerInterval);

            updateState({
                step: 'analyzing',
                message: 'Estonteante! Checando estrutura...',
                imageUrl: generatedUrl,
            });

            // === ETAPA 2: ANÁLISE e FUNDO ===
            const analysis = await analyzeBackground(generatedUrl, garmentMode);
            let currentImageUrl = generatedUrl;

            if (!analysis.hasTargetBackground) {
                if (garmentMode === 'black' || garmentMode === 'color') {
                    updateState({
                        step: 'fixing_background',
                        message: 'Adicionando fundo preto...',
                    });
                    currentImageUrl = await addBlackBackground(generatedUrl);
                } else {
                    updateState({
                        step: 'fixing_background',
                        message: 'Adicionando fundo branco...',
                    });
                    currentImageUrl = await addWhiteBackground(generatedUrl);
                }
                const reAnalysis = await analyzeBackground(currentImageUrl, garmentMode);
                analysis.width = reAnalysis.width;
                analysis.height = reAnalysis.height;
            }

            updateState({
                message: 'Fundo verificado!',
                imageUrl: currentImageUrl,
            });

            // === ETAPA 3: UPSCALE INTELIGENTE ===
            console.log('[PIPELINE] Step 3: Upscaling (Inteligente)');

            // Calculate needed factor based on target dims + aspect ratio
            const targetMax = (targetWidth && targetHeight) ? Math.max(targetWidth, targetHeight) : undefined;
            const upscaleFactor: number = calculateUpscaleFactor(analysis.width, analysis.height, targetMax, aspectRatio);

            console.log(`[PIPELINE] Upscale Strategy: Source=${analysis.width}x${analysis.height}, TargetMax=${targetMax}, Factor=${upscaleFactor}x`);

            let upscaledUrl: string = currentImageUrl;

            if (upscaleFactor === 0) {
                // 🚀 Imagem já grande o suficiente — pular upscale!
                console.log('[PIPELINE] ⚡ Upscale PULADO: imagem já atende o tamanho pedido.');
                updateState({
                    step: 'upscaling',
                    message: 'Nitidez já era ideal! Seguindo em frente...',
                });
                upscaledUrl = currentImageUrl;
                await new Promise(resolve => setTimeout(resolve, 800));
            } else {
                updateState({
                    step: 'upscaling',
                    message: `Afofando os pixels...`,
                });

                let upTries = 2; // Tentamos o upscale 2x
                let upAttempt = 0;
                let upscaleSuccess = false;

                while (upAttempt < upTries) {
                    try {
                        upAttempt++;
                        upscaledUrl = await enhanceImageFromUrl(currentImageUrl, { scale: upscaleFactor as 4 | 8 });
                        console.log('[PIPELINE] Upscale success, URL:', upscaledUrl?.substring(0, 50) + '...');
                        upscaleSuccess = true;
                        break;
                    } catch (upscaleError) {
                        console.error(`[PIPELINE_ERROR][UPSCALE_FAILED] Tentativa de upscale ${upAttempt} falhou:`, upscaleError);
                        if (upAttempt < upTries) {
                            updateState({
                                message: `Nossa nuvem dormiu... Tentando dar aquele banho de loja de novo! (Tentativa 2)`
                            });
                            await new Promise(r => setTimeout(r, 4000));
                        }
                    }
                }

                if (!upscaleSuccess) {
                    // Falliback Graceful!! Se no final de tudo falhou, não morremos. Continuamos com a imagem gerada
                    console.error('[PIPELINE_ERROR][UPSCALE_ABANDON] O upscale falhou depois de '+upTries+' tentativas. Usaremos o RAW Image gerado sem Upscale!');
                    updateState({
                        message: 'Servidor de pixels muito lotado! Salvando na sua qualidade normal com carinho.'
                    });
                    upscaledUrl = currentImageUrl;
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            updateState({
                message: 'Upscale concluído! Ajustando tamanho...',
                imageUrl: upscaledUrl,
                upscaledImageUrl: upscaledUrl,
            });

            // === ETAPA 3.5: SALVAR MASTER (CLEAN - PRE-RESIZE) ===
            // Salva a imagem original (após upscale, antes de resize/halftone) para re-edição com qualidade máxima
            let savedMasterPath: string | null = null;
            try {
                const masterFilename = `dtf-master-${Date.now()}.png`;
                // Salva o upscaledUrl (que é a imagem de alta resolução original)
                const masterBlob = await fetchBlob(upscaledUrl);
                const masterBuffer = await masterBlob.arrayBuffer();

                const saveResult = await electronBridge.saveImage(masterBuffer, masterFilename);
                if (saveResult.success && saveResult.path) {
                    savedMasterPath = saveResult.path;
                    console.log('[PIPELINE] Master image saved (pre-resize):', savedMasterPath);
                }
            } catch (err) {
                console.warn('[PIPELINE] Failed to save master image:', err);
            }

            updateState({
                savedMasterPath,
                message: 'Ajustando tamanho final...'
            });

            // === ETAPA 3.6: RESIZE (Se necessário) ===
            let readyForHalftoneUrl = upscaledUrl;

            // Ler dimensões atuais do ref (permitindo alteração dinâmica durante geração)
            const finalW = targetDimensionsRef.current.width;
            const finalH = targetDimensionsRef.current.height;

            if (finalW && finalH) {
                console.log(`[PIPELINE] Resizing to dynamic target: ${finalW}x${finalH}px`);
                readyForHalftoneUrl = await resizeImageIfNecessary(upscaledUrl, finalW, finalH);
                // Update state to show resized image
                updateState({
                    upscaledImageUrl: readyForHalftoneUrl,
                    imageUrl: readyForHalftoneUrl
                });
            } else {
                console.log('[PIPELINE] No target dimensions set (or cleared). Skipping resize.');
            }

            // === ETAPA 4: HALFTONE E DOWNLOAD ===
            updateState({
                step: 'halftoning',
                message: 'Pincelando sua arte e puxando pro PC...',
            });

            let halftoneBlob: Blob;
            
            try {
                // Se for modo colorido, PULAR halftone e usar imagem original (redimensionada)
                if (garmentMode === 'color') {
                    updateState({
                        step: 'halftoning', // Manter nome do step para compatibilidade de UI
                        message: 'Empacotando projeto colorido...',
                    });
                    halftoneBlob = await fetchBlob(readyForHalftoneUrl);
                } else {
                    const presetKey = garmentMode === 'white' ? 'white_shirt' : (halftonePreset || 'halftone_medio_preto');
                    const preset = getHalftonePreset(presetKey) || getHalftonePreset('halftone_medio_preto');

                    if (!preset) {
                        throw new Error(`Preset de halftone não encontrado: ${presetKey}`);
                    }

                    const settings: HalftoneSettings = {
                        ...preset.settings,
                        removeBlack: true,
                        edgeContraction: edgeContraction ?? 2,
                        invertInput: garmentMode === 'white' ? true : preset.settings.invertInput,
                        invertOutput: garmentMode === 'white' ? true : preset.settings.invertOutput,
                    };
                    const imageBlob = await fetchBlob(readyForHalftoneUrl);
                    halftoneBlob = await applyHalftoneToBlob(imageBlob, settings);
                }
            } catch (halftoneErr) {
                console.error('[PIPELINE_ERROR][DOWNLOAD_AND_HALFTONE] Falha local fatal:', halftoneErr);
                updateState({
                    fallbackUrl: readyForHalftoneUrl || upscaledUrl || generatedUrl
                });
                throw new Error("Pesaroso: não conseguimos baixar a arte enorme pra colocar a retícula ou faltou memória RAM! Clique abaixo para Baixar Manualmente direto do nosso gerador!");
            }

            // === ETAPA 5: SALVAR ===
            updateState({
                step: 'saving',
                message: 'Finalizando arquivo...',
            });

            const filename = `dtf-${Date.now()}.png`;
            const buffer = await halftoneBlob.arrayBuffer();
            const saveResult = await electronBridge.saveImage(buffer, filename);

            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Erro ao salvar imagem');
            }

            // === FINALIZAR PROGRESSO E CONCLUIR ===
            await finishProgress();

            const finalUrl = URL.createObjectURL(halftoneBlob);

            updateState({
                step: 'completed',
                progress: 100,
                message: 'Imagem salva com sucesso!',
                imageUrl: finalUrl,
                savedPath: saveResult.path || null,
            });

            // Signal end of generation for Tray
            electronBridge.setGenerationStatus(false);

            return { success: true, savedPath: saveResult.path || undefined };
        } catch (error) {
            console.error('Pipeline error:', error);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

            // Tentar estornar tokens se foram debitados
            if (tokensDebited && accessToken) {
                updateState({
                    message: 'Erro detectado. Estornando tokens...',
                });
                try {
                    await creditTokens(accessToken, 20, 'Estorno: Erro na geração');
                    console.log('Tokens estornados com sucesso.');
                } catch (refundError) {
                    console.error('Falha ao estornar tokens:', refundError);
                    // Não sobrescrevemos o erro original, apenas logamos
                }
            }

            updateState({
                step: 'error',
                progress: 0,
                message: '',
                error: error instanceof Error ? error.message : 'Erro desconhecido',
            });

            // Signal end of generation (even on error) for Tray
            electronBridge.setGenerationStatus(false);

            return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
        }
    }, [startContinuousProgress, finishProgress]);

    // Função para reprocessar halftone (mais rápido)
    const reprocessHalftone = useCallback(async (settings: HalftoneSettings) => {
        if (!state.upscaledImageUrl) return;

        try {
            updateState({
                step: 'halftoning',
                message: 'Reaplicando halftone...',
            });

            // Animação rápida (2s)
            animateProgressTo(100, 2000);

            const imageBlob = await fetchBlob(state.upscaledImageUrl);
            const halftoneBlob = await applyHalftoneToBlob(imageBlob, {
                ...settings,
                removeBlack: true,
            });

            const reader = new FileReader();
            const finalUrl = await new Promise<string>((resolve) => {
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(halftoneBlob);
            });

            const filename = `dtf-reprocessed-${Date.now()}.png`;
            const buffer = await halftoneBlob.arrayBuffer();
            const saveResult = await electronBridge.saveImage(buffer, filename);

            if (!saveResult.success) throw new Error(saveResult.error);

            updateState({
                step: 'completed',
                progress: 100,
                message: 'Salvo com sucesso!',
                imageUrl: finalUrl,
                savedPath: saveResult.path || null,
            });

        } catch (error) {
            updateState({
                step: 'error',
                error: error instanceof Error ? error.message : 'Erro',
            });
        }
    }, [state.upscaledImageUrl, animateProgressTo]);

    return {
        state,
        run,
        reset,
        reprocessHalftone,
        setTargetDimensions,
    };
}
