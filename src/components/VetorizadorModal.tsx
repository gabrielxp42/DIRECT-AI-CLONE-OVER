import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
    Upload,
    Sparkles,
    Download,
    Wand2,
    Camera,
    ImagePlus,
    X,
    Loader2,
    Palette,
    Send,
    Layers,
    Type,
    Image as ImageIcon,
    MessageSquare,
    Zap,
    RotateCcw,
    PenTool
} from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreditsShopModal } from './CreditsShopModal';
import { cn } from '@/lib/utils';
import '@/pages/Vetorizador.css';

interface VetorizadorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export const VetorizadorModal: React.FC<VetorizadorModalProps> = ({ isOpen, onClose }) => {
    const { supabase } = useSession();
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | string | null>(null); // Changed type to include string
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<'standard' | 'pro'>('standard');
    const [dragActive, setDragActive] = useState(false);
    const [userPrompt, setUserPrompt] = useState('');
    const [selectedEffect, setSelectedEffect] = useState<string | null>('vectorize');
    const [inlinePrompt, setInlinePrompt] = useState('');
    const [aiCredits, setAiCredits] = useState<number>(0);
    const [isShopOpen, setIsShopOpen] = useState(false); // Existing state for shop visibility

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // --- FETCH CREDITS ---
    const fetchCredits = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('ai_credits')
            .eq('id', user.id)
            .single();

