import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: vectorize
 *
 * Recebe uma imagem e a processa via API KIE.AI (Nano Banana) para
 * reconstruir/vetorizar logos de baixa qualidade.
 *
 * A chave da API é lida de qualquer perfil administrativo para uso global.
 */
Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS")
        return new Response("ok", { headers: corsHeaders });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- HANDLE GET (Polling) ---
    if (req.method === "GET") {
        try {
            const url = new URL(req.url);
            const id = url.searchParams.get("id");

            if (!id) {
                return new Response(JSON.stringify({ error: "Missing id parameter" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Buscar registro local
            const { data: record, error: fetchError } = await supabaseAdmin
                .from("vectorizations")
                .select("*")
                .eq("id", id)
                .single();

            if (fetchError || !record) {
                return new Response(JSON.stringify({ error: "Job not found" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Se já finalizou, retorna o que tem
            if (record.status !== "processing" || !record.external_task_id) {
                return new Response(JSON.stringify(record), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Se ainda está processando, consulta a KIE.AI
            // Buscar chave API de admin
            const { data: profiles } = await supabaseAdmin
                .from("profiles")
                .select("kieai_api_key")
                .eq("is_admin", true)
                .not("kieai_api_key", "is", null)
                .limit(1);

            const apiKey = profiles?.[0]?.kieai_api_key;
            if (!apiKey) throw new Error("API Key not found");

            const statusEndpoint = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${record.external_task_id}`;
            const response = await fetch(statusEndpoint, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[vectorize] KIE.AI status for ${record.external_task_id}:`, data);

                // Estrutura real retornada pela API KIE.AI
                const kieState = data.data?.state;
                let resultUrl = data.data?.output_url || data.data?.result_url || data.data?.image_url;

                if (kieState === "success" && data.data?.resultJson) {
                    try {
                        const parsedResult = JSON.parse(data.data.resultJson);
                        if (parsedResult.resultUrls && parsedResult.resultUrls.length > 0) {
                            resultUrl = parsedResult.resultUrls[0];
                        }
                    } catch (e) {
                        console.error("[vectorize] Error parsing KIE.AI resultJson:", e);
                    }
                }

                if (resultUrl) {
                    // Completou!
                    const { data: updated } = await supabaseAdmin
                        .from("vectorizations")
                        .update({
                            status: "completed",
                            result_url: resultUrl,
                            completed_at: new Date().toISOString()
                        })
                        .eq("id", id)
                        .select()
                        .single();

                    return new Response(JSON.stringify(updated), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                } else if (kieState === "failed" || kieState === "fail" || data.data?.status === 2 || data.data?.failCode) {
                    // Falhou
                    const { data: updated } = await supabaseAdmin
                        .from("vectorizations")
                        .update({
                            status: "failed",
                            error_message: "KIE.AI task failed",
                            completed_at: new Date().toISOString()
                        })
                        .eq("id", id)
                        .select()
                        .single();

                    return new Response(JSON.stringify(updated), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
            }

            // Ainda processando ou erro na consulta
            return new Response(JSON.stringify(record), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });

        } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    }

    // --- HANDLE POST (Creation) ---
    try {
        // Autenticação do chamador
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Validar user chamador
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Buscar a chave API de um perfil administrativo (chave global)
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("kieai_api_key")
            .eq("is_admin", true)
            .not("kieai_api_key", "is", null)
            .limit(1);

        if (profileError) {
            console.error("[vectorize] Profile query error:", profileError);
            return new Response(
                JSON.stringify({ error: "Erro ao buscar configuração administrativa." }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const apiKey = profiles && profiles.length > 0 ? profiles[0].kieai_api_key : null;

        if (!apiKey) {
            console.error("[vectorize] No admin API key found in profiles");
            return new Response(
                JSON.stringify({ error: "Serviço indisponível: Chave API do KIE.AI não configurada pelo administrador." }),
                { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const payload = await req.json();
        const { image_url, model = "standard", prompt } = payload;

        // --- CREDIT SYSTEM INTEGRATION ---
        const COSTS: Record<string, number> = {
            "standard": 5,
            "pro": 20,
            "edit": 5
        };

        const cost = prompt ? COSTS["edit"] : (COSTS[model as string] || COSTS["standard"]);
        console.log(`[vectorize] Attempting credit deduction for user ${user.id}. Cost: ${cost}`);

        try {
            const { data: deductionData, error: deductionError } = await supabaseAdmin.rpc('deduct_ai_credits', {
                p_user_id: user.id,
                p_amount: cost
            });

            if (deductionError) {
                console.error("[vectorize] RPC deductionError:", JSON.stringify(deductionError));
                if (deductionError.message?.includes('Insufficient Credits')) {
                    return new Response(
                        JSON.stringify({
                            error: "Créditos insuficientes. Por favor, recarregue para continuar.",
                            code: "INSUFFICIENT_CREDITS"
                        }),
                        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
                throw deductionError;
            }
            console.log(`[vectorize] Credit deduction successful for ${user.id}`);
        } catch (err: any) {
            console.error("[vectorize] Credit deduction critical error:", err);
            return new Response(
                JSON.stringify({
                    error: "Erro ao processar cobrança de créditos.",
                    debug: err.message
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
        // ---------------------------------

        if (!image_url) {
            return new Response(
                JSON.stringify({ error: "image_url is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[vectorize] User: ${user.id}, Model: ${model}`);

        // 1. Registrar job como "processing"
        const { data: vectorization, error: insertError } = await supabaseAdmin
            .from("vectorizations")
            .insert({
                user_id: user.id,
                input_url: image_url,
                model,
                prompt: prompt || null,
                status: "processing",
            })
            .select("id")
            .single();

        if (insertError) {
            console.error("[vectorize] Insert error:", insertError);
            return new Response(
                JSON.stringify({ error: "Failed to create vectorization job" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const vectorizationId = vectorization.id;

        // 2. Chamar API KIE.AI
        const endpoint = "https://api.kie.ai/api/v1/jobs/createTask";

        // Mapear modelo conforme o usuário solicitou ou usar o padrão Edit (que ele indicou no site)
        const targetModel = model === "pro" ? "google/nano-banana-pro" : "google/nano-banana-edit";
        const defaultPrompt = "vectorize this logo, clean and professional, sharp edges, high resolution";

        let resultUrl: string | null = null;
        let kieError: string | null = null;

        try {
            console.log(`[vectorize] Calling KIE.AI endpoint: ${endpoint} with model: ${targetModel}`);

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: targetModel,
                    input: {
                        prompt: prompt || defaultPrompt,
                        image_urls: [image_url],
                        output_format: "png",
                        image_size: "1:1"
                    }
                }),
            });

            const responseText = await response.text();
            let data: any;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                data = { message: responseText };
            }

            console.log(`[vectorize] KIE.AI response (${response.status}):`, responseText);

            if (response.ok && (data.taskId || data.data?.taskId)) {
                const taskId = data.taskId || data.data?.taskId;
                // Sucesso na criação da task (assinscrono)
                await supabaseAdmin
                    .from("vectorizations")
                    .update({ external_task_id: taskId })
                    .eq("id", vectorizationId);

                return new Response(
                    JSON.stringify({
                        vectorization_id: vectorizationId,
                        status: "processing",
                        task_id: taskId,
                    }),
                    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            } else if (response.ok && (data.output_url || data.result_url || data.image_url)) {
                // Sucesso síncrono
                resultUrl = data.output_url || data.result_url || data.image_url;
            } else if (data.code === 200 && (data.taskId || data.data?.taskId)) {
                // Caso o status venha 200 mas dentro do JSON (como vimos no log)
                const taskId = data.taskId || data.data?.taskId;
                await supabaseAdmin
                    .from("vectorizations")
                    .update({ external_task_id: taskId })
                    .eq("id", vectorizationId);

                return new Response(
                    JSON.stringify({
                        vectorization_id: vectorizationId,
                        status: "processing",
                        task_id: taskId,
                    }),
                    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            } else {
                kieError = data.error || data.message || data.msg || `Error ${response.status}: ${responseText}`;
                console.warn(`[vectorize] KIE.AI failed: ${kieError}`);
            }
        } catch (err: any) {
            kieError = err.message;
            console.error(`[vectorize] KIE.AI fetch exception:`, err);
        }

        // 4. Atualizar o job com resultado
        const finalStatus = resultUrl ? "completed" : "failed";

        await supabaseAdmin
            .from("vectorizations")
            .update({
                status: finalStatus,
                result_url: resultUrl,
                error_message: kieError,
                completed_at: new Date().toISOString(),
            })
            .eq("id", vectorizationId);

        return new Response(
            JSON.stringify({
                vectorization_id: vectorizationId,
                status: finalStatus,
                result_url: resultUrl,
                error: kieError,
            }),
            {
                status: finalStatus === "completed" ? 200 : 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error: any) {
        console.error("[vectorize] Fatal error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
