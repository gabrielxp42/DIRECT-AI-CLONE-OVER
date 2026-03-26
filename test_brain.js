
const SUPABASE_URL = "https://myylkpoisqijfnptlnyk.supabase.co";

async function testBrain() {
    console.log("🚀 Testing gabi-brain (Public)...");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gabi-brain`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eWxrcG9pc3FpamZucHRsbnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MzQxNTIsImV4cCI6MjA3MjAxMDE1Mn0.me7aXILmeIHvjbkYWUVczOZt7gxrz8Rddv515Xa9ZTU'
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
