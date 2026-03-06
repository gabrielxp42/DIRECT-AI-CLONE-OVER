
const SUPABASE_URL = "https://zdbjzrpgliqicwvncfpc.supabase.co";

async function testBrain() {
    console.log("🚀 Testing gabi-brain-v2 (Public)...");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gabi-brain-v2`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: "Olá Gabi, teste de funcionamento público.",
            history: [],
            platform: 'whatsapp',
            is_boss: true,
            customer_name: "Gabriel Teste",
            customer_phone: "5521986243396",
            user_id: "812ffd76-8e94-4b4c-8198-527d85386679"
        })
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
}

testBrain();
