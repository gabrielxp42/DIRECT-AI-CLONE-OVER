import React, { useEffect, useRef, useState, useCallback } from 'react';
import { openAIFunctions } from '@/integrations/openai/aiTools';
import { createGeminiLiveConnection, getGeminiTools, handleGeminiMessage } from '@/integrations/gemini/live-client';
import { getCurrentDateTime } from '@/integrations/gemini/client';
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

const GABI_INSTRUCTIONS = `Você é a Gabi, a inteligência central da DIRECT AI — um sistema de gestão para empresas de DTF e personalização.

## IDENTIDADE
- Você é uma assistente de vendas e operações PREMIUM.
- Sua voz é profissional, amigável e confiável.
- Fale em português brasileiro natural.

## REGRAS ABSOLUTAS (INVIOLÁVEIS)
1. NUNCA invente dados. Se não tem a informação, diga "Vou consultar agora" e use a ferramenta certa.
2. Quando receber resultado de uma ferramenta, leia os valores EXATOS do JSON retornado.
3. NUNCA arredonde ou aproxime valores de metros, quantidades, preços ou nomes.
4. MEMÓRIA DA GABI: Ao consultar detalhes de um cliente (get_client_details), você terá acesso ao campo "observacoes". Este campo é a sua "Memória de Longo Prazo" sobre esse cliente. Use essa informação para personalizar o atendimento. Se o usuário disser algo importante sobre o cliente (ex: "ele prefere entrega por motoboy"), você DEVE usar a ferramenta 'update_client_details' para salvar isso na memória dele.
5. SÓ chame ferramentas que o usuário PEDIU. NUNCA faça chamadas extras por conta própria.

## COMPORTAMENTO
- Ao iniciar, cumprimente brevemente: "Oi! Gabi aqui. Como posso te ajudar?"
- Seja BREVE e DIRETA nas respostas. Máximo 2-3 frases por resposta quando falar dados.
- WHATSAPP PROATIVO: Toda vez que você atualizar o status de um pedido (update_order_status), você DEVE sugerir enviar a atualização para o cliente. Antes de sugerir, verifique se o cliente tem um telefone válido (get_client_details). Se NÃO tiver, peça o número de forma gentil antes de oferecer o envio.
- CONSULTORA DE FRETE (NOVO): Ao criar um pedido (create_order), se o cliente tiver um CEP cadastrado, você DEVE oferecer para calcular o frete usando 'calculate_shipping' e sugerir a melhor opção (PAC vs SEDEX).
- APRENDIZADO CONTÍNUO (NOVO): Se durante um pedido o usuário der uma instrução que parece permanente (ex: "ele só recebe à tarde", "sempre quer refile"), após concluir a tarefa principal, pergunte: "Quer que eu salve essa preferência na memória permanente do cliente?" e use 'update_client_details' se ele confirmar.

## ESTILO DE VOZ
- Tom: profissional mas caloroso, como uma gerente dedicada.
- Ritmo: moderado, sem pressa.
- Vocabulário: claro, focado no sucesso da gráfica.`;

export const LiveGabi: React.FC<LiveGabiProps> = ({ onClose, onTranscript }) => {
    const [status, setStatus] = useState<ConnectionStatus>('connecting');
    const [isMuted, setIsMuted] = useState(false);
    const [activeTool, setActiveTool] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlayingRef = useRef(false);

    const { toast } = useToast();

    // Audio Playback
    const playNextAudio = useCallback(async () => {
        if (!audioQueueRef.current.length || !audioContextRef.current) {
            isPlayingRef.current = false;
            return;
        }

        if (isPlayingRef.current) return;
        isPlayingRef.current = true;

        const audioData = audioQueueRef.current.shift()!;

        try {
            // Convert PCM16 (Int16) to Float32
            const int16Data = new Int16Array(audioData);
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }

            // Create AudioBuffer (Mono, 24kHz matches Gemini output)
            const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
            audioBuffer.copyToChannel(float32Data, 0);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => {
                isPlayingRef.current = false;
                playNextAudio();
            };
            source.start();
        } catch (err) {
            console.error("❌ [LiveGabi] Erro no playback de áudio:", err);
            isPlayingRef.current = false;
            playNextAudio();
        }
    }, []);

    const handleAudioData = useCallback((audioBuffer: ArrayBuffer) => {
        audioQueueRef.current.push(audioBuffer);
        playNextAudio();
    }, [playNextAudio]);

    const startSession = async () => {
        try {
            setStatus('connecting');

            // 1. Initialize Audio Context for input/output
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            // 2. Prepare Setup Payload
            const VOICE_ESSENTIAL_TOOLS = [
                "get_current_date",
                "get_top_clients",
                "create_order",
                "get_total_meters_by_period",
                "get_client_orders",
                "get_order_details",
                "update_order_status",
                "send_whatsapp_message",
                "query_database",
                "list_orders",
                "get_client_details",
                "update_client_details",
                "calculate_dtf_packing"
            ];
            const filteredTools = openAIFunctions.filter(tool => VOICE_ESSENTIAL_TOOLS.includes(tool.name));

            const setupPayload = {
                setup: {
                    model: "models/gemini-2.0-flash-exp",
                    generation_config: {
                        response_modalities: ["AUDIO"]
                    },
                    tools: getGeminiTools(filteredTools),
                    system_instruction: {
                        role: "system",
                        parts: [{ text: GABI_INSTRUCTIONS }]
                    }
                }
            };

            // 3. Setup Gemini WebSocket with Initial Payload
            const ws = await createGeminiLiveConnection((data) => {
                handleGeminiMessage(data, ws, {
                    onTranscript: (text, role) => {
                        onTranscript?.(text, role);
                        if (role === 'assistant') setStatus('active');
                    },
                    onActiveToolChange: (tool) => {
                        setActiveTool(tool);
                        if (tool) setStatus('thinking');
                        else setStatus('active');
                    },
                    onAudioData: handleAudioData,
                    onSetupComplete: () => {
                        setStatus('active');
                        console.log("✅ [LiveGabi] Sessão Pronta e Ativa.");
                    }
                });
            }, setupPayload);
            wsRef.current = ws;

            // 3. Capture User Microphone and stream to Gemini
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const source = audioContextRef.current.createMediaStreamSource(stream);
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN && !isMuted) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    // Convert Float32 to Int16
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    // Efficient Base64 encoding for the chunk
                    let binary = '';
                    const bytes = new Uint8Array(pcmData.buffer);
                    const len = bytes.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64Audio = btoa(binary);

                    ws.send(JSON.stringify({
                        realtime_input: {
                            media_chunks: [{
                                mime_type: "audio/pcm",
                                data: base64Audio
                            }]
                        }
                    }));
                }
            };

            source.connect(processor);
            processor.connect(audioContextRef.current.destination);

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
            wsRef.current?.close();
            processorRef.current?.disconnect();
            streamRef.current?.getTracks().forEach(t => t.stop());
            audioContextRef.current?.close();
        };
    }, []);

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    // --- STATUS LABEL ---
    const getStatusLabel = () => {
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
        switch (status) {
            case 'active': return 'Fale naturalmente com a Gabi';
            case 'thinking': return 'Buscando dados reais do sistema...';
            case 'connecting': return 'Estabelecendo conexão segura com Gemini...';
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
                        AO VIVO (GEMINI)
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
