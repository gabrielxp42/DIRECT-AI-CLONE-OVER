import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getOpenAIClient } from '@/integrations/openai/client';
import { openAIFunctions, callOpenAIFunction } from '@/integrations/openai/aiTools';
import { Bot, Mic, MicOff, Volume2, XCircle, AlertCircle, Loader2, Brain, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LiveGabiProps {
    onClose: () => void;
    onTranscript?: (text: string, role: 'user' | 'assistant') => void;
}

type ConnectionStatus = 'connecting' | 'active' | 'thinking' | 'error' | 'disconnected';

const SENSITIVE_TOOLS = ['update_branding', 'reset_user_memory'];

const GABI_INSTRUCTIONS = `Você é a Gabi, a inteligência central da DIRECT AI — um sistema de gestão para empresas de DTF e personalização.

## IDENTIDADE
- Você é uma assistente de vendas e operações PREMIUM.
- Sua voz é profissional, amigável e confiável.
- Fale em português brasileiro natural.

## REGRAS ABSOLUTAS (INVIOLÁVEIS)
1. NUNCA invente dados. Se não tem a informação, diga "Vou consultar agora" e use a ferramenta certa.
2. Quando receber resultado de uma ferramenta, leia os valores EXATOS do JSON retornado. Exemplo: se "valor_total" = 1250.50, diga "mil duzentos e cinquenta reais e cinquenta centavos".
3. NUNCA arredonde ou aproxime valores de metros, quantidades, preços ou nomes.
4. Se uma ferramenta retornar erro, diga honestamente "Houve um erro ao consultar" e pergunte se quer tentar novamente.
5. Sempre reporte o resultado da consulta imediatamente após receber. NUNCA fique muda.
6. SÓ chame ferramentas que o usuário PEDIU. NUNCA faça chamadas extras por conta própria. Se o usuário perguntou sobre "último pedido", consulte APENAS isso. NÃO busque clientes ou dados que não foram solicitados.

## COMPORTAMENTO
- Ao iniciar, cumprimente brevemente: "Oi! Gabi aqui. Como posso te ajudar?"
- Seja BREVE e DIRETA nas respostas. Máximo 2-3 frases por resposta quando falar dados.
- Quando o resultado incluir o campo "itens", SEMPRE mencione os itens do pedido (tipo de serviço, quantidade, e valor unitário).
- Se o usuário perguntar algo genérico (ex: "como vai?"), responda naturalmente sem chamar ferramentas.
- Para perguntas sobre dados do negócio (pedidos, vendas, metros, clientes), SEMPRE use ferramentas.
- Para ações destrutivas (deletar dados, resetar memória), peça autorização ANTES.
- Você TEM PERMISSÃO para atualizar status de pedidos diretamente. Se o usuário disser "o pedido da Camila tá pronto", altere o status sem pedir confirmação.
- APÓS alterar o status de um pedido, SEMPRE sugira: "Quer que eu avise o cliente por WhatsApp também?" Se o usuário aceitar, use send_whatsapp_message.

## ESTILO DE VOZ
- Tom: profissional mas caloroso
- Ritmo: moderado, sem pressa
- Vocabulário: claro, sem jargão técnico desnecessário`;

export const LiveGabi: React.FC<LiveGabiProps> = ({ onClose, onTranscript }) => {
    const [status, setStatus] = useState<ConnectionStatus>('connecting');
    const [isMuted, setIsMuted] = useState(false);
    const [stagedTool, setStagedTool] = useState<{ id: string; name: string; args: any } | null>(null);
    const [activeTool, setActiveTool] = useState<string | null>(null);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const stagedToolRef = useRef(stagedTool);
    const { toast } = useToast();

    // Keep ref in sync with state (fixes stale closure issue)
    useEffect(() => {
        stagedToolRef.current = stagedTool;
    }, [stagedTool]);

    const sendClientEvent = useCallback((event: any) => {
        if (dcRef.current && dcRef.current.readyState === 'open') {
            console.log(`📤 [LiveGabi] Sending: ${event.type}`);
            dcRef.current.send(JSON.stringify(event));
        } else {
            console.warn(`⚠️ [LiveGabi] DC not open, cannot send: ${event.type}`);
        }
    }, []);

    const handleToolConfirm = useCallback(async () => {
        const tool = stagedToolRef.current;
        if (!tool) return;

        setActiveTool(tool.name);
        setStatus('thinking');

        try {
            console.log("🚀 [LiveGabi] Executando ferramenta AUTORIZADA:", tool.name);
            const result = await callOpenAIFunction({ name: tool.name, arguments: tool.args });
            const resultStr = JSON.stringify(result);
            console.log(`✅ [LiveGabi] Tool Result (${tool.name}):`, resultStr.substring(0, 500));

            sendClientEvent({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: tool.id,
                    output: resultStr,
                },
            });
            sendClientEvent({ type: "response.create" });
            setStagedTool(null);
            toast({ title: "✅ Ação realizada", description: `${tool.name.replace(/_/g, ' ')} executado com sucesso.` });
        } catch (err: any) {
            console.error(`❌ [LiveGabi] Erro na ferramenta autorizada ${tool.name}:`, err);
            sendClientEvent({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: tool.id,
                    output: JSON.stringify({ error: err.message || 'Erro desconhecido' }),
                },
            });
            sendClientEvent({ type: "response.create" });
            toast({ title: "Erro na execução", description: err.message, variant: "destructive" });
            setStagedTool(null);
        } finally {
            setActiveTool(null);
            setStatus('active');
        }
    }, [sendClientEvent, toast]);

    const startSession = async () => {
        try {
            setStatus('connecting');
            const openai = getOpenAIClient();

            // 1. Get ephemeral token
            const { client_secret } = await openai.getRealtimeSession(openAIFunctions);
            const EPHEMERAL_KEY = client_secret.value;
            console.log("🔑 [LiveGabi] Token efêmero obtido.");

            // 2. Create RTCPeerConnection with ICE monitoring
            const pc = new RTCPeerConnection();
            pcRef.current = pc;

            pc.oniceconnectionstatechange = () => {
                console.log(`🌐 [LiveGabi] ICE State: ${pc.iceConnectionState}`);
                if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                    setStatus('disconnected');
                    toast({
                        title: "Conexão perdida",
                        description: "A conexão de voz foi interrompida. Tente reconectar.",
                        variant: "destructive"
                    });
                }
            };

            // 3. Audio output
            const audioEl = document.createElement("audio");
            audioEl.autoplay = true;
            audioElementRef.current = audioEl;
            pc.ontrack = (e) => {
                if (audioElementRef.current) {
                    audioElementRef.current.srcObject = e.streams[0];
                }
            };

            // 4. Capture user mic
            const ms = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            streamRef.current = ms;
            pc.addTrack(ms.getTracks()[0]);

            // 5. Data Channel
            const dc = pc.createDataChannel("oai-events");
            dcRef.current = dc;

            dc.onopen = () => {
                console.log("🟢 [LiveGabi] Data Channel aberto. Configurando sessão PREMIUM...");

                // Session update with premium config
                sendClientEvent({
                    type: "session.update",
                    session: {
                        modalities: ["audio", "text"],
                        voice: "shimmer",
                        temperature: 0.6,
                        instructions: GABI_INSTRUCTIONS,
                        input_audio_transcription: { model: "whisper-1" },
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.6,
                            prefix_padding_ms: 400,
                            silence_duration_ms: 1200,
                        },
                    },
                });

                // Trigger greeting
                sendClientEvent({
                    type: "response.create",
                    response: {
                        modalities: ["audio", "text"],
                        instructions: "Cumprimente o usuário brevemente. Diga algo como 'Oi! Gabi aqui, ao vivo. Como posso te ajudar?' Seja natural e breve."
                    }
                });
            };

            dc.onmessage = async (e) => {
                const event = JSON.parse(e.data);

                // --- TRANSCRIPT EVENTS ---
                if (event.type === "conversation.item.input_audio_transcription.completed") {
                    const text = event.transcript?.trim();
                    if (text) {
                        console.log(`🗣️ [User] ${text}`);
                        onTranscript?.(text, 'user');

                        // Verbal confirmation for staged tool
                        const currentStaged = stagedToolRef.current;
                        if (currentStaged) {
                            const lower = text.toLowerCase();
                            if (lower.includes("sim") || lower.includes("autorizo") || lower.includes("pode") || lower.includes("confirmo") || lower.includes("confirmar")) {
                                await handleToolConfirm();
                            } else if (lower.includes("não") || lower.includes("cancela") || lower.includes("negar")) {
                                // Cancel staged tool
                                sendClientEvent({
                                    type: "conversation.item.create",
                                    item: {
                                        type: "function_call_output",
                                        call_id: currentStaged.id,
                                        output: JSON.stringify({ cancelled: true, message: "Ação cancelada pelo usuário." }),
                                    },
                                });
                                sendClientEvent({ type: "response.create" });
                                setStagedTool(null);
                                toast({ title: "Ação cancelada", description: "A operação foi cancelada." });
                            }
                        }
                    }
                }

                if (event.type === "response.audio_transcript.done") {
                    if (event.transcript) {
                        console.log(`🤖 [Gabi] ${event.transcript}`);
                        onTranscript?.(event.transcript, 'assistant');
                    }
                }

                // --- STATUS EVENTS ---
                if (event.type === "response.created") {
                    // Gabi is starting to think/respond
                    if (status !== 'thinking') setStatus('active');
                }

                if (event.type === "response.done") {
                    setStatus('active');
                    setActiveTool(null);
                }

                // --- ERROR EVENTS ---
                if (event.type === "error") {
                    console.error("❌ [LiveGabi] Server Error:", event.error);
                    toast({
                        title: "Erro do servidor",
                        description: event.error?.message || "Erro desconhecido na sessão de voz.",
                        variant: "destructive"
                    });
                }

                // --- TOOL CALLING ---
                if (event.type === "response.function_call_arguments.done") {
                    const { call_id, name, arguments: argsJson } = event;
                    console.log(`🔧 [LiveGabi] Tool Call: ${name}`, argsJson);

                    let args: any;
                    try {
                        args = JSON.parse(argsJson);
                    } catch (parseErr) {
                        console.error("❌ [LiveGabi] Parse error:", parseErr);
                        sendClientEvent({
                            type: "conversation.item.create",
                            item: { type: "function_call_output", call_id, output: JSON.stringify({ error: "Argumentos inválidos." }) },
                        });
                        sendClientEvent({ type: "response.create" });
                        return;
                    }

                    if (SENSITIVE_TOOLS.includes(name)) {
                        console.log("⚠️ [LiveGabi] AÇÃO SENSÍVEL:", name, args);
                        setStagedTool({ id: call_id, name, args });
                        // Model should already be configured to ask for confirmation
                    } else {
                        // Safe tool — execute immediately
                        setActiveTool(name);
                        setStatus('thinking');

                        try {
                            const result = await callOpenAIFunction({ name, arguments: args });
                            const resultStr = JSON.stringify(result);

                            // Log first 800 chars for debugging
                            console.log(`✅ [LiveGabi] Result (${name}):`, resultStr.substring(0, 800));

                            sendClientEvent({
                                type: "conversation.item.create",
                                item: { type: "function_call_output", call_id, output: resultStr },
                            });
                            sendClientEvent({ type: "response.create" });
                        } catch (toolErr: any) {
                            console.error(`❌ [LiveGabi] Tool Error (${name}):`, toolErr);
                            const errorOutput = JSON.stringify({
                                error: true,
                                tool: name,
                                message: toolErr.message || 'Erro desconhecido ao executar ferramenta',
                            });
                            sendClientEvent({
                                type: "conversation.item.create",
                                item: { type: "function_call_output", call_id, output: errorOutput },
                            });
                            sendClientEvent({ type: "response.create" });
                        } finally {
                            setActiveTool(null);
                            // Status will be set to 'active' by response.done
                        }
                    }
                }
            };

            dc.onclose = () => {
                console.log("🔴 [LiveGabi] Data Channel fechado.");
                setStatus('disconnected');
            };

            // 6. WebRTC SDP Exchange
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    "Content-Type": "application/sdp",
                },
            });

            if (!sdpResponse.ok) {
                throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
            }

            await pc.setRemoteDescription({
                type: "answer",
                sdp: await sdpResponse.text(),
            });

            setStatus('active');
            console.log("✅ [LiveGabi] Sessão PREMIUM estabelecida com sucesso!");

        } catch (err: any) {
            console.error("❌ [LiveGabi] Erro fatal:", err);
            setStatus('error');
            toast({
                title: "Erro na Conexão de Voz",
                description: err.message || "Não foi possível iniciar. Verifique as permissões de microfone.",
                variant: "destructive"
            });
        }
    };

    useEffect(() => {
        startSession();
        return () => {
            console.log("🧹 [LiveGabi] Cleanup: fechando conexão...");
            pcRef.current?.close();
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const toggleMute = () => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        }
    };

    // --- STATUS LABEL ---
    const getStatusLabel = () => {
        if (stagedTool) return '🔒 Aguardando autorização...';
        switch (status) {
            case 'active': return '🟢 Gabi está ouvindo...';
            case 'thinking': return activeTool ? `🧠 Consultando ${activeTool.replace(/_/g, ' ')}...` : '🧠 Processando...';
            case 'connecting': return '🔄 Conectando...';
            case 'disconnected': return '🔴 Desconectada';
            case 'error': return '❌ Erro na Conexão';
            default: return 'Aguarde...';
        }
    };

    const getStatusSubtitle = () => {
        if (stagedTool) return `Confirme: ${stagedTool.name.replace(/_/g, ' ')}`;
        switch (status) {
            case 'active': return 'Fale naturalmente com a Gabi';
            case 'thinking': return 'Buscando dados reais do sistema...';
            case 'connecting': return 'Estabelecendo conexão segura...';
            default: return '';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-6 animate-in fade-in zoom-in duration-300">
            {/* Avatar */}
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
                    <Badge className="absolute -top-2 -right-2 bg-red-500 animate-pulse border-none text-[10px] font-black">
                        AO VIVO
                    </Badge>
                )}
                {status === 'thinking' && (
                    <Badge className="absolute -top-2 -right-2 bg-blue-500 animate-pulse border-none text-[10px] font-black">
                        CONSULTANDO
                    </Badge>
                )}
            </div>

            {/* Status text */}
            <div className="text-center space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">
                    {getStatusLabel()}
                </h3>
                <p className="text-sm text-zinc-400 font-medium">
                    {getStatusSubtitle()}
                </p>
            </div>

            {/* Staged tool confirmation */}
            {stagedTool && (
                <div className="w-full max-w-[300px] p-4 bg-red-500/10 border border-red-500/30 rounded-2xl animate-in zoom-in duration-300">
                    <div className="flex items-center gap-2 text-red-500 mb-3">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Confirmação Necessária</span>
                    </div>
                    <p className="text-sm text-zinc-300 mb-4">
                        Gabi precisa de autorização para: <strong className="text-white">{stagedTool.name.replace(/_/g, ' ')}</strong>
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 text-xs font-black uppercase h-9"
                            onClick={handleToolConfirm}
                        >
                            ✅ Autorizar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs font-black uppercase h-9 bg-white/5 border-white/10"
                            onClick={() => {
                                if (stagedTool) {
                                    sendClientEvent({
                                        type: "conversation.item.create",
                                        item: {
                                            type: "function_call_output",
                                            call_id: stagedTool.id,
                                            output: JSON.stringify({ cancelled: true, message: "Ação cancelada pelo usuário." }),
                                        },
                                    });
                                    sendClientEvent({ type: "response.create" });
                                }
                                setStagedTool(null);
                            }}
                        >
                            ❌ Cancelar
                        </Button>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-4">
                <Button
                    size="icon"
                    variant="outline"
                    className={cn(
                        "h-14 w-14 rounded-full border-white/10 transition-all",
                        isMuted ? "bg-red-500/20 text-red-500 border-red-500/50" : "bg-white/5 text-zinc-400 hover:text-white"
                    )}
                    onClick={toggleMute}
                >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </Button>

                <Button
                    size="icon"
                    variant="destructive"
                    className="h-14 w-14 rounded-full shadow-lg"
                    onClick={onClose}
                >
                    <XCircle className="w-6 h-6" />
                </Button>
            </div>

            {/* Audio visualizer */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                <Volume2 className="w-4 h-4 text-primary" />
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                        <div
                            key={i}
                            className={cn(
                                "w-1 rounded-full transition-all duration-300",
                                status === 'active' && "bg-primary/70 animate-pulse h-4",
                                status === 'thinking' && "bg-blue-400/70 animate-bounce h-3",
                                (status !== 'active' && status !== 'thinking') && "bg-zinc-600 h-2",
                            )}
                            style={{ animationDelay: `${i * 0.08}s` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
