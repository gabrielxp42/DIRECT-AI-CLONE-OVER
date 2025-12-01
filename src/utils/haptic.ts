/**
 * Utilitário para feedback háptico em dispositivos móveis
 * Proporciona uma experiência mais nativa ao app
 */

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Executa feedback háptico se disponível no dispositivo
 * @param type - Tipo de feedback háptico
 */
export const hapticFeedback = (type: HapticFeedbackType = 'light') => {
    // Verifica se a API de vibração está disponível
    if (!navigator.vibrate) {
        return;
    }

    // Padrões de vibração para cada tipo
    const patterns: Record<HapticFeedbackType, number | number[]> = {
        light: 10,
        medium: 20,
        heavy: 30,
        success: [10, 50, 10],
        warning: [20, 100, 20],
        error: [30, 100, 30, 100, 30],
    };

    try {
        navigator.vibrate(patterns[type]);
    } catch (error) {
        // Silenciosamente falha se não suportado
        console.debug('Haptic feedback not supported:', error);
    }
};

/**
 * Feedback háptico para ações de sucesso
 */
export const hapticSuccess = () => hapticFeedback('success');

/**
 * Feedback háptico para ações de erro
 */
export const hapticError = () => hapticFeedback('error');

/**
 * Feedback háptico para avisos
 */
export const hapticWarning = () => hapticFeedback('warning');

/**
 * Feedback háptico leve (para cliques/taps)
 */
export const hapticTap = () => hapticFeedback('light');

/**
 * Feedback háptico médio (para seleções)
 */
export const hapticSelect = () => hapticFeedback('medium');

/**
 * Feedback háptico pesado (para ações importantes)
 */
export const hapticImpact = () => hapticFeedback('heavy');
