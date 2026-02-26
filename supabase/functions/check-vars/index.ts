import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
    const vars = {
        SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
        SUPERFRETE_MASTER_TOKEN: !!Deno.env.get('SUPERFRETE_MASTER_TOKEN'),
        FRENET_MASTER_TOKEN: !!Deno.env.get('FRENET_MASTER_TOKEN'),
        SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    };

    return new Response(JSON.stringify(vars), {
        headers: { 'Content-Type': 'application/json' },
    });
});
