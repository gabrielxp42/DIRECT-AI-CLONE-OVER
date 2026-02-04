const SUPABASE_URL = "https://zdbjzrpgliqicwvncfpc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkYmp6cnBnbGlxaWN3dm5jZnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2ODI3MzUsImV4cCI6MjA3MzI1ODczNX0.VOrT3YAVhCqkbSmV-POeb4sVTgmu756sivqT1_9vCr4";

async function run() {
    console.log("Checking webhook_logs...");
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/webhook_logs?select=*&order=created_at.desc&limit=5`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    if (!resp.ok) {
        console.error("Query failed:", await resp.text());
        return;
    }

    const data = await resp.json();
    console.log("RECENT LOGS:", JSON.stringify(data, null, 2));

    console.log("\nChecking PROFILES...");
    const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email,whatsapp_instance_id`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    const profiles = await resp2.json();
    console.log("PROFILES:", JSON.stringify(profiles, null, 2));
}

run().catch(console.error);
