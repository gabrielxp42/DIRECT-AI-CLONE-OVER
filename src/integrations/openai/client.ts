import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { logger } from '@/utils/logger';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  audioUrl?: string;
}

export interface FunctionCall {
  name: string;
  arguments: any;
}

export class OpenAIClient {
  private proxyURL = `${SUPABASE_URL}/functions/v1/openai-proxy`.replace(/([^:]\/)\/+/g, "$1");

  constructor() {
    logger.security('[OpenAIClient] Inicializado com foco exclusivo em Proxy para segurança máxima.');
  }

  async sendMessage(messages: ChatMessage[], functions?: any[]): Promise<{
    content?: string;
    function_call?: FunctionCall;
  }> {
    const token = await getValidToken();

    try {
      const response = await fetch(this.proxyURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          type: 'chat',
          model: 'gpt-4o-mini',
          messages: messages,
          functions: functions,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.error) {
          logger.error('[OpenAIClient] Erro interno retornado pelo Proxy:', data.error);
          throw new Error("Erro de processamento na IA.");
        }

        const choice = data.choices[0];
        if (choice.message.function_call) {
          return {
            function_call: {
              name: choice.message.function_call.name,
              arguments: JSON.parse(choice.message.function_call.arguments),
            },
          };
        }

        return { content: choice.message.content };
      } else {
        const errorData = await response.json().catch(() => ({}));
        logger.error('[OpenAIClient] Erro de rede ou autorização:', response.status);
        throw new Error("Serviço de IA temporariamente indisponível.");
      }
    } catch (proxyError) {
      logger.error('🚨 [OpenAIClient] FALHA NA COMUNICAÇÃO COM PROXY:', proxyError);
      throw new Error("Não foi possível conectar ao serviço de inteligência. Verifique sua conexão.");
    }
  }

  async getRealtimeSession(functions?: any[]): Promise<{ client_secret: { value: string } }> {
    const token = await getValidToken();

    try {
      const response = await fetch(this.proxyURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          type: 'realtime_session',
          functions: functions,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.client_secret) {
          return data;
        }
        throw new Error("Sessão Realtime não retornou segredo.");
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Erro ${response.status}`;
        throw new Error(`Erro ao buscar sessão: ${errorMessage}`);
      }
    } catch (error) {
      logger.error('🚨 [OpenAIClient] Erro ao obter sessão Realtime:', error);
      throw error;
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<string | null> {
    const token = await getValidToken();

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      const response = await fetch(this.proxyURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          type: 'audio',
          audio: base64Audio,
          model: 'whisper-1',
          language: 'pt'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.text || null;
      } else {
        logger.error('[OpenAIClient] Erro na transcrição via Proxy');
        return null;
      }
    } catch (error) {
      logger.error('🚨 [OpenAIClient] Erro na transcrição:', error);
      return null;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = text.replace(/\n/g, ' ');
    const token = await getValidToken();

    try {
      const response = await fetch(this.proxyURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          type: 'embeddings',
          input: cleanText,
          model: 'text-embedding-3-small',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data[0]) {
          return data.data[0].embedding;
        }
      }
    } catch (e) {
      logger.error('⚠️ [OpenAIClient] Falha ao gerar embeddings:', e);
    }

    throw new Error("Falha ao processar conhecimento da IA.");
  }
}

export const getOpenAIClient = () => {
  return new OpenAIClient();
};
