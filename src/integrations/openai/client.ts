"use client";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';

// OpenAI Client Configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("VITE_OPENAI_API_KEY is not set in environment variables.");
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  audioUrl?: string; // Nova propriedade para mensagens de áudio
}

export interface FunctionCall {
  name: string;
  arguments: any;
}

export class OpenAIClient {
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';
  private proxyURL = `${SUPABASE_URL}/functions/v1/openai-proxy`.replace(/([^:]\/)\/+/g, "$1");

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.log('🤖 [OpenAIClient] Inicializado. Proxy URL:', this.proxyURL);
    console.log('📦 [OpenAIClient] Versão do Bundle: ' + new Date().toISOString());
  }

  async sendMessage(messages: ChatMessage[], functions?: any[]): Promise<{
    content?: string;
    function_call?: FunctionCall;
  }> {
    const token = await getValidToken();

    console.log('🌐 [OpenAIClient] Tentando requisição via Proxy Supabase...');
    console.log('🔑 [OpenAIClient] Token Supabase presente:', !!token);

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

      console.log('📡 [OpenAIClient] Resposta do Proxy recebida. Status:', response.status);

      if (response.ok) {
        const data = await response.json();

        if (data.error) {
          console.error('❌ [OpenAIClient] Erro interno retornado pelo Proxy:', data.error);
          throw new Error(`Proxy Internal Error: ${JSON.stringify(data.error)}`);
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
        console.error('❌ [OpenAIClient] Erro HTTP no Proxy:', response.status, errorData);
        throw new Error(`Proxy Fallback - Status ${response.status}`);
      }
    } catch (proxyError) {
      console.error('🚨 [OpenAIClient] FALHA CRÍTICA NO PROXY:', proxyError);
      console.warn('⚠️ [OpenAIClient] Tentando fallback direto mesmo sabendo do risco de CORS...');

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          functions: functions,
          function_call: functions && functions.length > 0 ? 'auto' : undefined,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Fallback Error: ${response.status}`);
      }

      const data = await response.json();
      return { content: data.choices[0].message.content };
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<string | null> {
    const token = await getValidToken();
    console.log('🎙️ [OpenAIClient] Transcrevendo áudio via Proxy...');

    try {
      // Converter Blob para Base64 para passar pelo JSON do Proxy
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
        const errorText = await response.text();
        console.error('❌ [OpenAIClient] Erro no Proxy Audio:', response.status, errorText);
        throw new Error(`Proxy Audio error: ${response.status}`);
      }
    } catch (error) {
      console.error('🚨 [OpenAIClient] Erro na transcrição via Proxy:', error);

      // Fallback direto apenas se o proxy falhar e as chaves permitirem (risco de CORS)
      console.warn('⚠️ [OpenAIClient] Tentando fallback direto para Whisper...');
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');

      const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper direct fallback failed: ${response.status}`);
      }

      const data = await response.json();
      return data.text || null;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = text.replace(/\n/g, ' ');
    const token = await getValidToken();

    try {
      console.log('🌐 [OpenAIClient] Gerando Embedding via Proxy...');
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
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [OpenAIClient] Erro no Proxy Embeddings:', response.status, errorData);
      }
    } catch (e) {
      console.warn('⚠️ [OpenAIClient] Falha no Proxy Embeddings, tentando fallback direto...', e);
    }

    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: cleanText,
        dimensions: 1536
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Embeddings API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}

export const getOpenAIClient = () => {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }
  return new OpenAIClient(OPENAI_API_KEY);
};