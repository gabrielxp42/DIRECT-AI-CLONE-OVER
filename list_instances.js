
const EVOLUTION_URL = "https://evodirectai-evolution.ztq2ue.easypanel.host";
const API_KEY = "Gabriel7511@";
import fs from 'fs';

async function checkDirect() {
    console.log("🚀 Checking directdtf812f...");
    try {
        const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
            method: 'GET',
            headers: {
                'apikey': API_KEY
            }
        });

        const data = await res.json();
        const target = data.find(i => i.instanceName === 'directdtf812f' || i.name === 'directdtf812f');

        if (target) {
            console.log("✅ Found directdtf812f!");
            console.log("Details:", JSON.stringify(target, null, 2));
            fs.writeFileSync('direct_instance_details.json', JSON.stringify(target, null, 2));
        } else {
            console.log("❌ directdtf812f NOT FOUND specifically in list.");
            // Print all names found
            console.log("Names found:", data.map(i => i.name || i.instanceName || i.instance_name).join(', '));
        }

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkDirect();
