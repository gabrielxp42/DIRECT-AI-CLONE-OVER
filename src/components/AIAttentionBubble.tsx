import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

const MESSAGES = [
    "Ei! Tenho insights pra você! 👀",
    "Clica aqui, descobri algo importante! 💡",
    "Tem cliente precisando de atenção... 👋",
    "Psiu! Vamos vender mais hoje? 🚀",
    "Separei umas dicas de ouro! ✨",
    "Opa! Tem novidade na área! 📣",
    "Vem ver o que eu achei! 🧐",
    "Não me deixa falando sozinha! 😂",
    "Análise fresquinha pra você! 📊",
    "Bora bater a meta hoje? 💪"
];

export const AIAttentionBubble = () => {
    const [message, setMessage] = useState("");
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Escolher uma mensagem aleatória ao montar
        const randomMessage = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        setMessage(randomMessage);

        // Pequeno delay para aparecer com animação
        const timer = setTimeout(() => setIsVisible(true), 1000);

        return () => clearTimeout(timer);
    }, []);

    if (!message) return null;

    return (
        <div
            className={`
        absolute -top-12 right-4 z-20 transform transition-all duration-500 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
        >
            <div className="relative">
                {/* Balão */}
                <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-2 rounded-2xl rounded-br-none shadow-lg border border-slate-100 dark:border-slate-700 flex items-center gap-2 animate-bounce-slow">
                    <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-medium whitespace-nowrap">{message}</span>
                </div>

                {/* Ponta do balão (Triângulo) */}
                <div className="absolute -bottom-2 right-0 w-4 h-4 bg-white dark:bg-slate-800 border-r border-b border-slate-100 dark:border-slate-700 transform rotate-45"></div>
            </div>
        </div>
    );
};
