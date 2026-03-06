import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
    Sparkles,
    Download,
    Wand2,
    Camera,
    ImagePlus,
    Zap,
    Loader2,
    Palette,
    Send,
    ImageIcon,
    RotateCcw,
    MessageSquare,
    PenTool,
    Type,
    Edit3
} from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { DesignAgent } from '@/components/DesignAgent';
import './Vetorizador.css';

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const Vetorizador: React.FC = () => {
    const { supabase } = useSession();
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

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    };

    const uploadImage = async (file: File): Promise<string> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
        return data.publicUrl;
    };

    const vectorizeImage = async (imageUrl: string, model: string, prompt?: string) => {
        const { data, error } = await supabase.functions.invoke('vectorize', {
            body: { image_url: imageUrl, model, prompt }
        });
        if (error) throw error;
        return data;
    };

    const pollStatus = async (vectorizationId: string) => {
        const interval = setInterval(async () => {
            try {
                const { data, error } = await supabase.functions.invoke(`vectorize?id=${vectorizationId}`, { method: 'GET' });
                if (error) throw error;
                if (data.status === 'completed' && data.result_url) {
                    clearInterval(interval);
                    setResultImage(data.result_url);
                    setStatus('done');
                    setSelectedEffect(null);
                    setUserPrompt('');
                    toast.success('Vetorização concluída!');
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    setStatus('error');
                    toast.error('Falha na vetorização.');
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 2000);
    };

    const handleProcess = async (prompt?: string) => {
        const source = resultImage || originalFile;
        if (!source) return;
        const isEdit = !!prompt;
        setStatus(isEdit ? 'processing' : 'uploading');
        try {
            let imageUrl = (typeof source === 'string' && source.startsWith('http')) ? source : await uploadImage(originalFile!);
            const response = await vectorizeImage(imageUrl, isEdit ? 'edit' : selectedModel, prompt);
            if (response?.vectorization_id) pollStatus(response.vectorization_id);
            else throw new Error('Erro na resposta da API');
        } catch (err: any) {
            toast.error(err.message || 'Erro ao processar.');
            setStatus('error');
        }
    };

    const handleReset = () => {
        setOriginalImage(null);
        setOriginalFile(null);
        setResultImage(null);
        setStatus('idle');
        setSelectedEffect(null);
        setUserPrompt('');
    };

    const handleDownload = async () => {
        if (!resultImage) return;
        try {
            const response = await fetch(resultImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `vetor-direct-ai-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            toast.error('Erro ao baixar imagem.');
        }
    };

    const effectOptions = [
        { id: 'classic', label: 'Vetor Clássico', icon: <PenTool size={24} />, desc: 'Transformação limpa em vetor.', prompt: 'vectorize this logo, clean lines, high contrast, flat style, isolated, transparent background' },
        { id: 'embroidery', label: 'Efeito Bordado', icon: <Layers size={24} />, desc: 'Efeito de costura e linhas.', prompt: 'convert this design into a highly detailed embroidery patch, with realistic thread texture, satin stitching, 3D relief, isolated, transparent background' },
        { id: 'puff', label: 'Puff Print', icon: <Type size={24} />, desc: 'Relevo 3D estilo estampa puff.', prompt: 'convert this design into a 3D puff print on fabric, raised ink, tactile texture, realistic apparel printing, isolated, transparent background' },
        { id: 'neon', label: 'Efeito Neon', icon: <Zap size={24} />, desc: 'Letreiro neon brilhante.', prompt: 'convert this logo into a glowing neon sign, vibrant colors, isolated, transparent background' },
        { id: 'sticker', label: 'Adesivo', icon: <ImageIcon size={24} />, desc: 'Adesivo de vinil com borda.', prompt: 'convert this logo into a die-cut vinyl sticker, white border, glossy finish, isolated, transparent background' },
        { id: 'custom', label: 'Personalizado', icon: <MessageSquare size={24} />, desc: 'Escreva seu desejo.', prompt: '' }
    ];

    return (
        <div className="dashboard-mobile-vec">
            <div className="dashboard-content-vec">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} style={{ display: 'none' }} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileInput} style={{ display: 'none' }} />

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
                        <div className={`upload-zone-vec ${dragActive ? 'active' : ''}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                            <div className="upload-content-vec">
                                <div className="upload-icon-wrapper-vec"><ImagePlus size={32} /></div>
                                <h2 className="upload-title-vec">Transforme sua Imagem Agora</h2>
                                <p className="upload-subtitle-vec">Arraste seu arquivo ou escolha uma opção abaixo:</p>
                                <div className="upload-options-vec">
                                    <button className="action-btn-vec ghost flex-1 min-w-[120px]" onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                                        <Camera size={20} className="text-primary" />
                                        <span>Tirar Foto</span>
                                    </button>
                                    <button className="action-btn-vec ghost flex-1 min-w-[120px]" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                                        <ImageIcon size={20} className="text-primary" />
                                        <span>Galeria</span>
                                    </button>
                                </div>
                                <p className="mt-4 text-[10px] uppercase tracking-widest text-white/20 font-bold">JPG, PNG ou WEBP • Máx 10MB</p>
                            </div>
                        </div>
                    ) : (
                        <div className="preview-container-vec">
                            <div className="preview-split-left">
                                <div className="preview-card-vec active">
                                    <div className="card-header-vec">
                                        <span className="card-tag-vec">{status === 'processing' ? 'Processando...' : status === 'done' ? 'Vetorizado' : 'Original'}</span>
                                        {(status === 'idle' || status === 'done') && (
                                            <button className="absolute top-0 right-0 z-10 p-2 bg-black/40 rounded-full text-white/70 hover:text-white" onClick={handleReset}><RotateCcw size={16} /></button>
                                        )}
                                    </div>
                                    <div className="card-image-vec">
                                        {(status === 'processing' || status === 'uploading') && !resultImage ? (
                                            <div className="loading-container-vec">
                                                <Loader2 className="animate-spin text-primary" size={48} />
                                                <p>{status === 'uploading' ? 'Enviando...' : 'A mágica está acontecendo...'}</p>
                                            </div>
                                        ) : <img src={resultImage || originalImage || ''} alt="Preview" className={status === 'processing' ? 'opacity-50' : ''} />}
                                    </div>
                                </div>
                            </div>

                            <div className="preview-split-right">
                                <div className="model-selector-vec">
                                    <button className={`model-btn-vec ${selectedModel === 'standard' ? 'active' : ''}`} onClick={() => setSelectedModel('standard')}>
                                        <Zap size={16} /><span>Standard</span><span className="model-credits-vec">1 crédito</span>
                                    </button>
                                    <button className={`model-btn-vec ${selectedModel === 'pro' ? 'active' : ''}`} onClick={() => setSelectedModel('pro')}>
                                        <Sparkles size={16} /><span>Pro HD</span><span className="model-credits-vec">3 créditos</span>
                                    </button>
                                </div>

                                <div className="preview-actions-vec">
                                    {resultImage && (
                                        <div className="inline-agent-chat-vec fade-in">
                                            <div className="agent-bubble-vec">
                                                <div className="agent-avatar-vec"><Sparkles size={24} /></div>
                                                <div className="agent-text-vec">
                                                    {status === 'processing' ? <p><Loader2 className="animate-spin inline mr-2" size={16} />Gabi: Ajustando...</p> : <p><strong>Gabi:</strong> O que mais quer alterar?</p>}
                                                </div>
                                            </div>
                                            <form onSubmit={(e) => { e.preventDefault(); handleProcess(inlinePrompt); setInlinePrompt(''); }} className="inline-chat-input-vec">
                                                <input type="text" value={inlinePrompt} onChange={(e) => setInlinePrompt(e.target.value)} placeholder="Ajustar..." disabled={status === 'processing'} />
                                                <button type="submit" disabled={!inlinePrompt.trim() || status === 'processing'}><Send size={18} /></button>
                                            </form>
                                            <div className="inline-actions-row-vec">
                                                <button className="action-btn-vec primary" onClick={handleDownload}><Download size={20} /> Baixar</button>
                                                <button className="action-btn-vec ghost" onClick={handleReset}>Novo</button>
                                            </div>
                                        </div>
                                    )}

                                    {status !== 'processing' && status !== 'uploading' && (
                                        <div className="effects-selection-area">
                                            <h3 className="effects-title">Estilos Rápidos:</h3>
                                            <div className="effects-chips-vec">
                                                {effectOptions.map((eff) => (
                                                    <button key={eff.id} className={`effect-chip-vec ${selectedEffect === eff.id ? 'active' : ''}`} onClick={() => setSelectedEffect(eff.id)}>
                                                        {eff.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {selectedEffect === 'custom' && (
                                                <div className="observation-field-vec fade-in">
                                                    <div className="agent-bubble-vec mb-4">
                                                        <div className="agent-avatar-vec"><Sparkles size={24} /></div>
                                                        <div className="agent-text-vec"><p><strong>Gabi:</strong> O que deseja criar?</p></div>
                                                    </div>
                                                    <div className="custom-prompt-chat-input-wrapper">
                                                        <textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Descreva aqui..." rows={3} className="custom-prompt-textarea" />
                                                    </div>
                                                </div>
                                            )}
                                            <button className="action-btn-vec primary full mt-4" onClick={() => handleProcess(selectedEffect === 'custom' ? userPrompt : effectOptions.find(e => e.id === selectedEffect)?.prompt)} disabled={!selectedEffect}>
                                                <Wand2 size={20} /> {resultImage ? 'Aplicar' : 'Vetorizar'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
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
        </div>
    );
};

export default Vetorizador;
