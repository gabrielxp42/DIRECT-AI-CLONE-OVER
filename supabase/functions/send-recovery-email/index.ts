import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { to, subject, htmlContent } = await req.json();

        // Validations
        if (!to || !subject || !htmlContent) {
            throw new Error('Faltam parâmetros obrigatórios: "to", "subject" ou "htmlContent"');
        }

        const resendApiKey = Deno.env.get('RESEND_API_KEY');

        if (!resendApiKey) {
            throw new Error('Serviço de email não configurado. Adicione RESEND_API_KEY aos secrets da Supabase.');
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: 'Direct AI <hello@direct-ai.pro>', // Update the sender domain if needed
                to: [to],
                subject: subject,
                html: htmlContent
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            console.error('Erro detalhado do Resend:', errorData);
            throw new Error(`Erro no Resend: ${errorData.message || JSON.stringify(errorData)}`);
        }

        const data = await res.json();

        return new Response(
            JSON.stringify({ success: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error: any) {
        console.error('Erro na Edge Function:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }
});
