import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Initialize Supabase Admin Client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        console.log("[Processor] Starting AI Training Cycle...");

        // 1. Get Global Gemini Config
        const { data: adminProfile, error: adminError } = await supabase
            .from('profiles')
            .select('gemini_api_key, gemini_training_model')
            .eq('is_admin', true)
            .limit(1)
            .single();

        if (adminError || !adminProfile?.gemini_api_key) {
            throw new Error("Sistema não configurado (Falta Gemini API Key)");
        }

        const GEMINI_KEY = adminProfile.gemini_api_key;
        const MODEL = adminProfile.gemini_training_model || 'gemini-2.0-flash-exp';

        // 2. Determine users to process
        const body = await req.json().catch(() => ({}));
        const forceUserId = body.force_user_id;

        let usersToTrain = [];

        if (forceUserId) {
            console.log(`[Processor] Forced analysis for user ${forceUserId}`);
            // Check if training record exists, if not create it
            const { data: existing } = await supabase
                .from('ai_agent_training')
                .select('user_id, conversations_analyzed')
                .eq('user_id', forceUserId)
                .maybeSingle();

            if (!existing) {
                console.log(`[Processor] Creating initial training record for user ${forceUserId}`);
                await supabase.from('ai_agent_training').insert({
                    user_id: forceUserId,
                    training_status: 'learning',
                    confidence_score: 0,
                    conversations_analyzed: 0,
                    patterns_identified: 0
                });
                usersToTrain = [{ user_id: forceUserId, conversations_analyzed: 0 }];
            } else {
                usersToTrain = [existing];
            }
        } else {
            // Find Users in 'learning' state
            const { data: learningUsers, error: usersError } = await supabase
                .from('ai_agent_training')
                .select('user_id, conversations_analyzed')
                .eq('training_status', 'learning')
                .limit(5);

            if (usersError) throw usersError;
            usersToTrain = learningUsers || [];
        }

        if (usersToTrain.length === 0) {
            console.log("[Processor] No users to train.");
            return new Response(JSON.stringify({ status: 'idle', message: 'No users to train' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const results = [];

        // 3. Process each user
        for (const trainingRecord of usersToTrain) {
            const userId = trainingRecord.user_id;

            // Fetch unanalyzed messages (Batched: 50 messages max)
            const { data: messages, error: msgError } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .eq('user_id', userId)
                .eq('analyzed', false)
                .order('created_at', { ascending: true })
                .limit(50);

            if (msgError) {
                console.error(`Error fetching messages for user ${userId}:`, msgError);
                continue;
            }

            if (!messages || messages.length === 0) {
                continue; // Nothing to do for this user
            }

            console.log(`[Processor] Analyzing ${messages.length} messages for user ${userId}`);

            // Format conversation for Gemini
            const conversationText = messages.map(m =>
                `[${m.created_at}] ${m.direction === 'sent' ? 'Empresa' : 'Cliente (' + (m.client_name || 'Desconhecido') + ')'}: ${m.message}`
            ).join('\n');

            // Call Gemini
            const analysisResult = await analyzeWithGemini(conversationText, GEMINI_KEY, MODEL);

            if (analysisResult) {
                // Save Knowledge
                if (analysisResult.knowledge_entries && analysisResult.knowledge_entries.length > 0) {
                    const entries = analysisResult.knowledge_entries.map((entry: any) => ({
                        user_id: userId,
                        knowledge_type: entry.type,
                        content: entry.content,
                        confidence: entry.confidence || 0.8,
                        source_count: 1,
                        is_active: true
                    }));

                    await supabase.from('ai_knowledge_base').insert(entries);
                }

                // Update Training Metrics
                await supabase.rpc('update_training_progress', {
                    p_user_id: userId,
                    p_conversations_analyzed: (trainingRecord.conversations_analyzed || 0) + 1, // Rough count, actually batches
                    p_patterns_identified: (analysisResult.knowledge_entries?.length || 0)
                });

                // Calculate new confidence
                await supabase.rpc('calculate_confidence_score', { p_user_id: userId });

                // Mark messages as analyzed
                const msgIds = messages.map(m => m.id);
                await supabase
                    .from('whatsapp_messages')
                    .update({ analyzed: true, analysis_result: analysisResult })
                    .in('id', msgIds);

                results.push({ userId, status: 'success', insights: analysisResult.knowledge_entries?.length });
            } else {
                results.push({ userId, status: 'failed_analysis' });
            }
        }

        return new Response(JSON.stringify({ status: 'completed', results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error(`[Processor] Critical Error: ${error.message}`);
        return new Response(JSON.stringify({ error: true, message: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});

// Helper: Call Gemini API
async function analyzeWithGemini(conversation: string, apiKey: string, model: string) {
    const prompt = `
    ATUE COMO UM ESPECIALISTA EM ANÁLISE DE ATENDIMENTO E EXTRAÇÃO DE CONHECIMENTO.
    
    OBJETIVO: Analisar o trecho de conversa de WhatsApp abaixo e extrair padrões estruturados sobre como a EMPRESA atende, para treinar uma IA que a imite.
    
    CONVERSA:
    ${conversation}
    
    EXTRAIA E RETORNE APENAS UM JSON (SEM MARKDOWN) COM ESTE FORMATO:
    {
      "knowledge_entries": [
        {
          "type": "business_rule" | "tone" | "client_profile" | "product",
          "content": { ...tabela chave-valor flexível dependendo do tipo... },
          "confidence": 0.0 a 1.0
        }
      ]
    }
    
    DIRETRIZES DE EXTRAÇÃO:
    1. "business_rule": Regras de negócio explícitas (ex: "só aceitamos PIX", "entrega grátis acima de X").
    2. "tone": Estilo de escrita (ex: usa emojis? formal ou informal? saudações comuns?).
    3. "client_profile": Preferências ou dados do cliente se mencionados (nome do cliente, o que gosta).
    4. "product": Detalhes de produtos mencionados (preço, características).
    
    SE NADA RELEVANTE FOR ENCONTRADO, RETORNE 'knowledge_entries': [].
    IGNORE MENSAGENS IRRELEVANTES (ex: "ok", "tá").
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Gemini API Error:", err);
            return null;
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) return null;

        return JSON.parse(textResponse);
    } catch (e) {
        console.error("Gemini Parse/Fetch Error:", e);
        return null;
    }
}
