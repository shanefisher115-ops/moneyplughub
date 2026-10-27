const fs = require('fs');

async function sendTelemetry() {
    if (!fs.existsSync('signed_telemetry.json')) {
        console.error('[ERROR] signed_telemetry.json not found. Run your signing pipeline first.');
        process.exit(1);
    }

    const signedPackage = JSON.parse(fs.readFileSync('signed_telemetry.json', 'utf8'));

    console.log('[CLIENT] Broadcasting signed telemetry proof to webhook receiver...');

    try {
        const response = await fetch('http://localhost:3000/webhook/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signedPackage)
        });

        const result = await response.json();
        console.log(`[CLIENT] Receiver Response (${response.status}):`, result);
    } catch (err) {
        console.error('[CLIENT] Failed to connect to receiver. Ensure server.js is running:', err.message);
    }
}

sendTelemetry();