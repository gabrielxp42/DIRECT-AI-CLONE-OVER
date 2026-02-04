const WEBHOOK_URL = "https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/whatsapp-webhook";

async function test() {
    console.log("Sending manual test to webhook...");
    const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            event_type: 'MESSAGES_UPSERT',
            instance: 'minha_empresa',
            data: {
                messageType: 'conversation',
                key: { fromMe: false, remoteJid: '5511999999999@s.whatsapp.net', id: 'TEST_ID' },
                message: { conversation: 'TESTE MANUAL' },
                pushName: 'Tester'
            }
        })
    });

    console.log("Response Status:", resp.status);
    console.log("Response Body:", await resp.text());
}

test().catch(console.error);
