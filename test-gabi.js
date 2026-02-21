
async function testGabi() {
    console.log("🚀 Iniciando teste de simulação com a Gabi...");

    // Usando as chaves que encontrei no seu ambiente
    const SUPABASE_URL = "https://zdbjzrpgliqicwvncfpc.supabase.co";
    // Nota: Em um ambiente real eu pegaria isso de envvars, aqui estou simulando o fluxo

    const payload = {
        message: "Localize o cliente Gabriel e prepare uma mensagem dizendo que estou com saudades dele",
        user_id: "b25ecaff-c6ce-48aa-ad15-57f038053950" // ID vinculado aos Gabriels no banco
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gabi-brain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("📝 Resposta da Gabi recebida.");
        const fs = require('fs');
        fs.writeFileSync('test-result.json', JSON.stringify(data, null, 2), 'utf8');
        console.log("💾 Resultado salvo em test-result.json");

        if (data.result && data.result.includes("whatsapp_action")) {
            console.log("\n✅ SUCESSO: Gabi encontrou o cliente e preparou a ação de WhatsApp!");
        } else {
            console.log("\n⚠️ AVISO: A Gabi ainda não retornou a ação esperada.");
        }
    } catch (error) {
        console.error("❌ Erro ao chamar a Gabi:", error.message);
    }
}

testGabi();
