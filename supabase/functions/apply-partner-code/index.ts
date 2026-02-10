import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Hello from apply-partner-code!")

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 1. Parse Request Body
        const { code } = await req.json()

        // 2. Get User from Auth Header
        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            throw new Error('Usuário não autenticado')
        }

        // 3. Validate Code
        const normalizedCode = code?.toUpperCase()?.trim()

        // Universal code
        const isUniversal = normalizedCode === 'DTFAGUDOS'

        let isValid = isUniversal

        if (!isValid) {
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )
            const { data: affiliate } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('affiliate_code', normalizedCode)
                .eq('is_affiliate', true)
                .single()

            if (affiliate) {
                isValid = true
            }
        }

        if (!isValid) {
            return new Response(
                JSON.stringify({ success: false, error: 'Código inválido ou expirado.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // 4. Update Profile with Admin Privileges (Service Role)
        // We use a new client with Service Role key to bypass RLS if necessary, 
        // though the initial client has the user's context which usually allows updating their own profile if RLS permits.
        // Using service role ensures it works regardless of specific RLS on 'partner_code' column.
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                partner_code: normalizedCode
                // is_whatsapp_plus_active e is_whatsapp_plus_gifted removidos - agora o código vale 15% de desconto no checkout
            })
            .eq('id', user.id)

        if (updateError) {
            console.error('Update Error:', updateError);
            throw new Error('Erro ao aplicar o código na conta.');
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Código aplicado com sucesso! 15% de desconto ativado para sua assinatura.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('Function Error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
