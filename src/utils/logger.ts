
import { supabase } from "@/integrations/supabase/client";

type LogLevel = 'error' | 'warning' | 'info';
type LogCategory = 'ai' | 'auth' | 'payment' | 'system' | 'marketing';

interface LogEntry {
    level: LogLevel;
    category: LogCategory;
    message: string;
    details?: any;
    user_id?: string;
}

export const logEvent = async (entry: LogEntry) => {
    try {
        const { error } = await supabase
            .from('system_logs')
            .insert([{
                level: entry.level,
                category: entry.category,
                message: entry.message,
                details: entry.details || {},
                user_id: entry.user_id,
                resolved: false
            }]);

        if (error) {
            console.error('❌ [Logger] Falha ao persistir log no DB:', error);
        }
    } catch (err) {
        console.error('❌ [Logger] Erro crítico no logger:', err);
    }
};

/**
 * Atalho para registrar erros de IA
 */
export const logAIError = (message: string, errorDetails: any, userId?: string) => {
    console.error(`🤖 [AI Error] ${message}`, errorDetails);
    return logEvent({
        level: 'error',
        category: 'ai',
        message,
        details: {
            error: errorDetails?.message || errorDetails,
            stack: errorDetails?.stack,
            timestamp: new Date().toISOString()
        },
        user_id: userId
    });
};

/**
 * Atalho para registrar eventos de pagamento
 */
export const logPaymentEvent = (message: string, details: any, userId?: string) => {
    return logEvent({
        level: 'info',
        category: 'payment',
        message,
        details,
        user_id: userId
    });
};
