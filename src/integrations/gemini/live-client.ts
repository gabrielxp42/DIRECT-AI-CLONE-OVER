import { getGeminiApiKey } from '@/integrations/gemini/client';
import { callOpenAIFunction } from '@/integrations/openai/aiTools';

/**
 * Converte as descrições de ferramentas do formato OpenAI para o formato Google Gemini.
 */
export const getGeminiTools = (openAIFunctions: any[]) => {
    return [
        {
            function_declarations: openAIFunctions.map(fn => ({
                name: fn.name,
                description: fn.description,
                parameters: fn.parameters
            }))
        }
    ];
};

/**
 * Configura o WebSocket para o Gemini 2.0 Flash Multimodal Live
 */
/**
 * Configura o WebSocket para o Gemini 2.0 Flash Multimodal Live
 */
export const createGeminiLiveConnection = async (onMessage: (ev: any) => void, setupPayload?: any) => {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) throw new Error("Gemini API Key não encontrada.");

    // Using gemini-2.0-flash-exp for Multimodal Live API (Low Latency)
    const MODEL = "gemini-2.0-flash-exp";
    const URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    const ws = new WebSocket(URL);

    ws.onopen = () => {
        console.log("🟢 [GeminiLive] WebSocket Aberto.");
        if (setupPayload) {
            console.log("📤 [GeminiLive] Enviando Setup Inicial...");
            ws.send(JSON.stringify(setupPayload));
        }
    };

    ws.onmessage = async (event) => {
        try {
            if (event.data instanceof Blob) {
                // Audio data received as Blob
                onMessage(event.data);
                return;
            }
            const data = JSON.parse(event.data);
            onMessage(data);
        } catch (err) {
            console.error("❌ [GeminiLive] Erro ao processar mensagem:", err);
        }
    };

    ws.onerror = (err) => {
        console.error("❌ [GeminiLive] Erro no WebSocket:", err);
    };

    ws.onclose = (event) => {
        console.log(`🔴 [GeminiLive] WebSocket Fechado. Código: ${event.code}, Razão: ${event.reason}`);
    };

    return ws;
};

/**
 * Handlers para eventos do Gemini Live API
 */
export const handleGeminiMessage = async (
    data: any,
    ws: WebSocket,
    callbacks: {
        onTranscript?: (text: string, role: 'user' | 'assistant') => void;
        onStatusChange?: (status: any) => void;
        onActiveToolChange?: (tool: string | null) => void;
        onSetupComplete?: () => void;
        onAudioData?: (audioBuffer: ArrayBuffer) => void;
    }
) => {
    // 0. Handle Binary Audio (Blob)
    if (data instanceof Blob) {
        const arrayBuffer = await data.arrayBuffer();
        callbacks.onAudioData?.(arrayBuffer);
        return;
    }

    // 1. Setup Complete
    if (data.setupComplete) {
        console.log("✅ [GeminiLive] Setup concluído.");
        callbacks.onSetupComplete?.();
        return;
    }

    // 2. Server Content (Transcripts and Audio)
    if (data.serverContent) {
        const { modelTurn, interleaving } = data.serverContent;

        if (modelTurn && modelTurn.parts) {
            for (const part of modelTurn.parts) {
                if (part.text) {
                    console.log(`🤖 [Gemini] ${part.text}`);
                    callbacks.onTranscript?.(part.text, 'assistant');
                }
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                    // Audio data received from model as base64
                    const binaryString = atob(part.inlineData.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    callbacks.onAudioData?.(bytes.buffer);
                }
            }
        }

        if (interleaving) {
            // Interleaving (interruption) handling if needed
        }
        return;
    }

    // 3. Tool Calls (Function Calls)
    if (data.toolCall) {
        const { functionCalls } = data.toolCall;
        if (functionCalls && functionCalls.length > 0) {
            const results = [];
            for (const call of functionCalls) {
                const { name, args, id } = call;
                console.log(`🔧 [GeminiLive] Tool Call: ${name}`, args);
                callbacks.onActiveToolChange?.(name);

                try {
                    const result = await callOpenAIFunction({ name, arguments: args });
                    results.push({
                        id,
                        name,
                        response: { result }
                    });
                } catch (err: any) {
                    console.error(`❌ [GeminiLive] Tool Error (${name}):`, err);
                    results.push({
                        id,
                        name,
                        response: { error: err.message || "Erro desconhecido" }
                    });
                }
            }

            // Send tool responses back
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    toolResponse: {
                        functionResponses: results
                    }
                }));
            }
            callbacks.onActiveToolChange?.(null);
        }
        return;
    }

    // 4. Error
    if (data.error) {
        console.error("❌ [GeminiLive] Erro do Servidor:", data.error);
    }
};