        if (!error && data) {
            setAiCredits(data.ai_credits || 0);
        }
    };

    React.useEffect(() => {
        if (isOpen) {
            fetchCredits();
        }
    }, [isOpen]);

    // ── Drag & Drop ──
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, selecione uma imagem.');
            return;
        }
        setOriginalFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setOriginalImage(e.target?.result as string);
            setResultImage(null);
            setStatus('idle');
        };
        reader.readAsDataURL(file);
    };

    const uploadImage = async (file: File): Promise<string> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('uploads')
            .getPublicUrl(fileName);

        return data.publicUrl;
    };

    const vectorizeImage = async (imageUrl: string, model: 'standard' | 'pro' | 'edit', prompt?: string) => {
        const { data: rawData, error } = await supabase.functions.invoke('vectorize', {
            body: { image_url: imageUrl, model, prompt }
        });

        if (error) throw error;

        let data = rawData;
        if (typeof rawData === 'string') {
            try { data = JSON.parse(rawData); } catch { /* keep raw */ }
        }
        return data;
    };

    const checkVectorizationStatus = async (vectorizationId: string) => {
        const { data, error } = await supabase.functions.invoke(`vectorize?id=${vectorizationId}`, {
            method: 'GET'
        });

        if (error) throw error;
        return data;
    };

    const pollStatus = async (vectorizationId: string) => {
        const interval = setInterval(async () => {
            try {
                const data = await checkVectorizationStatus(vectorizationId);
                if (data.status === 'completed' && data.result_url) {
                    clearInterval(interval);
                    setResultImage(data.result_url);
                    setStatus('done');
                    setSelectedEffect(null);
                    setUserPrompt('');
                    toast.success('Vetorização concluída!');
                    setTimeout(() => fetchCredits(), 500);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    setStatus('error');
                    toast.error('Falha na vetorização. Tente novamente.');
                    fetchCredits(); // Refresh credits even on failure, in case they were deducted
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 2000);
    };

    const effectOptions = [
        {
            id: 'vectorize',
            label: 'Vetor Clássico',
            icon: <PenTool size={24} />,
            desc: 'Logos limpos, sem fundo, cores chapadas.',
            prompt: 'recreate as a professional high-fidelity 2D vector logo, IGNORE surface textures, wrinkles, shadows or reflections. RECREATE from scratch with perfect geometric shapes and solid flat colors. TIGHT CROP: ensure logo occupies 95% of the frame. HIGH CONTRAST BACKGROUND: Use a background color that contrasts strongly with the logo (e.g., dark for light logos, light for dark logos) to ensure visibility.'
        },
        {
            id: 'embroidery',
            label: 'Efeito Bordado',
            icon: <Layers size={24} />,
            desc: 'Patch 3D realista, linhas detalhadas.',
            prompt: 'HIGH-DETAILED EMBROIDERED PATCH of the logo. Elevated stitching and 3D texture. TIGHT CROP: logo must occupy 90-95% of the frame. HIGH CONTRAST BACKGROUND for visibility. Isolated on PNG background with no surrounding fabric or surface.'
        },
        {
            id: 'puff',
            label: 'Puff Print',
            icon: <Type size={24} />,
            desc: 'Relevo 3D estilo estampa puff.',
            prompt: '3D puff print on fabric, raised ink, tactile texture. TIGHT CROP: occupy 95% of the frame. Isolated, transparent background, strictly no background.'
        },
        {
            id: 'neon',
            label: 'Efeito Neon',
            icon: <Zap size={24} />,
            desc: 'Letreiro neon brilhante realista.',
            prompt: 'glowing neon sign, vibrant colors, cinematic lighting. TIGHT CROP: occupy 95% of the frame. Isolated, transparent background, strictly no background.'
        },
        {
            id: 'sticker',
            label: 'Adesivo',
            icon: <ImageIcon size={24} />,
            desc: 'Adesivo de vinil com borda branca.',
            prompt: 'die-cut vinyl sticker, thick white border, glossy finish. TIGHT CROP: occupy 95% of the frame. Isolated, transparent background outside the sticker.'
        },
        {
            id: 'custom',
            label: 'Personalizado',
            icon: <MessageSquare size={24} />,
            desc: 'Escreva exatamente o que deseja.',
            prompt: ''
        }
    ];

    const handleProcess = async (prompt?: string) => {
        const source = resultImage || originalFile;
        if (!source) return;

        // --- TABELA DE PREÇOS (Sincronizada com Backend) ---
        const COSTS = {
            standard: 5,
            pro: 20,
            edit: 5,
            bg_removal: 25 // Clipping Magic API
        };

        const cost = prompt ? COSTS.edit : (selectedModel === 'pro' ? COSTS.pro : COSTS.standard);
        const currentCredits = aiCredits;

        if (currentCredits < cost) {
            toast.error(`Saldo insuficiente: você tem ${currentCredits} créditos e precisa de ${cost}.`);
            setIsShopOpen(true); // Open the shop modal
            return;
        }

        const isEdit = !!prompt;
        setStatus(isEdit ? 'processing' : 'uploading');

        try {
            let imageUrl = '';
            if (typeof source === 'string' && source.startsWith('http')) {
                imageUrl = source;
            } else if (source instanceof File) { // Check if source is a File object
                imageUrl = await uploadImage(source);
            } else {
                return;
            }

            const response = await vectorizeImage(
                imageUrl,
                isEdit ? 'edit' : selectedModel,
                prompt
            );

            console.log('Vectorization started:', response);

            if (response?.vectorization_id) {
                setStatus('processing');
                pollStatus(response.vectorization_id);
            } else {
                throw new Error('Erro na resposta da API');
            }
        } catch (err: any) {
            toast.error(err.message || 'Erro ao processar imagem.');
            setStatus('error');
            fetchCredits(); // Refresh credits in case of an error after deduction
        }
    };

    const handleInlineSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inlinePrompt.trim() || status === 'processing') return;
        handleProcess(inlinePrompt);
        setInlinePrompt('');
    };

    const handleReset = () => {
        setOriginalImage(null);
        setOriginalFile(null);
        setResultImage(null);
        setStatus('idle');
        setUserPrompt('');
        setSelectedEffect(null);
        setInlinePrompt('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleDownload = async () => {
        if (!resultImage) return;

        try {
            toast.loading('Preparando download...', { id: 'downloading' });
            const response = await fetch(resultImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `vetoriza-ai-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Download concluído!', { id: 'downloading' });
        } catch (error) {
            console.error('Download error:', error);
            window.open(resultImage, '_blank');
            toast.error('Erro no download direto. Abrindo imagem em nova aba.', { id: 'downloading' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] max-w-[1200px] h-[90vh] p-0 overflow-hidden rounded-[2.5rem] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] bg-zinc-950/60 backdrop-blur-3xl dialog-content-vec" hideCloseButton>

                <div className="dashboard-mobile-vec h-full w-full overflow-hidden">
                    <div className="dashboard-content-vec h-full">
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} style={{ display: 'none' }} />
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileInput} style={{ display: 'none' }} />

                        <div className="header-vec">
                            <div className="flex items-center gap-3">
                                <div className="icon-badge-vec">
                                    <Sparkles className="text-primary fill-primary/20" size={24} />
                                </div>
                                <div>
                                    <h2 className="title-vec">Vetoriza AI</h2>
                                    <p className="subtitle-vec">A inteligência que transforma pixels em perfeição.</p>
                                </div>
                            </div>

                            {/* WALLET DISPLAY */}
                            <div className="wallet-vec" onClick={() => setIsShopOpen(true)}>
                                <div className="wallet-content-vec">
                                    <Zap className="text-primary fill-primary" size={16} />
                                    <div className="flex flex-col">
                                        <span className="wallet-label-vec">Seus Créditos</span>
                                        <span className="wallet-value-vec">{aiCredits.toLocaleString()}</span>
                                    </div>
                                    <button className="wallet-add-vec">
                                        <Zap size={12} fill="currentColor" />
                                    </button>
                                </div>
                            </div>

                            <button className="close-btn-vec" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="main-grid-vec overflow-hidden">
                            {status === 'idle' && !originalImage ? (
                                <div
                                    className={`upload-zone-vec ${dragActive ? 'active' : ''}`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="upload-content-vec">
                                        <div className="upload-icon-wrapper-vec">
                                            <ImagePlus size={32} />
                                        </div>
                                        <h2 className="upload-title-vec">Transforme sua Imagem Agora</h2>
                                        <p className="upload-subtitle-vec">
                                            Arraste seu arquivo ou escolha uma opção abaixo:
                                        </p>

                                        <div className="upload-options-vec">
                                            <button
                                                className="action-btn-vec ghost flex-1 min-w-[120px]"
                                                onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                                            >
                                                <Camera size={20} className="text-primary" />
                                                <span>Tirar Foto</span>
                                            </button>
                                            <button
                                                className="action-btn-vec ghost flex-1 min-w-[120px]"
                                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            >
                                                <ImageIcon size={20} className="text-primary" />
                                                <span>Galeria</span>
                                            </button>
                                        </div>
                                        <p className="mt-4 text-[10px] uppercase tracking-widest text-white/20 font-bold">
                                            JPG, PNG ou WEBP • Máx 10MB
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="preview-container-vec overflow-hidden">
                                    <div className="preview-split-left">
                                        <div className="preview-card-vec active">
                                            <div className="card-header-vec">
                                                <span className="card-tag-vec">
                                                    {(status as string) === 'processing' ? 'Processando IA...' : (status as string) === 'done' ? 'Resultado Final' : 'Imagem Original'}
                                                </span>
                                                {(status === 'idle' || status === 'done') && (
                                                    <button
                                                        className="absolute top-5 right-5 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/70 hover:text-white transition-all backdrop-blur-md border border-white/10 hidden md:flex"
                                                        onClick={handleReset}
                                                        title="Remover imagem e carregar outra"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="card-image-vec">
                                                {(status === 'processing' || status === 'uploading') && !resultImage ? (
                                                    <div className="loading-container-vec">
                                                        <Loader2 className="animate-spin text-primary" size={48} />
                                                        <p>{status === 'uploading' ? 'Enviando arquivo...' : 'A mágica está acontecendo...'}</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <img
                                                            src={(resultImage) ? resultImage : (originalImage || '')}
                                                            alt={resultImage ? 'Resultado' : 'Original'}
                                                            className={status === 'processing' ? 'opacity-50' : ''}
                                                        />
                                                        {status === 'processing' && resultImage && (
                                                            <div className="loading-overlay-vec">
                                                                <Loader2 className="animate-spin text-primary" size={32} />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* MOBILE RESET BUTTON (NEW POSITION) */}
                                        {(status === 'idle' || status === 'done') && (
                                            <button
                                                className="reset-btn-mobile-vec md:hidden"
                                                onClick={handleReset}
                                            >
                                                <RotateCcw size={14} />
                                                <span>Trocar Imagem</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="preview-split-right">
                                        <div className="model-selector-vec">
                                            <button className={`model-btn-vec ${selectedModel === 'standard' ? 'active' : ''}`} onClick={() => setSelectedModel('standard')}>
                                                <Zap size={16} />
                                                <span>Standard</span>
                                                <span className="model-credits-vec">1 crédito</span>
                                            </button>
                                            <button className={`model-btn-vec ${selectedModel === 'pro' ? 'active' : ''}`} onClick={() => setSelectedModel('pro')}>
                                                <Sparkles size={16} />
                                                <span>Pro HD</span>
                                                <span className="model-credits-vec">3 créditos</span>
                                            </button>
                                        </div>

                                        <div className="preview-actions-vec">
                                            {resultImage && (
                                                <div className="inline-agent-chat-vec fade-in">
                                                    <div className="agent-bubble-vec">
                                                        <div className="agent-avatar-vec">
                                                            <Sparkles size={24} />
                                                        </div>
                                                        <div className="agent-text-vec">
                                                            {(status as string) === 'processing' ? (
                                                                <p className="flex items-center gap-2">
                                                                    <Loader2 className="animate-spin" size={16} />
                                                                    <strong>Gabi:</strong> Um momento...
                                                                </p>
                                                            ) : (
                                                                <p><strong>Gabi:</strong> Ficou do seu gosto? Me diga o que mais quer alterar!</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <form onSubmit={handleInlineSubmit} className="inline-chat-input-vec">
                                                        <input
                                                            type="text"
                                                            value={inlinePrompt}
                                                            onChange={(e) => setInlinePrompt(e.target.value)}
                                                            placeholder="Diga à Gabi o que ajustar..."
                                                            disabled={(status as string) === 'processing'}
                                                        />
                                                        <button type="submit" disabled={!inlinePrompt.trim() || (status as string) === 'processing'}>
                                                            <Send size={18} />
                                                        </button>
                                                    </form>

                                                    <div className="inline-actions-row-vec">
                                                        <button className="action-btn-vec primary" onClick={handleDownload}>
                                                            <Download size={20} />
                                                            Baixar
                                                        </button>
                                                        <button className="action-btn-vec ghost" onClick={handleReset}>
                                                            Reset
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {(status !== 'processing' && status !== 'uploading') && (
                                                <div className="effects-selection-area">
                                                    <h3 className="effects-title">Estilos Rápidos:</h3>
                                                    <div className="effects-chips-vec">
                                                        {effectOptions.map((effect) => (
                                                            <button
                                                                key={effect.id}
                                                                className={`effect-chip-vec ${selectedEffect === effect.id ? 'active' : ''} ${effect.id === 'vectorize' ? 'highlighted' : ''}`}
                                                                onClick={() => setSelectedEffect(effect.id)}
                                                            >
                                                                <span className="effect-chip-icon">{effect.icon}</span>
                                                                <span className="effect-chip-label">{effect.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {selectedEffect === 'custom' && (
                                                        <div className="observation-field-vec fade-in">
                                                            <div className="agent-bubble-vec mb-4">
                                                                <div className="agent-avatar-vec">
                                                                    <Sparkles size={24} />
                                                                </div>
                                                                <div className="agent-text-vec">
                                                                    <p><strong>Gabi:</strong> O que você deseja criar hoje? Descreva com detalhes e eu usarei minha inteligência para gerar do zero!</p>
                                                                </div>
                                                            </div>
                                                            <div className="custom-prompt-chat-input-wrapper">
                                                                <textarea
                                                                    value={userPrompt}
                                                                    onChange={(e) => setUserPrompt(e.target.value)}
                                                                    placeholder="Ex: 'Um logotipo minimalista de uma cafeteria com um grão de café estilizado em tons de marrom e dourado'"
                                                                    rows={3}
                                                                    className="custom-prompt-textarea"
                                                                    disabled={(status as string) === 'processing' || (status as string) === 'uploading'}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <button
                                                        className={cn(
                                                            "action-btn-vec primary full mt-4 relative group",
                                                            !selectedEffect && "opacity-50 cursor-not-allowed"
                                                        )}
                                                        onClick={() => {
                                                            if (!selectedEffect) {
                                                                toast.error("Por favor, selecione um estilo antes de continuar.");
                                                                return;
                                                            }
                                                            if (selectedEffect === 'custom') {
                                                                handleProcess(userPrompt || undefined);
                                                            } else {
                                                                const effect = effectOptions.find(e => e.id === selectedEffect);
                                                                handleProcess(effect?.prompt || undefined);
                                                            }
                                                        }}
                                                        disabled={(status as string) === 'processing'}
                                                    >
                                                        <Wand2 size={20} />
                                                        {resultImage ? 'Aplicar Estilo' : 'VETORIZAR AGORA'}
                                                        {!selectedEffect && (
                                                            <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] py-1 px-3 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                                                Selecione um estilo acima
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>

            <CreditsShopModal
                isOpen={isShopOpen}
                onClose={() => {
                    setIsShopOpen(false);
                    fetchCredits(); // Refresh credits after potentially buying
                }}
            />
        </Dialog>
    );
};
