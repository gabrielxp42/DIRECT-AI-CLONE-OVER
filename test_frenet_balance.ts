
const token = "56DCF50FR85ECR47D6R8402RDB5BFFAC96C2";
// Note: If partner token is needed, we'll try with and without
const partnerToken = "";

async function testBalance() {
    const url = "https://api.frenet.com.br/v1/wallet";
    const headers: Record<string, string> = {
        'token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (partnerToken) {
        headers['x-partner-token'] = partnerToken;
    }

    console.log(`Testing Frenet Balance...`);
    console.log(`URL: ${url}`);
    console.log(`Headers:`, JSON.stringify(headers, null, 2));

    try {
        const response = await fetch(url, { headers });
        const result = await response.json();

        console.log(`Status: ${response.status}`);
        console.log(`Raw Result:`, JSON.stringify(result, null, 2));

        if (result.AvailableAmount !== undefined) {
            console.log(`--- SUMMARY ---`);
            console.log(`Amount: ${result.Amount}`);
            console.log(`AvailableAmount: ${result.AvailableAmount}`);
        } else {
            console.log(`Field 'AvailableAmount' not found in response.`);
        }

    } catch (err) {
        console.error(`Error fetching balance:`, err);
    }
}

testBalance();
