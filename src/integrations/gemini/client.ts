import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("VITE_GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

export const getGenerativeModel = () => {
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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