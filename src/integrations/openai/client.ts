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
  private proxyURL = `${SUPABASE_URL}/functions/v1/openai-proxy`;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendMessage(messages: ChatMessage[], functions?: any[]): Promise<{
    content?: string;
    function_call?: FunctionCall;
  }> {
    const token = await getValidToken();

    // Tentativa via Proxy (Supabase Edge Function) para evitar CORS
    try {
      console.log('🌐 [OpenAIClient] Enviando via Proxy (Supabase Edge Function)...');
      const response = await fetch(this.proxyURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
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
          throw new Error(`Proxy Error: ${data.error}`);
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

        return {
          content: choice.message.content,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [OpenAIClient] Erro no Proxy:', response.status, errorData);
      }

      console.warn(`⚠️ [OpenAIClient] Falha no Proxy (${response.status}), tentando fallback direto...`);
    } catch (proxyError) {
      console.warn('⚠️ [OpenAIClient] Erro no Proxy, tentando fallback direto:', proxyError);
    }

    // Fallback Direto (pode falhar por CORS em produção)
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    if (choice.message.function_call) {
      return {
        function_call: {
          name: choice.message.function_call.name,
          arguments: JSON.parse(choice.message.function_call.arguments),
        },
      };
    }

    return {
      content: choice.message.content,
    };
  }

  async transcribeAudio(audioBlob: Blob): Promise<string | null> {
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Whisper API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.text || null;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = text.replace(/\n/g, ' ');
    const token = await getValidToken();

    // Tentativa via Proxy
    try {
      const response = await fetch(this.proxyURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
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
      console.warn('⚠️ [OpenAIClient] Erro no Proxy Embeddings, tentando fallback direto...', e);
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