
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_PRICES = {
    // Profissional DTF (R$ 59,90)
    'price_1SnPXqQ1NJXG7xxhCmM22cIR': true,
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { priceId, userId, email, returnUrl } = await req.json();

        if (!priceId || !userId) {
            throw new Error("Missing priceId or userId");
        }

        // SECURITY CHECK: Whitelist Validation
        // Hacker Prevention: Prevents users from sending their own $0.01 price ID
        if (!ALLOWED_PRICES[priceId]) {
            console.error(`🚨 ATTACK ATTEMPT: Invalid Price ID received: ${priceId} from User: ${userId}`);
            throw new Error("Invalid Price ID configured.");
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'payment',
            customer_creation: 'always',
            success_url: `${returnUrl}?success=true`,
            cancel_url: `${returnUrl}?canceled=true`,
            client_reference_id: userId,
            customer_email: email,
            metadata: {
                user_id: userId,
            }
        });

        return new Response(
            JSON.stringify({ url: session.url }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
