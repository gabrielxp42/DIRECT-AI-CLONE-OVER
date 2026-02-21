import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- UTILS ---
const TIME_ZONE = 'America/Sao_Paulo';

function getCurrentDateTime() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long'
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const weekday = getPart('weekday');

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthName = monthNames[parseInt(month!) - 1];

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    return {
        fullDate: `${day}/${month}/${year}`,
        time: `${hour}:${minute}`,
        dayOfWeek: weekday,
        current: { day, month, year, monthName },
        ranges: {
            thisMonth: { start: startOfMonth, end: endOfMonth }
        }
    };
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const dateInfo = getCurrentDateTime();

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
        const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
        const MODEL = adminProfile.gemini_training_model || 'gemini-1.5-flash';

        if (!OPENAI_KEY) {
            throw new Error("Sistema não configurado (Falta OpenAI API Key no ambiente)");
        }

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
            console.log(`[Processor] Processing user ${userId}...`);

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

            if (messages && messages.length > 0) {
                console.log(`[Processor] Found ${messages.length} messages for user ${userId}. Starting Gemini analysis...`);

                // Log: Start of analysis
                await supabase.from('ai_training_logs').insert({
                    user_id: userId,
                    agent_type: 'extractor',
                    action: 'pattern_found',
                    details: { message: `Iniciando análise de lote com ${messages.length} mensagens.` }
                });

                // Format conversation for Gemini
                const conversationText = messages.map((m: any) =>
                    `[${m.created_at}] ${m.direction === 'sent' ? 'Empresa' : 'Cliente (' + (m.client_name || 'Desconhecido') + ')'}: ${m.message}`
                ).join('\n');

                // Call Gemini
                const analysisResult = await analyzeWithGemini(conversationText, GEMINI_KEY, MODEL);

                if (analysisResult) {
                    console.log(`[Processor] Gemini analysis successful for ${userId}. Extracted ${analysisResult.knowledge_entries?.length || 0} entries.`);

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

                        const { error: knError } = await supabase.from('ai_knowledge_base').insert(entries);
                        if (knError) console.error(`[Processor] Error saving knowledge for ${userId}:`, knError);

                        // Log: Knowledge extracted
                        await supabase.from('ai_training_logs').insert({
                            user_id: userId,
                            agent_type: 'synthesizer',
                            action: 'knowledge_updated',
                            details: {
                                message: `Extraídos ${entries.length} novos padrões de conhecimento.`,
                                types: entries.map((e: any) => e.knowledge_type)
                            }
                        });
                    }

                    // Calculate Metric Increments
                    const findings = analysisResult.knowledge_entries || [];
                    const hasTone = findings.some((f: any) => f.type === 'tone');
                    const hasProduct = findings.some((f: any) => f.type === 'product');
                    const hasBusinessRule = findings.some((f: any) => f.type === 'business_rule');
                    const hasClientProfile = findings.some((f: any) => f.type === 'client_profile');

                    const { data: currentTraining } = await supabase
                        .from('ai_agent_training')
                        .select('similarity_score, coverage_score, tone_consistency_score, product_knowledge_score')
                        .eq('user_id', userId)
                        .single();

                    const currentSim = currentTraining?.similarity_score || 0;
                    const currentCov = currentTraining?.coverage_score || 0;
                    const currentTone = currentTraining?.tone_consistency_score || 0;
                    const currentProd = currentTraining?.product_knowledge_score || 0;

                    const newSim = Math.min(100, currentSim + (findings.length > 0 ? 12 : 1));
                    const newCov = Math.min(100, currentCov + (hasBusinessRule ? 15 : 5) + (hasClientProfile ? 8 : 0));
                    const newTone = Math.min(100, currentTone + (hasTone ? 18 : 3));
                    const newProd = Math.min(100, currentProd + (hasProduct ? 14 : 2));

                    await supabase
                        .from('ai_agent_training')
                        .update({
                            conversations_analyzed: (trainingRecord.conversations_analyzed || 0) + 1,
                            patterns_identified: (trainingRecord.patterns_identified || 0) + findings.length,
                            last_analysis_at: new Date().toISOString(),
                            similarity_score: newSim,
                            coverage_score: newCov,
                            tone_consistency_score: newTone,
                            product_knowledge_score: newProd
                        })
                        .eq('user_id', userId);

                    await supabase.rpc('calculate_confidence_score', { p_user_id: userId });

                    // Mark messages as analyzed
                    const msgIds = messages.map((m: any) => m.id);
                    await supabase
                        .from('whatsapp_messages')
                        .update({ analyzed: true, analysis_result: analysisResult })
                        .in('id', msgIds);
                }
            }

            results.push({ userId, status: messages?.length > 0 ? 'success' : 'skipped_training' });

            // --- GABI ESTRATÉGICA: CONSOLIDATED ANALYSIS (THE "SECRETARY" PHASE) ---
            try {
                console.log(`[Processor] Checking if Strategic Secretary report is due for ${userId}...`);

                const { data: trainingStatus } = await supabase
                    .from('ai_agent_training')
                    .select('last_report_at, last_context_fingerprint')
                    .eq('user_id', userId)
                    .single();

                const lastReport = trainingStatus?.last_report_at;
                const lastFingerprint = trainingStatus?.last_context_fingerprint;

                // 1. Frequency Control (Cooldown of 4 hours)
                const isDue = forceUserId || !lastReport || (Date.now() - new Date(lastReport).getTime() > 4 * 60 * 60 * 1000);

                // 2. Quiet Hours (Avoid pro-active alerts between 23h and 08h)
                const currentHour = parseInt(dateInfo.time.split(':')[0]);
                const isQuietHours = currentHour >= 23 || currentHour < 8;

                if (isQuietHours && !forceUserId) {
                    console.log(`[Processor] Strategic Secretary in Quiet Hours (${currentHour}h) for ${userId}. Skipping.`);
                    continue;
                }

                if (isDue) {
                    console.log(`[Processor] Strategic Secretary phase STARTED for ${userId}...`);

                    // Log: Secretary Phase Start
                    await supabase.from('ai_training_logs').insert({
                        user_id: userId,
                        agent_type: 'synthesizer',
                        action: 'secretary_phase_start',
                        details: { message: "Iniciando compilação de relatório executivo proativo." }
                    });

                    // 1. WhatsApp Inactivity Check (Grouped by Client)
                    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
                    const { data: pendingMessages } = await supabase
                        .from('whatsapp_messages')
                        .select('client_name, phone, created_at, message')
                        .eq('user_id', userId)
                        .eq('direction', 'received')
                        .eq('analyzed', false)
                        .lt('created_at', sixHoursAgo);

                    // Group by client name
                    const groupedInactivity = pendingMessages?.reduce((acc: any, m: any) => {
                        const key = m.client_name || m.phone;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(m);
                        return acc;
                    }, {}) || {};

                    const inactivityDetails = Object.entries(groupedInactivity).map(([name, msgs]: [string, any]) =>
                        `- ${name}: ${msgs.length} mensagens (última em ${new Date(msgs[msgs.length - 1].created_at).toLocaleString('pt-BR')})`
                    ).join('\n');

                    // 2. Unpaid Orders Check (> 24h)
                    const { data: unpaidOrders } = await supabase
                        .from('pedidos')
                        .select('order_number, valor_total, created_at, clientes(nome)')
                        .eq('user_id', userId)
                        .in('status', ['pendente', 'aguardando_pagamento'])
                        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

                    // 3. Fingerprint check: avoid sending same info
                    const currentFingerprint = `unpaid:${(unpaidOrders || []).map((o: any) => o.order_number).sort().join(',')}|msg:${pendingMessages?.length || 0}`;

                    if (currentFingerprint === lastFingerprint && !forceUserId) {
                        console.log(`[Processor] Data hasn't changed for ${userId}. Skipping duplicate report.`);
                        await supabase.from('ai_training_logs').insert({
                            user_id: userId,
                            agent_type: 'synthesizer',
                            action: 'analysis_skipped',
                            details: { message: "Dados idênticos ao último relatório. Pulando para evitar spam.", fingerprint: currentFingerprint }
                        });
                        continue;
                    }

                    // 4. Monthly Metrics
                    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userId).single();
                    const { data: monthlyMetrics } = await supabase.rpc('get_total_meters_by_period', {
                        p_start_date: dateInfo.ranges.thisMonth.start,
                        p_end_date: dateInfo.ranges.thisMonth.end,
                        p_organization_id: profile?.organization_id
                    });

                    // 5. Generate Strategic Note with Gemini 
                    const strategicContext = {
                        pending_whatsapp: inactivityDetails,
                        unpaid_orders: unpaidOrders || [],
                        metrics: (monthlyMetrics && monthlyMetrics.length > 0) ? monthlyMetrics[0] : { total_meters: 0, total_orders: 0 },
                        date: dateInfo.fullDate
                    };

                    // Log: Context prepared
                    await supabase.from('ai_training_logs').insert({
                        user_id: userId,
                        agent_type: 'synthesizer',
                        action: 'context_prepared',
                        details: {
                            inactivity_grouped: inactivityDetails,
                            unpaid_count: strategicContext.unpaid_orders.length,
                            metrics: strategicContext.metrics,
                            fingerprint: currentFingerprint
                        }
                    });

                    // 6. Attempt to generate Strategic Note
                    try {
                        const executiveNote = await generateExecutiveNote(strategicContext, OPENAI_KEY);

                        // Log: Raw response for debugging
                        await supabase.from('ai_training_logs').insert({
                            user_id: userId,
                            agent_type: 'synthesizer',
                            action: 'raw_ai_response',
                            details: { response: executiveNote }
                        });

                        const hasUnpaid = strategicContext.unpaid_orders.length > 0;
                        const hasMessages = strategicContext.pending_whatsapp.length > 0;
                        const shouldForce = hasUnpaid || hasMessages;

                        if (executiveNote && (!executiveNote.includes("SKIP_ALERT") || shouldForce)) {
                            let note = executiveNote;
                            if (note.includes("SKIP_ALERT") && shouldForce) {
                                note = "Gabi identificou pendências importantes: " +
                                    (hasUnpaid ? `${strategicContext.unpaid_orders.length} pedidos não pagos. ` : "") +
                                    (hasMessages ? "Clientes aguardando no WhatsApp." : "");
                            }

                            console.log(`[Processor] Executive note generated for ${userId}. Saving insight...`);
                            await supabase.from('agent_insights').insert({
                                user_id: userId,
                                insight_type: 'executive_alert',
                                title: 'Resumo da Secretária Gabi',
                                description: note,
                                confidence: 0.9,
                                is_active: true
                            });

                            await supabase.from('ai_training_logs').insert({
                                user_id: userId,
                                agent_type: 'synthesizer',
                                action: 'insight_generated',
                                details: { message: "Relatório executivo gerado e enviado para agent_insights." }
                            });
                        } else {
                            console.log(`[Processor] Secretary skipped alert for ${userId} (Nothing critical).`);
                            await supabase.from('ai_training_logs').insert({
                                user_id: userId,
                                agent_type: 'synthesizer',
                                action: 'analysis_skipped',
                                details: { message: "Análise concluída. Nada crítico identificado (SKIP_ALERT)." }
                            });
                        }

                        // Update last report timestamp and fingerprint ON SUCCESS
                        await supabase.from('ai_agent_training')
                            .update({
                                last_report_at: new Date().toISOString(),
                                last_context_fingerprint: currentFingerprint
                            })
                            .eq('user_id', userId);

                    } catch (reportErr: any) {
                        console.error(`[Processor] Strategic Note Error for ${userId}:`, reportErr);

                        // IMPORTANT: Mark attempt even on failure to avoid infinite retry every 5 mins
                        // Set a smaller cooldown (e.g. 1h) instead of the full 4h if it failed
                        const retryIn = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 4h standard - 3h = 1h wait

                        await supabase.from('ai_agent_training')
                            .update({ last_report_at: retryIn })
                            .eq('user_id', userId);

                        throw reportErr; // Re-throw for main loop logging
                    }
                } else {
                    console.log(`[Processor] Strategic Report skipped (Not due yet for ${userId})`);
                }
            } catch (err: any) {
                console.error(`[Processor] CRITICAL ERROR for user ${userId}:`, err);
                await supabase.from('ai_training_logs').insert({
                    user_id: userId,
                    agent_type: 'evaluator',
                    action: 'analysis_failed',
                    details: {
                        message: "Erro crítico no processamento do usuário.",
                        error: err.message,
                        stack: err.stack,
                        is_error: true
                    }
                });
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

// Helper: Strategic Secretary Intelligence (Updated for OpenAI GPT-4o)
async function generateExecutiveNote(ctx: any, apiKey: string) {
    const prompt = `
    ATUE COMO A GABI, A GERENTE AMIGA E PARCEIRA DE CONFIANÇA DO PATRÃO NA DIRECT AI.
    
    ESTADO DA OPERAÇÃO AGORA:
    - Data: ${ctx.date}
    - Conversas Pendentes: ${ctx.pending_whatsapp || 'Tudo em dia por aqui!'}
    - Pedidos aguardando pagamento (> 24h): ${ctx.unpaid_orders.length} pedidos. Total: R$ ${ctx.unpaid_orders.reduce((acc: number, o: any) => acc + (o.valor_total || 0), 0).toFixed(2)}
    - Produção do Mês: ${ctx.metrics.total_meters?.toFixed(2) || 0} metros em ${ctx.metrics.total_orders || 0} pedidos.

    OBJETIVO:
    Dê um resumo proativo para o patrão. Imagine que você está sentada com ele tomando um café. 
    Seja humana, use o "olho de dona" e fale de forma natural.

    DIRETRIZES DE TOM:
    - Evite ser uma lista de supermercado. Converse.
    - Se as vendas estiverem boas, comemore! Se houver muitos calotes ou mensagens paradas, avise com tom de preocupação e parceira.
    - Dê uma dica ou sugestão de ação baseada no que viu.
    - Máximo 4-5 linhas para ser ágil.

    RETORNO "SKIP_ALERT": 
    Apenas se ABSOLUTAMENTE tudo estiver perfeito e não houver nada relevante para comentar. Mas se quiser apenas dar um "Bom dia" com uma análise positiva, pode mandar também.
    `;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "Você é uma secretária executiva focada em dados reais e gestão de lucros. Não invente números." },
                    { role: "user", content: prompt }
                ],
                temperature: 0
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "SKIP_ALERT";
    } catch (e: any) {
        console.error("[Processor] generateExecutiveNote Error:", e);
        throw e;
    }
}

// Helper: Call Gemini API
async function analyzeWithGemini(conversation: string, apiKey: string, model: string) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
            const errorData = await response.json().catch(() => ({}));
            const status = response.status;
            const msg = errorData.error?.message || "Erro desconhecido na API Gemini";
            console.error(`[Gemini API Error] Status: ${status}`, errorData);
            throw new Error(`Gemini API Error (${status}): ${msg}`);
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
