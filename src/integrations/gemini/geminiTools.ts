import { openAIFunctions } from '@/integrations/openai/aiTools';

/**
 * Converte a definição de ferramenta da OpenAI para o formato do Gemini.
 * A principal diferença é que o Gemini espera a estrutura dentro de 'function_declarations'.
 */
export const getGeminiTools = () => {
    return openAIFunctions.map(fn => {
        // OpenAI format: { name, description, parameters: { type, properties, required } }
        // Gemini format: { name, description, parameters: { type, properties, required } }
        // Eles são quase idênticos, mas o Gemini costuma ser mais rigoroso com o esquema JSON.

        return {
            name: fn.name,
            description: fn.description,
            parameters: {
                type: fn.parameters.type,
                properties: fn.parameters.properties,
                required: fn.parameters.required || []
            }
        };
    });
};
