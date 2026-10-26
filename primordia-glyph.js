const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const QUEUE_FILE = path.join(__dirname, 'primordia_queue.json');
const LEDGER_FILE = path.join(__dirname, 'primordia_ledger.log');
const AFFILIATE_REGISTRY = path.join(__dirname, 'moneyplug_sigils.json');
const REALM_MANIFEST = path.join(__dirname, 'primordia_realm_manifest.json');

// Map glyphic intent domains to compute weight, economic yield, and Unreal realm specs
const GLYPH_DOMAINS = {
    "BINDING": { 
        baseWeight: 12.0, tier: "CORE_NODE", multiplier: 1.25, 
        biome: "Obsidian Citadel", lighting: "#1A0033", density: "High", soundscape: "Deep Resonance" 
    },
    "UNRAVELING": { 
        baseWeight: 18.5, tier: "PURGE_ROUTER", multiplier: 1.50, 
        biome: "Void Nexus", lighting: "#330000", density: "Sparse", soundscape: "Ethereal Drone" 
    },
    "AMPLIFICATION": { 
        baseWeight: 24.0, tier: "HIGH_YIELD_SURGE", multiplier: 2.00, 
        biome: "Neon Gothic Spire", lighting: "#9900CC", density: "Dense", soundscape: "Cybernetic Pulse" 
    },
    "MANIFESTATION": { 
        baseWeight: 29.5, tier: "SOVEREIGN_GATEWAY", multiplier: 3.00, 
        biome: "Celestial Hyper-Grid", lighting: "#00FFFF", density: "Infinite", soundscape: "Harmonic Choir" 
    }
};

const args = process.argv.slice(2);
const domainKey = (args[0] || "AMPLIFICATION").toUpperCase();
const sigilName = args[1] || "SIGIL-OMEGA-777";
const customIntent = args[2] || "Sovereign Realm Genesis";

const domain = GLYPH_DOMAINS[domainKey] || GLYPH_DOMAINS["AMPLIFICATION"];

// Cryptographic hash for affiliation and realm ID
const sigilHash = crypto.createHash('sha256').update(sigilName + customIntent).digest('hex').substring(0, 12).toUpperCase();
const referralLink = `https://moneyplughub.com/ref/${sigilHash}`;

console.log(`\n🔮 [Primordia Omni-Engine] Scribing Universal Sigil...`);
console.log(`✨ Domain      : ${domainKey} (${domain.tier})`);
console.log(`👁️ Sigil Name  : ${sigilName}`);
console.log(`📜 Intent      : "${customIntent}"`);
console.log(`🌍 Unreal Realm: Biome [${domain.biome}] | Lighting [${domain.lighting}] | Density [${domain.density}]`);
console.log(`🔗 Ref Link    : ${referralLink}`);
console.log(`💰 Multiplier  : ${domain.multiplier}x | Compute Weight: ${domain.baseWeight}\n`);

// 1. Save to Affiliate Registry
let registry = [];
if (fs.existsSync(AFFILIATE_REGISTRY)) {
    try { registry = JSON.parse(fs.readFileSync(AFFILIATE_REGISTRY, 'utf8')); } catch (e) { registry = []; }
}
registry.push({ sigil: sigilName, hash: sigilHash, domain: domainKey, intent: customIntent, referralUrl: referralLink, timestamp: new Date().toISOString() });
fs.writeFileSync(AFFILIATE_REGISTRY, JSON.stringify(registry, null, 2));

// 2. Output Unreal Realm Manifest (Ingestible by UE Python/JSON parsers)
const realmBlueprint = {
    realm_id: sigilHash,
    sigil_name: sigilName,
    domain: domainKey,
    intent: customIntent,
    environment: {
        biome_style: domain.biome,
        global_illumination_hex: domain.lighting,
        asset_density: domain.density,
        audio_profile: domain.soundscape
    },
    economic_node: referralLink,
    compiled_at: new Date().toISOString()
};
fs.writeFileSync(REALM_MANIFEST, JSON.stringify(realmBlueprint, null, 2));

// 3. Push Compute Task to Daemon Queue
let queue = [];
if (fs.existsSync(QUEUE_FILE)) {
    try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch (e) { queue = []; }
}
queue.push({
    task: `[REALM_GENESIS] (${domainKey}) ${sigilName} -> Realm: ${domain.biome}`,
    complexity: domain.baseWeight
});
fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

// 4. Immutable Ledger Entry
const logLine = `[${realmBlueprint.compiled_at}] OMNI_CAST: DOMAIN=${domainKey} | SIGIL=${sigilName} | REALM=${domain.biome} | REF=${referralLink}\n`;
fs.appendFileSync(LEDGER_FILE, logLine, 'utf8');

console.log(`📥 [Sigil Manifested] Compute queued, affiliate link bound, and Unreal realm manifest written to disk.`);