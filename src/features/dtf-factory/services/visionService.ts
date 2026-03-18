
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

export async function analyzeInpaintingRequest(
    imageWithMaskBase64: string, // Imagem original com o desenho vermelho por cima
    userPrompt: string
): Promise<string> {
    if (!OPENROUTER_API_KEY) {
        console.warn('OpenRouter API Key not found. Returning original prompt.');
        return userPrompt;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://overpixel.online',
                'X-Title': 'DTF Factory Pro Vision',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-lite-preview-02-05:free', // Modelo Vision Rápido e Gratuito (se disponível) ou barato
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert Stable Diffusion Prompt Engineer. 
                        Your task is to analyze an image that has a RED MARKER (mask) drawn over a specific area.
                        The user wants to edit ONLY that area based on their request.
                        
                        1. Identify what is currently in the red marked area.
                        2. Understand the user's request: "${userPrompt}".
                        3. Write a precise, high-quality prompt to generate the NEW content for that area.
                        4. Ensure the style matches the rest of the image (lighting, art style, perspective).
                        5. The prompt must be in ENGLISH.
                        
                        OUTPUT FORMAT: Return ONLY the raw prompt text. No explanations.`
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: `User request: ${userPrompt}` },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageWithMaskBase64
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            throw new Error(`Vision API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const newPrompt = data.choices?.[0]?.message?.content?.trim();

        if (newPrompt) {
            console.log('[Vision] Original Prompt:', userPrompt);
            console.log('[Vision] Enhanced Prompt:', newPrompt);
            return newPrompt;
        }

        return userPrompt;

    } catch (error) {
        console.error('[Vision] Analysis failed:', error);
        return userPrompt; // Fallback
    }
}
