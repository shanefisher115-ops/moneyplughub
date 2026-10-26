const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const QUEUE_FILE = path.join(__dirname, 'primordia_queue.json');
const LEDGER_FILE = path.join(__dirname, 'primordia_ledger.log');
const SPELLWRIGHT_REGISTRY = path.join(__dirname, 'primordia_spellwright_registry.json');

const SPELLWRIGHT_SIGILS = [
    { name: "SIGIL-OBSIDIAN-VAULT", domain: "BINDING", biome: "Subterranean Citadel", hex: "#0A0014", density: "Sparse", weight: 12.0, mult: 1.25 },
    { name: "SIGIL-CHRONO-LOCK", domain: "BINDING", biome: "Temporal Anchorage", hex: "#1A2F4C", density: "Dense", weight: 14.0, mult: 1.35 },
    { name: "SIGIL-VOID-NEXUS", domain: "UNRAVELING", biome: "Entropic Collapse Zone", hex: "#FF0033", density: "Sparse", weight: 18.5, mult: 1.50 },
    { name: "SIGIL-ENTROPY-SPIRE", domain: "UNRAVELING", biome: "Decaying Cyber Ruins", hex: "#4A0000", density: "Dense", weight: 21.0, mult: 1.60 },
    { name: "SIGIL-NEON-OASIS", domain: "AMPLIFICATION", biome: "Cyberpunk Metropolis", hex: "#FF00FF", density: "Infinite", weight: 24.0, mult: 2.00 },
    { name: "SIGIL-AETHER-SPIRE", domain: "AMPLIFICATION", biome: "Floating Crystalline Spires", hex: "#00FFCC", density: "Dense", weight: 26.0, mult: 2.20 },
    { name: "SIGIL-GOTHIC-CATHEDRAL", domain: "MANIFESTATION", biome: "Obsidian Gothic Temple", hex: "#9900CC", density: "Infinite", weight: 29.5, mult: 3.00 },
    { name: "SIGIL-SOLARIS-CROWN", domain: "MANIFESTATION", biome: "Radiant Solar Throne", hex: "#FF6600", density: "Infinite", weight: 32.0, mult: 3.50 }
];

console.log(`\n🔮 [Primordia-Spellwright] Initializing Master Codex... Scribing ${SPELLWRIGHT_SIGILS.length} Realm Sigils...\n`);

let queue = fs.existsSync(QUEUE_FILE) ? JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')) : [];
let registry = [];

SPELLWRIGHT_SIGILS.forEach((s) => {
    const hash = crypto.createHash('sha256').update(s.name + s.biome).digest('hex').substring(0, 12).toUpperCase();
    const refLink = `https://moneyplughub.com/ref/${hash}`;

    registry.push({
        sigil: s.name,
        hash: hash,
        domain: s.domain,
        biome: s.biome,
        lighting: s.hex,
        density: s.density,
        referralUrl: refLink,
        multiplier: s.mult
    });

    queue.push({
        task: `[SPELLWRIGHT_MANIFEST] (${s.domain}) ${s.name} -> Biome: ${s.biome}`,
        complexity: s.weight
    });

    const timestamp = new Date().toISOString();
    fs.appendFileSync(LEDGER_FILE, `[${timestamp}] SPELLWRIGHT_COMPILE: SIGIL=${s.name} | REALM=${s.biome} | REF=${refLink}\n`, 'utf8');
    console.log(`✨ Scribed & Queued: ${s.name} [${s.biome}] (Weight: ${s.weight})`);
});

fs.writeFileSync(SPELLWRIGHT_REGISTRY, JSON.stringify(registry, null, 2));
fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

console.log(`\n📥 [Primordia-Spellwright Sealed] Master registry compiled and injected into PrimordiaOS daemon.\n`);