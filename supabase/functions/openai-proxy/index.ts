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

        let url = "https://api.openai.com/v1/chat/completions";
        let body: any = {};
        let isAudio = type === 'audio';

        if (type === 'embeddings') {
            url = "https://api.openai.com/v1/embeddings";
            body = {
                model: 'text-embedding-3-small',
                input: input || (messages && messages[0] ? messages[0].content : ""),
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
