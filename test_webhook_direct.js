
const WEBHOOK_URL = "https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/whatsapp-webhook";

async function test() {
    console.log("🚀 Sending Real Boss Test to webhook...");
    const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            event_type: 'MESSAGES_UPSERT',
            instance: 'directdtf812f',
            data: {
                messageType: 'conversation',
                key: { fromMe: false, remoteJid: '5521986243396@s.whatsapp.net', id: 'REAL_TEST_' + Date.now() },
                message: { conversation: 'Olá Gabi, responda se estiver me ouvindo!' },
                pushName: 'Gabriel Boss'
            }
        })
    });

    console.log("Response Status:", resp.status);
    console.log("Response Body:", await resp.text());
}

test().catch(console.error);
