import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brush, Eraser, RotateCcw, Check, Loader2, Sparkles, Undo2, BrainCircuit } from 'lucide-react';
import { GalleryItem } from '@dtf/services/galleryService';
import { analyzeInpaintingRequest } from '@dtf/services/visionService';

interface InpaintingEditorProps {
    isOpen: boolean;
    onClose: () => void;
    originalItem: GalleryItem;
    onStartInpainting: (prompt: string, originalBase64: string, maskBase64: string) => void;
}

export default function InpaintingEditor({ isOpen, onClose, originalItem, onStartInpainting }: InpaintingEditorProps) {
    const [prompt, setPrompt] = useState(originalItem.prompt || '');
    const [brushSize, setBrushSize] = useState(40);
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState<'brush' | 'eraser'>('brush');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<string>('');
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyStep, setHistoryStep] = useState(-1);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Inicializar Canvas com a imagem
    useEffect(() => {
        if (isOpen && canvasRef.current && originalItem) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            // Preferir master file se disponível para melhor qualidade
            const src = originalItem.masterFilePath 
                ? `file://${originalItem.masterFilePath}` 
                : (originalItem.savedPath ? `file://${originalItem.savedPath}` : originalItem.thumbnail);
            
            img.src = src;
            
            img.onload = () => {
                imageRef.current = img;
                const canvas = canvasRef.current;
                if (!canvas) return;

                // Ajustar tamanho do canvas para caber na tela mantendo aspect ratio
                const maxWidth = window.innerWidth * 0.8;
                const maxHeight = window.innerHeight * 0.7;
                
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                // Escalar visualmente, mas manter resolução interna alta se possível, 
                // ou ajustar para um tamanho editável razoável (ex: max 1024px para performance de UI)
                // Para a máscara, precisamos que bata com a imagem enviada.
                
                // Vamos usar o tamanho natural da imagem no canvas para precisão da máscara
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Limpar e salvar estado inicial
                ctx.clearRect(0, 0, width, height);
                saveHistory();
            };
        }
    }, [isOpen, originalItem]);

    const saveHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        setHistory(prev => {
            const newHistory = prev.slice(0, historyStep + 1);
            return [...newHistory, data];
        });
        setHistoryStep(prev => prev + 1);
    }, [historyStep]);

    const undo = () => {
        if (historyStep > 0) {
            const newStep = historyStep - 1;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.putImageData(history[newStep], 0, 0);
            setHistoryStep(newStep);
        } else if (historyStep === 0) {
            // Limpar tudo
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHistoryStep(-1);
            setHistory([]);
            // Re-save empty state if needed or handle logic
        }
    };

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const { x, y } = getMousePos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushSize;
        ctx.strokeStyle = mode === 'brush' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0,0,0,1)';
        
        if (mode === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const { x, y } = getMousePos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) ctx.closePath();
            saveHistory();
        }
    };

    const handleGenerate = async (useAI = false) => {
        if (!canvasRef.current || !imageRef.current) return;
        setIsProcessing(true);
        setProcessingStep(useAI ? 'Analisando imagem...' : 'Preparando...');

        try {
            // 1. Gerar Máscara (Preto e Branco)
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvasRef.current.width;
            maskCanvas.height = canvasRef.current.height;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) throw new Error("Falha no contexto da máscara");

            // Fundo Preto (área não editada)
            maskCtx.fillStyle = 'black';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            
            maskCtx.globalCompositeOperation = 'source-over';
            maskCtx.drawImage(canvasRef.current, 0, 0);
            
            const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Se tiver alpha > 0, vira branco
                if (data[i+3] > 0) {
                    data[i] = 255;
                    data[i+1] = 255;
                    data[i+2] = 255;
                    data[i+3] = 255; // Alpha full
                }
            }
            maskCtx.putImageData(imageData, 0, 0);

            const maskBase64 = maskCanvas.toDataURL('image/png');

            // 2. Pegar imagem original como base64
            const originalCanvas = document.createElement('canvas');
            originalCanvas.width = imageRef.current.naturalWidth;
            originalCanvas.height = imageRef.current.naturalHeight;
            const origCtx = originalCanvas.getContext('2d');
            if (!origCtx) throw new Error("Contexto original falhou");
            origCtx.drawImage(imageRef.current, 0, 0);
            const originalBase64 = originalCanvas.toDataURL('image/png');

            let finalPrompt = prompt;

            // 3. SE AI ATIVADO: Capturar imagem composta (Original + Desenho) para Vision
            if (useAI) {
                const compositeCanvas = document.createElement('canvas');
                compositeCanvas.width = originalCanvas.width;
                compositeCanvas.height = originalCanvas.height;
                const compCtx = compositeCanvas.getContext('2d');
                if (compCtx) {
                    // Desenha original
                    compCtx.drawImage(originalCanvas, 0, 0);
                    // Desenha máscara vermelha por cima
                    compCtx.drawImage(canvasRef.current, 0, 0);
                    
                    const compositeBase64 = compositeCanvas.toDataURL('image/jpeg', 0.8);
                    
                    const enhancedPrompt = await analyzeInpaintingRequest(compositeBase64, prompt);
                    if (enhancedPrompt && enhancedPrompt !== prompt) {
                        finalPrompt = enhancedPrompt;
                        setProcessingStep('Prompt melhorado!');
                        await new Promise(r => setTimeout(r, 800)); // Pequena pausa para ler
                    }
                }
            }

            // 4. Delegar para o pai iniciar o processo em background
            onStartInpainting(finalPrompt, originalBase64, maskBase64);
            onClose();

        } catch (error) {
            console.error("Erro na edição:", error);
            alert("Erro ao preparar edição: " + (error instanceof Error ? error.message : "Desconhecido"));
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[80] bg-[#050505] flex flex-col"
            >
                {/* Header */}
                <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0a0a]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                            <Brush size={20} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">Editor de Máscara (Inpainting)</h2>
                            <p className="text-xs text-white/40">Circule a área que deseja alterar</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Main Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Canvas Area */}
                    <div className="flex-1 bg-[#111] relative overflow-hidden flex items-center justify-center p-8" ref={containerRef}>
                        {/* Checkerboard bg */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" 
                             style={{ backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
                        />

                        <div className="relative shadow-2xl shadow-black/50 border border-white/10">
                            {/* Imagem de Fundo */}
                            {originalItem && (
                                <img 
                                    src={originalItem.masterFilePath ? `file://${originalItem.masterFilePath}` : originalItem.thumbnail} 
                                    alt="Reference" 
                                    className="max-w-full max-h-[70vh] object-contain block pointer-events-none select-none"
                                    style={{ opacity: 0.5 }} // Levemente apagada para destacar o desenho? Não, melhor full.
                                />
                            )}
                            
                            {/* Canvas de Desenho (Overlay) */}
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 cursor-crosshair touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                        </div>

                        {/* Floating Toolbar */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex items-center gap-2 shadow-xl">
                            <button
                                onClick={() => setMode('brush')}
                                className={`p-3 rounded-xl flex flex-col items-center gap-1 min-w-[60px] transition-all ${mode === 'brush' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                            >
                                <Brush size={20} />
                                <span className="text-[9px] font-bold uppercase">Pincel</span>
                            </button>
                            
                            <button
                                onClick={() => setMode('eraser')}
                                className={`p-3 rounded-xl flex flex-col items-center gap-1 min-w-[60px] transition-all ${mode === 'eraser' ? 'bg-white text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                            >
                                <Eraser size={20} />
                                <span className="text-[9px] font-bold uppercase">Borracha</span>
                            </button>

                            <div className="w-px h-8 bg-white/10 mx-2" />

                            <div className="flex flex-col items-center gap-1 px-2">
                                <input 
                                    type="range" 
                                    min="5" 
                                    max="100" 
                                    value={brushSize} 
                                    onChange={(e) => setBrushSize(Number(e.target.value))}
                                    className="w-24 h-1.5 accent-purple-500 bg-white/10 rounded-full appearance-none"
                                />
                                <span className="text-[9px] text-white/40 font-mono">Tamanho: {brushSize}px</span>
                            </div>

                            <div className="w-px h-8 bg-white/10 mx-2" />

                            <button
                                onClick={undo}
                                disabled={historyStep < 0}
                                className="p-3 rounded-xl text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
                                title="Desfazer"
                            >
                                <Undo2 size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Sidebar Controls */}
                    <div className="w-80 bg-[#0a0a0a] border-l border-white/10 p-6 flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4">Configurações de Edição</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-white/70 block mb-2">Prompt de Alteração</label>
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500/50 focus:outline-none min-h-[120px] resize-none"
                                        placeholder="Descreva o que deve aparecer na área circulada..."
                                    />
                                    <p className="text-[10px] text-white/30 mt-2 leading-relaxed">
                                        O prompt original foi carregado. Modifique-o para descrever a nova cena ou o detalhe que deseja inserir na área marcada.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto flex flex-col gap-3">
                            <button
                                onClick={() => handleGenerate(true)}
                                disabled={isProcessing || !prompt.trim()}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:grayscale"
                                title="A IA vai ler sua marcação e criar o prompt perfeito"
                            >
                                <BrainCircuit size={18} />
                                <span className="text-xs">IA Vision (Recomendado)</span>
                            </button>

                            <button
                                onClick={() => handleGenerate(false)}
                                disabled={isProcessing || !prompt.trim()}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span className="text-xs">{processingStep || 'Processando...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} />
                                        <span className="text-xs">Gerar (Prompt Manual)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
