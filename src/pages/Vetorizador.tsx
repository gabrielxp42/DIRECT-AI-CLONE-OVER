import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Upload,
    Sparkles,
    Download,
    Wand2,
    Camera,
    ImagePlus,
    Zap,
    X,
    Loader2,
    Key,
    Settings,
    Palette,
    Send,
    Check,
    ExternalLink,
    Layers,
    Type,
    Image as ImageIcon,
    PenTool,
    MessageSquare
} from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { DesignAgent } from '@/components/DesignAgent';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import './Vetorizador.css';

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const Vetorizador: React.FC = () => {
    const { supabase, session } = useSession();
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<'standard' | 'pro'>('standard');
    const [dragActive, setDragActive] = useState(false);
    const [isAgentOpen, setIsAgentOpen] = useState(false);
    const [userPrompt, setUserPrompt] = useState('');
    const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
    const [inlinePrompt, setInlinePrompt] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

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

    // ── Upload para Supabase Storage ──
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

    // ── Chamar a Edge Function ──
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

    // ── Verificar status ──
    const checkVectorizationStatus = async (vectorizationId: string) => {
        const { data, error } = await supabase.functions.invoke(`vectorize?id=${vectorizationId}`, {
            method: 'GET'
        });

        if (error) throw error;
        return data;
    };

    // ── Polling ──
    const pollStatus = async (vectorizationId: string) => {
        const interval = setInterval(async () => {
            try {
                const data = await checkVectorizationStatus(vectorizationId);
                console.log('Polling status:', data.status);

                if (data.status === 'completed' && data.result_url) {
                    clearInterval(interval);
                    setResultImage(data.result_url);
                    setStatus('done');
                    toast.success('Vetorização concluída!');
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    setStatus('error');
                    toast.error('Falha na vetorização. Tente novamente.');
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 2000);
    };

    // ── Opções de Efeitos ──
    const effectOptions = [
        {
            id: 'vectorize',
            label: 'Vetor Clássico',
            icon: <PenTool size={24} />,
            desc: 'Logos limpos, sem fundo, cores chapadas.',
            prompt: 'vectorize this logo, clean and professional, sharp edges, high resolution, flat colors, isolated, transparent background, strictly no background'
        },
        {
            id: 'embroidery',
            label: 'Efeito Bordado',
            icon: <Layers size={24} />,
            desc: 'Patch 3D realista, linhas detalhadas.',
            prompt: 'convert this logo into a realistic 3D embroidery patch, detailed threads, fabric texture, high resolution, isolated, transparent background, strictly no background'
        },
        {
            id: 'puff',
            label: 'Puff Print',
            icon: <Type size={24} />,
            desc: 'Relevo 3D estilo estampa puff.',
            prompt: 'convert this design into a 3D puff print on fabric, raised ink, tactile texture, realistic apparel printing, isolated, transparent background, strictly no background'
        },
        {
            id: 'neon',
            label: 'Efeito Neon',
            icon: <Zap size={24} />,
            desc: 'Letreiro neon brilhante realista.',
            prompt: 'convert this logo into a glowing neon sign, vibrant colors, cinematic lighting, isolated, transparent background, strictly no background'
        },
        {
            id: 'sticker',
            label: 'Adesivo',
            icon: <ImageIcon size={24} />,
            desc: 'Adesivo de vinil com borda branca.',
            prompt: 'convert this logo into a die-cut vinyl sticker, with a thick white border, glossy finish, flat vector style, isolated, transparent background outside the sticker, strictly no background'
        },
        {
            id: 'custom',
            label: 'Personalizado',
            icon: <MessageSquare size={24} />,
            desc: 'Escreva exatamente o que deseja.',
            prompt: '' // Usará o texto digitado
        }
    ];

    // ── Processar ──
    const handleProcess = async (prompt?: string) => {
        const source = resultImage || originalFile;
        if (!source) return;

        const isEdit = !!prompt;
        setStatus(isEdit ? 'processing' : 'uploading');

        try {
            let imageUrl = '';

            if (typeof source === 'string' && source.startsWith('http')) {
                imageUrl = source;
            } else if (originalFile) {
                imageUrl = await uploadImage(originalFile);
            } else {
                return;
            }

            console.log('Image source for AI:', imageUrl);

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
                console.error('Response missing vectorization_id:', response);
                throw new Error('Erro na resposta da API');
            }
        } catch (err: any) {
            console.error('Process error:', err);
            toast.error(err.message || 'Erro ao processar imagem.');
            setStatus('error');
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

    const handleDownload = () => {
        if (!resultImage) return;

        fetch(resultImage)
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `vetoriza-ai-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                toast.success('Download iniciado!');
            })
            .catch(() => {
                const link = document.createElement('a');
                link.href = resultImage!;
                link.target = '_blank';
                link.download = 'vetoriza-ai-result.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
    };

    const openCamera = () => cameraInputRef.current?.click();
    const openGallery = () => fileInputRef.current?.click();

    return (
        <div className="dashboard-mobile-vec">
            <div className="dashboard-content-vec">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />

                <div className="header-vec">
                    <div className="logo-container-vec">
                        <Palette className="bg-primary p-2 rounded-xl text-white" size={40} />
                        <div>
                            <h1 className="title-vec">Vetoriza AI</h1>
                            <p className="subtitle-vec">Transforme fotos em artes para DTF</p>
                        </div>
                    </div>
                </div>

                <div className="main-grid-vec">
                    {status === 'idle' && !originalImage ? (
                        <div
                            className={`upload-zone-vec ${dragActive ? 'active' : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={openGallery}
                        >
                            <div className="upload-content-vec">
                                <div className="upload-icon-wrapper-vec">
                                    <ImagePlus size={32} />
                                </div>
                                <h2 className="upload-title-vec">Arraste ou clique para enviar</h2>
                                <p className="upload-subtitle-vec">JPG, PNG ou WEBP (Max 10MB)</p>

                                <div className="upload-options-vec gap-3" onClick={e => e.stopPropagation()}>
                                    <button className="upload-btn-vec secondary" onClick={openCamera}>
                                        <Camera size={18} />
                                        Câmera
                                    </button>
                                    <button className="upload-btn-vec primary" onClick={openGallery}>
                                        <Upload size={18} />
                                        Galeria
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="preview-container-vec">
                            <div className="preview-split-left">
                                <div className="preview-card-vec active">
                                    <div className="card-header-vec">
                                        <span className="card-tag-vec">
                                            {status === 'processing' ? 'Processando IA...' : status === 'done' ? 'Resultado Final' : 'Imagem Original'}
                                        </span>
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
                            </div>

                            <div className="preview-split-right">
                                <div className="model-selector-vec">
                                    <button
                                        className={`model-btn-vec ${selectedModel === 'standard' ? 'active' : ''}`}
                                        onClick={() => setSelectedModel('standard')}
                                    >
                                        <Zap size={16} />
                                        <span>Standard</span>
                                        <span className="model-credits-vec">1 crédito</span>
                                    </button>
                                    <button
                                        className={`model-btn-vec ${selectedModel === 'pro' ? 'active' : ''}`}
                                        onClick={() => setSelectedModel('pro')}
                                    >
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
                                                    {status === 'processing' ? (
                                                        <p className="flex items-center gap-2">
                                                            <Loader2 className="animate-spin" size={16} />
                                                            <strong>Gabi:</strong> Um momento, estou preparando suas alterações...
                                                        </p>
                                                    ) : (
                                                        <p><strong>Gabi:</strong> Ficou do seu gosto? Me diga o que mais quer alterar! (ex: "deixe o fundo branco", "mude para vermelho")</p>
                                                    )}
                                                </div>
                                            </div>

                                            <form onSubmit={handleInlineSubmit} className="inline-chat-input-vec">
                                                <input
                                                    type="text"
                                                    value={inlinePrompt}
                                                    onChange={(e) => setInlinePrompt(e.target.value)}
                                                    placeholder="Diga à Gabi o que ajustar..."
                                                    disabled={status === 'processing'}
                                                />
                                                <button type="submit" disabled={!inlinePrompt.trim() || status === 'processing'}>
                                                    <Send size={18} />
                                                </button>
                                            </form>

                                            <div className="inline-actions-row-vec">
                                                <button className="action-btn-vec primary" onClick={handleDownload}>
                                                    <Download size={20} />
                                                    Baixar PNG
                                                </button>
                                                <button className="action-btn-vec ghost" onClick={handleReset}>
                                                    Nova Imagem
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
                                                        className={`effect-chip-vec ${selectedEffect === effect.id ? 'active' : ''}`}
                                                        onClick={() => setSelectedEffect(effect.id)}
                                                    >
                                                        <span className="effect-chip-icon">{effect.icon}</span>
                                                        <span className="effect-chip-label">{effect.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {selectedEffect && selectedEffect !== 'custom' && (
                                                <p className="effect-selected-desc fade-in">
                                                    {effectOptions.find(e => e.id === selectedEffect)?.desc}
                                                </p>
                                            )}

                                            {selectedEffect === 'custom' && (
                                                <div className="observation-field-vec fade-in">
                                                    <textarea
                                                        value={userPrompt}
                                                        onChange={(e) => setUserPrompt(e.target.value)}
                                                        placeholder="💡 Descreva o que quer vetorizar ou alterar. Ex: 'Logo em azul', 'Apenas o macaco'..."
                                                        rows={3}
                                                    />
                                                </div>
                                            )}

                                            <button
                                                className="action-btn-vec primary full mt-4"
                                                onClick={() => {
                                                    if (selectedEffect === 'custom') {
                                                        handleProcess(userPrompt || undefined);
                                                    } else {
                                                        const effect = effectOptions.find(e => e.id === selectedEffect);
                                                        handleProcess(effect?.prompt || undefined);
                                                    }
                                                }}
                                                disabled={!selectedEffect}
                                            >
                                                <Wand2 size={20} />
                                                {resultImage ? 'Aplicar Estilo' : 'Vetorizar Agora'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isAgentOpen && (
                <DesignAgent
                    currentImage={resultImage}
                    onSendMessage={handleProcess}
                    isProcessing={status === 'processing'}
                    onClose={() => setIsAgentOpen(false)}
                />
            )}
        </div>
    );
};

export default Vetorizador;
