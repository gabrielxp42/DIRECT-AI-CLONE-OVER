import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Response logic using Gemini with Knowledge Base
Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { user_id, message, customer_phone, customer_name, previous_history } = await req.json();

        if (!user_id || !message) {
            throw new Error("Missing required fields: user_id, message");
        }

        // Initialize Supabase Admin
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get User Config & Keys
        const { data: profile } = await supabase
            .from('profiles')
            .select('gemini_api_key, gemini_response_model, ai_auto_reply_enabled, company_name')
            .eq('id', user_id)
            .single();

        // 2. Fallback to Admin Key if user key not set (for managed services)
        // OR enforce system admin key if this is a "platform feature"
        let GEMINI_KEY = profile?.gemini_api_key;
        if (!GEMINI_KEY) {
            const { data: adminProfile } = await supabase
                .from('profiles')
                .select('gemini_api_key')
                .eq('is_admin', true)
                .single();
            GEMINI_KEY = adminProfile?.gemini_api_key;
        }

        if (!GEMINI_KEY) throw new Error("API Key configuration missing");

        const MODEL = profile?.gemini_response_model || 'gemini-2.5-flash';

        // 3. RETRIEVE KNOWLEDGE
        // Since we don't have pgvector set up yet, we will fetch ACTIVE rules and tone.
        // We fetch: Tone, Business Rules, and FAQ.
        const { data: knowledge } = await supabase
            .from('ai_knowledge_base')
            .select('knowledge_type, content, confidence')
            .eq('user_id', user_id)
            .eq('is_active', true)
            .gt('confidence', 0.7); // Only high confidence knowledge

        const tone = knowledge?.find(k => k.knowledge_type === 'tone')?.content;
        const businessRules = knowledge?.filter(k => k.knowledge_type === 'business_rule').map(k => k.content);
        const products = knowledge?.filter(k => k.knowledge_type === 'product').map(k => k.content);

        // 4. CONSTRUCT PROMPT
        const prompt = `
        ATUE COMO UM ASSISTENTE VIRTUAL DA EMPRESA "${profile?.company_name || 'Loja'}".
        SEU OBJETIVO: Responder ao cliente de forma natural, útil e seguindo estritamente as regras da empresa.

        CONTEXTO DO CLIENTE:
        - Nome: ${customer_name || 'Cliente'}
        - Mensagem Atual: "${message}"
        - Histórico recente: ${previous_history || 'Nenhum'}

        CONHECIMENTO APRENDIDO (USE PARA GUIAR SUA RESPOSTA):
        
        1. TOM DE VOZ (IMITE ESTE ESTILO):
        ${JSON.stringify(tone || { style: "Profissional", greeting: "Olá!" }, null, 2)}

        2. REGRAS DE NEGÓCIO DA EMPRESA (IGNORE O QUE NÃO SE APLICA):
        ${JSON.stringify(businessRules || [], null, 2)}

        3. PRODUTOS/SERVIÇOS CONHECIDOS:
        ${JSON.stringify(products || [], null, 2)}

        DIRETRIZES DE RESPOSTA:
        - SEJA DIRETO: Responda exatamente o que foi perguntado.
        - SE NÃO SOUBER: Diga educadamente que vai verificar com um humano. NÃO INVENTE DADOS.
        - SEGURANÇA: Não prometa descontos ou prazos que não estejam nas regras.
        - TEXTO: Use o "TOM" fornecido. Se o tom usa emojis, use. Se é formal, seja formal.

        GERE APENAS O TEXTO DA RESPOSTA FINAL PARA O WHATSAPP.
        `;

        // 5. CALL GEMINI
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API Error: ${err}`);
        }

        const genData = await response.json();
        const responseText = genData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) throw new Error("Empty response from AI");

        // 6. SEND RESPONSE VIA EVOLUTION API
        // Fetch Admin Config for Evolution API
        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('whatsapp_api_url, whatsapp_api_key')
            .eq('is_admin', true)
            .single();

        if (!adminProfile?.whatsapp_api_url || !adminProfile?.whatsapp_api_key) {
            throw new Error("Evolution API not configured in Admin");
        }

        const EVOLUTION_URL = adminProfile.whatsapp_api_url.replace(/\/$/, "");
        const EVOLUTION_KEY = adminProfile.whatsapp_api_key;
        const INSTANCE = profile.whatsapp_instance_id;

        if (!INSTANCE) throw new Error("User instance not found");

        console.log(`[Responder] Sending reply to ${customer_phone} via ${INSTANCE}`);

        // Send Text
        await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_KEY
            },
            body: JSON.stringify({
                number: customer_phone,
                text: responseText,
                linkPreview: false
            })
        });

        // 7. LOG ACTION
        await supabase.from('whatsapp_messages').insert({
            user_id: user_id,
            phone: customer_phone,
            message: responseText,
            direction: 'sent',
            status: 'sent',
            analyzed: true, // Generated by AI, so already "analyzed"
            analysis_result: { source: 'ai_auto_reply', model: MODEL }
        });

        return new Response(JSON.stringify({ response: responseText, status: 'sent' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("[Responder] Error:", error.message);
        return new Response(JSON.stringify({ error: true, message: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
