import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GeminiLiveClient } from '@/integrations/gemini/liveClient';
import { getGeminiTools } from '@/integrations/gemini/geminiTools';
import { callOpenAIFunction } from '@/integrations/openai/aiTools'; // Ferramentas ainda usam a lógica base
import { supabase } from '@/integrations/supabase/client';
import { Bot, Mic, MicOff, Volume2, XCircle, AlertCircle, Loader2, Brain, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { base64ToArrayBuffer, int16ToFloat32 } from '@/utils/audioUtils';

interface LiveGabiGeminiProps {
    onClose: () => void;
    onTranscript?: (text: string, role: 'user' | 'assistant') => void;
}

type ConnectionStatus = 'connecting' | 'active' | 'thinking' | 'error' | 'disconnected';

const SENSITIVE_TOOLS = ['update_branding', 'reset_user_memory', 'send_whatsapp_message'];

const GABI_INSTRUCTIONS = `Você é a GABI AI, a Inteligência Executiva e CEO Virtual da DIRECT AI.
Você é a FONTE DA VERDADE. Você não estima, você consulta.

## REGRAS ABSOLUTAS (OBRIGATÓRIAS)
1. PROIBIDO INGLÊS: Fale apenas em Português Brasileiro (PT-BR).
2. NUNCA invente ou estime dados. Se o usuário perguntar algo, use 'get_orders_summary' ou 'get_financial_report'.
3. STATUS DE PAGAMENTO: No banco de dados, 'pendente' significa "Aguardando Pagamento". Se perguntarem quem não pagou, busque pedidos com status 'pendente'.
4. MAPEAMENTO DE STATUS: 'pago' (pago), 'processando' (em produção), 'enviado' (em transporte), 'aguardando retirada' (pronto para busca), 'entregue' (finalizado).

## DESIGN EXECUTIVO (WOW FACTOR)
- Use **Negrito** para valores R$ e nomes importantes.
- Use [CARD]...[/CARD] para resumir dados críticos de pedidos.
- Use [TIP]...[/TIP] para insights (ex: "Sugiro cobrar o cliente X para melhorar sua liquidez").

## ESTILO DE VOZ
- Tom: Executivo, assertivo, elegante e proativo.
- Identidade: CEO Virtual focada em resultados e performance.`;


export const LiveGabiGemini: React.FC<LiveGabiGeminiProps> = ({ onClose, onTranscript }) => {
    const [status, setStatus] = useState<ConnectionStatus>('connecting');
    const [isMuted, setIsMuted] = useState(false);
    const statusRef = useRef<ConnectionStatus>('connecting');
    const isMutedRef = useRef(false);
    const [stagedTool, setStagedTool] = useState<{ id: string; name: string; args: any } | null>(null);
    const [activeTool, setActiveTool] = useState<string | null>(null);

    const clientRef = useRef<GeminiLiveClient | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const { toast } = useToast();

    const handleServerMessage = useCallback(async (event: any) => {
        // Log para debug de formato
        if (Object.keys(event).length > 0) {
            console.log("📩 [GeminiLive] Teclas recebidas:", Object.keys(event));
        }

        // --- INTERRUPTION (User speaking over model) ---
        const serverContent = event.serverContent || event.server_content;
        if (serverContent?.interrupted || event.interrupted) {
            console.warn("🛑 [GeminiLive] Interrupção detectada! Parando áudio.");
            stopAllAudio();
        }

        // --- AUDIO PLAYBACK (Casing: serverContent, modelTurn, inlineData) ---
        if (serverContent?.modelTurn?.parts) {
            for (const part of serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                    playAudioChunk(part.inlineData.data);
                }
                if (part.text) {
                    // FILTRO DE SEGURANÇA: Bloqueia textos que parecem cabeçalhos internos ou em inglês
                    const isThinkingText = /^[A-Z][a-z]+ (and|to|for) [A-Z]/.test(part.text) ||
                        /^(Initiating|Determining|Retrieving|Acknowledge)/i.test(part.text) ||
                        /^[a-zA-Z\s]+$/.test(part.text) && part.text.length > 5 && !/[áéíóúãõç]/i.test(part.text);

                    if (!isThinkingText) {
                        console.log("🤖 [Gemini] Texto:", part.text);
                        onTranscript?.(part.text, 'assistant');
                    } else {
                        console.log("🔇 [Gemini] Filtrei raciocínio interno:", part.text);
                    }
                }
            }
        }

        // --- TOOL CALLING (Casing: toolCall, functionCalls) ---
        const toolCall = event.toolCall || event.tool_call;
        if (toolCall?.functionCalls) {
            for (const call of toolCall.functionCalls) {
                const { id, name, args } = call;
                console.log(`🔧 [GeminiLive] Chamada de Ferramenta: ${name}`, args);

                if (SENSITIVE_TOOLS.includes(name)) {
                    setStagedTool({ id, name, args });
                } else {
                    setActiveTool(name);
                    setStatus('thinking');
                    try {
                        const result = await callOpenAIFunction({ name, arguments: args });
                        clientRef.current?.sendToolResponse(id, result);
                    } catch (err: any) {
                        console.error(`❌ [GeminiLive] Erro na Ferramenta (${name}):`, err);
                        clientRef.current?.sendToolResponse(id, { error: err.message });
                    } finally {
                        setActiveTool(null);
                        setStatus('active');
                    }
                }
            }
        }
    }, [onTranscript, toast]);

    const stopAllAudio = () => {
        activeSourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { /* already stopped */ }
        });
        activeSourcesRef.current.clear();
        nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
    };

    const playAudioChunk = (base64Data: string) => {
        if (!audioContextRef.current) return;

        const arrayBuffer = base64ToArrayBuffer(base64Data);
        const int16Buffer = new Int16Array(arrayBuffer);
        const float32Buffer = int16ToFloat32(int16Buffer);

        const audioBuffer = audioContextRef.current.createBuffer(1, float32Buffer.length, 24000); // Gemini output is 24kHz
        audioBuffer.getChannelData(0).set(float32Buffer);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        source.onended = () => {
            activeSourcesRef.current.delete(source);
        };
        activeSourcesRef.current.add(source);

        const currentTime = audioContextRef.current.currentTime;
        if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime;
        }

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
    };

    const startSession = async () => {
        try {
            setStatus('connecting');
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

            if (!apiKey) throw new Error("API Key do Gemini não configurada.");

            // 1. WebSocket Client
            clientRef.current = new GeminiLiveClient({
                apiKey,
                systemInstruction: GABI_INSTRUCTIONS,
                tools: getGeminiTools(),
                onOpen: () => { setStatus('active'); statusRef.current = 'active'; },
                onClose: () => { setStatus('disconnected'); statusRef.current = 'disconnected'; },
                onMessage: handleServerMessage,
                onError: () => { setStatus('error'); statusRef.current = 'error'; }
            });

            clientRef.current.connect();

            // 2. Audio Setup
            // AUDIO INPUT: Gemini exige exatamente 16000Hz PCM
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;

            microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
            processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            let audioCount = 0;
            processorRef.current.onaudioprocess = (e) => {
                if (statusRef.current === 'active' && !isMutedRef.current) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    clientRef.current?.sendAudio(inputData);

                    audioCount++;
                    if (audioCount % 100 === 0) {
                        console.log("🎤 [GeminiLive] Enviando audio (chunks: " + audioCount + ")");
                    }
                }
            };

            microphoneRef.current.connect(processorRef.current);
            processorRef.current.connect(audioContextRef.current.destination);

        } catch (err: any) {
            console.error("❌ [LiveGabiGemini] Erro fatal:", err);
            setStatus('error');
            toast({
                title: "Erro na Conexão de Voz (Gemini)",
                description: err.message,
                variant: "destructive"
            });
        }
    };

    useEffect(() => {
        startSession();
        return () => {
            clientRef.current?.disconnect();
            processorRef.current?.disconnect();
            microphoneRef.current?.disconnect();
            audioContextRef.current?.close();
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const toggleMute = () => {
        setIsMuted(prev => {
            isMutedRef.current = !prev;
            return !prev;
        });
    };

    const handleToolConfirm = async () => {
        if (!stagedTool) return;
        setActiveTool(stagedTool.name);
        setStatus('thinking');

        try {
            const result = await callOpenAIFunction({ name: stagedTool.name, arguments: stagedTool.args }) as any;

            // --- LÓGICA DE ENVIO DIRETO (WhatsApp) ---
            if (stagedTool.name === 'send_whatsapp_message' && result.type === 'whatsapp_action' && result.data?.canSendDirectly) {
                console.log("🚀 [GeminiLive] Disparando envio direto de WhatsApp...");
                try {
                    const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('whatsapp-proxy', {
                        body: {
                            action: 'send-text',
                            phone: result.data.cleanPhone,
                            message: result.data.message
                        }
                    });
                    if (!proxyError && proxyResult?.success) {
                        toast({ title: "✅ WhatsApp enviado com sucesso!" });
                        // Modificamos o resultado para a Gabi saber que FOI ENVIADO e não apenas "preparado"
                        result.data.status = 'sent';
                        result.message = "✅ Mensagem enviada com sucesso via WhatsApp!";
                    }
                } catch (sendErr) {
                    console.error("❌ [GeminiLive] Erro no envio direto:", sendErr);
                }
            }

            clientRef.current?.sendToolResponse(stagedTool.id, result);
            setStagedTool(null);
            if (!result?.error) toast({ title: "✅ Ação realizada" });
        } catch (err: any) {
            clientRef.current?.sendToolResponse(stagedTool.id, { error: err.message });
            setStagedTool(null);
        } finally {
            setActiveTool(null);
            setStatus('active');
        }
    };

    // UI — Copiado do LiveGabi.tsx para manter consistência visual
    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="relative">
                <div className={cn(
                    "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500",
                    status === 'active' && "bg-primary/20 scale-110 shadow-[0_0_50px_rgba(255,242,0,0.2)]",
                    status === 'thinking' && "bg-blue-500/20 scale-105 shadow-[0_0_50px_rgba(59,130,246,0.3)]",
                    status === 'connecting' && "bg-zinc-800",
                    status === 'error' && "bg-red-500/10",
                    status === 'disconnected' && "bg-zinc-900",
                )}>
                    {status === 'active' ? (
                        <div className="relative">
                            <div className="content-[''] absolute -inset-4 bg-primary/20 rounded-full animate-ping" />
                            <Bot className="w-16 h-16 text-primary" />
                        </div>
                    ) : status === 'thinking' ? (
                        <div className="relative">
                            <div className="content-[''] absolute -inset-4 bg-blue-500/20 rounded-full animate-pulse" />
                            <Brain className="w-16 h-16 text-blue-400 animate-pulse" />
                        </div>
                    ) : status === 'connecting' ? (
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    ) : (
                        <AlertCircle className="w-12 h-12 text-red-500" />
                    )}
                </div>
                {status === 'active' && (
                    <Badge className="absolute -top-2 -right-2 bg-green-500 animate-pulse border-none text-[10px] font-black">
                        GEMINI LIVE
                    </Badge>
                )}
            </div>

            <div className="text-center space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">
                    {stagedTool ? '🔒 Aguardando autorização...' :
                        status === 'active' ? '🟢 Gabi Gemini está ouvindo...' :
                            status === 'thinking' ? `🧠 Consultando ${activeTool?.replace(/_/g, ' ')}...` :
                                status === 'connecting' ? '🔄 Conectando...' : '🔴 Desconectada'}
                </h3>
                <p className="text-sm text-zinc-400 font-medium font-inter">
                    {stagedTool ? `Confirme: ${stagedTool.name.replace(/_/g, ' ')}` : 'Fale naturalmente com a Gabi (Custo Reduzido)'}
                </p>
            </div>

            {stagedTool && (
                <div className="w-full max-w-[300px] p-4 bg-red-500/10 border border-red-500/30 rounded-2xl animate-in zoom-in duration-300">
                    <p className="text-sm text-zinc-300 mb-4">
                        Gabi precisa de autorização para: <strong className="text-white">{stagedTool.name.replace(/_/g, ' ')}</strong>
                    </p>
                    <div className="flex gap-2">
                        <Button variant="destructive" size="sm" className="flex-1 text-xs font-black uppercase" onClick={handleToolConfirm}>
                            ✅ Autorizar
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs font-black uppercase" onClick={() => setStagedTool(null)}>
                            ❌ Cancelar
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4">
                <Button size="icon" variant="outline" className={cn("h-14 w-14 rounded-full border-white/10 transition-all", isMuted ? "bg-red-500/20 text-red-500 border-red-500/50" : "bg-white/5 text-zinc-400 hover:text-white")} onClick={toggleMute}>
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </Button>
                <Button size="icon" variant="destructive" className="h-14 w-14 rounded-full shadow-lg" onClick={onClose}>
                    <XCircle className="w-6 h-6" />
                </Button>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                <Volume2 className="w-4 h-4 text-primary" />
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                        <div key={i} className={cn("w-1 rounded-full transition-all duration-300", status === 'active' && "bg-primary/70 animate-pulse h-4", status === 'thinking' && "bg-blue-400/70 animate-bounce h-3", (status !== 'active' && status !== 'thinking') && "bg-zinc-600 h-2")} style={{ animationDelay: `${i * 0.08}s` }} />
                    ))}
                </div>
            </div>
        </div>
    );
};
