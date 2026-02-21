import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/integrations/supabase/client';

/**
 * Obtém a chave do Gemini do perfil do usuário ou do ambiente VITE
 */
export const getGeminiApiKey = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', user.id)
        .single();

      if (!error && data?.gemini_api_key) {
        return data.gemini_api_key;
      }
    }
  } catch (err) {
    console.warn("⚠️ [GeminiClient] Erro ao buscar chave no perfil, tentando VITE_GEMINI_API_KEY:", err);
  }

  return import.meta.env.VITE_GEMINI_API_KEY;
};

/**
 * Inicializa o cliente Gemini de forma assíncrona
 */
export const getGeminiClient = async () => {
  const key = await getGeminiApiKey();
  if (!key) {
    throw new Error("Gemini API Key não encontrada no perfil nem no ambiente.");
  }
  return new GoogleGenerativeAI(key);
};

export const getGenerativeModel = async (modelName = "gemini-2.0-flash") => {
  try {
    const genAI = await getGeminiClient();
    return genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });
  } catch (error) {
    console.error("❌ [GeminiClient] Erro ao carregar modelo:", error);
    throw error;
  }
};

export const getCurrentDateTime = () => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };

  return {
    fullDate: now.toLocaleDateString('pt-BR', options),
    dayOfWeek: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }),
    date: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    time: now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
    timestamp: now.toISOString()
  };
};