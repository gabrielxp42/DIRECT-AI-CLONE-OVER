
const SUPABASE_URL = "https://zdbjzrpgliqicwvncfpc.supabase.co";

async function testGenerator() {
    console.log("🚀 Testing ai-response-generator (Public)...");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-response-generator`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: "812ffd76-8e94-4b4c-8198-527d85386679",
            customer_phone: "5521986243396@s.whatsapp.net",
            message: "Olá Gabi, teste pelo generator.",
            is_boss: true,
            customer_name: "Gabriel Teste Gen",
            platform: 'whatsapp'
        })
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
}

testGenerator();
