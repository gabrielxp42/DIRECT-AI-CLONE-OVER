import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

/**
 * Edge Function: vectorize
 *
 * Recebe uma imagem e a processa via API KIE.AI (Nano Banana) para
 * reconstruir/vetorizar logos de baixa qualidade.
 *
 * A chave da API é lida de qualquer perfil administrativo para uso global.
 */Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS")
        return new Response("ok", { headers: corsHeaders });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar a chave API administrativa globalmente
    const { data: adminProfiles } = await supabaseAdmin
        .from("profiles")
        .select("kieai_api_key")
        .eq("is_admin", true)
        .not("kieai_api_key", "is", null)
        .limit(1);

    const kieApiKey = adminProfiles?.[0]?.kieai_api_key;
    if (!kieApiKey && req.method !== "OPTIONS") {
        return new Response(JSON.stringify({ error: "KIE.AI API key not configured" }), {
            status: 503, headers: corsHeaders
        });
    }

    // --- UTILITY: Execute KIE.AI Task ---
    const executeKieTask = async (
        vectorizationId: string, 
        userId: string, 
        currentModel: string, 
        currentPrompt: string, 
        currentImageUrl: string, 
        isFallbackRetry = false
    ) => {
        const endpoint = "https://api.kie.ai/api/v1/jobs/createTask";
        const isFlux = currentModel.startsWith("flux");
        
        // --- 1. HANDLE CREDITS FOR FALLBACK ---
        if (isFallbackRetry) {
            console.log(`[vectorize] Attempting fallback token debit for ${userId} (20 tokens)`);
            const { data: debitSuccess, error: fallbackError } = await supabaseAdmin.rpc('debit_user_tokens', {
                p_user_uid: userId,
                p_amount: 20, // Unified cost
                p_reason: `Vetorização AI (Fallback): ${currentModel}`
            });

            if (fallbackError || !debitSuccess) {
                console.error("[vectorize] Fallback token debit failed:", fallbackError);
                throw new Error("Saldo insuficiente para o modelo alternativo (Flux 2).");
            }
        }

        // --- 2. CALL KIE.AI API ---
        const requestBody = {
            model: currentModel,
            input: isFlux ? {
                prompt: currentPrompt,
                input_urls: [currentImageUrl],
                aspect_ratio: "auto",
                resolution: "1K"
            } : {
                prompt: currentPrompt,
                image_urls: [currentImageUrl],
                output_format: "png",
                image_size: "1:1"
            }
        };

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${kieApiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        let data: any;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { message: responseText };
        }

        if (response.ok && (data.taskId || data.data?.taskId)) {
            const taskId = data.taskId || data.data?.taskId;
            return { taskId, isFallback: isFallbackRetry };
        } else if (data.code === 200 && (data.taskId || data.data?.taskId)) {
            const taskId = data.taskId || data.data?.taskId;
            return { taskId, isFallback: isFallbackRetry };
        } else {
            const errorStr = data.error || data.message || data.msg || `Error ${response.status}`;
            throw new Error(errorStr);
        }
    };

    // --- HANDLE GET (Polling) ---
    if (req.method === "GET") {
        try {
            const url = new URL(req.url);
            const id = url.searchParams.get("id");

            if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: corsHeaders });

            const { data: record, error: fetchError } = await supabaseAdmin.from("vectorizations").select("*").eq("id", id).single();
            if (fetchError || !record) return new Response(JSON.stringify({ error: "Job find error" }), { status: 404, headers: corsHeaders });

            if (record.status !== "processing" || !record.external_task_id) {
                return new Response(JSON.stringify(record), { headers: corsHeaders });
            }

            const statusEndpoint = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${record.external_task_id}`;
            const response = await fetch(statusEndpoint, { headers: { "Authorization": `Bearer ${kieApiKey}` } });

            if (response.ok) {
                const data = await response.json();
                const kieData = data.data || data; // Handle cases where data is not wrapped
                const kieState = kieData?.state || kieData?.status;
                
                // Detailed logging for debugging
                console.log(`[vectorize] KIE.AI status for taskId ${record.external_task_id}: ${kieState}`);

                let resultUrl = kieData?.output_url || kieData?.result_url || kieData?.image_url || kieData?.url;

                // Flux models and others often use result (stringified JSON) or resultJson
                const resultSource = kieData?.result || kieData?.resultJson || kieData?.result_json;
                if (kieState === "success" || kieState === "completed") {
                    if (resultSource) {
                        try {
                            const parsed = typeof resultSource === 'string' ? JSON.parse(resultSource) : resultSource;
                            if (parsed.resultUrls && parsed.resultUrls.length > 0) {
                                resultUrl = parsed.resultUrls[0];
                            } else if (parsed.url) {
                                resultUrl = parsed.url;
                            } else if (Array.isArray(parsed) && parsed.length > 0) {
                                resultUrl = parsed[0];
                            }
                        } catch (e) { 
                            console.error("[vectorize] JSON parse error in resultSource", e); 
                        }
                    }
                }

                if (resultUrl && (kieState === "success" || kieState === "completed")) {
                    console.log(`[vectorize] Success! resultUrl found: ${resultUrl}`);
                    const { data: updated, error: updateError } = await supabaseAdmin
                        .from("vectorizations")
                        .update({ 
                            status: "completed", 
                            result_url: resultUrl, 
                            completed_at: new Date().toISOString() 
                        })
                        .eq("id", id)
                        .select()
                        .single();

                    if (updateError) console.error("[vectorize] Update error:", updateError);
                    return new Response(JSON.stringify(updated || record), { headers: corsHeaders });
                } 
                
                // --- FALLBACK LOGIC ON FAILURE ---
                if (kieState === "failed" || kieState === "fail" || kieData?.failCode) {
                    const failMsg = (kieData?.failMsg || kieData?.error || "").toLowerCase();
                    const isCopyrightError = failMsg.includes("safety") || failMsg.includes("copyright") || failMsg.includes("prohibited") || failMsg.includes("gemini could not generate");

                    // Check if we already tried fallback for this record
                    const alreadyFallback = record.error_message?.includes("Fallback (Flux 2)");

                    if (isCopyrightError && !alreadyFallback) {
                        console.log("⚠️ Async Copyright error detected. Initiating fallback to Flux 2 PRO...");
                        try {
                            const fluxModel = "flux-2/pro-image-to-image";
                            const defaultPrompt = "Isolate the main logo or drawing from the image... TIGHT CROP. TRANSPARENT BACKGROUND.";
                            
                            const { taskId } = await executeKieTask(
                                record.id, 
                                record.user_id, 
                                fluxModel, 
                                record.prompt || defaultPrompt, 
                                record.input_url, 
                                true
                            );

                            const { data: updatedRecord } = await supabaseAdmin
                                .from("vectorizations")
                                .update({ 
                                    external_task_id: taskId,
                                    error_message: "Processado via Fallback (Flux 2) devido a restrições de direitos autorais no modelo original."
                                })
                                .eq("id", id)
                                .select()
                                .single();

                            return new Response(JSON.stringify(updatedRecord), { headers: corsHeaders });
                        } catch (err: any) {
                            console.error("[vectorize] Async fallback initiation failed:", err);
                            const { data: failedRecord } = await supabaseAdmin
                                .from("vectorizations")
                                .update({ 
                                    status: "failed", 
                                    error_message: `Fallback falhou: ${err.message}` 
                                })
                                .eq("id", id)
                                .select()
                                .single();
                            return new Response(JSON.stringify(failedRecord || record), { headers: corsHeaders });
                        }
                    }

                    // Se não for erro de copyright ou fallback falhou/já foi tentado
                    const { data: updated } = await supabaseAdmin.from("vectorizations").update({ status: "failed", error_message: kieData?.failMsg || "KIE.AI task failed", completed_at: new Date().toISOString() }).eq("id", id).select().single();
                    return new Response(JSON.stringify(updated), { headers: corsHeaders });
                }
            }

            return new Response(JSON.stringify(record), { headers: corsHeaders });
        } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
    }

    // --- HANDLE POST (Creation) ---
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });

        const payload = await req.json();
        const { image_url, model = "standard", prompt } = payload;
        if (!image_url) return new Response(JSON.stringify({ error: "image_url required" }), { status: 400, headers: corsHeaders });

        // UNIFIED COST: 20 tokens
        const UNIFIED_COST = 20;

        // 1. Debit tokens using the unified RPC
        const { data: debitSuccess, error: deductionError } = await supabaseAdmin.rpc('debit_user_tokens', {
            p_user_uid: user.id,
            p_amount: UNIFIED_COST,
            p_reason: `Vetorização AI: ${model}`
        });

        if (deductionError || !debitSuccess) {
            return new Response(JSON.stringify({ 
                error: "Saldo insuficiente ou erro ao debitar tokens.", 
                code: "INSUFFICIENT_CREDITS" 
            }), { status: 402, headers: corsHeaders });
        }

        // 1. Criar registro no banco
        const { data: job } = await supabaseAdmin.from("vectorizations").insert({ user_id: user.id, input_url: image_url, model, prompt, status: "processing" }).select("id").single();
        if (!job) throw new Error("Failed to create record");

        const targetModel = model === "pro" ? "google/nano-banana-pro" : "google/nano-banana-edit";
        const defaultPrompt = "Isolate the main logo or drawing from the image... TIGHT CROP. TRANSPARENT BACKGROUND.";

        let kieError: string | null = null;

        try {
            const { taskId } = await executeKieTask(job.id, user.id, targetModel, prompt || defaultPrompt, image_url);
            
            await supabaseAdmin.from("vectorizations").update({ external_task_id: taskId }).eq("id", job.id);

            return new Response(JSON.stringify({ vectorization_id: job.id, status: "processing", task_id: taskId }), { status: 202, headers: corsHeaders });
        } catch (err: any) {
            // DETECTAR ERRO DE COPYRIGHT IMEDIATO NO POST
            const errLower = err.message.toLowerCase();
            const isCopyrightError = errLower.includes("safety") || 
                                   errLower.includes("copyright") || 
                                   errLower.includes("prohibited") || 
                                   errLower.includes("gemini could not generate");

            if (isCopyrightError) {
                console.log("⚠️ Immediate Copyright error detected in POST. Trying fallback to Flux 2 PRO...");
                try {
                    const { taskId } = await executeKieTask(job.id, user.id, "flux-2/pro-image-to-image", prompt || defaultPrompt, image_url, true);
                    await supabaseAdmin.from("vectorizations").update({ external_task_id: taskId, error_message: "Processado via Fallback (Flux 2) devido a restrições no modelo original." }).eq("id", job.id);
                    return new Response(JSON.stringify({ vectorization_id: job.id, status: "processing", task_id: taskId, is_fallback: true }), { status: 202, headers: corsHeaders });
                } catch (fallbackErr: any) {
                    kieError = fallbackErr.message;
                }
            } else {
                kieError = err.message;
            }

            await supabaseAdmin.from("vectorizations").update({ status: "failed", error_message: kieError, completed_at: new Date().toISOString() }).eq("id", job.id);
            return new Response(JSON.stringify({ error: kieError }), { status: 500, headers: corsHeaders });
        }
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
