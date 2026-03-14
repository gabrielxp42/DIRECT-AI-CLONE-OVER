"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MessageCircle, Send, Loader2, ArrowDown } from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionProvider";
import { format } from "date-fns";
import { toast } from "sonner";

type ChatMessage = {
    id: string;
    message?: string;
    content?: string;
    direction: 'sent' | 'received';
    created_at: string;
    client_name?: string;
    sender_type?: string;
};

interface OperatorChatModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    customerName: string;
    phone: string;
    orderId?: string;
    orderNumber?: number;
    onMessageSent?: () => void;
}

export const OperatorChatModal = ({
    isOpen,
    onOpenChange,
    customerName,
    phone,
    orderId,
    orderNumber,
    onMessageSent,
}: OperatorChatModalProps) => {
    const isMobile = useIsMobile();
    const { session } = useSession();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [useAI, setUseAI] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Normalizar telefone para comparação
    const normalizePhone = useCallback((p: string) => {
        return p.replace(/\D/g, '').replace(/^0+/, '');
    }, []);

    const normalizedPhone = normalizePhone(phone);
    // Garantir código do país 55 para envio
    const sendPhone = normalizedPhone.startsWith('55') ? normalizedPhone : `55${normalizedPhone}`;

    // Buscar histórico de mensagens
    const fetchMessages = useCallback(async () => {
        if (!session?.user?.id || !normalizedPhone) return;
        setLoadingHistory(true);

        try {
            // Buscar mensagens que contenham o telefone (últimos 8+ dígitos para match)
            const phoneEnd = normalizedPhone.slice(-8);

            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('id, message, direction, created_at, client_name, sender_type')
                .eq('user_id', session.user.id)
                .ilike('phone', `%${phoneEnd}`)
                .order('created_at', { ascending: true })
                .limit(30);

            if (error) {
                console.error('[OperatorChat] Erro ao buscar mensagens:', error);
            } else {
                setMessages(data || []);
            }
        } catch (err) {
            console.error('[OperatorChat] Exceção:', err);
        } finally {
            setLoadingHistory(false);
        }
    }, [session?.user?.id, normalizedPhone]);

    // Buscar mensagens quando o modal abre
    useEffect(() => {
        if (isOpen) {
            fetchMessages();
        } else {
            setMessages([]);
            setNewMessage("");
        }
    }, [isOpen, fetchMessages]);

    // Realtime subscription para novas mensagens
    useEffect(() => {
        if (!isOpen || !session?.user?.id) return;

        const channel = supabase
            .channel(`chat_${normalizedPhone}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'whatsapp_messages',
                filter: `user_id=eq.${session.user.id}`,
            }, (payload) => {
                const newMsg = payload.new as ChatMessage;
                const msgPhone = (newMsg as any).phone?.replace(/\D/g, '') || '';
                const phoneEnd = normalizedPhone.slice(-8);

                if (msgPhone.endsWith(phoneEnd)) {
                    setMessages(prev => {
                        // Evitar duplicatas
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, session?.user?.id, normalizedPhone]);

    // Auto-scroll para a última mensagem
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Focus no input ao abrir
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Enviar mensagem
    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;

        const messageText = newMessage.trim();
        setNewMessage("");
        setSending(true);

        try {
            const sessionResp = await supabase.auth.getSession();
            const currentSession = sessionResp.data.session;

            const resp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession?.access_token}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    action: 'send-text',
                    phone: sendPhone,
                    message: messageText,
                    mediate: useAI,
                }),
            });

            const result = await resp.json();

            if (!resp.ok || result?.error) {
                throw new Error(result?.message || 'Falha ao enviar mensagem');
            }

            // Mensagem otimista (já adicionada pelo realtime, mas como fallback)
            const optimisticMsg: ChatMessage = {
                id: `temp-${Date.now()}`,
                message: result.mediated_message || messageText,
                direction: 'sent',
                created_at: new Date().toISOString(),
                sender_type: 'operator',
            };

            setMessages(prev => {
                // Verificar se o realtime já adicionou
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.message === messageText && lastMsg.direction === 'sent') {
                    return prev;
                }
                return [...prev, optimisticMsg];
            });

            onMessageSent?.();
        } catch (error: any) {
            console.error('[OperatorChat] Erro ao enviar:', error);
            toast.error(error.message || 'Erro ao enviar mensagem');
            // Re-add the message to the input
            setNewMessage(messageText);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const getMessageText = (msg: ChatMessage) => {
        return msg.message || '';
    };

    const formatTime = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'HH:mm');
        } catch {
            return '';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                onOpenAutoFocus={(e) => e.preventDefault()}
                className={cn(
                    "bg-background text-foreground border-border shadow-2xl p-0 gap-0 overflow-hidden flex flex-col",
                    isMobile
                        ? "w-full max-w-full rounded-t-[2rem] rounded-b-none fixed bottom-0 max-h-[95vh] h-[95vh]"
                        : "max-w-lg rounded-2xl h-[600px] max-h-[85vh]"
                )}>

                {/* Header */}
                <div className="bg-gradient-to-r from-green-600/20 via-emerald-600/15 to-green-600/10 px-5 py-4 border-b border-border/50 shrink-0">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-green-500">
                            <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
                                <MessageCircle className="h-4.5 w-4.5 text-green-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="leading-tight">{customerName}</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    {phone}
                                    {orderNumber && <span className="ml-2 text-primary">• Pedido #{orderNumber}</span>}
                                </span>
                            </div>
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Chat com {customerName}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[hsl(var(--background)/0.5)]"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--primary) / 0.03), transparent 50%), radial-gradient(circle at 80% 50%, hsl(142 76% 36% / 0.03), transparent 50%)',
                    }}>

                    {loadingHistory && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-xs text-muted-foreground">Carregando histórico...</span>
                        </div>
                    )}

                    {!loadingHistory && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
                            <p className="text-xs opacity-60 mt-1">Envie uma mensagem para iniciar a conversa</p>
                        </div>
                    )}

                    {messages.map((msg) => {
                        const isSent = msg.direction === 'sent';
                        const isIA = msg.sender_type === 'ia' || msg.sender_type === 'ia_note';
                        const text = getMessageText(msg);
                        if (!text) return null;

                        return (
                            <div key={msg.id} className={cn("flex flex-col", isSent && !isIA ? "items-end" : "items-start")}>
                                <div className={cn(
                                    "max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all duration-300",
                                    isIA 
                                        ? "bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 text-foreground backdrop-blur-sm relative overflow-hidden group"
                                        : isSent
                                            ? "bg-green-600 text-white rounded-br-md"
                                            : "bg-muted text-foreground rounded-bl-md border border-border/50"
                                )}>
                                    {isIA && (
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter text-indigo-400">Nota da Gabi</span>
                                        </div>
                                    )}
                                    {!isSent && !isIA && msg.client_name && (
                                        <p className="text-[10px] font-bold text-green-500 mb-0.5">{msg.client_name}</p>
                                    )}
                                    <p className={cn(
                                        "whitespace-pre-wrap break-words",
                                        isIA && "italic text-muted-foreground"
                                    )}>{text}</p>
                                    <p className={cn(
                                        "text-[10px] mt-1 text-right",
                                        isSent && !isIA ? "text-white/60" : "text-muted-foreground"
                                    )}>
                                        {formatTime(msg.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}

                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="px-4 py-3 border-t border-border/50 bg-background shrink-0 space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                             <div className={cn(
                                "w-2 h-2 rounded-full animate-pulse",
                                useAI ? "bg-green-500" : "bg-muted-foreground/30"
                             )} />
                             <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {useAI ? "Gabi está moderando sua mensagem" : "Gabi desativada"}
                             </span>
                        </div>
                        <button 
                            onClick={() => setUseAI(!useAI)}
                            className={cn(
                                "text-[10px] font-bold px-3 py-1 rounded-full transition-all duration-300",
                                useAI 
                                    ? "bg-green-500/20 text-green-500 border border-green-500/30" 
                                    : "bg-muted text-muted-foreground border border-transparent"
                            )}
                        >
                            {useAI ? "DESATIVAR IA" : "ATIVAR IA (GABI)"}
                        </button>
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex items-center gap-2"
                    >
                        <Input
                            ref={inputRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={useAI ? "Peça para a Gabi dizer algo..." : "Digite sua mensagem..."}
                            className={cn(
                                "flex-1 bg-muted/50 border-input h-11 rounded-full px-4 transition-all duration-300",
                                useAI && "border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                            )}
                            disabled={sending}
                            autoComplete="off"
                        />
                        <Button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            size="icon"
                            className={cn(
                                "h-11 w-11 rounded-full text-white shadow-lg shrink-0 transition-all duration-200 active:scale-95",
                                useAI 
                                    ? "bg-green-500 hover:bg-green-600 shadow-green-900/20" 
                                    : "bg-green-600 hover:bg-green-700 shadow-green-900/20"
                            )}
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
};
