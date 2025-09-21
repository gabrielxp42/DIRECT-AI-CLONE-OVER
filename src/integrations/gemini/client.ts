import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("VITE_GEMINI_API_KEY is not set in environment variables.");
  // You might want to throw an error or handle this more gracefully in a production app
}

const genAI = new GoogleGenerativeAI(apiKey);

export const getGenerativeModel = () => {
  // Alterado de 'gemini-1.5-pro' para 'gemini-1.5-flash' para melhor performance e velocidade
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};