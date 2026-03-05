import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Sparkles, X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import './DesignAgent.css';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface DesignAgentProps {
    currentImage: string | null;
    onSendMessage: (message: string) => Promise<void>;
    isProcessing: boolean;
    onClose: () => void;
}

export function DesignAgent({ currentImage, onSendMessage, isProcessing, onClose }: DesignAgentProps) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'O que você gostaria de ajustar?'
        }
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        const userMessage = input.trim();
        setInput('');

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'user',
            content: userMessage
        }]);

        try {
            await onSendMessage(userMessage);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Processando... (2 créditos)'
            }]);
        } catch {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Erro ao processar. Tente novamente.'
            }]);
        }
    };

    const handleDownload = async () => {
        if (!currentImage) return;

        try {
            const response = await fetch(currentImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `vetoriza-ai-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch {
            window.open(currentImage, '_blank');
        }
    };

    const suggestions = [
        "Fundo transparente",
        "Preto e branco",
        "Mais contraste",
        "Simplificar"
    ];

    return (
        <div className="agent-overlay" onClick={onClose}>
            <div className="agent-modal" onClick={(e) => e.stopPropagation()}>
                {/* Image Preview with Zoom/Pan */}
                <div className="agent-preview">
                    {currentImage ? (
                        <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={4}
                            wheel={{ step: 0.1 }}
                            pinch={{ step: 5 }}
                            doubleClick={{ mode: 'reset' }}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    <div className="zoom-controls">
                                        <button onClick={() => zoomIn()} title="Zoom In">
                                            <ZoomIn size={18} />
                                        </button>
                                        <button onClick={() => zoomOut()} title="Zoom Out">
                                            <ZoomOut size={18} />
                                        </button>
                                        <button onClick={() => resetTransform()} title="Reset">
                                            <RotateCcw size={18} />
                                        </button>
                                    </div>
                                    <TransformComponent
                                        wrapperStyle={{ width: '100%', height: '100%' }}
                                        contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <img src={currentImage} alt="Preview" />
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>
                    ) : (
                        <div className="agent-preview-empty">
                            <Bot size={48} />
                            <span>Sem imagem</span>
                        </div>
                    )}
                    <button className="agent-close-mobile" onClick={onClose}>
                        <X size={20} />
                    </button>
                    {currentImage && (
                        <button className="agent-download" onClick={handleDownload}>
                            <Download size={18} />
                            Baixar
                        </button>
                    )}
                </div>

                {/* Chat Sidebar */}
                <div className="agent-chat">
                    <div className="agent-chat-header">
                        <Bot size={20} />
                        <span>Editor IA</span>
                        <button className="agent-close-desktop" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="agent-chat-messages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chat-msg ${msg.role}`}>
                                {msg.content}
                            </div>
                        ))}
                        {isProcessing && (
                            <div className="chat-msg assistant loading">
                                <Loader2 className="animate-spin" size={16} />
                                Processando...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="agent-chat-footer">
                        {messages.length === 1 && !isProcessing && (
                            <div className="agent-suggestions">
                                {suggestions.map(s => (
                                    <button key={s} onClick={() => setInput(s)} className="agent-pill">
                                        <Sparkles size={10} />
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="agent-input">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ex: Mudar cor..."
                                disabled={isProcessing}
                            />
                            <button type="submit" disabled={!input.trim() || isProcessing}>
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
