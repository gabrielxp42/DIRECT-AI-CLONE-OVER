import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
    const envKeys = {
        SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
        SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        EVOLUTION_API_URL: !!Deno.env.get('EVOLUTION_API_URL'),
        EVOLUTION_API_KEY: !!Deno.env.get('EVOLUTION_API_KEY'),
        OPENAI_API_KEY2: !!Deno.env.get('OPENAI_API_KEY2'),
        GABI_BRAIN_URL: !!Deno.env.get('GABI_BRAIN_URL')
    };

    return new Response(JSON.stringify({
        message: "Environment variable check",
        keys: envKeys,
        supabase_url_value: Deno.env.get('SUPABASE_URL') ? Deno.env.get('SUPABASE_URL')?.substring(0, 15) + "..." : "MISSING"
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
});
