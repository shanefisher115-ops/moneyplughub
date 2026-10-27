const fs = require('fs');
const LEDGER_FILE = 'swarm_ledger.json';

if (!fs.existsSync(LEDGER_FILE)) {
    console.log('[LEDGER] Ledger file not found.');
    process.exit(0);
}

try {
    const chain = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
    console.log(`[LEDGER] Total Blocks Anchored: ${chain.length}\n`);
    chain.forEach(block => {
        console.log(`Block #${block.index} [${block.senderId}]`);
        console.log(`  Timestamp: ${block.timestamp}`);
        console.log(`  Hash: ${block.hash}`);
        console.log(`  Prev: ${block.previousHash.substring(0, 16)}...`);
        console.log(`  Payload:`, block.payload);
        console.log('-'.repeat(50));
    });
} catch (err) {
    console.error('[LEDGER ERROR] Failed to parse ledger:', err.message);
}
