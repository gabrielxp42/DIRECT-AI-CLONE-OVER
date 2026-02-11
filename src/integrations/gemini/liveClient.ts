import { float32ToInt16, arrayBufferToBase64, base64ToArrayBuffer, int16ToFloat32 } from '@/utils/audioUtils';

export type MultimodalLiveEvent = {
    type: string;
    [key: string]: any;
};

export interface GeminiLiveConfig {
    apiKey: string;
    model?: string;
    systemInstruction?: string;
    tools?: any[];
    onOpen?: () => void;
    onClose?: (event: CloseEvent) => void;
    onMessage?: (event: MultimodalLiveEvent) => void;
    onError?: (error: Event) => void;
}

const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export class GeminiLiveClient {
    private ws: WebSocket | null = null;
    private config: GeminiLiveConfig;
    private url: string;

    constructor(config: GeminiLiveConfig) {
        this.config = config;
        const model = config.model || DEFAULT_MODEL;
        this.url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${config.apiKey}`;
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('🟢 [GeminiLive] WebSocket conectado.');
            this.sendSetup();
            this.config.onOpen?.();
        };

        this.ws.onmessage = async (event) => {
            try {
                let rawText: string;
                if (event.data instanceof Blob) {
                    rawText = await event.data.text();
                } else {
                    rawText = event.data;
                }
                const data = JSON.parse(rawText);
                this.config.onMessage?.(data);
            } catch (err) {
                console.error('❌ [GeminiLive] Erro ao processar mensagem:', err);
            }
        };

        this.ws.onclose = (event) => {
            console.log('🔴 [GeminiLive] WebSocket fechado:', event.reason);
            this.config.onClose?.(event);
        };

        this.ws.onerror = (error) => {
            console.error('⚠️ [GeminiLive] Erro no WebSocket:', error);
            this.config.onError?.(error);
        };
    }

    private sendSetup() {
        const setupMessage = {
            setup: {
                model: `models/${this.config.model || DEFAULT_MODEL}`,
                generation_config: {
                    response_modalities: ["AUDIO"],
                },
                system_instruction: {
                    parts: [{ text: this.config.systemInstruction || "" }]
                },
                tools: this.config.tools ? [{ function_declarations: this.config.tools }] : []
            }
        };
        this.send(setupMessage);
    }

    sendAudio(float32Buffer: Float32Array) {
        const int16Buffer = float32ToInt16(float32Buffer);
        const base64Data = arrayBufferToBase64(int16Buffer.buffer as ArrayBuffer);

        this.send({
            realtime_input: {
                media_chunks: [
                    {
                        data: base64Data,
                        mime_type: "audio/pcm;rate=16000"
                    }
                ]
            }
        });
    }

    sendToolResponse(callId: string, output: any) {
        this.send({
            tool_response: {
                function_responses: [
                    {
                        id: callId,
                        response: { output }
                    }
                ]
            }
        });
    }

    send(payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        } else {
            console.warn('⚠️ [GeminiLive] WebSocket não está aberto.');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
