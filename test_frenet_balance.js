
const token = "2ED36750R6C96R4182R9057R481466AC5C42";
const userEmail = "dtfagudos@gmail.com";

async function runTest() {
    // Probing CASE SENSITIVITY
    const variants = [
        "https://api.frenet.com.br/v1/Customer/Wallet",
        "https://api.frenet.com.br/v1/customer/Wallet",
        "https://api.frenet.com.br/v1/Customer/wallet",
        "https://api.frenet.com.br/v1/wallet"
    ];

    const userAgent = `DIRECT-AI-GB-1 (v1.0.0; ${userEmail})`;
    const headers = {
        'token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': userAgent
    };

    for (const url of variants) {
        console.log(`\n--- Testing ${url} ---`);
        try {
            const response = await fetch(url, { headers });
            const text = await response.text();
            console.log(`Status: ${response.status}`);
            if (response.status === 200) {
                console.log(`SUCCESS! Response:`, text.substring(0, 500));
            }
        } catch (e) {
            console.log(`Error:`, e.message);
        }
    }
}

runTest();
