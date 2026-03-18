

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, X, Trash2, Sparkles, ImagePlus, CheckCircle2, Zap } from 'lucide-react';
import { useWidgets, WidgetConfig } from '@dtf/contexts/WidgetContext';
import { sendMessageToOpenRouter } from '@dtf/services/chatService';
import { Message, WidgetAction } from '@dtf/types/chat';

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// Parse [ACTIONS]...[/ACTIONS] blocks from AI response
function parseActions(text: string): { cleanText: string; actions: WidgetAction[] } {
    const regex = /\[ACTIONS\]\s*([\s\S]*?)\s*\[\/ACTIONS\]/g;
    let actions: WidgetAction[] = [];
    let cleanText = text;

    let match;
    while ((match = regex.exec(text)) !== null) {
        try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed)) {
                actions = [...actions, ...parsed];
            }
        } catch (e) {
            console.error('Failed to parse actions:', e);
        }
        cleanText = cleanText.replace(match[0], '').trim();
    }

    return { cleanText, actions };
}

export default function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
    const { widgets, addWidget, updateWidget } = useWidgets();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [pendingImages, setPendingImages] = useState<string[]>([]);
    const [executedActions, setExecutedActions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingContent]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Execute widget actions
    const executeActions = useCallback((actions: WidgetAction[], uploadedImages?: string[]) => {
        const executed: string[] = [];
        const createdIds: string[] = [];

        for (const action of actions) {
            switch (action.action) {
                case 'create_widget': {
                    const id = addWidget(action.aspectRatio || '2:3');
                    createdIds.push(id);
                    const updates: Partial<WidgetConfig> = {};
                    if (action.prompt) updates.prompt = action.prompt;
                    if (action.garmentMode) updates.garmentMode = action.garmentMode;
                    if (action.halftonePreset) updates.halftonePreset = action.halftonePreset;
                    if (action.widthCm) updates.widthCm = action.widthCm;
                    if (action.heightCm) updates.heightCm = action.heightCm;
                    if (action.useUploadedImage && uploadedImages?.length) {
                        updates.uploadedImages = uploadedImages;
                    }
                    // Call updateWidget directly — React batches both setWidgets calls
                    updateWidget(id, updates);
                    executed.push(`✅ Widget criado (${action.aspectRatio || '2:3'})`);
                    break;
                }
                case 'update_widget': {
                    const idx = action.widgetIndex ?? 0;
                    if (idx >= 0 && idx < widgets.length) {
                        const widgetId = widgets[idx].id;
                        const updates: Partial<WidgetConfig> = {};
                        if (action.prompt !== undefined) updates.prompt = action.prompt;
                        if (action.garmentMode) updates.garmentMode = action.garmentMode;
                        if (action.halftonePreset) updates.halftonePreset = action.halftonePreset;
                        if (action.widthCm !== undefined) updates.widthCm = Number(action.widthCm);
                        if (action.heightCm !== undefined) updates.heightCm = Number(action.heightCm);
                        if (action.aspectRatio) updates.aspectRatio = action.aspectRatio;
                        if (action.useUploadedImage && uploadedImages?.length) {
                            updates.uploadedImages = uploadedImages;
                        }
                        updateWidget(widgetId, updates);
                        executed.push(`✅ Widget ${idx + 1} atualizado`);
                    } else {
                        executed.push(`⚠️ Widget ${idx + 1} não encontrado`);
                    }
                    break;
                }
                case 'trigger_generation': {
                    // Desabilitado — somente o usuário pode gerar
                    executed.push('⚠️ Clique em GERAR no widget quando estiver pronto!');
                    break;
                }
            }
        }

        setExecutedActions(executed);
        setTimeout(() => setExecutedActions([]), 5000);
    }, [addWidget, updateWidget, widgets]);

    const sendMessage = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
            images: pendingImages.length > 0 ? [...pendingImages] : undefined,
        };

        setMessages(prev => [...prev, userMessage]);
        const currentImages = [...pendingImages];
        setInput('');
        setPendingImages([]);
        setIsLoading(true);
        setStreamingContent('');

        // Build API messages with context about current widgets
        const widgetContext = widgets.length > 0
            ? `\n\n[CONTEXTO ATUAL: O usuário tem ${widgets.length} widget(s) ativo(s):\n${widgets.map((w, i) => `  Widget ${i + 1}: prompt="${w.prompt || '(vazio)'}", aspectRatio="${w.aspectRatio}", garmentMode="${w.garmentMode}", halftone="${w.halftonePreset}"${w.widthCm ? `, largura=${w.widthCm}cm` : ''}${w.heightCm ? `, altura=${w.heightCm}cm` : ''}`).join('\n')}\n]`
            : '\n\n[CONTEXTO ATUAL: Nenhum widget ativo.]';

        const apiMessages = [...messages, userMessage].map((m, i, arr) => {
            const msgObj: any = {
                role: m.role,
                content: m.content,
            };
            // Add widget context to the last user message
            if (m.role === 'user' && i === arr.length - 1) {
                msgObj.content = m.content + widgetContext;
            }
            // Add images if present
            if (m.images && m.images.length > 0) {
                msgObj.images = m.images;
            }
            return msgObj;
        });

        try {
            abortRef.current = new AbortController();

            // Usar serviço client-side em vez de API route (fix para Electron)
            const stream = await sendMessageToOpenRouter(apiMessages, abortRef.current.signal);
            const reader = stream.getReader();

            const decoder = new TextDecoder();
            let fullContent = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            fullContent += parsed.content;
                            // Show clean text during streaming (remove action blocks visually)
                            const { cleanText } = parseActions(fullContent);
                            setStreamingContent(cleanText);
                        }
                    } catch {
                        // skip
                    }
                }
            }

            // Parse actions from final content
            const { cleanText, actions } = parseActions(fullContent);

            // Execute actions if any
            if (actions.length > 0) {
                executeActions(actions, currentImages);
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: cleanText,
                timestamp: new Date(),
                actions: actions.length > 0 ? actions : undefined,
            };

            setMessages(prev => [...prev, assistantMessage]);
            setStreamingContent('');
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error('Chat error:', e);
                const errorMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: '❌ Erro ao processar sua mensagem. Verifique sua conexão ou a chave de API.',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } finally {
            setIsLoading(false);
            setStreamingContent('');
            abortRef.current = null;
        }
    }, [input, isLoading, messages, pendingImages, widgets, executeActions]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result as string;
                    setPendingImages(prev => [...prev, base64]);
                };
                reader.readAsDataURL(file);
            }
        });

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removePendingImage = (index: number) => {
        setPendingImages(prev => prev.filter((_, i) => i !== index));
    };

    const clearChat = () => {
        setMessages([]);
        setStreamingContent('');
        setPendingImages([]);
        if (abortRef.current) abortRef.current.abort();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed right-0 top-[96px] bottom-0 w-[420px] z-[45] flex flex-col"
                style={{
                    background: 'linear-gradient(180deg, rgba(9,9,11,0.98) 0%, rgba(9,9,11,0.95) 100%)',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">DTF AI Assistant</h3>
                            <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
                                <span className="text-[10px] text-white/40">Grok 4.1 • Pode criar widgets!</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={clearChat}
                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/30 hover:text-white/60"
                            title="Limpar conversa"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Action Feedback Toast */}
                <AnimatePresence>
                    {executedActions.length > 0 && (
                        <motion.div
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -30, opacity: 0 }}
                            className="mx-4 mt-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl"
                        >
                            {executedActions.map((a, i) => (
                                <p key={i} className="text-xs text-green-400 flex items-center gap-1.5">
                                    <Zap size={12} />
                                    {a}
                                </p>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
                    {messages.length === 0 && !streamingContent && (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20 flex items-center justify-center">
                                <Sparkles className="w-7 h-7 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white/60 mb-1">Assistente DTF Factory</p>
                                <p className="text-xs text-white/30 max-w-[280px]">
                                    Posso criar widgets, melhorar prompts, ensinar sobre halftone e ajudar com suas artes DTF!
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center mt-2">
                                {[
                                    'Crie 2 cards 2:3 com Goku neon',
                                    'Como funciona camiseta preta?',
                                    'Quais presets de halftone existem?',
                                    'Me ensine a usar a ferramenta',
                                ].map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInput(suggestion)}
                                        className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/50 hover:bg-violet-500/10 hover:border-violet-500/20 hover:text-violet-300 transition-all"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className="space-y-1">
                            <div className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Bot className="w-3.5 h-3.5 text-violet-400" />
                                    </div>
                                )}
                                <div className={`max-w-[85%] space-y-2`}>
                                    {/* Show uploaded images */}
                                    {msg.images && msg.images.length > 0 && (
                                        <div className="flex gap-1.5 flex-wrap justify-end">
                                            {msg.images.map((img, i) => (
                                                <img
                                                    key={i}
                                                    src={img}
                                                    alt="Upload"
                                                    className="w-16 h-16 rounded-lg object-cover border border-white/10"
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <div className={`px-3 py-2 rounded-xl text-[13px] leading-relaxed ${msg.role === 'user'
                                        ? 'bg-cyan-500/15 border border-cyan-500/20 text-cyan-50'
                                        : 'bg-white/5 border border-white/5 text-white/80'
                                        }`}>
                                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                        <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-cyan-400/40 text-right' : 'text-white/20'}`}>
                                            {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    {/* Action badges */}
                                    {msg.actions && msg.actions.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {msg.actions.map((a, i) => (
                                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] text-green-400">
                                                    <CheckCircle2 size={10} />
                                                    {a.action === 'create_widget' ? `Widget criado (${a.aspectRatio})` :
                                                        a.action === 'update_widget' ? `Widget ${(a.widgetIndex ?? 0) + 1} atualizado` :
                                                            'Geração disparada'}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <User className="w-3.5 h-3.5 text-cyan-400" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Streaming message */}
                    {streamingContent && (
                        <div className="flex gap-2 justify-start">
                            <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Bot className="w-3.5 h-3.5 text-violet-400" />
                            </div>
                            <div className="max-w-[85%] px-3 py-2 rounded-xl text-[13px] leading-relaxed bg-white/5 border border-white/5 text-white/80">
                                <div className="whitespace-pre-wrap break-words">{streamingContent}</div>
                                <span className="inline-block w-2 h-4 bg-violet-400/60 animate-pulse ml-0.5 rounded-sm" />
                            </div>
                        </div>
                    )}

                    {/* Loading indicator */}
                    {isLoading && !streamingContent && (
                        <div className="flex gap-2 justify-start">
                            <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-3.5 h-3.5 text-violet-400" />
                            </div>
                            <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Pending Images Preview */}
                {pendingImages.length > 0 && (
                    <div className="px-4 py-2 border-t border-white/5 flex gap-2 flex-wrap">
                        {pendingImages.map((img, i) => (
                            <div key={i} className="relative group">
                                <img
                                    src={img}
                                    alt="Pending"
                                    className="w-12 h-12 rounded-lg object-cover border border-violet-500/30"
                                />
                                <button
                                    onClick={() => removePendingImage(i)}
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input */}
                <div className="px-4 py-3 border-t border-white/5">
                    <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-violet-500/30 transition-colors">
                        {/* Image upload button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-violet-400 transition-colors flex-shrink-0"
                            title="Enviar imagem"
                        >
                            <ImagePlus className="w-4 h-4" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Crie widgets, peça ajuda..."
                            rows={1}
                            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 resize-none outline-none max-h-[100px] scrollbar-thin"
                            style={{ minHeight: '20px' }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = '20px';
                                target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className="p-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <p className="text-[9px] text-white/20 mt-1.5 text-center">
                        Powered by Grok 4.1 • Pode criar e modificar widgets
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
