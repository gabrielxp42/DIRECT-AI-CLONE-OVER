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
            previous_history,
            is_boss
        } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

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
            } catch (err) {
                console.error("[Generator] Transcription failed:", err);
            }
        }

        // --- 2. FETCH HISTORY ---
        console.log(`[Generator] Fetching history for ${customer_phone}...`);
        const { data: rawHistory } = await supabase
            .from('whatsapp_messages')
            .select('role:direction, content:message')
            .eq('user_id', user_id)
            .eq('phone', customer_phone)
            .order('created_at', { ascending: false })
            .limit(10);

        const history = (rawHistory || [])
            .map((m: any) => ({
                role: m.role === 'received' ? 'user' : 'assistant',
                content: m.content
            }))
            .reverse();

        // --- 3. CALL UNIFIED GABI BRAIN ---
        // gabi-brain handles the ReAct logic and ALSO the WhatsApp message sending if platform is 'whatsapp'
        console.log(`[Generator] Calling unified gabi-brain for text: "${textMessage}" with ${history.length} history items`);
        const brainRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/gabi-brain`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${user_id}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: textMessage,
                history: history,
                platform: 'whatsapp',
                is_boss: is_boss,
                customer_name: customer_name,
                customer_phone: customer_phone,
                user_id: user_id
            })
        });

        if (!brainRes.ok) {
            const errorText = await brainRes.text();
            throw new Error(`Gabi-brain error: ${errorText}`);
        }

        const brainData = await brainRes.json();
        const finalResponse = brainData.content || brainData.text || "Desculpe, tive um problema ao processar. Pode repetir? 😅";

        // --- 3. Log Sent Message (gabi-brain already handled the delivery via Evolution API) ---
        await supabase.from('whatsapp_messages').insert({
            user_id,
            phone: customer_phone,
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
