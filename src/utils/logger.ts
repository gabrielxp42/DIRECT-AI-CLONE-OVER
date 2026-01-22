/**
 * Utilitário de log seguro que silencia mensagens em produção.
 * Evita vazamento de informações sensíveis no console do usuário final.
 */

const isDev = process.env.NODE_ENV === 'development' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

export const logger = {
    log: (...args: any[]) => {
        if (isDev) console.log(...args);
    },
    info: (...args: any[]) => {
        if (isDev) console.info(...args);
    },
    warn: (...args: any[]) => {
        if (isDev) console.warn(...args);
    },
    error: (...args: any[]) => {
        console.error(...args);
    },
    debug: (...args: any[]) => {
        if (isDev) console.debug(...args);
    },
    security: (message: string, data?: any) => {
        if (isDev) {
            console.group('🔐 Security Analysis');
            console.log(message, data);
            console.groupEnd();
        }
    }
};

// Funções utilitárias específicas esperadas por outros componentes
export const logAIError = (error: any, context: string) => {
    if (isDev) {
        console.error(`❌ [AI Error] Contexto: ${context}`, error);
    } else {
        // Em produção, logamos apenas o essencial para não quebrar o app
        console.error(`AI Error in ${context}`);
    }
};

export const logPaymentEvent = (event: string, data?: any) => {
    if (isDev) {
        console.info(`💳 [Payment Event] ${event}`, data);
    }
};
