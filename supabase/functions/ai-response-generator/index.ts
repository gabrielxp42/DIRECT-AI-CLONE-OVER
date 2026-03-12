import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const {
            user_id,
            message,
            audio_base64,
            audio_mimetype,
            db_message_id,
            customer_phone,
            customer_name,
            is_boss,
            quoted_message
        } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // --- DEBUG LOG: START ---
        await supabase.from('system_logs').insert({
            level: 'info',
            category: 'generator_debug',
            message: `Starting generator for ${customer_phone}`,
            user_id: user_id,
            details: { customer_name, is_boss, has_message: !!message, has_audio: !!audio_base64 }
        });

        // --- 1. Handle Audio (Whisper) ---
        let textMessage = message || "";
        const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');

        if (audio_base64) {
            console.log(`[Generator] Audio detected. Transcribing...`);
            try {
                const binaryString = atob(audio_base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                const mimeType = (audio_mimetype || "audio/ogg").split(';')[0].trim();
                const extension = mimeType.includes('ogg') ? 'ogg' : 'mp4';

                const formData = new FormData();
                formData.append('file', new Blob([bytes], { type: mimeType }), `audio.${extension}`);
                formData.append('model', 'whisper-1');
                formData.append('language', 'pt');

                const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
                    body: formData,
                });

                if (whisperRes.ok) {
                    const whisperData = await whisperRes.json();
                    textMessage = whisperData.text || "";
                    if (db_message_id) {
                        await supabase
                            .from('whatsapp_messages')
                            .update({ message: `🎤 ${textMessage}` })
                            .eq('id', db_message_id);
                    }
                }
            } catch (err: any) {
                console.error("[Generator] Transcription failed:", err);
                await supabase.from('system_logs').insert({
                    level: 'error',
                    category: 'generator_error',
                    message: `Transcription failed: ${err.message}`,
                    user_id: user_id,
                    details: { error: err }
                });
            }
        }

        // --- 2. FETCH HISTORY ---
        console.log(`[Generator] Fetching history for ${customer_phone}...`);
        const { data: rawHistory } = await supabase
            .from('whatsapp_messages')
            .select('role:direction, content:message')
            .eq('user_id', user_id)
            .eq('phone', customer_phone.split('@')[0])
            .order('created_at', { ascending: false })
            .limit(10);

        const history = (rawHistory || [])
            .map((m: any) => ({
                role: m.role === 'received' ? 'user' : 'assistant',
                content: m.content
            }))
            .reverse();

        // --- 2.5 ADD QUOTED CONTEXT (Omniscient Gabi) ---
        if (quoted_message) {
            console.log(`[Generator] Injecting quoted context: ${quoted_message.substring(0, 30)}...`);
            textMessage = `[Nota Contextual: O usuário está respondendo à mensagem: "${quoted_message}"]\n\n${textMessage}`;
        }

        // --- 3. CALL UNIFIED GABI BRAIN ---
        console.log(`[Generator] Calling unified gabi-brain for user ${user_id}`);
        const { data: brainData, error: brainError } = await supabase.functions.invoke('gabi-brain', {
            body: {
                message: textMessage,
                history: history,
                platform: 'whatsapp',
                is_boss: is_boss,
                customer_name: customer_name,
                customer_phone: customer_phone,
                user_id: user_id
            }
        });

        if (brainError) {
            console.error(`[Generator] Gabi-brain invocation failed:`, brainError);
            throw new Error(`Cérebro da Gabi indisponível: ${brainError.message}`);
        }

        const finalResponse = brainData.content || brainData.text || "Desculpe, tive um problema ao processar. Pode repetir? 😅";

        await supabase.from('system_logs').insert({
            level: 'info',
            category: 'generator_debug',
            message: `Brain responded for ${customer_phone}`,
            user_id: user_id,
            details: { response_preview: finalResponse.substring(0, 100) }
        });

        // --- 4. DELIVERY: Send back via Evolution API ---
        const { data: profile } = await supabase.from('profiles').select('whatsapp_api_url, whatsapp_api_key, whatsapp_instance_id').eq('id', user_id).single();

        if (profile?.whatsapp_api_url && profile?.whatsapp_api_key && profile?.whatsapp_instance_id) {
            const evolutionUrl = profile.whatsapp_api_url.replace(/\/$/, "");
            console.log(`[Generator] Delivering message to ${customer_phone} via ${profile.whatsapp_instance_id}...`);

            try {
                const sendRes = await fetch(`${evolutionUrl}/message/sendText/${profile.whatsapp_instance_id}`, {
                    method: 'POST',
                    headers: {
                        'apikey': profile.whatsapp_api_key,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        number: customer_phone,
                        text: finalResponse
                    })
                });

                if (!sendRes.ok) {
                    const errorText = await sendRes.text();
                    console.error(`[Generator] Evolution API send failed: ${sendRes.status} ${errorText}`);
                    await supabase.from('system_logs').insert({
                        level: 'error',
                        category: 'generator_error',
                        message: `Evolution API delivery failed: ${sendRes.status}`,
                        user_id: user_id,
                        details: { status: sendRes.status, error: errorText, instance: profile.whatsapp_instance_id }
                    });
                } else {
                    await supabase.from('system_logs').insert({
                        level: 'info',
                        category: 'generator_debug',
                        message: `Message delivered to ${customer_phone}`,
                        user_id: user_id,
                        details: { instance: profile.whatsapp_instance_id }
                    });
                }
            } catch (sendErr: any) {
                console.error("[Generator] Delivery error:", sendErr);
                await supabase.from('system_logs').insert({
                    level: 'error',
                    category: 'generator_error',
                    message: `Evolution API fetch error: ${sendErr.message}`,
                    user_id: user_id,
                    details: { error: sendErr }
                });
            }
        } else {
            console.warn("[Generator] Skipping delivery: WhatsApp API not configured for user", user_id);
        }

        // --- 5. Log Sent Message ---
        await supabase.from('whatsapp_messages').insert({
            user_id,
            phone: customer_phone.split('@')[0],
            message: finalResponse,
            direction: 'sent',
            analyzed: true,
            analysis_result: { source: 'gabi-brain-unified', version: '2.0' }
        });

        return new Response(JSON.stringify({ response: finalResponse }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("[Generator Fatal Error]", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
});
