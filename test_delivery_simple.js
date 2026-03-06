
const EVOLUTION_URL = "https://evodirectai-evolution.ztq2ue.easypanel.host";
const API_KEY = "Gabriel7511@";
const TARGET_PHONE = "5521986243396"; // Gabriel boss

async function testSend(instanceRef) {
    try {
        const res = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceRef}`, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: TARGET_PHONE, text: `Teste ${instanceRef}` })
        });
        console.log(`RESULT: ${instanceRef} -> ${res.status}`);
    } catch (err) {
        console.log(`ERROR: ${instanceRef} -> ${err.message}`);
    }
}

async function run() {
    await testSend("directdtf812f");
    await testSend("32ffa2f6-4033-46c3-9866-0f3cb20027e7");
}
run();
