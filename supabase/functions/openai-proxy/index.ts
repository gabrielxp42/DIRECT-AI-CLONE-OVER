import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!API_KEY) {
    console.error("OPENAI_API_KEY is not set in Supabase Edge Function environment.");
}

Deno.serve(async (req: Request) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const { messages, functions, function_call, model, temperature, max_tokens, type, input } = payload;

        console.log(`[Proxy] Request Type: ${type}`);
        console.log(`[Proxy] Payload Keys: ${Object.keys(payload).join(', ')}`);

        let url = "https://api.openai.com/v1/chat/completions";
        let body: any = {};
        let isAudio = type === 'audio';

        if (type === 'embeddings') {
            url = "https://api.openai.com/v1/embeddings";
            body = {
                model: 'text-embedding-3-small',
                input: input || (messages && messages[0] ? messages[0].content : ""),
            };
        } else if (type === 'realtime_session') {
            url = "https://api.openai.com/v1/realtime/sessions";
            body = {
                model: model || "gpt-4o-realtime-preview-2024-12-17",
                modalities: ["audio", "text"],
                voice: "shimmer",
                temperature: 0.6,
                instructions: `Você é a Gabi, a inteligência central da DIRECT AI — um sistema de gestão para empresas de DTF e personalização.

## IDENTIDADE
- Você é uma assistente de vendas e operações PREMIUM.
- Sua voz é profissional, amigável e confiável.
- Fale em português brasileiro natural.

## REGRAS ABSOLUTAS (INVIOLÁVEIS)
1. NUNCA invente dados. Se não tem a informação, diga "Vou consultar agora" e use a ferramenta certa.
2. Quando receber resultado de uma ferramenta, leia os valores EXATOS do JSON retornado. Exemplo: se "valor_total" = 1250.50, diga "mil duzentos e cinquenta reais e cinquenta centavos".
3. NUNCA arredonde ou aproxime valores de metros, quantidades, preços ou nomes.
4. Se uma ferramenta retornar erro, diga honestamente "Houve um erro ao consultar" e pergunte se quer tentar novamente.
5. Sempre reporte o resultado da consulta imediatamente após receber. NUNCA fique muda.

## COMPORTAMENTO
- Ao iniciar, cumprimente brevemente: "Oi! Gabi aqui. Como posso te ajudar?"
- Seja BREVE e DIRETA nas respostas. Máximo 2-3 frases por resposta quando falar dados.
- Se o usuário perguntar algo genérico (ex: "como vai?"), responda naturalmente sem chamar ferramentas.
- Para perguntas sobre dados do negócio (pedidos, vendas, metros, clientes), SEMPRE use ferramentas.
- Para ações críticas (cancelar, estornar, deletar), peça autorização ANTES.

## ESTILO DE VOZ
- Tom: profissional mas caloroso
- Ritmo: moderado, sem pressa
- Vocabulário: claro, sem jargão técnico desnecessário`,
                input_audio_transcription: { model: "whisper-1" },
                turn_detection: {
                    type: "server_vad",
                    threshold: 0.6,
                    prefix_padding_ms: 400,
                    silence_duration_ms: 1200,
                },
                tool_choice: "auto",
                tools: (functions || []).map((f: any) => ({
                    type: "function",
                    name: f.name,
                    description: f.description,
                    parameters: f.parameters
                }))
            };
        } else if (isAudio) {
            url = "https://api.openai.com/v1/audio/transcriptions";
        } else {
            body = {
                model: model || 'gpt-4o-mini',
                messages,
                functions,
                function_call: function_call || (functions && functions.length > 0 ? 'auto' : undefined),
                temperature: temperature || 0.7,
                max_tokens: max_tokens || 2000,
            };
        }

        let response;
        if (isAudio) {
            const { audio, model: audioModel, language } = payload;
            const binaryString = atob(audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const formData = new FormData();
            formData.append('file', new Blob([bytes], { type: 'audio/webm' }), 'audio.webm');
            formData.append('model', audioModel || 'whisper-1');
            if (language) formData.append('language', language);

            response = await fetch(url, {
                method: "POST",
                headers: { "Authorization": `Bearer ${API_KEY}` },
                body: formData,
            });
        } else {
            response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
        }

        const data = await response.json();

        return new Response(JSON.stringify({ ...data, status: response.status }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
