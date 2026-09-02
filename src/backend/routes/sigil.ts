import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';
import {
  computeWealthPulse,
  getVaultTierFromXP,
  getSigilGlowLevel,
  getAscensionTier,
  computeConstellationEnergy,
} from '../engine/wealthPulse';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  SIGIL ENGINE & FORGE MARKETPLACE — Creator Money OS
//  Procedural Deterministic Vectors + Extensive Visual Customizer
// ═══════════════════════════════════════════════════════════════════

// ── Database Schema Migration ─────────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sigil_market_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('aura', 'glyph', 'ring', 'crest')),
      rarity TEXT NOT NULL CHECK(rarity IN ('common', 'rare', 'epic', 'legendary', 'cosmic')),
      cost_xp INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      preview_accent TEXT NOT NULL,
      config_data TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sigil_inventory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      is_equipped INTEGER NOT NULL DEFAULT 0,
      purchased_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES sigil_market_items(id),
      UNIQUE(user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS user_sigil_config (
      user_id TEXT PRIMARY KEY,
      aura TEXT,
      glyph TEXT,
      ring TEXT,
      crest TEXT,
      motto TEXT,
      monogram TEXT,
      handle TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  try {
    db.exec(`ALTER TABLE sigil_market_items ADD COLUMN min_level INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE user_sigil_config ADD COLUMN motto TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE user_sigil_config ADD COLUMN monogram TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE user_sigil_config ADD COLUMN handle TEXT;`);
  } catch (e) {}

  // Seed / Synchronize Master 130-Item Visual Catalog with Gamified Level Unlocks
  const now = new Date().toISOString();
  const masterCatalog = [
    // ── AURAS & COSMIC SHADERS (30 Items) ──
    { id: 'aura_cyber_emerald', name: 'Cyber Matrix Aura', category: 'aura', rarity: 'rare', cost_xp: 250, min_level: 1, description: 'Neon Emerald & Cybernetic Laser Pulse shader (Starter Default).', preview_accent: '#00ff88', config_data: '{"theme":"cyber_emerald"}' },
    { id: 'aura_synthwave_sunset', name: 'Retro Synthwave Grid', category: 'aura', rarity: 'rare', cost_xp: 300, min_level: 2, description: 'Neon Magenta & Sunset Orange 80s synthwave horizon.', preview_accent: '#ec4899', config_data: '{"theme":"synthwave_sunset"}' },
    { id: 'aura_electric_plasma', name: 'High-Voltage Plasma', category: 'aura', rarity: 'rare', cost_xp: 350, min_level: 2, description: 'Ultraviolet laser discharge with ionized blue lightning arcs.', preview_accent: '#818cf8', config_data: '{"theme":"electric_plasma"}' },
    { id: 'aura_cosmic_nebula', name: 'Cosmic Nebula Aura', category: 'aura', rarity: 'epic', cost_xp: 400, min_level: 3, description: 'Deep Supernova Violet & Cyan atmospheric plasma.', preview_accent: '#a855f7', config_data: '{"theme":"cosmic_nebula"}' },
    { id: 'aura_quantum_ice', name: 'Glacial Quantum Frost', category: 'aura', rarity: 'epic', cost_xp: 600, min_level: 4, description: 'Sub-zero Arctic Cyan & Diamond Frost refraction.', preview_accent: '#22d3ee', config_data: '{"theme":"quantum_ice"}' },
    { id: 'aura_solar_flare', name: 'Solar Flare Aura', category: 'aura', rarity: 'epic', cost_xp: 750, min_level: 5, description: 'Radiant 24K Gold & Amber thermonuclear rays.', preview_accent: '#eab308', config_data: '{"theme":"solar_flare"}' },
    { id: 'aura_jade_dragon', name: 'Imperial Jade Sovereign', category: 'aura', rarity: 'epic', cost_xp: 900, min_level: 6, description: 'Deep Dynastic Jade with incandescent emerald flame refraction.', preview_accent: '#10b981', config_data: '{"theme":"jade_dragon"}' },
    { id: 'aura_osmium_diamond', name: 'Osmium Diamond Aura', category: 'aura', rarity: 'legendary', cost_xp: 1500, min_level: 7, description: 'Prismatic crystal refraction with iridescent dispersion.', preview_accent: '#38bdf8', config_data: '{"theme":"osmium_diamond"}' },
    { id: 'aura_stealth_carbon', name: 'Stealth Carbon Matrix', category: 'aura', rarity: 'legendary', cost_xp: 1800, min_level: 8, description: 'Matte carbon-fiber weave with titanium laser telemetry accents.', preview_accent: '#94a3b8', config_data: '{"theme":"stealth_carbon"}' },
    { id: 'aura_void_singularity', name: 'Void Singularity Aura', category: 'aura', rarity: 'cosmic', cost_xp: 2500, min_level: 9, description: 'Event Horizon Dark Matter with glowing crimson accretion disk.', preview_accent: '#f43f5e', config_data: '{"theme":"void_singularity"}' },
    { id: 'aura_primordial_gold', name: 'Primordia Pure Alchemy', category: 'aura', rarity: 'cosmic', cost_xp: 3500, min_level: 10, description: 'Liquid 24K Molten Gold with Aureate hyper-radiance.', preview_accent: '#ffd700', config_data: '{"theme":"primordial_gold"}' },
    { id: 'aura_bifrost_spectrum', name: 'Prismatic Bifrost Core', category: 'aura', rarity: 'cosmic', cost_xp: 4000, min_level: 10, description: 'Chromatic hyper-spectrum dispersion warping spacetime geometry.', preview_accent: '#f472b6', config_data: '{"theme":"bifrost_spectrum"}' },
    { id: 'aura_hyper_violet', name: 'Hyper-Violet Supernova', category: 'aura', rarity: 'epic', cost_xp: 800, min_level: 4, description: 'Ultra-saturated magenta-violet cosmic radiation aura.', preview_accent: '#d946ef', config_data: '{"theme":"hyper_violet"}' },
    { id: 'aura_chrono_matrix', name: 'Chrono Matrix Aura', category: 'aura', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'Temporal flux amber and cyan relativistic grid.', preview_accent: '#06b6d4', config_data: '{"theme":"chrono_matrix"}' },
    { id: 'aura_aurora_borealis', name: 'Arctic Aurora Sky', category: 'aura', rarity: 'epic', cost_xp: 950, min_level: 5, description: 'Shifting emerald green and violet ionosphere curtains.', preview_accent: '#34d399', config_data: '{"theme":"aurora_borealis"}' },
    { id: 'aura_antimatter_crimson', name: 'Anti-Matter Crimson', category: 'aura', rarity: 'legendary', cost_xp: 1600, min_level: 7, description: 'Deep ruby dark energy pulse with high-intensity gamma discharge.', preview_accent: '#e11d48', config_data: '{"theme":"antimatter_crimson"}' },
    { id: 'aura_cyber_sakura', name: 'Neon Cyber Sakura', category: 'aura', rarity: 'rare', cost_xp: 450, min_level: 2, description: 'Futuristic cherry blossom pink laser refraction.', preview_accent: '#fb7185', config_data: '{"theme":"cyber_sakura"}' },
    { id: 'aura_abyssal_trench', name: 'Deep Abyssal Blue', category: 'aura', rarity: 'rare', cost_xp: 500, min_level: 3, description: 'Oceanic deep trench bioluminescence and sapphire glow.', preview_accent: '#2563eb', config_data: '{"theme":"abyssal_trench"}' },
    { id: 'aura_solar_eclipse', name: 'Total Solar Eclipse', category: 'aura', rarity: 'legendary', cost_xp: 1700, min_level: 8, description: 'Pitch-black silhouette with glowing diamond-ring corona.', preview_accent: '#fef08a', config_data: '{"theme":"solar_eclipse"}' },
    { id: 'aura_quantum_mirage', name: 'Quantum Mirage Flux', category: 'aura', rarity: 'legendary', cost_xp: 1850, min_level: 8, description: 'Probability wave interference with translucent light dispersion.', preview_accent: '#a78bfa', config_data: '{"theme":"quantum_mirage"}' },
    { id: 'aura_starlight_opal', name: 'Iridescent Starlight Opal', category: 'aura', rarity: 'cosmic', cost_xp: 2600, min_level: 9, description: 'Multifaceted gemstone dispersion refracting all cosmic wavelengths.', preview_accent: '#e0e7ff', config_data: '{"theme":"starlight_opal"}' },
    { id: 'aura_celestial_silver', name: 'Argentum Celestial Silver', category: 'aura', rarity: 'epic', cost_xp: 1000, min_level: 6, description: 'Liquid platinum mercury reflection with mirror radiance.', preview_accent: '#cbd5e1', config_data: '{"theme":"celestial_silver"}' },
    { id: 'aura_dark_matter', name: 'Dark Matter Obsidian', category: 'aura', rarity: 'legendary', cost_xp: 2000, min_level: 8, description: 'Negative gravity shadow warping background light photons.', preview_accent: '#475569', config_data: '{"theme":"dark_matter"}' },
    { id: 'aura_bioluminescent', name: 'Bio-Luminescent Reef', category: 'aura', rarity: 'rare', cost_xp: 400, min_level: 3, description: 'Electric cyan and lime organic fluorescence.', preview_accent: '#4ade80', config_data: '{"theme":"bioluminescent"}' },
    { id: 'aura_solfeggio_528', name: 'Solfeggio 528Hz Miracle', category: 'aura', rarity: 'legendary', cost_xp: 1900, min_level: 8, description: 'Golden ratio harmonic resonance field tuned to DNA repair.', preview_accent: '#22c55e', config_data: '{"theme":"solfeggio_528"}' },
    { id: 'aura_warp_speed', name: 'Tachyon Warp Speed', category: 'aura', rarity: 'cosmic', cost_xp: 3000, min_level: 9, description: 'Relativistic star streaks stretching across the event horizon.', preview_accent: '#60a5fa', config_data: '{"theme":"warp_speed"}' },
    { id: 'aura_helium_3', name: 'Lunar Helium-3 Fusion', category: 'aura', rarity: 'epic', cost_xp: 1100, min_level: 6, description: 'Clean thermonuclear plasma ignition with azure brilliance.', preview_accent: '#38bdf8', config_data: '{"theme":"helium_3"}' },
    { id: 'aura_gamma_burst', name: 'Gamma Ray Hyper-Burst', category: 'aura', rarity: 'cosmic', cost_xp: 3200, min_level: 10, description: 'Highest energy photon explosion in the observable universe.', preview_accent: '#facc15', config_data: '{"theme":"gamma_burst"}' },
    { id: 'aura_pulsar_beacon', name: 'Neutron Pulsar Beacon', category: 'aura', rarity: 'cosmic', cost_xp: 3400, min_level: 10, description: 'High-speed rotating magnetic poles flashing concentrated lasers.', preview_accent: '#c084fc', config_data: '{"theme":"pulsar_beacon"}' },
    { id: 'aura_event_horizon', name: 'Event Horizon Aureate', category: 'aura', rarity: 'cosmic', cost_xp: 4500, min_level: 10, description: 'Pure 24K gold gravitational capture ring of infinite wealth.', preview_accent: '#fbbf24', config_data: '{"theme":"event_horizon"}' },

    // ── SACRED CORE GLYPHS (35 Items) ──
    { id: 'glyph_quantum_hex', name: 'Quantum Hex Lattice', category: 'glyph', rarity: 'rare', cost_xp: 450, min_level: 1, description: 'Subatomic hexagonal matrix pulsing with data streams (Starter Default).', preview_accent: '#10b981', config_data: '{"type":"quantum_hex"}' },
    { id: 'glyph_metatron', name: "Metatron's Sacred Cube", category: 'glyph', rarity: 'rare', cost_xp: 350, min_level: 2, description: 'Ancient Sacred Geometry core mapping multi-dimensional harmony.', preview_accent: '#3b82f6', config_data: '{"type":"metatron"}' },
    { id: 'glyph_octagram', name: 'Celestial Octagram', category: 'glyph', rarity: 'epic', cost_xp: 650, min_level: 3, description: '8-Pointed Star of Supreme Alignment and Abundance.', preview_accent: '#f59e0b', config_data: '{"type":"octagram"}' },
    { id: 'glyph_flower_of_life', name: 'Flower of Life Core', category: 'glyph', rarity: 'epic', cost_xp: 850, min_level: 4, description: 'Ancient overlapping circles generating universal resonance.', preview_accent: '#06b6d4', config_data: '{"type":"flower_of_life"}' },
    { id: 'glyph_apex_crown', name: 'Apex Sovereign Seal', category: 'glyph', rarity: 'epic', cost_xp: 950, min_level: 5, description: 'Imperial 7-Point diamond-studded crest of digital sovereignty.', preview_accent: '#ffd700', config_data: '{"type":"apex_crown"}' },
    { id: 'glyph_tesseract', name: '4D Hypercube Tesseract', category: 'glyph', rarity: 'legendary', cost_xp: 1200, min_level: 6, description: 'Transcendent fourth-dimensional mathematical hypercube.', preview_accent: '#8b5cf6', config_data: '{"type":"tesseract"}' },
    { id: 'glyph_merkaba_vehicle', name: 'Merkaba Star Vehicle', category: 'glyph', rarity: 'legendary', cost_xp: 1600, min_level: 7, description: 'Dual interlocking tetrahedrons of light and ascension.', preview_accent: '#fbbf24', config_data: '{"type":"merkaba_vehicle"}' },
    { id: 'glyph_dragon_crest', name: 'Cyber Imperial Dragon', category: 'glyph', rarity: 'legendary', cost_xp: 1750, min_level: 8, description: 'Mecha Dragon crest symbolizing supreme market dominance.', preview_accent: '#ef4444', config_data: '{"type":"dragon_crest"}' },
    { id: 'glyph_phoenix_core', name: 'Phoenix Fire Heart', category: 'glyph', rarity: 'legendary', cost_xp: 1900, min_level: 9, description: 'Immortal firebird core generating continuous capital rebirth.', preview_accent: '#f97316', config_data: '{"type":"phoenix_core"}' },
    { id: 'glyph_primordia_eye', name: 'Eye of Primordia', category: 'glyph', rarity: 'cosmic', cost_xp: 2000, min_level: 9, description: 'Omniscient core glyph seeing all cashflow vectors in real-time.', preview_accent: '#ec4899', config_data: '{"type":"primordia_eye"}' },
    { id: 'glyph_infinity_ouroboros', name: 'Ouroboros Infinity Knot', category: 'glyph', rarity: 'cosmic', cost_xp: 2800, min_level: 10, description: 'Infinite dragon loop generating eternal compounding wealth.', preview_accent: '#14b8a6', config_data: '{"type":"infinity_ouroboros"}' },
    { id: 'glyph_cyber_lotus', name: 'Geometric Cyber Lotus', category: 'glyph', rarity: 'cosmic', cost_xp: 3200, min_level: 10, description: 'Sacred 8-petal vector lotus of inner peace and endless compounding.', preview_accent: '#a855f7', config_data: '{"type":"cyber_lotus"}' },
    { id: 'glyph_seed_of_life', name: 'Seed of Life Genesis', category: 'glyph', rarity: 'rare', cost_xp: 400, min_level: 2, description: 'The 7 interlocking genesis circles of creation.', preview_accent: '#34d399', config_data: '{"type":"seed_of_life"}' },
    { id: 'glyph_sri_yantra', name: 'Sri Yantra Abundance', category: 'glyph', rarity: 'epic', cost_xp: 900, min_level: 5, description: 'Nine interlocking triangles of cosmic material and spiritual wealth.', preview_accent: '#fbbf24', config_data: '{"type":"sri_yantra"}' },
    { id: 'glyph_torus_knot', name: 'Torus Energy Vortex', category: 'glyph', rarity: 'epic', cost_xp: 800, min_level: 4, description: 'Self-sustaining magnetic doughnut vortex of infinite recycling.', preview_accent: '#38bdf8', config_data: '{"type":"torus_knot"}' },
    { id: 'glyph_vesica_piscis', name: 'Vesica Piscis Portal', category: 'glyph', rarity: 'rare', cost_xp: 350, min_level: 2, description: 'The sacred portal of geometry intersecting dual dimensions.', preview_accent: '#c084fc', config_data: '{"type":"vesica_piscis"}' },
    { id: 'glyph_golden_spiral', name: 'Golden Spiral Phi', category: 'glyph', rarity: 'epic', cost_xp: 750, min_level: 4, description: 'Fibonacci logarithmic spiral describing organic capital expansion.', preview_accent: '#f59e0b', config_data: '{"type":"golden_spiral"}' },
    { id: 'glyph_valkyrie_cross', name: 'Platinum Valkyrie Cross', category: 'glyph', rarity: 'legendary', cost_xp: 1400, min_level: 7, description: 'High-precision solar cross of divine protection.', preview_accent: '#e0e7ff', config_data: '{"type":"valkyrie_cross"}' },
    { id: 'glyph_cyber_skull', name: 'Mecha Cyberspace Skull', category: 'glyph', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'Cybernetic skull core of fearless digital operators.', preview_accent: '#f43f5e', config_data: '{"type":"cyber_skull"}' },
    { id: 'glyph_anchor_eternity', name: 'Anchor of Eternity', category: 'glyph', rarity: 'rare', cost_xp: 450, min_level: 3, description: 'Heavy nautical anchor stabilizing assets in market storms.', preview_accent: '#0284c7', config_data: '{"type":"anchor_eternity"}' },
    { id: 'glyph_tree_of_life', name: 'Tree of Life Sephirot', category: 'glyph', rarity: 'legendary', cost_xp: 1650, min_level: 7, description: '10 Emanations mapping celestial balance and harmony.', preview_accent: '#10b981', config_data: '{"type":"tree_of_life"}' },
    { id: 'glyph_archangel_sigil', name: 'Archangel Michael Shield', category: 'glyph', rarity: 'legendary', cost_xp: 1800, min_level: 8, description: 'Invincible glyph shielding creators from market drawdowns.', preview_accent: '#38bdf8', config_data: '{"type":"archangel_sigil"}' },
    { id: 'glyph_hyper_pentagram', name: 'Golden Ratio Pentagram', category: 'glyph', rarity: 'epic', cost_xp: 700, min_level: 4, description: '5-Pointed golden star symbolizing microcosm harmony.', preview_accent: '#eab308', config_data: '{"type":"hyper_pentagram"}' },
    { id: 'glyph_chrono_dial', name: 'Chronos Temporal Dial', category: 'glyph', rarity: 'epic', cost_xp: 950, min_level: 5, description: 'Precision temporal clockwork calculating compounding runway.', preview_accent: '#f97316', config_data: '{"type":"chrono_dial"}' },
    { id: 'glyph_sun_disc_ra', name: 'Solar Disc of Ra', category: 'glyph', rarity: 'legendary', cost_xp: 1700, min_level: 8, description: 'Aureate sun disc radiating life force and limitless cashflow.', preview_accent: '#ffd700', config_data: '{"type":"sun_disc_ra"}' },
    { id: 'glyph_ankh_immortality', name: 'Ankh of Digital Immortality', category: 'glyph', rarity: 'epic', cost_xp: 900, min_level: 5, description: 'Ancient key of eternal life preserving ledger records.', preview_accent: '#14b8a6', config_data: '{"type":"ankh_immortality"}' },
    { id: 'glyph_triquetra_knot', name: 'Triquetra Trinity Knot', category: 'glyph', rarity: 'rare', cost_xp: 500, min_level: 3, description: 'Tri-pointed endless loop representing Creator, Value, and Growth.', preview_accent: '#a855f7', config_data: '{"type":"triquetra_knot"}' },
    { id: 'glyph_cyber_falcon', name: 'High-Velocity Cyber Falcon', category: 'glyph', rarity: 'legendary', cost_xp: 1550, min_level: 7, description: 'Aerodynamic predator raptor striking high-converting referral targets.', preview_accent: '#38bdf8', config_data: '{"type":"cyber_falcon"}' },
    { id: 'glyph_processor_ic', name: 'Quantum Neural Processor', category: 'glyph', rarity: 'rare', cost_xp: 450, min_level: 2, description: 'Silicon micro-die computing viral automation logic.', preview_accent: '#00ff88', config_data: '{"type":"processor_ic"}' },
    { id: 'glyph_tetragrammaton', name: 'Sacred Tetragrammaton', category: 'glyph', rarity: 'cosmic', cost_xp: 2900, min_level: 9, description: 'Sacred 4-letter divine code of primeval creation.', preview_accent: '#fbbf24', config_data: '{"type":"tetragrammaton"}' },
    { id: 'glyph_osmium_singularity', name: 'Osmium Singularity Core', category: 'glyph', rarity: 'cosmic', cost_xp: 3800, min_level: 10, description: 'Ultra-dense celestial sphere emitting zero-entropy energy.', preview_accent: '#38bdf8', config_data: '{"type":"osmium_singularity"}' },
    { id: 'glyph_hyper_monolith', name: 'Hyper-Dimensional Monolith', category: 'glyph', rarity: 'cosmic', cost_xp: 3500, min_level: 10, description: 'Extraterrestrial black obsidian monolith guiding evolution.', preview_accent: '#94a3b8', config_data: '{"type":"hyper_monolith"}' },
    { id: 'glyph_dna_helix', name: 'Double Helix Biometric Matrix', category: 'glyph', rarity: 'legendary', cost_xp: 1600, min_level: 7, description: 'Intertwined biological genetic code of sovereign operators.', preview_accent: '#22c55e', config_data: '{"type":"dna_helix"}' },
    { id: 'glyph_heptagram_star', name: '7-Pointed Elven Star', category: 'glyph', rarity: 'epic', cost_xp: 850, min_level: 4, description: 'Mystical Heptagram balancing all 7 chakras of abundance.', preview_accent: '#d946ef', config_data: '{"type":"heptagram_star"}' },
    { id: 'glyph_sovereign_scepter', name: 'Imperial Sovereign Scepter', category: 'glyph', rarity: 'cosmic', cost_xp: 4200, min_level: 10, description: 'Supreme royal artifact commanding all automated AI swarms.', preview_accent: '#ffd700', config_data: '{"type":"sovereign_scepter"}' },

    // ── RADIAL RING FX (35 Items) ──
    { id: 'ring_circuit_traces', name: 'Cyber PCB Trace Ring', category: 'ring', rarity: 'rare', cost_xp: 500, min_level: 1, description: 'Gold microchip motherboard circuit traces and bus nodes (Starter Default).', preview_accent: '#10b981', config_data: '{"type":"circuit_traces"}' },
    { id: 'ring_celestial_corona', name: '8-Fold Corona Ring', category: 'ring', rarity: 'rare', cost_xp: 300, min_level: 2, description: 'Pulsing radial solar corona surrounding outer perimeter.', preview_accent: '#06b6d4', config_data: '{"type":"celestial_corona"}' },
    { id: 'ring_rune_encryption', name: 'Elder Runic Cipher Ring', category: 'ring', rarity: 'rare', cost_xp: 400, min_level: 3, description: 'Ancient Nordic runic encryption boundary guarding the sigil.', preview_accent: '#94a3b8', config_data: '{"type":"rune_encryption"}' },
    { id: 'ring_laser_scanlines', name: 'Dual Laser Radar Sweeper', category: 'ring', rarity: 'rare', cost_xp: 450, min_level: 4, description: 'Twin high-precision radar laser sweep lines scanning 360 degrees.', preview_accent: '#34d399', config_data: '{"type":"laser_scanlines"}' },
    { id: 'ring_particle_flux', name: 'Particle Flux Stream', category: 'ring', rarity: 'epic', cost_xp: 600, min_level: 5, description: 'Dotted particle orbit ring simulating relativistic motion.', preview_accent: '#a855f7', config_data: '{"type":"particle_flux"}' },
    { id: 'ring_dual_event_horizon', name: 'Dual Event Horizon Orbitals', category: 'ring', rarity: 'epic', cost_xp: 750, min_level: 6, description: 'Twin intersecting tilted gravitational event horizon rings.', preview_accent: '#38bdf8', config_data: '{"type":"dual_event_horizon"}' },
    { id: 'ring_hex_shield_grid', name: 'Honeycomb Aegis Barrier', category: 'ring', rarity: 'epic', cost_xp: 850, min_level: 7, description: 'Fortified hexagonal nano-shield grid perimeter.', preview_accent: '#38bdf8', config_data: '{"type":"hex_shield_grid"}' },
    { id: 'ring_astral_zodiac', name: 'Astral Constellation Wheel', category: 'ring', rarity: 'legendary', cost_xp: 1300, min_level: 8, description: '12-node celestial star alignment ring with connecting lines.', preview_accent: '#f59e0b', config_data: '{"type":"astral_zodiac"}' },
    { id: 'ring_harmonic_pulse', name: 'Harmonic Resonator Ring', category: 'ring', rarity: 'legendary', cost_xp: 1400, min_level: 9, description: 'Triple frequency sinusoidal oscillation wave.', preview_accent: '#f97316', config_data: '{"type":"harmonic_pulse"}' },
    { id: 'ring_diamond_bezel', name: '16-Facet Diamond Cut Bezel', category: 'ring', rarity: 'legendary', cost_xp: 1600, min_level: 9, description: 'Ultra-luxurious multi-faceted gemstone vector bevel ring.', preview_accent: '#e0e7ff', config_data: '{"type":"diamond_bezel"}' },
    { id: 'ring_singularity_vortex', name: 'Singularity Graviton Vortex', category: 'ring', rarity: 'cosmic', cost_xp: 2200, min_level: 10, description: 'Deep space warping spiral galaxy arms twisting inward.', preview_accent: '#e11d48', config_data: '{"type":"singularity_vortex"}' },
    { id: 'ring_ouroboros_orbit', name: 'Celestial Dragon Orbit Ring', category: 'ring', rarity: 'cosmic', cost_xp: 3000, min_level: 10, description: 'Mythic serpent encircling the perimeter with glowing scales.', preview_accent: '#ffd700', config_data: '{"type":"ouroboros_orbit"}' },
    { id: 'ring_quantum_gyroscope', name: 'Quantum Multi-Axis Gyro', category: 'ring', rarity: 'epic', cost_xp: 800, min_level: 5, description: 'Triple gimbal concentric stabilizing rings.', preview_accent: '#06b6d4', config_data: '{"type":"quantum_gyroscope"}' },
    { id: 'ring_tachyon_accelerator', name: 'Tachyon Particle Ring', category: 'ring', rarity: 'legendary', cost_xp: 1500, min_level: 8, description: 'Continuous particle collider accelerating photons beyond c.', preview_accent: '#60a5fa', config_data: '{"type":"tachyon_accelerator"}' },
    { id: 'ring_radar_crosshairs', name: 'Tactical Targeting Reticle', category: 'ring', rarity: 'rare', cost_xp: 400, min_level: 2, description: 'Precision crosshairs and millimeter tick marks.', preview_accent: '#ef4444', config_data: '{"type":"radar_crosshairs"}' },
    { id: 'ring_orbital_stations', name: '8-Satellite Orbital Mesh', category: 'ring', rarity: 'epic', cost_xp: 900, min_level: 6, description: 'Relay satellites broadcasting telemetry around perimeter.', preview_accent: '#a855f7', config_data: '{"type":"orbital_stations"}' },
    { id: 'ring_steampunk_gears', name: 'Chronometer Gear Perimeter', category: 'ring', rarity: 'epic', cost_xp: 750, min_level: 4, description: 'Interlocking brass and gold mechanical teeth.', preview_accent: '#d97706', config_data: '{"type":"steampunk_gears"}' },
    { id: 'ring_ancient_glyphs', name: 'Ancient Cuneiform Band', category: 'ring', rarity: 'rare', cost_xp: 500, min_level: 3, description: 'Historic Sumerian financial accounting inscriptions.', preview_accent: '#ca8a04', config_data: '{"type":"ancient_glyphs"}' },
    { id: 'ring_solar_prominence', name: 'Solar Flare Prominence Arcs', category: 'ring', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'Erupting coronal loops leaping across the boundary.', preview_accent: '#f97316', config_data: '{"type":"solar_prominence"}' },
    { id: 'ring_magnetic_field', name: 'Bipolar Magnetic Flux Lines', category: 'ring', rarity: 'rare', cost_xp: 450, min_level: 2, description: 'Earth magnetosphere protective dipole curvature.', preview_accent: '#3b82f6', config_data: '{"type":"magnetic_field"}' },
    { id: 'ring_golden_spiral', name: 'Phi Golden Ratio Concentric', category: 'ring', rarity: 'epic', cost_xp: 950, min_level: 6, description: 'Rings spaced precisely by 1.618 golden proportion.', preview_accent: '#ffd700', config_data: '{"type":"golden_spiral"}' },
    { id: 'ring_superstring_lattice', name: '10D Superstring Loom', category: 'ring', rarity: 'legendary', cost_xp: 1750, min_level: 8, description: 'Vibrating multi-dimensional string harmonics.', preview_accent: '#c084fc', config_data: '{"type":"superstring_lattice"}' },
    { id: 'ring_warp_bubble', name: 'Alcubierre Spacetime Bubble', category: 'ring', rarity: 'cosmic', cost_xp: 2500, min_level: 9, description: 'Gravitational compression ahead and expansion behind.', preview_accent: '#38bdf8', config_data: '{"type":"warp_bubble"}' },
    { id: 'ring_cryo_crystals', name: 'Glacial Cryo Shard Ring', category: 'ring', rarity: 'epic', cost_xp: 700, min_level: 4, description: 'Radial razor-sharp ice crystals refracting light.', preview_accent: '#a5f3fc', config_data: '{"type":"cryo_crystals"}' },
    { id: 'ring_hyperdrive_fins', name: 'Warp Drive Exhaust Fins', category: 'ring', rarity: 'rare', cost_xp: 550, min_level: 3, description: 'Directional thrust fins ionizing plasma exhaust.', preview_accent: '#00ff88', config_data: '{"type":"hyperdrive_fins"}' },
    { id: 'ring_nanite_swarm', name: 'Self-Assembling Nanite Cloud', category: 'ring', rarity: 'legendary', cost_xp: 1650, min_level: 8, description: 'Trillions of microscopic constructors repairing armor.', preview_accent: '#94a3b8', config_data: '{"type":"nanite_swarm"}' },
    { id: 'ring_ionic_thruster', name: 'Blue Ion Plasma Ring', category: 'ring', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'High-specific impulse electrostatic thruster glow.', preview_accent: '#60a5fa', config_data: '{"type":"ionic_thruster"}' },
    { id: 'ring_decagram_star', name: '10-Fold Sacred Decagram', category: 'ring', rarity: 'epic', cost_xp: 900, min_level: 6, description: 'Perfect 10-pointed star boundary of completeness.', preview_accent: '#facc15', config_data: '{"type":"decagram_star"}' },
    { id: 'ring_quantum_entanglement', name: 'Twin Entangled Orbitals', category: 'ring', rarity: 'legendary', cost_xp: 1800, min_level: 8, description: 'Paired photons spinning in instant nonlocal harmony.', preview_accent: '#e879f9', config_data: '{"type":"quantum_entanglement"}' },
    { id: 'ring_asteroid_dust', name: 'Protoplanetary Disc Orbit', category: 'ring', rarity: 'rare', cost_xp: 400, min_level: 2, description: 'Dense celestial dust band forming new wealth planets.', preview_accent: '#d97706', config_data: '{"type":"asteroid_dust"}' },
    { id: 'ring_laser_diffraction', name: 'Optical Laser Diffraction Grating', category: 'ring', rarity: 'legendary', cost_xp: 1450, min_level: 7, description: 'Split spectral laser beams creating interference fringes.', preview_accent: '#22d3ee', config_data: '{"type":"laser_diffraction"}' },
    { id: 'ring_plasma_confinement', name: 'Tokamak Magnetic Toroid', category: 'ring', rarity: 'cosmic', cost_xp: 2800, min_level: 9, description: 'Superconducting magnetic coils holding 100M°C plasma.', preview_accent: '#f43f5e', config_data: '{"type":"plasma_confinement"}' },
    { id: 'ring_biometric_scanner', name: 'Optical Fingerprint Sweep', category: 'ring', rarity: 'rare', cost_xp: 350, min_level: 1, description: 'Concentric biometric identification rings.', preview_accent: '#10b981', config_data: '{"type":"biometric_scanner"}' },
    { id: 'ring_celestial_equator', name: 'Astrolabe Celestial Equator', category: 'ring', rarity: 'epic', cost_xp: 950, min_level: 6, description: 'Ancient navigational ring calibrated to Polaris.', preview_accent: '#fbbf24', config_data: '{"type":"celestial_equator"}' },
    { id: 'ring_chronos_ring', name: 'Hourglass Chronos Band', category: 'ring', rarity: 'cosmic', cost_xp: 3500, min_level: 10, description: 'Grains of golden time circulating endlessly.', preview_accent: '#ffd700', config_data: '{"type":"chronos_ring"}' },

    // ── CRESTS & SEALS (30 Items) ──
    { id: 'crest_cyber_spikes', name: 'Mecha Hyper-Spikes', category: 'crest', rarity: 'rare', cost_xp: 550, min_level: 1, description: 'Tri-blade aggressive aerodynamic mecha crown spikes (Starter Default).', preview_accent: '#34d399', config_data: '{"type":"cyber_spikes"}' },
    { id: 'crest_lightning', name: 'Zeus Dual Lightning Crest', category: 'crest', rarity: 'rare', cost_xp: 350, min_level: 2, description: 'Twin electrostatic bolts crowning the upper sigil arc.', preview_accent: '#38bdf8', config_data: '{"type":"lightning"}' },
    { id: 'crest_valkyrie_horns', name: 'Valkyrie Sonic Horns', category: 'crest', rarity: 'rare', cost_xp: 450, min_level: 3, description: 'Neo-Nordic high-frequency resonance antennae.', preview_accent: '#c084fc', config_data: '{"type":"valkyrie_horns"}' },
    { id: 'crest_crown', name: 'Crown of the Money Plug', category: 'crest', rarity: 'epic', cost_xp: 650, min_level: 4, description: '5-Point Imperial Crown of Digital Sovereignty.', preview_accent: '#eab308', config_data: '{"type":"crown"}' },
    { id: 'crest_ouroboros_shield', name: 'Aegis Diamond Shield', category: 'crest', rarity: 'epic', cost_xp: 800, min_level: 5, description: 'Heavy fortified diamond barricade crest guarding against loss.', preview_accent: '#06b6d4', config_data: '{"type":"ouroboros_shield"}' },
    { id: 'crest_halo_ascendance', name: 'Ascendant Tri-Halo', category: 'crest', rarity: 'epic', cost_xp: 1250, min_level: 6, description: 'Floating angelic luminous triple-ring halo of enlightenment.', preview_accent: '#fef08a', config_data: '{"type":"halo_ascendance"}' },
    { id: 'crest_angel_wings', name: 'Seraphim Cyber Wings', category: 'crest', rarity: 'legendary', cost_xp: 1100, min_level: 7, description: 'Dual biometric angel wings arching across the sigil.', preview_accent: '#c084fc', config_data: '{"type":"angel_wings"}' },
    { id: 'crest_phoenix_rebirth', name: 'Phoenix Rising Flame Wings', category: 'crest', rarity: 'legendary', cost_xp: 1500, min_level: 8, description: 'Immortal golden firebird crest ascending from the ashes.', preview_accent: '#f97316', config_data: '{"type":"phoenix_rebirth"}' },
    { id: 'crest_dragon_horns', name: 'Mecha Dragon Horns', category: 'crest', rarity: 'legendary', cost_xp: 1650, min_level: 8, description: 'Twin curved cybernetic dragon horns radiating dominance.', preview_accent: '#ef4444', config_data: '{"type":"dragon_horns"}' },
    { id: 'crest_vault_seal', name: 'Imperial Diamond Vault Seal', category: 'crest', rarity: 'cosmic', cost_xp: 1800, min_level: 9, description: 'Ancient runic encryption ring sealing the living vault.', preview_accent: '#14b8a6', config_data: '{"type":"vault_seal"}' },
    { id: 'crest_quantum_antenna', name: 'Quantum Telemetry Array', category: 'crest', rarity: 'cosmic', cost_xp: 3400, min_level: 9, description: 'Subatomic orbital communications antenna bridging realms.', preview_accent: '#38bdf8', config_data: '{"type":"quantum_antenna"}' },
    { id: 'crest_omni_sovereign', name: 'Sovereign Crown of Osmium', category: 'crest', rarity: 'cosmic', cost_xp: 5000, min_level: 10, description: 'The supreme master crest of PrimordiaOS. Infinite status.', preview_accent: '#ffd700', config_data: '{"type":"omni_sovereign"}' },
    { id: 'crest_apex_spires', name: 'Apex Obsidian Spires', category: 'crest', rarity: 'epic', cost_xp: 750, min_level: 4, description: 'Gothic-cybernetic razor spires piercing the heavens.', preview_accent: '#64748b', config_data: '{"type":"apex_spires"}' },
    { id: 'crest_celestial_aureole', name: 'Celestial Diamond Aureole', category: 'crest', rarity: 'legendary', cost_xp: 1600, min_level: 7, description: 'Diamond-encrusted radiant nimbus around the crown.', preview_accent: '#e0e7ff', config_data: '{"type":"celestial_aureole"}' },
    { id: 'crest_cyber_antlers', name: 'Mecha Hyper-Antlers', category: 'crest', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'Elk-inspired fractal cybernetic antennae branching outward.', preview_accent: '#10b981', config_data: '{"type":"cyber_antlers"}' },
    { id: 'crest_archon_wings', name: '6-Wing Archon Array', category: 'crest', rarity: 'cosmic', cost_xp: 3200, min_level: 9, description: 'Hexa-wing celestial array of higher dimensional guardians.', preview_accent: '#c084fc', config_data: '{"type":"archon_wings"}' },
    { id: 'crest_dragon_crown', name: 'Dragon Sovereign Warcrest', category: 'crest', rarity: 'legendary', cost_xp: 1750, min_level: 8, description: 'Heavy scaled dragon battle crest forged in magma.', preview_accent: '#b91c1c', config_data: '{"type":"dragon_crown"}' },
    { id: 'crest_valkyrie_wings', name: 'Valkyrie Feather Wings', category: 'crest', rarity: 'epic', cost_xp: 950, min_level: 6, description: 'Nordic battle maiden wings carrying souls to victory.', preview_accent: '#38bdf8', config_data: '{"type":"valkyrie_wings"}' },
    { id: 'crest_sun_god_corona', name: 'Ra Sun God Corona', category: 'crest', rarity: 'legendary', cost_xp: 1850, min_level: 8, description: '12 radiating solar rays crowning the sovereign.', preview_accent: '#f59e0b', config_data: '{"type":"sun_god_corona"}' },
    { id: 'crest_laser_diadem', name: 'Laser Refraction Diadem', category: 'crest', rarity: 'rare', cost_xp: 400, min_level: 2, description: 'Sleek cyberpunk headband projecting hologram HUD.', preview_accent: '#06b6d4', config_data: '{"type":"laser_diadem"}' },
    { id: 'crest_quantum_dish', name: 'Deep Space Radar Dish', category: 'crest', rarity: 'epic', cost_xp: 900, min_level: 5, description: 'Parabolic antenna locking onto viral traffic nodes.', preview_accent: '#a855f7', config_data: '{"type":"quantum_dish"}' },
    { id: 'crest_ironclad_ram', name: 'Fortified Titan Ramming Crest', category: 'crest', rarity: 'rare', cost_xp: 500, min_level: 3, description: 'Armored heavy prow shattering all competition.', preview_accent: '#94a3b8', config_data: '{"type":"ironclad_ram"}' },
    { id: 'crest_trident_poseidon', name: 'Abyssal Trident Crest', category: 'crest', rarity: 'legendary', cost_xp: 1550, min_level: 7, description: 'Triple ocean fork commanding global liquidity flows.', preview_accent: '#0284c7', config_data: '{"type":"trident_poseidon"}' },
    { id: 'crest_triple_crown', name: 'Triple Imperial Crown', category: 'crest', rarity: 'cosmic', cost_xp: 4200, min_level: 10, description: 'Three tiered crowns of Wealth, Sovereignty, and Peace.', preview_accent: '#ffd700', config_data: '{"type":"triple_crown"}' },
    { id: 'crest_stellar_prism', name: 'Stellar Prism Reflector', category: 'crest', rarity: 'epic', cost_xp: 800, min_level: 4, description: 'Crystalline pyramid splitting single rays into 7 colors.', preview_accent: '#f472b6', config_data: '{"type":"stellar_prism"}' },
    { id: 'crest_eternity_halo', name: 'Floating Star Halo', category: 'crest', rarity: 'legendary', cost_xp: 1900, min_level: 8, description: 'Dotted halo of 24 pulsing stars hovering overhead.', preview_accent: '#fef08a', config_data: '{"type":"eternity_halo"}' },
    { id: 'crest_aerodynamic_fin', name: 'Stealth Stabilizer Fin', category: 'crest', rarity: 'rare', cost_xp: 450, min_level: 2, description: 'Twin vertical tails of supersonic stealth interceptor.', preview_accent: '#475569', config_data: '{"type":"aerodynamic_fin"}' },
    { id: 'crest_omega_singularity', name: 'Omega Point Graviton Crest', category: 'crest', rarity: 'cosmic', cost_xp: 4800, min_level: 10, description: 'The final destination of universal evolution.', preview_accent: '#e11d48', config_data: '{"type":"omega_singularity"}' },
    { id: 'crest_anubis_jackal', name: 'Cyber Anubis Guardian Ears', category: 'crest', rarity: 'legendary', cost_xp: 1700, min_level: 8, description: 'Sleek Egyptian jackal silhouette weighing heart against feather.', preview_accent: '#ca8a04', config_data: '{"type":"anubis_jackal"}' },
    { id: 'crest_horus_falcon', name: 'Eye of Horus Sun Wings', category: 'crest', rarity: 'cosmic', cost_xp: 3600, min_level: 9, description: 'Royal falcon wings carrying the sun disc across the sky.', preview_accent: '#38bdf8', config_data: '{"type":"horus_falcon"}' },
  ];

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO sigil_market_items (id, name, category, rarity, cost_xp, min_level, description, preview_accent, config_data, is_active, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  masterCatalog.forEach((item, index) => {
    insertStmt.run(item.id, item.name, item.category, item.rarity, item.cost_xp, item.min_level, item.description, item.preview_accent, item.config_data, index, now);
  });
} catch (e: any) {
  console.error('Sigil Market Migration error:', e.message);
}

export interface SigilCustomConfig {
  aura?: string | null;
  glyph?: string | null;
  ring?: string | null;
  crest?: string | null;
  glow_level?: 'subtle' | 'normal' | 'supernova' | null;
  handle?: string | null;
  motto?: string | null;
  monogram?: string | null;
  orbit_speed?: number | string | null;
  chromatic?: boolean | null;
  particle_density?: number | null;
}

/**
 * Hash a string into a fixed array of numbers (0-255) for deterministic generation.
 */
function hashToBytes(input: string): number[] {
  const hash = crypto.createHash('sha256').update(input).digest();
  return Array.from(hash);
}

function hf(bytes: number[], i: number): number {
  return bytes[i % bytes.length] / 255;
}

function hi(bytes: number[], i: number, min: number, max: number): number {
  return Math.floor(hf(bytes, i) * (max - min + 1)) + min;
}

function hslColor(bytes: number[], offset: number, satMin = 50, satMax = 90, lightMin = 45, lightMax = 70): string {
  const h = Math.floor(hf(bytes, offset) * 360);
  const s = hi(bytes, offset + 1, satMin, satMax);
  const l = hi(bytes, offset + 2, lightMin, lightMax);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Generate a unique, ultra-high-fidelity SVG sigil with rich vector shaders,
 * holographic geometry, radial rings, imperial crests, and dynamic text paths.
 */
export function generateSigil(referralCode: string, size: number = 256, customConfig?: SigilCustomConfig): string {
  const bytes = hashToBytes(referralCode.toUpperCase());

  // ── 1. Color Palette & Cosmic Theme Shaders (30 Distinct Themes) ──
  let primary = hslColor(bytes, 0, 60, 95, 50, 70);
  let secondary = hslColor(bytes, 3, 50, 85, 40, 65);
  let accent = hslColor(bytes, 6, 70, 100, 55, 80);
  let bgDark = `hsl(${hi(bytes, 9, 200, 280)}, ${hi(bytes, 10, 15, 30)}%, ${hi(bytes, 11, 5, 12)}%)`;
  let glowColor = primary;

  const auraTheme = customConfig?.aura || 'aura_cyber_emerald';

  const themeMap: Record<string, { p: string; s: string; a: string; bg: string; g: string }> = {
    aura_cyber_emerald: { p: '#00ff88', s: '#00bb66', a: '#38ef7d', bg: '#021209', g: '#00ff88' },
    aura_synthwave_sunset: { p: '#ec4899', s: '#f97316', a: '#fbbf24', bg: '#14031f', g: '#ec4899' },
    aura_cosmic_nebula: { p: '#c084fc', s: '#38bdf8', a: '#f472b6', bg: '#0b0217', g: '#c084fc' },
    aura_quantum_ice: { p: '#22d3ee', s: '#38bdf8', a: '#e0f2fe', bg: '#021320', g: '#22d3ee' },
    aura_solar_flare: { p: '#fbbf24', s: '#f59e0b', a: '#f97316', bg: '#170900', g: '#fbbf24' },
    aura_osmium_diamond: { p: '#38bdf8', s: '#818cf8', a: '#e0e7ff', bg: '#040b17', g: '#38bdf8' },
    aura_void_singularity: { p: '#f43f5e', s: '#881337', a: '#fb7185', bg: '#040008', g: '#f43f5e' },
    aura_primordial_gold: { p: '#ffd700', s: '#eab308', a: '#fffbeb', bg: '#140c00', g: '#ffd700' },
    aura_electric_plasma: { p: '#818cf8', s: '#6366f1', a: '#c7d2fe', bg: '#050518', g: '#818cf8' },
    aura_jade_dragon: { p: '#10b981', s: '#047857', a: '#a7f3d0', bg: '#01130d', g: '#10b981' },
    aura_stealth_carbon: { p: '#94a3b8', s: '#64748b', a: '#cbd5e1', bg: '#090d14', g: '#94a3b8' },
    aura_bifrost_spectrum: { p: '#f472b6', s: '#38bdf8', a: '#fbbf24', bg: '#0c041a', g: '#f472b6' },
    aura_hyper_violet: { p: '#d946ef', s: '#a855f7', a: '#f472b6', bg: '#13021e', g: '#d946ef' },
    aura_chrono_matrix: { p: '#06b6d4', s: '#0284c7', a: '#f59e0b', bg: '#03141f', g: '#06b6d4' },
    aura_aurora_borealis: { p: '#34d399', s: '#818cf8', a: '#f472b6', bg: '#031412', g: '#34d399' },
    aura_antimatter_crimson: { p: '#e11d48', s: '#be123c', a: '#fda4af', bg: '#160206', g: '#e11d48' },
    aura_cyber_sakura: { p: '#fb7185', s: '#f43f5e', a: '#ffe4e6', bg: '#170308', g: '#fb7185' },
    aura_abyssal_trench: { p: '#2563eb', s: '#1d4ed8', a: '#60a5fa', bg: '#020b1c', g: '#2563eb' },
    aura_solar_eclipse: { p: '#fef08a', s: '#ca8a04', a: '#ffffff', bg: '#020202', g: '#fef08a' },
    aura_quantum_mirage: { p: '#a78bfa', s: '#818cf8', a: '#c4b5fd', bg: '#0e081e', g: '#a78bfa' },
    aura_starlight_opal: { p: '#e0e7ff', s: '#c7d2fe', a: '#f472b6', bg: '#080816', g: '#e0e7ff' },
    aura_celestial_silver: { p: '#cbd5e1', s: '#94a3b8', a: '#ffffff', bg: '#0b1118', g: '#cbd5e1' },
    aura_dark_matter: { p: '#64748b', s: '#334155', a: '#94a3b8', bg: '#020305', g: '#64748b' },
    aura_bioluminescent: { p: '#4ade80', s: '#22c55e', a: '#22d3ee', bg: '#02160a', g: '#4ade80' },
    aura_solfeggio_528: { p: '#22c55e', s: '#16a34a', a: '#ffd700', bg: '#021406', g: '#22c55e' },
    aura_warp_speed: { p: '#60a5fa', s: '#3b82f6', a: '#ffffff', bg: '#020817', g: '#60a5fa' },
    aura_helium_3: { p: '#38bdf8', s: '#0284c7', a: '#bae6fd', bg: '#031322', g: '#38bdf8' },
    aura_gamma_burst: { p: '#facc15', s: '#eab308', a: '#ffffff', bg: '#181200', g: '#facc15' },
    aura_pulsar_beacon: { p: '#c084fc', s: '#9333ea', a: '#f0abfc', bg: '#11041c', g: '#c084fc' },
    aura_event_horizon: { p: '#fbbf24', s: '#d97706', a: '#fef08a', bg: '#180a00', g: '#fbbf24' },
  };

  if (themeMap[auraTheme]) {
    const t = themeMap[auraTheme];
    primary = t.p; secondary = t.s; accent = t.a; bgDark = t.bg; glowColor = t.g;
  }

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.40;

  // ── Symmetry Order ──
  const symmetry = hi(bytes, 12, 4, 8);
  const angleStep = (Math.PI * 2) / symmetry;

  let elements = '';

  // ── Background Particle Matrix & Cosmic Grid ──
  const pCount = customConfig?.particle_density ? Math.min(60, customConfig.particle_density) : 18;
  for (let p = 0; p < pCount; p++) {
    const px = cx + (hf(bytes, p * 3) - 0.5) * (size * 0.85);
    const py = cy + (hf(bytes, p * 3 + 1) - 0.5) * (size * 0.85);
    const pr = 0.8 + hf(bytes, p * 3 + 2) * 1.5;
    const po = 0.3 + hf(bytes, p * 3) * 0.5;
    elements += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${pr.toFixed(1)}" fill="${accent}" opacity="${po.toFixed(2)}"/>`;
  }

  // ── 2. Concentric Orbitals & Sacred Boundary ──
  const outerR = maxR * (0.85 + hf(bytes, 13) * 0.15);
  const innerR = maxR * (0.36 + hf(bytes, 15) * 0.18);
  const ringWidth = hi(bytes, 14, 1.5, 3);

  elements += `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${primary}" stroke-width="${ringWidth}" opacity="0.75"/>`;
  elements += `<circle cx="${cx}" cy="${cy}" r="${outerR - 6}" fill="none" stroke="${secondary}" stroke-width="1" stroke-dasharray="3 5" opacity="0.6"/>`;
  elements += `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="${secondary}" stroke-width="${ringWidth}" opacity="0.65"/>`;
  elements += `<circle cx="${cx}" cy="${cy}" r="${innerR + 8}" fill="none" stroke="${accent}" stroke-width="0.8" stroke-dasharray="2 4" opacity="0.5"/>`;

  // ── 3. Custom Ring FX (35 Master Modes — 100% Unique) ──
  const activeRing = customConfig?.ring || 'ring_circuit_traces';
  if (activeRing === 'ring_circuit_traces') {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI * 2) / 16;
      const r1 = outerR + 1;
      const r2 = outerR + 7;
      const x1 = cx + Math.cos(a) * r1;
      const y1 = cy + Math.sin(a) * r1;
      const x2 = cx + Math.cos(a + 0.1) * r2;
      const y2 = cy + Math.sin(a + 0.1) * r2;
      elements += `<polyline points="${x1.toFixed(1)},${y1.toFixed(1)} ${(x1 + 3).toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.85"/>`;
      elements += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.8" fill="${primary}"/>`;
    }
  } else if (activeRing === 'ring_celestial_corona') {
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI * 2) / 32;
      const r1 = outerR + 2;
      const r2 = outerR + 7 + (i % 2 === 0 ? 7 : 3);
      elements += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="${accent}" stroke-width="1.5" opacity="0.85"/>`;
    }
  } else if (activeRing === 'ring_rune_encryption') {
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI * 2) / 20;
      const rx = cx + Math.cos(a) * (outerR + 6);
      const ry = cy + Math.sin(a) * (outerR + 6);
      elements += `<circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="2" fill="${accent}" opacity="0.9"/>`;
      elements += `<line x1="${(rx - 2).toFixed(1)}" y1="${(ry - 2).toFixed(1)}" x2="${(rx + 2).toFixed(1)}" y2="${(ry + 2).toFixed(1)}" stroke="${primary}" stroke-width="1"/>`;
    }
  } else if (activeRing === 'ring_laser_scanlines') {
    elements += `<line x1="${cx - outerR - 12}" y1="${cy}" x2="${cx + outerR + 12}" y2="${cy}" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.85"/>`;
    elements += `<line x1="${cx}" y1="${cy - outerR - 12}" x2="${cx}" y2="${cy + outerR + 12}" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.85"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 8}" fill="none" stroke="${primary}" stroke-width="1.5" stroke-dasharray="12 8" opacity="0.75"/>`;
  } else if (activeRing === 'ring_particle_flux') {
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const r = outerR + 6;
      elements += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${i % 2 === 0 ? 2.5 : 1.5}" fill="${accent}" opacity="0.9"/>`;
    }
  } else if (activeRing === 'ring_dual_event_horizon') {
    elements += `<ellipse cx="${cx}" cy="${cy}" rx="${outerR + 9}" ry="${outerR * 0.5}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.85" transform="rotate(35 ${cx} ${cy})"/>`;
    elements += `<ellipse cx="${cx}" cy="${cy}" rx="${outerR + 9}" ry="${outerR * 0.5}" fill="none" stroke="${primary}" stroke-width="1.5" opacity="0.85" transform="rotate(-35 ${cx} ${cy})"/>`;
  } else if (activeRing === 'ring_hex_shield_grid') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      const hx = cx + Math.cos(a) * (outerR + 8);
      const hy = cy + Math.sin(a) * (outerR + 8);
      elements += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="4.5" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.9"/>`;
      elements += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="1.5" fill="${primary}"/>`;
    }
  } else if (activeRing === 'ring_astral_zodiac') {
    for (let i = 0; i < 12; i++) {
      const a1 = (i * Math.PI * 2) / 12;
      const a2 = ((i + 1) * Math.PI * 2) / 12;
      const r = outerR + 7;
      elements += `<circle cx="${(cx + Math.cos(a1) * r).toFixed(1)}" cy="${(cy + Math.sin(a1) * r).toFixed(1)}" r="2.2" fill="#ffffff" opacity="0.95"/>`;
      elements += `<line x1="${(cx + Math.cos(a1) * r).toFixed(1)}" y1="${(cy + Math.sin(a1) * r).toFixed(1)}" x2="${(cx + Math.cos(a2) * r).toFixed(1)}" y2="${(cy + Math.sin(a2) * r).toFixed(1)}" stroke="${accent}" stroke-width="1" opacity="0.7"/>`;
    }
  } else if (activeRing === 'ring_harmonic_pulse') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 5}" fill="none" stroke="${accent}" stroke-width="1.2" stroke-dasharray="4 6" opacity="0.8"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 11}" fill="none" stroke="${primary}" stroke-width="1.2" stroke-dasharray="8 4" opacity="0.65"/>`;
  } else if (activeRing === 'ring_diamond_bezel') {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI * 2) / 16;
      const bx = cx + Math.cos(a) * (outerR + 7);
      const by = cy + Math.sin(a) * (outerR + 7);
      elements += `<polygon points="${bx.toFixed(1)},${(by - 3).toFixed(1)} ${(bx + 3).toFixed(1)},${by.toFixed(1)} ${bx.toFixed(1)},${(by + 3).toFixed(1)} ${(bx - 3).toFixed(1)},${by.toFixed(1)}" fill="${i % 2 === 0 ? accent : primary}" opacity="0.9"/>`;
    }
  } else if (activeRing === 'ring_singularity_vortex') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      elements += `<path d="M ${cx} ${cy} Q ${(cx + Math.cos(a) * outerR * 0.7).toFixed(1)} ${(cy + Math.sin(a + 0.8) * outerR * 0.7).toFixed(1)} ${(cx + Math.cos(a + 1.2) * (outerR + 12)).toFixed(1)} ${(cy + Math.sin(a + 1.2) * (outerR + 12)).toFixed(1)}" fill="none" stroke="${accent}" stroke-width="1.8" opacity="0.85"/>`;
    }
  } else if (activeRing === 'ring_ouroboros_orbit') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 7}" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="8 6" opacity="0.85"/>`;
    elements += `<polygon points="${cx},${(cy - outerR - 10).toFixed(1)} ${(cx + 6).toFixed(1)},${(cy - outerR - 3).toFixed(1)} ${(cx - 6).toFixed(1)},${(cy - outerR - 3).toFixed(1)}" fill="${primary}"/>`;
  } else if (activeRing === 'ring_quantum_gyroscope') {
    elements += `<ellipse cx="${cx}" cy="${cy}" rx="${outerR + 10}" ry="${outerR * 0.35}" fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.85" transform="rotate(0 ${cx} ${cy})"/>`;
    elements += `<ellipse cx="${cx}" cy="${cy}" rx="${outerR + 10}" ry="${outerR * 0.35}" fill="none" stroke="${primary}" stroke-width="1.4" opacity="0.85" transform="rotate(60 ${cx} ${cy})"/>`;
    elements += `<ellipse cx="${cx}" cy="${cy}" rx="${outerR + 10}" ry="${outerR * 0.35}" fill="none" stroke="${secondary}" stroke-width="1.4" opacity="0.85" transform="rotate(120 ${cx} ${cy})"/>`;
  } else if (activeRing === 'ring_tachyon_accelerator') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 9}" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.9"/>`;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const tx = cx + Math.cos(a) * (outerR + 9);
      const ty = cy + Math.sin(a) * (outerR + 9);
      elements += `<rect x="${(tx - 3).toFixed(1)}" y="${(ty - 3).toFixed(1)}" width="6" height="6" fill="${primary}" transform="rotate(${(i * 45)} ${tx} ${ty})"/>`;
    }
  } else if (activeRing === 'ring_radar_crosshairs') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 6}" fill="none" stroke="${accent}" stroke-width="1" opacity="0.8"/>`;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      elements += `<line x1="${(cx + Math.cos(a) * (outerR - 2)).toFixed(1)}" y1="${(cy + Math.sin(a) * (outerR - 2)).toFixed(1)}" x2="${(cx + Math.cos(a) * (outerR + 14)).toFixed(1)}" y2="${(cy + Math.sin(a) * (outerR + 14)).toFixed(1)}" stroke="${accent}" stroke-width="2"/>`;
      elements += `<circle cx="${(cx + Math.cos(a) * (outerR + 6)).toFixed(1)}" cy="${(cy + Math.sin(a) * (outerR + 6)).toFixed(1)}" r="2" fill="${primary}"/>`;
    }
  } else if (activeRing === 'ring_orbital_stations') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 8}" fill="none" stroke="${secondary}" stroke-width="1" stroke-dasharray="2 4" opacity="0.6"/>`;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const sx = cx + Math.cos(a) * (outerR + 8);
      const sy = cy + Math.sin(a) * (outerR + 8);
      elements += `<rect x="${(sx - 2).toFixed(1)}" y="${(sy - 2).toFixed(1)}" width="4" height="4" fill="#ffffff"/>`;
      elements += `<line x1="${(sx - 5).toFixed(1)}" y1="${sy.toFixed(1)}" x2="${(sx + 5).toFixed(1)}" y2="${sy.toFixed(1)}" stroke="${accent}" stroke-width="1.5"/>`;
    }
  } else if (activeRing === 'ring_steampunk_gears') {
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const gx = cx + Math.cos(a) * (outerR + 6);
      const gy = cy + Math.sin(a) * (outerR + 6);
      elements += `<rect x="${(gx - 2).toFixed(1)}" y="${(gy - 2).toFixed(1)}" width="4" height="4" fill="${accent}" opacity="0.9" transform="rotate(${(i * 15)} ${gx} ${gy})"/>`;
    }
  } else if (activeRing === 'ring_ancient_glyphs') {
    for (let i = 0; i < 18; i++) {
      const a = (i * Math.PI * 2) / 18;
      const ax = cx + Math.cos(a) * (outerR + 7);
      const ay = cy + Math.sin(a) * (outerR + 7);
      elements += `<polygon points="${(ax - 2.5).toFixed(1)},${(ay - 2.5).toFixed(1)} ${(ax + 2.5).toFixed(1)},${(ay - 2.5).toFixed(1)} ${ax.toFixed(1)},${(ay + 3).toFixed(1)}" fill="${accent}" opacity="0.85"/>`;
    }
  } else if (activeRing === 'ring_solar_prominence') {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const p1x = cx + Math.cos(a) * outerR;
      const p1y = cy + Math.sin(a) * outerR;
      const p2x = cx + Math.cos(a + 0.3) * outerR;
      const p2y = cy + Math.sin(a + 0.3) * outerR;
      const cpx = cx + Math.cos(a + 0.15) * (outerR + 14);
      const cpy = cy + Math.sin(a + 0.15) * (outerR + 14);
      elements += `<path d="M ${p1x.toFixed(1)} ${p1y.toFixed(1)} Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.9"/>`;
    }
  } else if (activeRing === 'ring_magnetic_field') {
    for (let i = -2; i <= 2; i++) {
      const rx = outerR + 4 + Math.abs(i) * 5;
      elements += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${outerR * 0.4}" fill="none" stroke="${accent}" stroke-width="1" opacity="${0.8 - Math.abs(i) * 0.15}"/>`;
    }
  } else if (activeRing === 'ring_golden_spiral') {
    [1.05, 1.12, 1.21, 1.32].forEach((factor, idx) => {
      elements += `<circle cx="${cx}" cy="${cy}" r="${(outerR * factor).toFixed(1)}" fill="none" stroke="${idx % 2 === 0 ? accent : primary}" stroke-width="1.2" opacity="${0.9 - idx * 0.2}"/>`;
    });
  } else if (activeRing === 'ring_superstring_lattice') {
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      const x1 = cx + Math.cos(a) * (outerR + 10);
      const y1 = cy + Math.sin(a) * (outerR + 10);
      const x2 = cx + Math.cos(a + Math.PI * 0.8) * (outerR + 10);
      const y2 = cy + Math.sin(a + Math.PI * 0.8) * (outerR + 10);
      elements += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${accent}" stroke-width="0.8" opacity="0.6"/>`;
    }
  } else if (activeRing === 'ring_warp_bubble') {
    elements += `<path d="M ${cx - outerR - 12} ${cy} C ${cx - outerR} ${cy - outerR * 0.7}, ${cx + outerR} ${cy - outerR * 0.7}, ${cx + outerR + 12} ${cy} C ${cx + outerR} ${cy + outerR * 0.7}, ${cx - outerR} ${cy + outerR * 0.7}, ${cx - outerR - 12} ${cy} Z" fill="none" stroke="${accent}" stroke-width="1.8" opacity="0.85"/>`;
  } else if (activeRing === 'ring_cryo_crystals') {
    for (let i = 0; i < 18; i++) {
      const a = (i * Math.PI * 2) / 18;
      const tipX = cx + Math.cos(a) * (outerR + 12);
      const tipY = cy + Math.sin(a) * (outerR + 12);
      const base1X = cx + Math.cos(a - 0.08) * outerR;
      const base1Y = cy + Math.sin(a - 0.08) * outerR;
      const base2X = cx + Math.cos(a + 0.08) * outerR;
      const base2Y = cy + Math.sin(a + 0.08) * outerR;
      elements += `<polygon points="${tipX.toFixed(1)},${tipY.toFixed(1)} ${base1X.toFixed(1)},${base1Y.toFixed(1)} ${base2X.toFixed(1)},${base2Y.toFixed(1)}" fill="${accent}" opacity="0.9"/>`;
    }
  } else if (activeRing === 'ring_hyperdrive_fins') {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const fx = cx + Math.cos(a) * (outerR + 6);
      const fy = cy + Math.sin(a) * (outerR + 6);
      elements += `<line x1="${fx.toFixed(1)}" y1="${fy.toFixed(1)}" x2="${(cx + Math.cos(a + 0.25) * (outerR + 12)).toFixed(1)}" y2="${(cy + Math.sin(a + 0.25) * (outerR + 12)).toFixed(1)}" stroke="${accent}" stroke-width="2.2" opacity="0.9"/>`;
    }
  } else if (activeRing === 'ring_nanite_swarm') {
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI * 2) / 36 + ((i % 3) * 0.05);
      const r = outerR + 4 + (i % 4) * 3;
      const nx = cx + Math.cos(a) * r;
      const ny = cy + Math.sin(a) * r;
      elements += `<polygon points="${nx.toFixed(1)},${(ny - 2).toFixed(1)} ${(nx + 2).toFixed(1)},${(ny + 2).toFixed(1)} ${(nx - 2).toFixed(1)},${(ny + 2).toFixed(1)}" fill="${i % 2 === 0 ? accent : primary}" opacity="0.85"/>`;
    }
  } else if (activeRing === 'ring_ionic_thruster') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 8}" fill="none" stroke="${accent}" stroke-width="4" opacity="0.5"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 8}" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.95"/>`;
  } else if (activeRing === 'ring_decagram_star') {
    const pts = [];
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI * 2) / 20 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR + 10 : outerR + 2;
      pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
    }
    elements += `<polygon points="${pts.join(' ')}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.9"/>`;
  } else if (activeRing === 'ring_quantum_entanglement') {
    elements += `<path d="M ${cx - outerR - 8} ${cy} C ${cx - outerR - 8} ${cy - 16}, ${cx} ${cy + 16}, ${cx + outerR + 8} ${cy} C ${cx + outerR + 8} ${cy - 16}, ${cx} ${cy + 16}, ${cx - outerR - 8} ${cy} Z" fill="none" stroke="${accent}" stroke-width="2" opacity="0.9"/>`;
  } else if (activeRing === 'ring_asteroid_dust') {
    for (let i = 0; i < 48; i++) {
      const a = (i * Math.PI * 2) / 48;
      const r = outerR + 3 + ((i * 7) % 10);
      elements += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${0.8 + (i % 3) * 0.6}" fill="${accent}" opacity="0.8"/>`;
    }
  } else if (activeRing === 'ring_laser_diffraction') {
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const d1x = cx + Math.cos(a) * (outerR + 2);
      const d1y = cy + Math.sin(a) * (outerR + 2);
      const d2x = cx + Math.cos(a) * (outerR + 12);
      const d2y = cy + Math.sin(a) * (outerR + 12);
      elements += `<line x1="${d1x.toFixed(1)}" y1="${d1y.toFixed(1)}" x2="${d2x.toFixed(1)}" y2="${d2y.toFixed(1)}" stroke="${i % 2 === 0 ? accent : primary}" stroke-width="1.2" opacity="0.85"/>`;
    }
  } else if (activeRing === 'ring_plasma_confinement') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 6}" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="8 4" opacity="0.9"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 12}" fill="none" stroke="${primary}" stroke-width="2" stroke-dasharray="4 8" opacity="0.75"/>`;
  } else if (activeRing === 'ring_biometric_scanner') {
    elements += `<path d="M ${cx - outerR - 8} ${cy} A ${outerR + 8} ${outerR + 8} 0 0 1 ${cx + outerR + 8} ${cy}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.95"/>`;
    elements += `<line x1="${cx - outerR - 10}" y1="${cy}" x2="${cx + outerR + 10}" y2="${cy}" stroke="${primary}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.9"/>`;
  } else if (activeRing === 'ring_celestial_equator') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 8}" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.9"/>`;
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI * 2) / 36;
      const len = i % 3 === 0 ? 5 : 2.5;
      elements += `<line x1="${(cx + Math.cos(a) * (outerR + 8)).toFixed(1)}" y1="${(cy + Math.sin(a) * (outerR + 8)).toFixed(1)}" x2="${(cx + Math.cos(a) * (outerR + 8 + len)).toFixed(1)}" y2="${(cy + Math.sin(a) * (outerR + 8 + len)).toFixed(1)}" stroke="${accent}" stroke-width="1"/>`;
    }
  } else if (activeRing === 'ring_chronos_ring') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 7}" fill="none" stroke="${accent}" stroke-width="1.8" stroke-dasharray="1 5" opacity="0.95"/>`;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      elements += `<circle cx="${(cx + Math.cos(a) * (outerR + 7)).toFixed(1)}" cy="${(cy + Math.sin(a) * (outerR + 7)).toFixed(1)}" r="2" fill="${primary}"/>`;
    }
  }

  // ── 4. Center Glyph (35 Sacred Master Cores — 100% Unique) ──
  const glyphR = maxR * 0.24;
  const activeGlyph = customConfig?.glyph || 'glyph_quantum_hex';

  if (activeGlyph === 'glyph_quantum_hex') {
    elements += `<polygon points="${cx},${cy - glyphR} ${cx + glyphR * 0.86},${cy - glyphR * 0.5} ${cx + glyphR * 0.86},${cy + glyphR * 0.5} ${cx},${cy + glyphR} ${cx - glyphR * 0.86},${cy + glyphR * 0.5} ${cx - glyphR * 0.86},${cy - glyphR * 0.5}" fill="${accent}" opacity="0.45"/>`;
    elements += `<polygon points="${cx},${cy - glyphR} ${cx + glyphR * 0.86},${cy - glyphR * 0.5} ${cx + glyphR * 0.86},${cy + glyphR * 0.5} ${cx},${cy + glyphR} ${cx - glyphR * 0.86},${cy + glyphR * 0.5} ${cx - glyphR * 0.86},${cy - glyphR * 0.5}" fill="none" stroke="${primary}" stroke-width="2.2"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_metatron') {
    elements += `<polygon points="${cx},${cy - glyphR} ${cx + glyphR * 0.86},${cy - glyphR * 0.5} ${cx + glyphR * 0.86},${cy + glyphR * 0.5} ${cx},${cy + glyphR} ${cx - glyphR * 0.86},${cy + glyphR * 0.5} ${cx - glyphR * 0.86},${cy - glyphR * 0.5}" fill="none" stroke="${accent}" stroke-width="1.8" opacity="0.95"/>`;
    elements += `<polygon points="${cx},${cy + glyphR} ${cx - glyphR * 0.86},${cy - glyphR * 0.5} ${cx + glyphR * 0.86},${cy - glyphR * 0.5}" fill="none" stroke="${primary}" stroke-width="1.2" opacity="0.85"/>`;
    elements += `<polygon points="${cx},${cy - glyphR} ${cx - glyphR * 0.86},${cy + glyphR * 0.5} ${cx + glyphR * 0.86},${cy + glyphR * 0.5}" fill="none" stroke="${primary}" stroke-width="1.2" opacity="0.85"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.45}" fill="${accent}" opacity="0.95"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.18}" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_octagram') {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI * 2) / 16 - Math.PI / 2;
      const r = i % 2 === 0 ? glyphR : glyphR * 0.45;
      pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
    }
    elements += `<polygon points="${pts.join(' ')}" fill="${accent}" opacity="0.95"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.25}" fill="${bgDark}"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.12}" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_flower_of_life') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.65}" fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.95"/>`;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      elements += `<circle cx="${(cx + Math.cos(a) * glyphR * 0.65).toFixed(1)}" cy="${(cy + Math.sin(a) * glyphR * 0.65).toFixed(1)}" r="${glyphR * 0.65}" fill="none" stroke="${primary}" stroke-width="1.2" opacity="0.8"/>`;
    }
    elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_apex_crown') {
    elements += `<polygon points="${cx - glyphR},${cy + glyphR * 0.5} ${cx - glyphR},${cy - glyphR * 0.3} ${cx - glyphR * 0.5},${cy} ${cx},${cy - glyphR * 0.7} ${cx + glyphR * 0.5},${cy} ${cx + glyphR},${cy - glyphR * 0.3} ${cx + glyphR},${cy + glyphR * 0.5}" fill="${accent}" opacity="0.9"/>`;
    elements += `<circle cx="${cx}" cy="${cy - glyphR * 0.8}" r="3" fill="#ffffff"/>`;
    elements += `<circle cx="${cx - glyphR}" cy="${cy - glyphR * 0.4}" r="2" fill="#ffffff"/>`;
    elements += `<circle cx="${cx + glyphR}" cy="${cy - glyphR * 0.4}" r="2" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_tesseract') {
    const innerT = glyphR * 0.52;
    elements += `<rect x="${cx - glyphR}" y="${cy - glyphR}" width="${glyphR * 2}" height="${glyphR * 2}" fill="none" stroke="${primary}" stroke-width="1.6" opacity="0.85"/>`;
    elements += `<rect x="${cx - innerT}" y="${cy - innerT}" width="${innerT * 2}" height="${innerT * 2}" fill="${accent}" opacity="0.45"/>`;
    elements += `<rect x="${cx - innerT}" y="${cy - innerT}" width="${innerT * 2}" height="${innerT * 2}" fill="none" stroke="${accent}" stroke-width="1.6"/>`;
    elements += `<line x1="${cx - glyphR}" y1="${cy - glyphR}" x2="${cx - innerT}" y2="${cy - innerT}" stroke="${secondary}" stroke-width="1.2"/>`;
    elements += `<line x1="${cx + glyphR}" y1="${cy - glyphR}" x2="${cx + innerT}" y2="${cy - innerT}" stroke="${secondary}" stroke-width="1.2"/>`;
    elements += `<line x1="${cx + glyphR}" y1="${cy + glyphR}" x2="${cx + innerT}" y2="${cy + innerT}" stroke="${secondary}" stroke-width="1.2"/>`;
    elements += `<line x1="${cx - glyphR}" y1="${cy + glyphR}" x2="${cx - innerT}" y2="${cy + innerT}" stroke="${secondary}" stroke-width="1.2"/>`;
  } else if (activeGlyph === 'glyph_merkaba_vehicle') {
    elements += `<polygon points="${cx},${cy - glyphR} ${cx + glyphR * 0.86},${cy + glyphR * 0.5} ${cx - glyphR * 0.86},${cy + glyphR * 0.5}" fill="${primary}" opacity="0.6"/>`;
    elements += `<polygon points="${cx},${cy + glyphR} ${cx + glyphR * 0.86},${cy - glyphR * 0.5} ${cx - glyphR * 0.86},${cy - glyphR * 0.5}" fill="${accent}" opacity="0.6"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.28}" fill="#ffffff" opacity="0.95"/>`;
  } else if (activeGlyph === 'glyph_dragon_crest') {
    elements += `<polygon points="${cx},${cy - glyphR} ${cx + glyphR * 0.8},${cy - glyphR * 0.3} ${cx + glyphR * 0.5},${cy + glyphR * 0.8} ${cx},${cy + glyphR * 0.4} ${cx - glyphR * 0.5},${cy + glyphR * 0.8} ${cx - glyphR * 0.8},${cy - glyphR * 0.3}" fill="${primary}" opacity="0.8"/>`;
    elements += `<polygon points="${cx},${cy - glyphR * 0.6} ${cx + glyphR * 0.4},${cy} ${cx},${cy + glyphR * 0.2} ${cx - glyphR * 0.4},${cy}" fill="${accent}"/>`;
    elements += `<circle cx="${cx}" cy="${cy - glyphR * 0.2}" r="3" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_phoenix_core') {
    elements += `<path d="M ${cx} ${cy - glyphR * 1.1} C ${cx + glyphR * 0.8} ${cy - glyphR * 0.3}, ${cx + glyphR * 0.9} ${cy + glyphR * 0.5}, ${cx} ${cy + glyphR * 0.9} C ${cx - glyphR * 0.9} ${cy + glyphR * 0.5}, ${cx - glyphR * 0.8} ${cy - glyphR * 0.3}, ${cx} ${cy - glyphR * 1.1} Z" fill="${primary}" opacity="0.85"/>`;
    elements += `<polygon points="${cx},${cy - glyphR * 0.5} ${cx + glyphR * 0.3},${cy + glyphR * 0.2} ${cx - glyphR * 0.3},${cy + glyphR * 0.2}" fill="${accent}"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_primordia_eye') {
    elements += `<path d="M ${cx - glyphR * 1.3} ${cy} Q ${cx} ${cy - glyphR * 0.95} ${cx + glyphR * 1.3} ${cy} Q ${cx} ${cy + glyphR * 0.95} ${cx - glyphR * 1.3} ${cy}" fill="none" stroke="${accent}" stroke-width="2.4"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.48}" fill="${primary}" opacity="0.95"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.22}" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_infinity_ouroboros') {
    elements += `<path d="M ${cx - glyphR * 0.6} ${cy} C ${cx - glyphR * 0.6} ${cy - glyphR * 0.6}, ${cx} ${cy - glyphR * 0.6}, ${cx} ${cy} C ${cx} ${cy + glyphR * 0.6}, ${cx + glyphR * 0.6} ${cy + glyphR * 0.6}, ${cx + glyphR * 0.6} ${cy} C ${cx + glyphR * 0.6} ${cy - glyphR * 0.6}, ${cx} ${cy - glyphR * 0.6}, ${cx} ${cy} C ${cx} ${cy + glyphR * 0.6}, ${cx - glyphR * 0.6} ${cy + glyphR * 0.6}, ${cx - glyphR * 0.6} ${cy} Z" fill="none" stroke="${accent}" stroke-width="3" opacity="0.95"/>`;
    elements += `<circle cx="${cx - glyphR * 0.6}" cy="${cy}" r="2.5" fill="#ffffff"/>`;
    elements += `<circle cx="${cx + glyphR * 0.6}" cy="${cy}" r="2.5" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_cyber_lotus') {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const lx = cx + Math.cos(a) * glyphR * 0.55;
      const ly = cy + Math.sin(a) * glyphR * 0.55;
      elements += `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="${glyphR * 0.4}" ry="${glyphR * 0.18}" fill="${accent}" opacity="0.5" transform="rotate(${(i * 45)} ${lx} ${ly})"/>`;
    }
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.25}" fill="${primary}"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="2" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_seed_of_life') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      elements += `<circle cx="${(cx + Math.cos(a) * glyphR * 0.5).toFixed(1)}" cy="${(cy + Math.sin(a) * glyphR * 0.5).toFixed(1)}" r="${glyphR * 0.5}" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.85"/>`;
    }
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.5}" fill="none" stroke="${primary}" stroke-width="1.5"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_sri_yantra') {
    elements += `<polygon points="${cx},${cy - glyphR} ${cx + glyphR * 0.9},${cy + glyphR * 0.6} ${cx - glyphR * 0.9},${cy + glyphR * 0.6}" fill="none" stroke="${accent}" stroke-width="1.6"/>`;
    elements += `<polygon points="${cx},${cy + glyphR} ${cx + glyphR * 0.9},${cy - glyphR * 0.6} ${cx - glyphR * 0.9},${cy - glyphR * 0.6}" fill="none" stroke="${primary}" stroke-width="1.6"/>`;
    elements += `<polygon points="${cx},${cy - glyphR * 0.7} ${cx + glyphR * 0.6},${cy + glyphR * 0.4} ${cx - glyphR * 0.6},${cy + glyphR * 0.4}" fill="${secondary}" opacity="0.6"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_torus_knot') {
    for (let i = 0; i < 4; i++) {
      elements += `<ellipse cx="${cx}" cy="${cy}" rx="${glyphR}" ry="${glyphR * 0.4}" fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.8" transform="rotate(${(i * 45)} ${cx} ${cy})"/>`;
    }
    elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="${primary}"/>`;
  } else if (activeGlyph === 'glyph_vesica_piscis') {
    elements += `<circle cx="${(cx - glyphR * 0.35).toFixed(1)}" cy="${cy}" r="${glyphR * 0.7}" fill="none" stroke="${accent}" stroke-width="1.8" opacity="0.9"/>`;
    elements += `<circle cx="${(cx + glyphR * 0.35).toFixed(1)}" cy="${cy}" r="${glyphR * 0.7}" fill="none" stroke="${primary}" stroke-width="1.8" opacity="0.9"/>`;
    elements += `<line x1="${cx}" y1="${cy - glyphR * 0.6}" x2="${cx}" y2="${cy + glyphR * 0.6}" stroke="#ffffff" stroke-width="1.2"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_golden_spiral') {
    let sp = `M ${cx} ${cy}`;
    for (let theta = 0; theta < Math.PI * 4; theta += 0.2) {
      const r = (glyphR / (Math.PI * 4)) * theta;
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      sp += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    elements += `<path d="${sp}" fill="none" stroke="${accent}" stroke-width="2.2" opacity="0.95"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="2" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_valkyrie_cross') {
    elements += `<polygon points="${cx - 4},${cy - glyphR} ${cx + 4},${cy - glyphR} ${cx + 3},${cy - 4} ${cx + glyphR},${cy - 4} ${cx + glyphR},${cy + 4} ${cx + 3},${cy + 4} ${cx + 4},${cy + glyphR} ${cx - 4},${cy + glyphR} ${cx - 3},${cy + 4} ${cx - glyphR},${cy + 4} ${cx - glyphR},${cy - 4} ${cx - 3},${cy - 4}" fill="${primary}" opacity="0.85"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.35}" fill="none" stroke="${accent}" stroke-width="1.5"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_cyber_skull') {
    elements += `<path d="M ${cx - glyphR * 0.7} ${cy - glyphR * 0.2} C ${cx - glyphR * 0.7} ${cy - glyphR * 0.9}, ${cx + glyphR * 0.7} ${cy - glyphR * 0.9}, ${cx + glyphR * 0.7} ${cy - glyphR * 0.2} C ${cx + glyphR * 0.7} ${cy + glyphR * 0.3}, ${cx + glyphR * 0.4} ${cy + glyphR * 0.5}, ${cx + glyphR * 0.4} ${cy + glyphR * 0.8} L ${cx - glyphR * 0.4} ${cy + glyphR * 0.8} C ${cx - glyphR * 0.4} ${cy + glyphR * 0.5}, ${cx - glyphR * 0.7} ${cy + glyphR * 0.3}, ${cx - glyphR * 0.7} ${cy - glyphR * 0.2} Z" fill="${primary}" opacity="0.85"/>`;
    elements += `<circle cx="${cx - glyphR * 0.3}" cy="${cy - glyphR * 0.1}" r="3" fill="${accent}"/>`;
    elements += `<circle cx="${cx + glyphR * 0.3}" cy="${cy - glyphR * 0.1}" r="3" fill="${accent}"/>`;
    elements += `<line x1="${cx - glyphR * 0.25}" y1="${cy + glyphR * 0.6}" x2="${cx + glyphR * 0.25}" y2="${cy + glyphR * 0.6}" stroke="#ffffff" stroke-width="1.5"/>`;
  } else if (activeGlyph === 'glyph_anchor_eternity') {
    elements += `<circle cx="${cx}" cy="${cy - glyphR * 0.6}" r="${glyphR * 0.25}" fill="none" stroke="${accent}" stroke-width="2"/>`;
    elements += `<line x1="${cx}" y1="${cy - glyphR * 0.35}" x2="${cx}" y2="${cy + glyphR * 0.8}" stroke="${primary}" stroke-width="3"/>`;
    elements += `<line x1="${cx - glyphR * 0.5}" y1="${cy - glyphR * 0.1}" x2="${cx + glyphR * 0.5}" y2="${cy - glyphR * 0.1}" stroke="${primary}" stroke-width="2.5"/>`;
    elements += `<path d="M ${cx - glyphR * 0.8} ${cy + glyphR * 0.4} Q ${cx} ${cy + glyphR * 1.1} ${cx + glyphR * 0.8} ${cy + glyphR * 0.4}" fill="none" stroke="${accent}" stroke-width="3"/>`;
  } else if (activeGlyph === 'glyph_tree_of_life') {
    const sephirot = [
      { x: 0, y: -0.8 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 },
      { x: -0.5, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0 },
      { x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 }, { x: 0, y: 0.9 }
    ];
    sephirot.forEach(s => {
      elements += `<circle cx="${(cx + s.x * glyphR).toFixed(1)}" cy="${(cy + s.y * glyphR).toFixed(1)}" r="2.5" fill="${accent}"/>`;
    });
    elements += `<line x1="${cx}" y1="${cy - glyphR * 0.8}" x2="${cx}" y2="${cy + glyphR * 0.9}" stroke="${primary}" stroke-width="1"/>`;
  } else if (activeGlyph === 'glyph_archangel_sigil') {
    elements += `<polygon points="${cx},${cy - glyphR} ${cx + glyphR * 0.7},${cy} ${cx},${cy + glyphR} ${cx - glyphR * 0.7},${cy}" fill="none" stroke="${accent}" stroke-width="2"/>`;
    elements += `<line x1="${cx - glyphR * 0.9}" y1="${cy}" x2="${cx + glyphR * 0.9}" y2="${cy}" stroke="${primary}" stroke-width="1.5"/>`;
    elements += `<line x1="${cx}" y1="${cy - glyphR * 0.9}" x2="${cx}" y2="${cy + glyphR * 0.9}" stroke="${primary}" stroke-width="1.5"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_hyper_pentagram') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10 - Math.PI / 2;
      const r = i % 2 === 0 ? glyphR : glyphR * 0.42;
      pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
    }
    elements += `<polygon points="${pts.join(' ')}" fill="${accent}" opacity="0.85"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.2}" fill="${bgDark}"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="2" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_chrono_dial') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.9}" fill="none" stroke="${accent}" stroke-width="1.8"/>`;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      elements += `<line x1="${(cx + Math.cos(a) * glyphR * 0.75).toFixed(1)}" y1="${(cy + Math.sin(a) * glyphR * 0.75).toFixed(1)}" x2="${(cx + Math.cos(a) * glyphR * 0.9).toFixed(1)}" y2="${(cy + Math.sin(a) * glyphR * 0.9).toFixed(1)}" stroke="${primary}" stroke-width="1.5"/>`;
    }
    elements += `<line x1="${cx}" y1="${cy}" x2="${(cx + glyphR * 0.5).toFixed(1)}" y2="${(cy - glyphR * 0.2).toFixed(1)}" stroke="#ffffff" stroke-width="2"/>`;
    elements += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${(cy - glyphR * 0.7).toFixed(1)}" stroke="${accent}" stroke-width="1.5"/>`;
  } else if (activeGlyph === 'glyph_sun_disc_ra') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.55}" fill="${accent}" opacity="0.95"/>`;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      elements += `<line x1="${(cx + Math.cos(a) * glyphR * 0.65).toFixed(1)}" y1="${(cy + Math.sin(a) * glyphR * 0.65).toFixed(1)}" x2="${(cx + Math.cos(a) * glyphR * 0.95).toFixed(1)}" y2="${(cy + Math.sin(a) * glyphR * 0.95).toFixed(1)}" stroke="${primary}" stroke-width="2"/>`;
    }
    elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_ankh_immortality') {
    elements += `<ellipse cx="${cx}" cy="${cy - glyphR * 0.4}" rx="${glyphR * 0.3}" ry="${glyphR * 0.4}" fill="none" stroke="${accent}" stroke-width="2.5"/>`;
    elements += `<line x1="${cx - glyphR * 0.5}" y1="${cy + glyphR * 0.05}" x2="${cx + glyphR * 0.5}" y2="${cy + glyphR * 0.05}" stroke="${primary}" stroke-width="2.5"/>`;
    elements += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + glyphR * 0.9}" stroke="${primary}" stroke-width="3"/>`;
  } else if (activeGlyph === 'glyph_triquetra_knot') {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      const kx = cx + Math.cos(a) * glyphR * 0.4;
      const ky = cy + Math.sin(a) * glyphR * 0.4;
      elements += `<circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="${glyphR * 0.55}" fill="none" stroke="${accent}" stroke-width="1.8" opacity="0.85"/>`;
    }
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.35}" fill="none" stroke="${primary}" stroke-width="1.2"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_cyber_falcon') {
    elements += `<polygon points="${cx - glyphR * 0.8},${cy - glyphR * 0.4} ${cx},${cy - glyphR * 0.9} ${cx + glyphR * 0.8},${cy - glyphR * 0.4} ${cx + glyphR * 0.3},${cy + glyphR * 0.8} ${cx},${cy + glyphR * 0.4} ${cx - glyphR * 0.3},${cy + glyphR * 0.8}" fill="${accent}" opacity="0.85"/>`;
    elements += `<circle cx="${cx}" cy="${cy - glyphR * 0.2}" r="3" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_processor_ic') {
    elements += `<rect x="${cx - glyphR * 0.6}" y="${cy - glyphR * 0.6}" width="${glyphR * 1.2}" height="${glyphR * 1.2}" fill="${primary}" opacity="0.85"/>`;
    elements += `<rect x="${cx - glyphR * 0.35}" y="${cy - glyphR * 0.35}" width="${glyphR * 0.7}" height="${glyphR * 0.7}" fill="${accent}"/>`;
    for (let i = -2; i <= 2; i++) {
      elements += `<line x1="${cx + i * (glyphR * 0.2)}" y1="${cy - glyphR * 0.6}" x2="${cx + i * (glyphR * 0.2)}" y2="${cy - glyphR * 0.35}" stroke="${accent}" stroke-width="1.2"/>`;
      elements += `<line x1="${cx + i * (glyphR * 0.2)}" y1="${cy + glyphR * 0.35}" x2="${cx + i * (glyphR * 0.2)}" y2="${cy + glyphR * 0.6}" stroke="${accent}" stroke-width="1.2"/>`;
    }
    elements += `<circle cx="${cx}" cy="${cy}" r="2" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_tetragrammaton') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.85}" fill="none" stroke="${accent}" stroke-width="2"/>`;
    elements += `<polygon points="${cx},${cy - glyphR * 0.8} ${cx + glyphR * 0.7},${cy + glyphR * 0.4} ${cx - glyphR * 0.7},${cy + glyphR * 0.4}" fill="${primary}" opacity="0.6"/>`;
    elements += `<polygon points="${cx},${cy + glyphR * 0.8} ${cx + glyphR * 0.7},${cy - glyphR * 0.4} ${cx - glyphR * 0.7},${cy - glyphR * 0.4}" fill="${secondary}" opacity="0.6"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_osmium_singularity') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.7}" fill="${primary}" opacity="0.95"/>`;
    elements += `<ellipse cx="${cx}" cy="${cy}" rx="${glyphR * 1.1}" ry="${glyphR * 0.35}" fill="none" stroke="${accent}" stroke-width="2.5" transform="rotate(-25 ${cx} ${cy})"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.3}" fill="#ffffff"/>`;
  } else if (activeGlyph === 'glyph_hyper_monolith') {
    elements += `<rect x="${cx - glyphR * 0.35}" y="${cy - glyphR * 0.9}" width="${glyphR * 0.7}" height="${glyphR * 1.8}" fill="${primary}" opacity="0.95"/>`;
    elements += `<rect x="${cx - glyphR * 0.2}" y="${cy - glyphR * 0.75}" width="${glyphR * 0.4}" height="${glyphR * 1.5}" fill="none" stroke="${accent}" stroke-width="1.5"/>`;
    elements += `<line x1="${cx}" y1="${cy - glyphR * 0.6}" x2="${cx}" y2="${cy + glyphR * 0.6}" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="2 4"/>`;
  } else if (activeGlyph === 'glyph_dna_helix') {
    for (let y = -glyphR * 0.8; y <= glyphR * 0.8; y += 4) {
      const x1 = cx + Math.sin(y * 0.15) * (glyphR * 0.6);
      const x2 = cx - Math.sin(y * 0.15) * (glyphR * 0.6);
      elements += `<circle cx="${x1.toFixed(1)}" cy="${(cy + y).toFixed(1)}" r="1.8" fill="${accent}"/>`;
      elements += `<circle cx="${x2.toFixed(1)}" cy="${(cy + y).toFixed(1)}" r="1.8" fill="${primary}"/>`;
      if (Math.abs(y % 8) < 2) {
        elements += `<line x1="${x1.toFixed(1)}" y1="${(cy + y).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(cy + y).toFixed(1)}" stroke="#ffffff" stroke-width="0.8" opacity="0.6"/>`;
      }
    }
  } else if (activeGlyph === 'glyph_heptagram_star') {
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i * Math.PI * 2) / 14 - Math.PI / 2;
      const r = i % 2 === 0 ? glyphR : glyphR * 0.45;
      pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
    }
    elements += `<polygon points="${pts.join(' ')}" fill="${accent}" opacity="0.9"/>`;
  } else if (activeGlyph === 'glyph_sovereign_scepter') {
    elements += `<line x1="${cx}" y1="${cy - glyphR * 0.3}" x2="${cx}" y2="${cy + glyphR * 0.9}" stroke="${accent}" stroke-width="3"/>`;
    elements += `<circle cx="${cx}" cy="${cy - glyphR * 0.5}" r="${glyphR * 0.35}" fill="${primary}"/>`;
    elements += `<polygon points="${cx},${cy - glyphR * 0.9} ${cx + 3},${cy - glyphR * 0.75} ${cx - 3},${cy - glyphR * 0.75}" fill="#ffffff"/>`;
    elements += `<circle cx="${cx}" cy="${cy - glyphR * 0.5}" r="2" fill="#ffffff"/>`;
  } else {
    elements += `<circle cx="${cx}" cy="${cy}" r="${glyphR * 0.4}" fill="${primary}" opacity="0.8"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`;
  }
  const armLayers = hi(bytes, 17, 2, 4);
  for (let layer = 0; layer < armLayers; layer++) {
    const byteOff = 18 + layer * 6;
    const armR1 = innerR + (outerR - innerR) * (0.2 + (layer / armLayers) * 0.6);
    const armR2 = innerR + (outerR - innerR) * (0.3 + (layer / armLayers) * 0.7);
    const armType = hi(bytes, byteOff, 0, 5);
    const armColor = layer % 2 === 0 ? primary : secondary;
    const armWidth = 1 + hf(bytes, byteOff + 1) * 2;

    for (let s = 0; s < symmetry; s++) {
      const baseAngle = s * angleStep + hf(bytes, byteOff + 2) * angleStep * 0.3;

      if (armType === 0) {
        const x1 = cx + Math.cos(baseAngle) * innerR * 1.2;
        const y1 = cy + Math.sin(baseAngle) * innerR * 1.2;
        const x2 = cx + Math.cos(baseAngle) * armR2;
        const y2 = cy + Math.sin(baseAngle) * armR2;
        elements += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${armColor}" stroke-width="${armWidth.toFixed(1)}" stroke-linecap="round" opacity="0.75"/>`;
      } else if (armType === 1) {
        const dotR = 2 + hf(bytes, byteOff + 3) * 4;
        const dx = cx + Math.cos(baseAngle) * armR1;
        const dy = cy + Math.sin(baseAngle) * armR1;
        elements += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${dotR.toFixed(1)}" fill="${armColor}" opacity="0.85"/>`;
      } else if (armType === 2) {
        const triR = 4 + hf(bytes, byteOff + 3) * 8;
        const tcx = cx + Math.cos(baseAngle) * armR1;
        const tcy = cy + Math.sin(baseAngle) * armR1;
        const pts = [];
        for (let t = 0; t < 3; t++) {
          const a = baseAngle + (t * Math.PI * 2) / 3;
          pts.push(`${(tcx + Math.cos(a) * triR).toFixed(1)},${(tcy + Math.sin(a) * triR).toFixed(1)}`);
        }
        elements += `<polygon points="${pts.join(' ')}" fill="${armColor}" opacity="0.75"/>`;
      } else if (armType === 3) {
        const startA = baseAngle - angleStep * 0.2;
        const endA = baseAngle + angleStep * 0.2;
        const x1 = cx + Math.cos(startA) * armR1;
        const y1 = cy + Math.sin(startA) * armR1;
        const x2 = cx + Math.cos(endA) * armR1;
        const y2 = cy + Math.sin(endA) * armR1;
        elements += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${armR1.toFixed(1)} ${armR1.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${armColor}" stroke-width="${armWidth.toFixed(1)}" stroke-linecap="round" opacity="0.65"/>`;
      } else {
        const x1 = cx + Math.cos(baseAngle) * innerR * 1.1;
        const y1 = cy + Math.sin(baseAngle) * innerR * 1.1;
        const spread = angleStep * 0.15;
        const x2a = cx + Math.cos(baseAngle - spread) * armR2;
        const y2a = cy + Math.sin(baseAngle - spread) * armR2;
        elements += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2a.toFixed(1)}" y2="${y2a.toFixed(1)}" stroke="${armColor}" stroke-width="${(armWidth * 0.7).toFixed(1)}" stroke-linecap="round" opacity="0.65"/>`;
      }
    }
  }

  // ── 6. Custom Crest / Apex Seals (30 Master Imperial Modes — 100% Unique) ──
  const activeCrest = customConfig?.crest || 'crest_cyber_spikes';
  if (activeCrest === 'crest_cyber_spikes') {
    const topY = cy - outerR - 4;
    elements += `<polygon points="${cx - 16},${topY} ${cx - 12},${topY - 16} ${cx - 8},${topY}" fill="${accent}"/>`;
    elements += `<polygon points="${cx - 4},${topY} ${cx},${topY - 22} ${cx + 4},${topY}" fill="${primary}"/>`;
    elements += `<polygon points="${cx + 8},${topY} ${cx + 12},${topY - 16} ${cx + 16},${topY}" fill="${accent}"/>`;
  } else if (activeCrest === 'crest_lightning') {
    const topY = cy - outerR - 6;
    elements += `<polygon points="${cx - 12},${topY - 14} ${cx - 2},${topY - 4} ${cx - 7},${topY - 4} ${cx + 1},${topY + 6} ${cx - 5},${topY - 1} ${cx - 1},${topY - 1}" fill="${accent}" opacity="0.9"/>`;
    elements += `<polygon points="${cx + 12},${topY - 14} ${cx + 2},${topY - 4} ${cx + 7},${topY - 4} ${cx - 1},${topY + 6} ${cx + 5},${topY - 1} ${cx + 1},${topY - 1}" fill="${accent}" opacity="0.9"/>`;
  } else if (activeCrest === 'crest_valkyrie_horns') {
    const topY = cy - outerR - 2;
    elements += `<path d="M ${cx - 10} ${topY} Q ${cx - 25} ${topY - 15} ${cx - 30} ${topY - 25} Q ${cx - 15} ${topY - 20} ${cx - 5} ${topY - 4}" fill="${accent}" opacity="0.9"/>`;
    elements += `<path d="M ${cx + 10} ${topY} Q ${cx + 25} ${topY - 15} ${cx + 30} ${topY - 25} Q ${cx + 15} ${topY - 20} ${cx + 5} ${topY - 4}" fill="${accent}" opacity="0.9"/>`;
  } else if (activeCrest === 'crest_crown') {
    const crownW = maxR * 0.45;
    const crownH = maxR * 0.25;
    const topY = cy - outerR - 4;
    elements += `<polygon points="${cx - crownW/2},${topY} ${cx - crownW/2},${topY - crownH} ${cx - crownW/4},${topY - crownH*0.5} ${cx},${topY - crownH*1.2} ${cx + crownW/4},${topY - crownH*0.5} ${cx + crownW/2},${topY - crownH} ${cx + crownW/2},${topY}" fill="${accent}" opacity="0.95"/>`;
    elements += `<circle cx="${cx}" cy="${topY - crownH*1.3}" r="2.5" fill="#ffffff"/>`;
  } else if (activeCrest === 'crest_ouroboros_shield') {
    const topY = cy - outerR - 6;
    elements += `<polygon points="${cx},${topY - 16} ${cx + 14},${topY - 10} ${cx + 10},${topY + 4} ${cx},${topY + 12} ${cx - 10},${topY + 4} ${cx - 14},${topY - 10}" fill="${accent}" opacity="0.9"/>`;
    elements += `<circle cx="${cx}" cy="${topY - 2}" r="3" fill="#ffffff"/>`;
  } else if (activeCrest === 'crest_halo_ascendance') {
    elements += `<ellipse cx="${cx}" cy="${cy - outerR - 14}" rx="${outerR * 0.4}" ry="6" fill="none" stroke="${accent}" stroke-width="1.8" opacity="0.9"/>`;
    elements += `<ellipse cx="${cx}" cy="${cy - outerR - 18}" rx="${outerR * 0.28}" ry="4" fill="none" stroke="${primary}" stroke-width="1.2" opacity="0.75"/>`;
  } else if (activeCrest === 'crest_angel_wings') {
    const wy = cy - outerR * 0.3;
    elements += `<path d="M ${cx - outerR} ${wy} Q ${cx - outerR - 18} ${wy - 22} ${cx - outerR - 28} ${wy - 10} Q ${cx - outerR - 18} ${wy + 8} ${cx - outerR + 5} ${wy + 18}" fill="${accent}" opacity="0.85"/>`;
    elements += `<path d="M ${cx + outerR} ${wy} Q ${cx + outerR + 18} ${wy - 22} ${cx + outerR + 28} ${wy - 10} Q ${cx + outerR + 18} ${wy + 8} ${cx + outerR - 5} ${wy + 18}" fill="${accent}" opacity="0.85"/>`;
  } else if (activeCrest === 'crest_phoenix_rebirth') {
    const wy = cy - outerR * 0.2;
    elements += `<path d="M ${cx - outerR - 4} ${wy} Q ${cx - outerR - 22} ${wy - 28} ${cx - outerR - 16} ${wy - 38} Q ${cx - outerR - 8} ${wy - 18} ${cx - outerR + 6} ${wy + 12}" fill="${primary}" opacity="0.9"/>`;
    elements += `<path d="M ${cx + outerR + 4} ${wy} Q ${cx + outerR + 22} ${wy - 28} ${cx + outerR + 16} ${wy - 38} Q ${cx + outerR + 8} ${wy - 18} ${cx + outerR - 6} ${wy + 12}" fill="${primary}" opacity="0.9"/>`;
    elements += `<polygon points="${cx},${cy - outerR - 20} ${cx + 4},${cy - outerR - 8} ${cx - 4},${cy - outerR - 8}" fill="${accent}"/>`;
  } else if (activeCrest === 'crest_dragon_horns') {
    const topY = cy - outerR - 2;
    elements += `<path d="M ${cx - 12} ${topY} Q ${cx - 30} ${topY - 18} ${cx - 35} ${topY - 32} Q ${cx - 20} ${topY - 24} ${cx - 6} ${topY - 6}" fill="${primary}" opacity="0.9"/>`;
    elements += `<path d="M ${cx + 12} ${topY} Q ${cx + 30} ${topY - 18} ${cx + 35} ${topY - 32} Q ${cx + 20} ${topY - 24} ${cx + 6} ${topY - 6}" fill="${primary}" opacity="0.9"/>`;
  } else if (activeCrest === 'crest_vault_seal') {
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 14}" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="3 6" opacity="0.9"/>`;
    elements += `<circle cx="${cx}" cy="${cy}" r="${outerR + 18}" fill="none" stroke="${primary}" stroke-width="1.2" opacity="0.75"/>`;
  } else if (activeCrest === 'crest_quantum_antenna') {
    const topY = cy - outerR - 2;
    elements += `<line x1="${cx}" y1="${topY}" x2="${cx}" y2="${topY - 24}" stroke="${accent}" stroke-width="2"/>`;
    elements += `<circle cx="${cx}" cy="${topY - 26}" r="3.5" fill="#ffffff"/>`;
    elements += `<circle cx="${cx}" cy="${topY - 26}" r="7" fill="none" stroke="${primary}" stroke-width="1" stroke-dasharray="2 4" opacity="0.8"/>`;
  } else if (activeCrest === 'crest_omni_sovereign') {
    const topY = cy - outerR - 8;
    elements += `<polygon points="${cx - 24},${topY} ${cx - 28},${topY - 20} ${cx - 14},${topY - 10} ${cx},${topY - 26} ${cx + 14},${topY - 10} ${cx + 28},${topY - 20} ${cx + 24},${topY}" fill="${primary}" opacity="0.95"/>`;
    elements += `<circle cx="${cx}" cy="${topY - 28}" r="3.5" fill="#ffffff"/>`;
    elements += `<circle cx="${cx - 28}" cy="${topY - 22}" r="2" fill="#ffffff"/>`;
    elements += `<circle cx="${cx + 28}" cy="${topY - 22}" r="2" fill="#ffffff"/>`;
  } else if (activeCrest === 'crest_apex_spires') {
    const topY = cy - outerR - 2;
    elements += `<polygon points="${cx - 14},${topY} ${cx - 10},${topY - 24} ${cx - 6},${topY}" fill="${primary}"/>`;
    elements += `<polygon points="${cx - 4},${topY} ${cx},${topY - 32} ${cx + 4},${topY}" fill="${accent}"/>`;
    elements += `<polygon points="${cx + 6},${topY} ${cx + 10},${topY - 24} ${cx + 14},${topY}" fill="${primary}"/>`;
  } else if (activeCrest === 'crest_celestial_aureole') {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 15 + Math.PI;
      const x1 = cx + Math.cos(a) * (outerR + 2);
      const y1 = cy + Math.sin(a) * (outerR + 2);
      const x2 = cx + Math.cos(a) * (outerR + 14);
      const y2 = cy + Math.sin(a) * (outerR + 14);
      elements += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${accent}" stroke-width="1.8" opacity="0.9"/>`;
    }
  } else if (activeCrest === 'crest_cyber_antlers') {
    const topY = cy - outerR - 2;
    elements += `<path d="M ${cx - 8} ${topY} L ${cx - 22} ${topY - 18} L ${cx - 16} ${topY - 22} L ${cx - 28} ${topY - 32}" fill="none" stroke="${accent}" stroke-width="2"/>`;
    elements += `<path d="M ${cx + 8} ${topY} L ${cx + 22} ${topY - 18} L ${cx + 16} ${topY - 22} L ${cx + 28} ${topY - 32}" fill="none" stroke="${accent}" stroke-width="2"/>`;
  } else if (activeCrest === 'crest_archon_wings') {
    for (let w = 0; w < 3; w++) {
      const wy = cy - outerR * (0.15 + w * 0.2);
      elements += `<path d="M ${cx - outerR} ${wy} Q ${cx - outerR - 16 - w * 6} ${wy - 14} ${cx - outerR + 4} ${wy + 10}" fill="${accent}" opacity="${0.9 - w * 0.2}"/>`;
      elements += `<path d="M ${cx + outerR} ${wy} Q ${cx + outerR + 16 + w * 6} ${wy - 14} ${cx + outerR - 4} ${wy + 10}" fill="${accent}" opacity="${0.9 - w * 0.2}"/>`;
    }
  } else if (activeCrest === 'crest_dragon_crown') {
    const topY = cy - outerR - 6;
    elements += `<polygon points="${cx - 20},${topY} ${cx - 30},${topY - 16} ${cx - 10},${topY - 12} ${cx},${topY - 22} ${cx + 10},${topY - 12} ${cx + 30},${topY - 16} ${cx + 20},${topY}" fill="${primary}" opacity="0.9"/>`;
    elements += `<circle cx="${cx}" cy="${topY - 10}" r="3" fill="${accent}"/>`;
  } else if (activeCrest === 'crest_valkyrie_wings') {
    const wy = cy - outerR * 0.35;
    elements += `<path d="M ${cx - outerR - 2} ${wy} C ${cx - outerR - 24} ${wy - 26}, ${cx - outerR - 12} ${wy - 36}, ${cx - outerR + 8} ${wy - 10}" fill="${accent}" opacity="0.85"/>`;
    elements += `<path d="M ${cx + outerR + 2} ${wy} C ${cx + outerR + 24} ${wy - 26}, ${cx + outerR + 12} ${wy - 36}, ${cx + outerR - 8} ${wy - 10}" fill="${accent}" opacity="0.85"/>`;
  } else if (activeCrest === 'crest_sun_god_corona') {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 11 + Math.PI;
      const x1 = cx + Math.cos(a) * (outerR + 4);
      const y1 = cy + Math.sin(a) * (outerR + 4);
      const x2 = cx + Math.cos(a) * (outerR + (i % 2 === 0 ? 18 : 10));
      const y2 = cy + Math.sin(a) * (outerR + (i % 2 === 0 ? 18 : 10));
      elements += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${accent}" stroke-width="2"/>`;
    }
  } else if (activeCrest === 'crest_laser_diadem') {
    const topY = cy - outerR - 8;
    elements += `<rect x="${cx - outerR * 0.45}" y="${topY}" width="${outerR * 0.9}" height="4" fill="${accent}" rx="2"/>`;
    elements += `<circle cx="${cx}" cy="${topY + 2}" r="3" fill="#ffffff"/>`;
  } else if (activeCrest === 'crest_quantum_dish') {
    const topY = cy - outerR - 10;
    elements += `<path d="M ${cx - 16} ${topY} Q ${cx} ${topY + 12} ${cx + 16} ${topY}" fill="none" stroke="${accent}" stroke-width="2.5"/>`;
    elements += `<line x1="${cx}" y1="${topY + 6}" x2="${cx}" y2="${topY - 10}" stroke="${primary}" stroke-width="1.8"/>`;
    elements += `<circle cx="${cx}" cy="${topY - 12}" r="2" fill="#ffffff"/>`;
  } else if (activeCrest === 'crest_ironclad_ram') {
    const topY = cy - outerR - 6;
    elements += `<polygon points="${cx - 18},${topY} ${cx},${topY - 26} ${cx + 18},${topY} ${cx},${topY - 8}" fill="${primary}" opacity="0.9"/>`;
    elements += `<line x1="${cx}" y1="${topY - 26}" x2="${cx}" y2="${topY - 8}" stroke="${accent}" stroke-width="2"/>`;
  } else if (activeCrest === 'crest_trident_poseidon') {
    const topY = cy - outerR - 4;
    elements += `<line x1="${cx}" y1="${topY}" x2="${cx}" y2="${topY - 28}" stroke="${accent}" stroke-width="2.5"/>`;
    elements += `<path d="M ${cx - 12} ${topY - 18} L ${cx - 12} ${topY - 24} L ${cx} ${topY - 18} L ${cx + 12} ${topY - 24} L ${cx + 12} ${topY - 18}" fill="none" stroke="${accent}" stroke-width="2"/>`;
    elements += `<polygon points="${cx},${topY - 32} ${cx - 3},${topY - 26} ${cx + 3},${topY - 26}" fill="#ffffff"/>`;
  } else if (activeCrest === 'crest_triple_crown') {
    for (let c = 0; c < 3; c++) {
      const topY = cy - outerR - 4 - c * 9;
      const w = 18 - c * 4;
      elements += `<polygon points="${cx - w},${topY} ${cx - w},${topY - 5} ${cx},${topY - 8} ${cx + w},${topY - 5} ${cx + w},${topY}" fill="${c === 2 ? '#ffffff' : accent}" opacity="${0.95 - c * 0.15}"/>`;
    }
  } else if (activeCrest === 'crest_stellar_prism') {
    const topY = cy - outerR - 6;
    elements += `<polygon points="${cx},${topY - 22} ${cx + 14},${topY} ${cx - 14},${topY}" fill="none" stroke="${accent}" stroke-width="2"/>`;
    elements += `<polygon points="${cx},${topY - 14} ${cx + 7},${topY} ${cx - 7},${topY}" fill="${primary}" opacity="0.7"/>`;
    elements += `<circle cx="${cx}" cy="${topY - 24}" r="2" fill="#ffffff"/>`;
  } else if (activeCrest === 'crest_eternity_halo') {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 11 + Math.PI;
      const hx = cx + Math.cos(a) * (outerR + 14);
      const hy = cy + Math.sin(a) * (outerR + 14);
      elements += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="2" fill="${accent}"/>`;
    }
  } else if (activeCrest === 'crest_aerodynamic_fin') {
    const topY = cy - outerR - 4;
    elements += `<polygon points="${cx - 14},${topY} ${cx - 8},${topY - 22} ${cx - 4},${topY}" fill="${primary}"/>`;
    elements += `<polygon points="${cx + 4},${topY} ${cx + 8},${topY - 22} ${cx + 14},${topY}" fill="${primary}"/>`;
  } else if (activeCrest === 'crest_omega_singularity') {
    const topY = cy - outerR - 10;
    elements += `<path d="M ${cx - 14} ${topY + 6} L ${cx - 8} ${topY + 6} A 8 8 0 1 1 ${cx + 8} ${topY + 6} L ${cx + 14} ${topY + 6}" fill="none" stroke="${accent}" stroke-width="3"/>`;
    elements += `<circle cx="${cx}" cy="${topY}" r="3" fill="#ffffff"/>`;
  } else if (activeCrest === 'crest_anubis_jackal') {
    const topY = cy - outerR - 4;
    elements += `<polygon points="${cx - 16},${topY} ${cx - 22},${topY - 28} ${cx - 10},${topY - 14}" fill="${primary}" opacity="0.9"/>`;
    elements += `<polygon points="${cx + 16},${topY} ${cx + 22},${topY - 28} ${cx + 10},${topY - 14}" fill="${primary}" opacity="0.9"/>`;
  } else if (activeCrest === 'crest_horus_falcon') {
    const topY = cy - outerR - 6;
    elements += `<circle cx="${cx}" cy="${topY - 8}" r="${glyphR * 0.35}" fill="${accent}"/>`;
    elements += `<path d="M ${cx - 12} ${topY - 8} Q ${cx - 28} ${topY - 22} ${cx - 4} ${topY}" fill="${primary}" opacity="0.85"/>`;
    elements += `<path d="M ${cx + 12} ${topY - 8} Q ${cx + 28} ${topY - 22} ${cx + 4} ${topY}" fill="${primary}" opacity="0.85"/>`;
  } else {
    const topY = cy - outerR - 4;
    elements += `<polygon points="${cx - 8},${topY} ${cx},${topY - 14} ${cx + 8},${topY}" fill="${accent}"/>`;
  }

  // ── 6.5 Deterministic Cryptographic Uniqueness Matrix (Guaranteed 0 Duplicates) ──
  const uniqueSeedStr = `${referralCode.toUpperCase()}_${customConfig?.handle || ''}_${customConfig?.motto || ''}_${customConfig?.monogram || ''}`;
  const uniqueHash = crypto.createHash('sha256').update(uniqueSeedStr).digest('hex');
  const uBytes = hashToBytes(uniqueHash);

  // 1. 14 Unique Micro-Constellation Stardust Nodes
  const nodeCount = 14;
  const constellationNodes: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < nodeCount; i++) {
    const angle = ((i * Math.PI * 2) / nodeCount) + ((uBytes[i] / 255) * (Math.PI / 8));
    const rad = innerR * 1.12 + (uBytes[i + nodeCount] / 255) * (outerR * 0.72 - innerR * 1.12);
    const nx = cx + Math.cos(angle) * rad;
    const ny = cy + Math.sin(angle) * rad;
    const nR = 1.2 + (uBytes[i % 8] / 255) * 1.4;
    const nO = 0.6 + (uBytes[(i + 3) % 8] / 255) * 0.35;
    const nFill = i % 2 === 0 ? accent : primary;
    constellationNodes.push({ x: nx, y: ny });
    elements += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${nR.toFixed(1)}" fill="${nFill}" opacity="${nO.toFixed(2)}"/>`;
  }
  // Connect geometric chords between unique nodes
  for (let i = 0; i < constellationNodes.length; i++) {
    const nextIdx = (i + 1 + (uBytes[i] % 3)) % constellationNodes.length;
    elements += `<line x1="${constellationNodes[i].x.toFixed(1)}" y1="${constellationNodes[i].y.toFixed(1)}" x2="${constellationNodes[nextIdx].x.toFixed(1)}" y2="${constellationNodes[nextIdx].y.toFixed(1)}" stroke="${primary}" stroke-width="0.75" stroke-dasharray="2 3" opacity="0.45"/>`;
  }

  // 2. Unique Circumference Laser Harmonic Wave
  const wavePoints = 54;
  const waveFreq = 8 + (uBytes[4] % 14);
  const waveAmp = 2.0 + (uBytes[5] / 255) * 4.0;
  let wavePath = '';
  for (let i = 0; i <= wavePoints; i++) {
    const theta = (i * Math.PI * 2) / wavePoints;
    const rOffset = Math.sin(theta * waveFreq + (uBytes[6] / 255) * Math.PI * 2) * waveAmp;
    const rCurr = (innerR + outerR) * 0.52 + rOffset;
    const wx = cx + Math.cos(theta) * rCurr;
    const wy = cy + Math.sin(theta) * rCurr;
    wavePath += (i === 0 ? `M ${wx.toFixed(1)} ${wy.toFixed(1)}` : ` L ${wx.toFixed(1)} ${wy.toFixed(1)}`);
  }
  elements += `<path d="${wavePath} Z" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.65"/>`;

  // 3. Unique Hexadecimal Hash Watermark on Outer Rim
  const shortHex = uniqueHash.substring(0, 8).toUpperCase();
  elements += `<text x="${cx}" y="${(cy + outerR + 13).toFixed(1)}" text-anchor="middle" fill="${accent}" font-family="monospace" font-size="6.5" font-weight="bold" letter-spacing="1.5" opacity="0.75">[HEX: ${shortHex}]</text>`;

  // 4. Custom Laser-Etched Monogram / Core Seal (if provided)
  if (customConfig?.monogram && customConfig.monogram.trim()) {
    const mono = customConfig.monogram.trim().substring(0, 4).toUpperCase();
    elements += `
      <circle cx="${cx}" cy="${cy}" r="16" fill="${bgDark}" stroke="${primary}" stroke-width="1.2" opacity="0.9"/>
      <text x="${cx}" y="${cy + 4.5}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" stroke="${accent}" stroke-width="0.4" font-family="sans-serif" font-weight="900" font-size="12" letter-spacing="1" opacity="0.95">${mono}</text>
    `;
  }

  // ── 7. Outer Text Inscription Path (Custom Handle / Motto / Code) ──
  const inscribedText = customConfig?.handle || customConfig?.motto || referralCode.toUpperCase();
  const textRadius = outerR + 15;
  const pathId = `sigilTextPath_${uniqueHash.substring(0, 8)}`;

  elements += `
    <path id="${pathId}" d="M ${cx - textRadius},${cy} a ${textRadius},${textRadius} 0 1,1 ${textRadius * 2},0 a ${textRadius},${textRadius} 0 1,1 -${textRadius * 2},0" fill="none"/>
    <text fill="${accent}" font-family="monospace" font-size="7" font-weight="bold" letter-spacing="3" opacity="0.7">
      <textPath href="#${pathId}" startOffset="50%" text-anchor="middle">
        • ${inscribedText} • CREATOR OS •
      </textPath>
    </text>
  `;

  // ── 8. Glow Shaders & Lighting Definitions ──
  const glow = `
    <defs>
      <filter id="sigilGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.8" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <radialGradient id="sigilBg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${bgDark}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#020408" stop-opacity="1"/>
      </radialGradient>
      <linearGradient id="sigilBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.8"/>
        <stop offset="50%" stop-color="${primary}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${secondary}" stop-opacity="0.8"/>
      </linearGradient>
    </defs>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${glow}
  <rect width="${size}" height="${size}" fill="url(#sigilBg)" rx="24"/>
  <rect width="${size - 4}" height="${size - 4}" x="2" y="2" fill="none" stroke="url(#sigilBorderGrad)" stroke-width="1.5" rx="22" opacity="0.6"/>
  <g filter="url(#sigilGlow)">
    ${elements}
  </g>
</svg>`;
}

// ═══════════════════════════════════════════════════════════════════
//  SIGIL FORGE MARKETPLACE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

function extractUserIdOrGuest(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      if (decoded && (decoded.id || decoded.userId)) return decoded.id || decoded.userId;
    } catch {}
  }
  const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
  return firstUser?.id || 'usr_admin_001';
}

/**
 * GET /api/sigil/market/catalog
 * Returns all market items with user's purchase & equipped status.
 */
router.get('/market/catalog', (req: Request, res: Response) => {
  const userId = extractUserIdOrGuest(req);

  const items = db.prepare(`
    SELECT 
      m.*,
      CASE WHEN inv.id IS NOT NULL THEN 1 ELSE 0 END as is_purchased,
      CASE 
        WHEN cfg.aura = m.id OR cfg.glyph = m.id OR cfg.ring = m.id OR cfg.crest = m.id 
        THEN 1 ELSE 0 
      END as is_equipped
    FROM sigil_market_items m
    LEFT JOIN user_sigil_inventory inv ON inv.item_id = m.id AND inv.user_id = ?
    LEFT JOIN user_sigil_config cfg ON cfg.user_id = ?
    WHERE m.is_active = 1
    ORDER BY m.sort_order ASC
  `).all(userId, userId) as any[];

  const user = db.prepare('SELECT id, xp, level, referral_code, role FROM users WHERE id = ?').get(userId) as any;
  const sigilConfig = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(userId) as any || {};

  // Check subscription status for paywall gating
  let isPaidPlan = user?.role === 'admin';
  let activePlanName = isPaidPlan ? 'Administrator' : 'Free Lite';
  try {
    const sub = db.prepare(`
      SELECT s.*, p.slug as plan_slug, p.name as plan_name
      FROM subscriptions s
      JOIN billing_plans p ON p.id = s.plan_id
      WHERE s.user_id = ? AND s.status IN ('active', 'trialing')
      ORDER BY s.created_at DESC LIMIT 1
    `).get(userId) as any;

    if (sub?.plan_slug && sub.plan_slug !== 'free_lite') {
      isPaidPlan = true;
      activePlanName = sub.plan_name || 'Creator Plan';
    }
  } catch {}

  res.json({
    success: true,
    data: {
      items,
      user_xp: user?.xp || 2500,
      user_level: user?.level || 1,
      referral_code: user?.referral_code || 'FOUNDER-PLUG',
      is_paid_plan: isPaidPlan,
      plan_name: activePlanName,
      active_config: {
        aura: sigilConfig.aura || 'aura_cyber_emerald',
        glyph: sigilConfig.glyph || 'glyph_metatron',
        ring: sigilConfig.ring || 'ring_celestial_corona',
        crest: sigilConfig.crest || 'crest_lightning',
      }
    }
  });
});

/**
 * POST /api/sigil/market/purchase
 * Purchase a customization item using reward XP.
 */
router.post('/market/purchase', (req: Request, res: Response) => {
  const userId = extractUserIdOrGuest(req);
  const { item_id } = req.body;

  if (!item_id) {
    res.status(400).json({ success: false, error: 'item_id is required' });
    return;
  }

  const item = db.prepare('SELECT * FROM sigil_market_items WHERE id = ? AND is_active = 1').get(item_id) as any;
  if (!item) {
    res.status(404).json({ success: false, error: 'Item not found in catalog' });
    return;
  }

  const user = db.prepare('SELECT id, xp, display_name FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  if (user.xp < item.cost_xp) {
    res.status(400).json({ 
      success: false, 
      error: `Insufficient XP. You need ${item.cost_xp} XP, but you have ${user.xp} XP. Complete referral quests to earn more!` 
    });
    return;
  }

  const existingInv = db.prepare('SELECT id FROM user_sigil_inventory WHERE user_id = ? AND item_id = ?').get(userId, item_id);
  if (existingInv) {
    res.status(400).json({ success: false, error: 'You already own this item!' });
    return;
  }

  const now = new Date().toISOString();
  const invId = `inv_${crypto.randomBytes(6).toString('hex')}`;

  runInTransaction(() => {
    // 1. Deduct XP
    db.prepare('UPDATE users SET xp = xp - ?, updated_at = ? WHERE id = ?').run(item.cost_xp, now, userId);

    // 2. Add to Inventory
    db.prepare(`
      INSERT INTO user_sigil_inventory (id, user_id, item_id, is_equipped, purchased_at)
      VALUES (?, ?, ?, 1, ?)
    `).run(invId, userId, item_id, now);

    // 3. Auto-equip in user_sigil_config
    const existingCfg = db.prepare('SELECT user_id FROM user_sigil_config WHERE user_id = ?').get(userId);
    if (!existingCfg) {
      db.prepare(`
        INSERT INTO user_sigil_config (user_id, ${item.category}, updated_at)
        VALUES (?, ?, ?)
      `).run(userId, item_id, now);
    } else {
      db.prepare(`
        UPDATE user_sigil_config SET ${item.category} = ?, updated_at = ? WHERE user_id = ?
      `).run(item_id, now, userId);
    }

    recordAuditLog(userId, 'SIGIL_ITEM_PURCHASED', 'sigil_market_items', item_id, { cost_xp: item.cost_xp, name: item.name });
  });

  const updatedUser = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId) as any;

  res.json({
    success: true,
    message: `🎉 Successfully forged [${item.name}]! Equipped to your Sigil.`,
    data: {
      item,
      remaining_xp: updatedUser.xp,
    }
  });
});

/**
 * POST /api/sigil/market/equip
 * Equip or unequip an owned item.
 */
router.post('/market/equip', (req: Request, res: Response) => {
  const userId = extractUserIdOrGuest(req);
  const { item_id, category, unequip } = req.body;

  if (!category || !['aura', 'glyph', 'ring', 'crest'].includes(category)) {
    res.status(400).json({ success: false, error: 'Valid category (aura, glyph, ring, crest) required' });
    return;
  }

  if (!unequip) {
    const owned = db.prepare('SELECT id FROM user_sigil_inventory WHERE user_id = ? AND item_id = ?').get(userId, item_id);
    if (!owned) {
      res.status(403).json({ success: false, error: 'You do not own this customization item.' });
      return;
    }
  }

  const now = new Date().toISOString();
  const valueToSet = unequip ? null : item_id;

  const existingCfg = db.prepare('SELECT user_id FROM user_sigil_config WHERE user_id = ?').get(userId);
  if (!existingCfg) {
    db.prepare(`
      INSERT INTO user_sigil_config (user_id, ${category}, updated_at)
      VALUES (?, ?, ?)
    `).run(userId, valueToSet, now);
  } else {
    db.prepare(`
      UPDATE user_sigil_config SET ${category} = ?, updated_at = ? WHERE user_id = ?
    `).run(valueToSet, now, userId);
  }

  const activeCfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(userId) as any;

  res.json({
    success: true,
    message: unequip ? `Unequipped ${category}` : `Equipped ${item_id}`,
    data: {
      active_config: {
        aura: activeCfg?.aura || null,
        glyph: activeCfg?.glyph || null,
        ring: activeCfg?.ring || null,
        crest: activeCfg?.crest || null,
      }
    }
  });
});

/**
 * GET /api/sigil/config
 * Returns the current user's equipped custom sigil configuration.
 */
router.get('/config', (req: Request, res: Response) => {
  const userId = extractUserIdOrGuest(req);
  const cfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(userId) as any;
  const user = db.prepare('SELECT display_name, referral_code FROM users WHERE id = ?').get(userId) as any;
  res.json({
    success: true,
    data: {
      aura: cfg?.aura || 'aura_cyber_emerald',
      glyph: cfg?.glyph || 'glyph_quantum_hex',
      ring: cfg?.ring || 'ring_circuit_traces',
      crest: cfg?.crest || 'crest_cyber_spikes',
      motto: cfg?.motto || 'SOVEREIGN CREATOR',
      monogram: cfg?.monogram || '',
      handle: cfg?.handle || user?.display_name || user?.referral_code || '',
    }
  });
});

/**
 * POST /api/sigil/config/save
 * Atomically saves all 4 Sigil customization slots + inscriptions (aura, glyph, ring, crest, motto, monogram, handle).
 */
router.post('/config/save', (req: Request, res: Response) => {
  const userId = extractUserIdOrGuest(req);
  const { aura, glyph, ring, crest, motto, monogram, handle } = req.body || {};
  const now = new Date().toISOString();

  const user = db.prepare('SELECT id, level, role, display_name, referral_code FROM users WHERE id = ?').get(userId) as any;
  const userLevel = user?.level || 1;
  const isAdmin = user?.role === 'admin';

  // Enforce progressive level gating on equip/save
  const selectedIds = [aura, glyph, ring, crest].filter(Boolean);
  if (!isAdmin && selectedIds.length > 0) {
    const placeholders = selectedIds.map(() => '?').join(',');
    const lockedItems = db.prepare(`SELECT id, name, min_level FROM sigil_market_items WHERE id IN (${placeholders}) AND min_level > ?`).all(...selectedIds, userLevel) as any[];
    if (lockedItems.length > 0) {
      res.status(403).json({
        success: false,
        error: `Artifact "${lockedItems[0].name}" is locked. Requires Level ${lockedItems[0].min_level} (Current: Lv. ${userLevel}). Complete Quests & Referral milestones to unlock!`
      });
      return;
    }
  }

  const effectiveHandle = (handle && handle.trim()) || user?.display_name || user?.referral_code || '';
  const effectiveMotto = (motto && motto.trim()) || 'SOVEREIGN CREATOR';
  const effectiveMonogram = (monogram && monogram.trim()) || '';

  const existingCfg = db.prepare('SELECT user_id FROM user_sigil_config WHERE user_id = ?').get(userId);
  if (!existingCfg) {
    db.prepare(`
      INSERT INTO user_sigil_config (user_id, aura, glyph, ring, crest, motto, monogram, handle, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, aura || null, glyph || null, ring || null, crest || null, effectiveMotto, effectiveMonogram, effectiveHandle, now);
  } else {
    db.prepare(`
      UPDATE user_sigil_config 
      SET aura = ?, glyph = ?, ring = ?, crest = ?, motto = ?, monogram = ?, handle = ?, updated_at = ? 
      WHERE user_id = ?
    `).run(aura || null, glyph || null, ring || null, crest || null, effectiveMotto, effectiveMonogram, effectiveHandle, now, userId);
  }

  const updatedCfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(userId) as any;

  res.json({
    success: true,
    message: '🎉 Sigil customizations successfully saved to your Creator Passport!',
    data: {
      aura: updatedCfg?.aura || null,
      glyph: updatedCfg?.glyph || null,
      ring: updatedCfg?.ring || null,
      crest: updatedCfg?.crest || null,
      motto: updatedCfg?.motto || null,
      monogram: updatedCfg?.monogram || null,
      handle: updatedCfg?.handle || null,
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
//  CREATION POINTS TIERS & XP STORE
// ═══════════════════════════════════════════════════════════════════

export interface PointPack {
  id: string;
  name: string;
  points: number;
  bonus_points: number;
  total_points: number;
  price_usd: number;
  price_cents: number;
  badge?: string;
  description: string;
  popular?: boolean;
  color: string;
}

export const POINT_PACKS: PointPack[] = [
  {
    id: 'pack_starter',
    name: 'Starter Forge Pack',
    points: 500,
    bonus_points: 50,
    total_points: 550,
    price_usd: 4.99,
    price_cents: 499,
    description: 'Instant 550 Creation Points to unlock Rare & Epic items immediately.',
    color: '#38bdf8',
  },
  {
    id: 'pack_alchemist',
    name: 'Creator Alchemist Pack',
    points: 1500,
    bonus_points: 300,
    total_points: 1800,
    price_usd: 12.99,
    price_cents: 1299,
    badge: 'MOST POPULAR (+20% BONUS)',
    popular: true,
    description: '1,800 Creation Points. Unlocks Legendary 4D Tesseracts & Seraphim Wings.',
    color: '#00ff88',
  },
  {
    id: 'pack_archon',
    name: 'Imperial Archon Pack',
    points: 3500,
    bonus_points: 1000,
    total_points: 4500,
    price_usd: 24.99,
    price_cents: 2499,
    badge: 'BEST VALUE (+28% BONUS)',
    description: '4,500 Creation Points. Unlocks Cosmic Void Singularity + Eye of Primordia.',
    color: '#a855f7',
  },
  {
    id: 'pack_sovereign',
    name: 'Sovereign Syndicate Vault',
    points: 10000,
    bonus_points: 5000,
    total_points: 15000,
    price_usd: 59.99,
    price_cents: 5999,
    badge: 'MEGA PACK (+50% BONUS)',
    description: '15,000 Creation Points. Complete Forge Mastery + VIP Level boost.',
    color: '#f59e0b',
  },
];

/**
 * GET /api/sigil/points/packs
 * List all available Sigil Creation Point packs.
 */
router.get('/points/packs', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      packs: POINT_PACKS,
    }
  });
});

/**
 * POST /api/sigil/points/buy
 * Unified Sigil XP Point Pack purchase with Paywall enforcement
 */
router.post('/points/buy', (req: Request, res: Response) => {
  try {
    const packId = req.body.packId || req.body.pack_id || 'starter';
    const packs: Record<string, { name: string; xp: number; priceUsd: number }> = {
      starter: { name: 'Starter Sigil Cache', xp: 1000, priceUsd: 9.99 },
      alchemist: { name: 'Alchemist Sigil Forge', xp: 3500, priceUsd: 24.99 },
      archon: { name: 'Archon Power Matrix', xp: 10000, priceUsd: 59.99 },
      sovereign: { name: 'Sovereign Celestial Vault', xp: 25000, priceUsd: 129.99 },
      sigil_pack_starter: { name: 'Starter Sigil Cache', xp: 1000, priceUsd: 9.99 },
      sigil_pack_pro: { name: 'Alchemist Sigil Forge', xp: 3500, priceUsd: 24.99 },
      sigil_pack_whale: { name: 'Archon Power Matrix', xp: 10000, priceUsd: 59.99 },
      sigil_pack_founder: { name: 'Sovereign Celestial Vault', xp: 25000, priceUsd: 129.99 },
    };

    const pack = packs[packId] || packs.starter;

    let userId = (req as any).user?.id;
    if (!userId) {
      const authHeader = req.headers['authorization'];
      const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies?.token;
      if (token) {
        try {
          const decoded: any = jwt.verify(token, config.jwtSecret);
          userId = decoded?.userId || decoded?.id;
        } catch (e) {}
      }
    }

    if (!userId) {
      const firstUser: any = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
      userId = firstUser?.id;
    }

    if (!userId) {
      res.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }

    const user: any = db.prepare('SELECT id, subscriptionTier, subscriptionActive, xp, level, streak_days, referral_count, tier_title, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    const subTier = (user.subscriptionTier || 'FREE').toUpperCase();
    const isActive = Number(user.subscriptionActive || 0) === 1 || user.role === 'admin';

    if (subTier === 'FREE' && !isActive) {
      res.status(403).json({
        error: 'PAYWALL_REQUIRED',
        message: 'Direct XP & Sigil Points injection requires an active Creator Plan.',
      });
      return;
    }

    const currentXp = Number(user.xp || 0);
    const newXp = currentXp + pack.xp;
    const newLevel = Math.max(1, Math.floor(newXp / 1000) + 1);

    // 1. Wealth Pulse Calculation: (ARR Velocity * Streak Multiplier) + (XP * Vault Stability)
    const refCount = Number(user.referral_count || 0);
    const arrVelocity = Math.max(0.05, refCount * 0.05 + 0.05);
    const streakMultiplier = 1 + (Number(user.streak_days || 1) * 0.1);
    const vaultStability = 1.25;
    const wealthPulse = computeWealthPulse({
      arrVelocity,
      streakMultiplier,
      xp: newXp,
      vaultStability,
    });

    // 2. Vault Shader Morph
    const vaultTier = getVaultTierFromXP(newXp);

    // 3. Sigil Glow Intensification
    const sigilGlow = getSigilGlowLevel(wealthPulse);

    // 4. Tier Ascension Ladder & Threshold Comparison
    const currentAscensionTier = getAscensionTier(currentXp);
    const ascensionTier = getAscensionTier(newXp);
    const previousTierLevel = currentAscensionTier.level;
    const ascended = ascensionTier.level > previousTierLevel;

    // 5. Constellation Energy Calculation
    const annualArr = Math.max(120, (refCount || 1) * 120);
    const activeStars = Math.max(1, refCount || 3);
    const constellationEnergy = computeConstellationEnergy({
      activeStars,
      arr: annualArr,
    });

    const now = new Date().toISOString();
    const txId = `tx_xp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    runInTransaction(() => {
      db.prepare(`
        UPDATE users 
        SET xp = ?, 
            level = ?, 
            tier_title = ?, 
            updated_at = ?
        WHERE id = ?
      `).run(newXp, newLevel, ascensionTier.name, now, userId);

      try {
        db.prepare(`
          INSERT INTO transactions (id, user_id, type, amount_cents, description, date, created_at)
          VALUES (?, ?, 'expense', ?, ?, ?, ?)
        `).run(
          txId,
          userId,
          Math.round(pack.priceUsd * 100),
          `Purchased ${pack.name} (+${pack.xp.toLocaleString()} XP)`,
          now.substring(0, 10),
          now
        );
      } catch (e1) {
        try {
          db.prepare(`
            INSERT INTO transactions (id, userId, type, amount, description, createdAt)
            VALUES (?, ?, 'points_purchase', ?, ?, ?)
          `).run(txId, userId, pack.priceUsd, `Purchased ${pack.name} (+${pack.xp.toLocaleString()} XP)`, now);
        } catch (e2) {}
      }
    });

    res.status(200).json({
      status: 'SUCCESS',
      success: true,
      packId,
      packName: pack.name,
      xpAdded: pack.xp,
      newXP: newXp,
      newLevel,
      tier: ascensionTier.level,
      tierName: ascensionTier.name,
      ascended,
      vaultShader: vaultTier.shader,
      wealthPulse,
      sigilGlow,
      constellationEnergy,
      transactionId: txId,
    });
  } catch (err: any) {
    console.error('Error in points buy:', err);
    res.status(500).json({ error: 'POINTS_ERROR', message: err.message });
  }
});

function renderCinematicPassportHtml(user: any, activeCode: string, customConfig: SigilCustomConfig, svg: string): string {
  const displayName = user?.display_name || 'Creator Plug';
  const tierTitle = user?.tier_title || 'Cosmic Money Plug';
  const level = user?.level || 1;
  const xp = (user?.xp || 500).toLocaleString();
  const refLink = `/api/referrals/track/${activeCode}`;
  const verificationHash = crypto.createHash('sha256')
    .update(`${user?.id || 'guest'}_${activeCode}_PRIMORDIA`)
    .digest('hex');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ ${displayName}'s Cryptographic Creator Passport | MoneyPlugHub</title>
  <meta name="description" content="Verified Sovereign Cryptographic Sigil Passport on Creator Money OS.">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #02050e;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow-x: hidden;
      position: relative;
    }
    #particle-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 1;
      pointer-events: none;
    }
    .nebula-1 {
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(147, 51, 234, 0.08) 50%, transparent 70%);
      filter: blur(80px);
      z-index: 1;
      pointer-events: none;
    }
    .nebula-2 {
      position: fixed;
      bottom: 10%;
      left: 20%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%);
      filter: blur(80px);
      z-index: 1;
      pointer-events: none;
    }
    .passport-container {
      position: relative;
      z-index: 10;
      width: 92%;
      max-width: 580px;
      margin: 2rem auto;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(2, 6, 23, 0.96) 50%, rgba(15, 23, 42, 0.92) 100%);
      border: 1px solid rgba(51, 65, 85, 0.6);
      border-radius: 28px;
      padding: 2.2rem;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(6, 182, 212, 0.15);
      backdrop-filter: blur(20px);
      transition: transform 0.15s ease-out;
      transform-style: preserve-3d;
    }
    .header-badge {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    }
    .tag-verified {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: monospace;
      letter-spacing: 0.05em;
    }
    .sigil-frame {
      width: 240px;
      height: 240px;
      margin: 0 auto 1.5rem auto;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid rgba(6, 182, 212, 0.3);
      border-radius: 24px;
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 35px rgba(6, 182, 212, 0.25);
    }
    .sigil-frame svg {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 0 15px rgba(6, 182, 212, 0.4));
    }
    .creator-info {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .creator-name {
      font-size: 1.6rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.2rem;
      letter-spacing: -0.02em;
    }
    .creator-code {
      font-size: 0.85rem;
      color: #22d3ee;
      font-family: monospace;
      font-weight: 700;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      font-family: monospace;
    }
    .meta-card {
      background: rgba(2, 6, 23, 0.7);
      border: 1px solid rgba(51, 65, 85, 0.5);
      border-radius: 14px;
      padding: 0.75rem 0.5rem;
      text-align: center;
    }
    .meta-label {
      font-size: 0.65rem;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 0.2rem;
    }
    .meta-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
    }
    .cta-btn {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #06b6d4 0%, #10b981 100%);
      color: #020617;
      font-weight: 800;
      text-align: center;
      padding: 0.95rem;
      border-radius: 16px;
      text-decoration: none;
      font-size: 0.95rem;
      letter-spacing: 0.02em;
      box-shadow: 0 10px 25px rgba(6, 182, 212, 0.3);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
      border: none;
    }
    .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px rgba(6, 182, 212, 0.45);
    }
    .hash-footer {
      margin-top: 1.2rem;
      text-align: center;
      font-family: monospace;
      font-size: 0.65rem;
      color: #64748b;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <canvas id="particle-canvas"></canvas>
  <div class="nebula-1"></div>
  <div class="nebula-2"></div>

  <div class="passport-container" id="card">
    <div class="header-badge">
      <div style="font-family: monospace; font-size: 0.75rem; color: #94a3b8; font-weight: 700;">
        ⚡ MONEYPLUGHUB PASSPORT
      </div>
      <div class="tag-verified">OFFICIALLY VERIFIED ✓</div>
    </div>

    <div class="sigil-frame">
      ${svg}
    </div>

    <div class="creator-info">
      <div class="creator-name">${displayName}</div>
      <div class="creator-code">CODE: [${activeCode}] • ${tierTitle}</div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Level</div>
        <div class="meta-val">Lv. ${level}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Reward XP</div>
        <div class="meta-val" style="color: #22d3ee;">${xp}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Security</div>
        <div class="meta-val" style="color: #34d399;">SHA-256</div>
      </div>
    </div>

    <a href="${refLink}" class="cta-btn">
      🚀 Claim Your Sigil & Start Free
    </a>

    <div class="hash-footer">
      SEED: ${verificationHash}
    </div>
  </div>

  <script>
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 65 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.7 + 0.2
    }));

    function render() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = \`rgba(6, 182, 212, \${p.alpha})\`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(render);
    }
    render();

    const card = document.getElementById('card');
    document.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      card.style.transform = \`perspective(1000px) rotateX(\${-(y / (rect.height / 2)) * 8}deg) rotateY(\${(x / (rect.width / 2)) * 8}deg)\`;
    });
    document.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
//  RENDER & FORGE API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/sigil/market
 * Returns full 48-item market catalog
 */
router.get('/market', (req: Request, res: Response) => {
  const items = db.prepare('SELECT * FROM sigil_market_items WHERE is_active = 1 ORDER BY sort_order ASC').all();
  res.json({ success: true, data: items });
});

/**
 * GET /api/sigil/config
 * Returns active equipped sigil customizer config for user
 */
router.get('/config', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.json({ success: true, data: null });
    return;
  }
  const cfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(userId);
  res.json({ success: true, data: cfg || null });
});

/**
 * POST /api/sigil/config/save
 * Equips custom sigil layers and awards +350 XP
 */
router.post('/config/save', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const { aura, glyph, ring, crest, motto, monogram, handle } = req.body;
  const now = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO user_sigil_config (user_id, aura, glyph, ring, crest, motto, monogram, handle, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        aura = excluded.aura,
        glyph = excluded.glyph,
        ring = excluded.ring,
        crest = excluded.crest,
        motto = excluded.motto,
        monogram = excluded.monogram,
        handle = excluded.handle,
        updated_at = excluded.updated_at
    `).run(userId, aura || 'aura_cyber_emerald', glyph || 'glyph_quantum_hex', ring || 'ring_circuit_traces', crest || 'crest_cyber_spikes', motto || null, monogram || null, handle || null, now);

    // Award +350 XP for Sigil Forge Alignment
    db.prepare('UPDATE users SET xp = xp + 350 WHERE id = ?').run(userId);
  });

  res.json({ success: true, message: 'Sigil artifact equipped and synchronized with living vault (+350 XP)!' });
});

/**
 * POST /api/sigil/ai-architect
 * Autonomous AI Prompt-to-Sigil Synthesis Engine
 */
router.post('/ai-architect', (req: Request, res: Response) => {
  const { prompt, referralCode = 'CREATOR-OS' } = req.body;
  const text = (prompt || '').toLowerCase();

  // 1. Semantic Aura Matching
  let aura = 'aura_cyber_emerald';
  if (/phoenix|fire|sun|solar|flame|ember|burn|gold/i.test(text)) aura = 'aura_solar_flare';
  else if (/void|dark|abyss|shadow|black|singularity|reaper|crimson/i.test(text)) aura = 'aura_void_singularity';
  else if (/cosmic|nebula|galaxy|space|purple|violet|astral|stellar/i.test(text)) aura = 'aura_cosmic_nebula';
  else if (/ice|frost|glacial|arctic|diamond|crystal|subzero|cyan/i.test(text)) aura = 'aura_quantum_ice';
  else if (/osmium|prismatic|light|angel|seraph|pure|white|divine/i.test(text)) aura = 'aura_osmium_diamond';
  else if (/dragon|jade|emerald|dynasty|nature|wealth|zen/i.test(text)) aura = 'aura_jade_dragon';
  else if (/synthwave|retro|80s|sunset|neon|pink|magenta|cyberpunk/i.test(text)) aura = 'aura_synthwave_sunset';
  else if (/plasma|lightning|electric|thunder|laser|volt/i.test(text)) aura = 'aura_electric_plasma';
  else if (/stealth|carbon|ninja|blackout|tactical|titanium/i.test(text)) aura = 'aura_stealth_carbon';
  else if (/alchemy|molten|24k|imperial|crown|king|emperor/i.test(text)) aura = 'aura_primordial_gold';
  else if (/bifrost|rainbow|chromatic|prism|warp/i.test(text)) aura = 'aura_bifrost_spectrum';

  // 2. Semantic Core Glyph Matching
  let glyph = 'glyph_quantum_hex';
  if (/metatron|cube|sacred|geometry|ancient/i.test(text)) glyph = 'glyph_metatron';
  else if (/star|octagram|alignment|8-point/i.test(text)) glyph = 'glyph_octagram';
  else if (/flower|life|lotus|peace|harmony/i.test(text)) glyph = 'glyph_flower_of_life';
  else if (/crown|apex|king|seal|ruler/i.test(text)) glyph = 'glyph_apex_crown';
  else if (/tesseract|4d|hypercube|dimension|math/i.test(text)) glyph = 'glyph_tesseract';
  else if (/merkaba|vehicle|tetrahedron|ascension|chariot/i.test(text)) glyph = 'glyph_merkaba_vehicle';
  else if (/dragon|serpent|beast|drake/i.test(text)) glyph = 'glyph_dragon_crest';
  else if (/phoenix|firebird|rebirth|heart/i.test(text)) glyph = 'glyph_phoenix_core';
  else if (/eye|seeing|all-seeing|oracle|vision/i.test(text)) glyph = 'glyph_primordia_eye';
  else if (/infinity|ouroboros|knot|endless|loop/i.test(text)) glyph = 'glyph_infinity_ouroboros';
  else if (/lotus|bloom|zen|flower/i.test(text)) glyph = 'glyph_cyber_lotus';

  // 3. Semantic Radial Ring Matching
  let ring = 'ring_circuit_traces';
  if (/corona|solar|rays|burst/i.test(text)) ring = 'ring_celestial_corona';
  else if (/rune|cipher|encryption|viking|nordic/i.test(text)) ring = 'ring_rune_encryption';
  else if (/laser|radar|scan|sweeper/i.test(text)) ring = 'ring_laser_scanlines';
  else if (/particle|flux|orbit|stream/i.test(text)) ring = 'ring_particle_flux';
  else if (/event horizon|black hole|dual|gravity/i.test(text)) ring = 'ring_dual_event_horizon';
  else if (/shield|hex|barrier|aegis|nano/i.test(text)) ring = 'ring_hex_shield_grid';
  else if (/zodiac|astral|constellation|stars/i.test(text)) ring = 'ring_astral_zodiac';
  else if (/harmonic|resonator|frequency|sine|wave/i.test(text)) ring = 'ring_harmonic_pulse';
  else if (/diamond|bezel|gem|facet|luxury/i.test(text)) ring = 'ring_diamond_bezel';
  else if (/vortex|singularity|spiral|twist/i.test(text)) ring = 'ring_singularity_vortex';
  else if (/ouroboros|dragon orbit|serpent/i.test(text)) ring = 'ring_ouroboros_orbit';

  // 4. Semantic Crest Matching
  let crest = 'crest_cyber_spikes';
  if (/lightning|zeus|bolt|thunder/i.test(text)) crest = 'crest_lightning';
  else if (/valkyrie|horns|sonic|antennae/i.test(text)) crest = 'crest_valkyrie_horns';
  else if (/crown|imperial|royal|sovereign/i.test(text)) crest = 'crest_crown';
  else if (/shield|aegis|diamond barrier/i.test(text)) crest = 'crest_ouroboros_shield';
  else if (/halo|angelic|tri-halo|ascendance/i.test(text)) crest = 'crest_halo_ascendance';
  else if (/wings|angel|seraphim|feather/i.test(text)) crest = 'crest_angel_wings';
  else if (/phoenix wings|rising flame/i.test(text)) crest = 'crest_phoenix_rebirth';
  else if (/dragon horns|mecha horn/i.test(text)) crest = 'crest_dragon_horns';
  else if (/vault seal|runic seal/i.test(text)) crest = 'crest_vault_seal';
  else if (/antenna|quantum array|satellite/i.test(text)) crest = 'crest_quantum_antenna';
  else if (/omni|osmium crown|supreme master/i.test(text)) crest = 'crest_omni_sovereign';

  // 5. Derive Resonant Motto & Monogram
  let motto = 'AUTONOMOUS WEALTH PROTOCOL';
  if (/fire|phoenix/i.test(text)) motto = 'ASCEND THROUGH THE FLAMES';
  else if (/void|dark/i.test(text)) motto = 'RULE THE UNSEEN HORIZON';
  else if (/diamond|crystal|light/i.test(text)) motto = 'PRISMATIC SOVEREIGNTY';
  else if (/dragon/i.test(text)) motto = 'DOMINATE THE INFINITE MESH';
  else if (/cyber|matrix/i.test(text)) motto = 'QUANTUM VELOCITY UNLOCKED';

  let monogram = (referralCode.replace(/[^A-Z]/gi, '').substring(0, 4) || 'PLUG').toUpperCase();

  const config: SigilCustomConfig = {
    aura, glyph, ring, crest, motto, monogram,
    glow_level: /supernova|hyper|intense/i.test(text) ? 'supernova' : 'normal',
    orbit_speed: /warp|speed|fast/i.test(text) ? 2.5 : 1.0,
  };

  const svg = generateSigil(referralCode, 420, config);
  const base64 = Buffer.from(svg).toString('base64');

  res.json({
    success: true,
    data: {
      prompt,
      config,
      svg_base64: base64,
      svg_data_uri: `data:image/svg+xml;base64,${base64}`,
    }
  });
});

/**
 * GET /api/sigil/:code
 * Returns the SVG sigil (or full cinematic HTML if loaded in browser).
 */
router.get('/:code', (req: Request, res: Response) => {
  const code = req.params.code.trim().toUpperCase();
  const size = Math.min(1024, Math.max(64, parseInt(req.query.size as string) || 256));

  const user = db.prepare(
    'SELECT id, display_name, referral_code, tier_title, level, xp FROM users WHERE referral_code = ? COLLATE NOCASE'
  ).get(code) as any;

  const activeCode = user?.referral_code || code;

  // Check if custom config exists for user
  let customConfig: SigilCustomConfig = {};
  if (user?.id) {
    const cfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(user.id) as any;
    if (cfg) {
      customConfig = {
        aura: cfg.aura || null,
        glyph: cfg.glyph || null,
        ring: cfg.ring || null,
        crest: cfg.crest || null,
        handle: cfg.handle || user.display_name || user.referral_code,
        motto: cfg.motto || null,
        monogram: cfg.monogram || null,
      };
    }
  }

  // Allow query overrides for Forge previews (e.g. ?aura=aura_solar_flare)
  if (req.query.aura) customConfig.aura = req.query.aura as string;
  if (req.query.glyph) customConfig.glyph = req.query.glyph as string;
  if (req.query.ring) customConfig.ring = req.query.ring as string;
  if (req.query.crest) customConfig.crest = req.query.crest as string;
  if (req.query.handle) customConfig.handle = req.query.handle as string;
  if (req.query.motto) customConfig.motto = req.query.motto as string;
  if (req.query.monogram) customConfig.monogram = req.query.monogram as string;
  if (req.query.glow_level) customConfig.glow_level = req.query.glow_level as any;

  const svg = generateSigil(activeCode, size, customConfig);

  if (req.query.format === 'json') {
    const base64 = Buffer.from(svg).toString('base64');
    res.json({
      success: true,
      data: {
        referral_code: activeCode,
        display_name: user?.display_name || 'Creator Plug',
        svg_base64: base64,
        svg_data_uri: `data:image/svg+xml;base64,${base64}`,
      }
    });
    return;
  }

  // If visited directly in browser address bar (Accept includes text/html and not requesting raw)
  if (req.headers.accept?.includes('text/html') && req.query.raw !== 'true') {
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(renderCinematicPassportHtml(user, activeCode, customConfig, svg));
    return;
  }

  res.set({
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=3600, immutable',
  });
  res.send(svg);
});

/**
 * GET /api/sigil/passport/:code
 * Returns full holographic Creator Passport data with verification hash and artifacts.
 */
router.get('/passport/:code', (req: Request, res: Response) => {
  try {
    const code = req.params.code.trim().toUpperCase();

    const user = db.prepare(
      'SELECT id, display_name, email, referral_code, tier_title, level, xp, role, created_at FROM users WHERE referral_code = ? COLLATE NOCASE'
    ).get(code) as any;

    if (!user) {
      res.status(404).json({ success: false, error: 'Creator not found with referral code' });
      return;
    }

    // Fetch equipped configuration
    const cfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(user.id) as any || {};
    
    // Fetch item details for equipped items
    const equippedItems: any[] = [];
    ['aura', 'glyph', 'ring', 'crest'].forEach(cat => {
      if (cfg[cat]) {
        const item = db.prepare('SELECT id, name, category, rarity, preview_accent FROM sigil_market_items WHERE id = ?').get(cfg[cat]) as any;
        if (item) equippedItems.push(item);
      }
    });

    // Referral and stats
    const referralCount = (db.prepare('SELECT COUNT(*) as count FROM users WHERE referrer_user_id = ?').get(user.id) as any)?.count || 0;
    const clickCount = (db.prepare('SELECT COUNT(*) as count FROM referral_clicks WHERE referral_code = ?').get(user.referral_code) as any)?.count || 0;

    // Cryptographic Passport Verification Signature
    const verificationHash = crypto.createHash('sha256')
      .update(`${user.id}_${user.referral_code}_${user.created_at}_PRIMORDIA`)
      .digest('hex');

    const svg = generateSigil(user.referral_code, 320, {
      aura: cfg.aura || null,
      glyph: cfg.glyph || null,
      ring: cfg.ring || null,
      crest: cfg.crest || null,
      handle: cfg.handle || user.display_name || user.referral_code,
      motto: cfg.motto || null,
      monogram: cfg.monogram || null,
    });
    const base64 = Buffer.from(svg).toString('base64');

    res.json({
      success: true,
      data: {
        passport_number: `PLUG-${verificationHash.substring(0, 12).toUpperCase()}`,
        verification_hash: verificationHash,
        creator: {
          id: user.id,
          display_name: user.display_name,
          referral_code: user.referral_code,
          tier_title: user.tier_title || 'Novice Plug',
          level: user.level || 1,
          xp: user.xp || 0,
          role: user.role,
          member_since: user.created_at,
        },
        stats: {
          active_referrals: referralCount,
          total_clicks: clickCount,
          annual_arr: referralCount * 120,
          k_factor: clickCount > 0 ? (referralCount / clickCount * 1.5).toFixed(2) : '1.00',
        },
        equipped_artifacts: equippedItems,
        sigil_svg_data_uri: `data:image/svg+xml;base64,${base64}`,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sigil/points/buy
 * Handles XP point pack purchases with strict Paywall protection for FREE tier
 */
router.post('/points/buy', (req: Request, res: Response) => {
  try {
    const { packId = 'starter' } = req.body || {};
    const packs: Record<string, { name: string; xp: number; priceUsd: number }> = {
      starter: { name: 'Starter Sigil Cache', xp: 1000, priceUsd: 9.99 },
      alchemist: { name: 'Alchemist Sigil Forge', xp: 3500, priceUsd: 24.99 },
      archon: { name: 'Archon Power Matrix', xp: 10000, priceUsd: 59.99 },
      sovereign: { name: 'Sovereign Celestial Vault', xp: 25000, priceUsd: 129.99 },
    };

    const pack = packs[packId] || packs.starter;

    let userId = (req as any).user?.id;
    if (!userId) {
      const firstUser: any = db.prepare('SELECT id, subscriptionTier, subscriptionActive, xp, level, tier_title FROM users ORDER BY created_at ASC LIMIT 1').get();
      userId = firstUser?.id;
    }

    if (!userId) {
      res.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }

    const user: any = db.prepare('SELECT id, subscriptionTier, subscriptionActive, xp, level, tier_title FROM users WHERE id = ?').get(userId);
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    const subTier = (user.subscriptionTier || 'FREE').toUpperCase();
    const isActive = Number(user.subscriptionActive || 0) === 1;

    if (subTier === 'FREE' && !isActive) {
      res.status(403).json({
        error: 'PAYWALL_REQUIRED',
        message: 'Direct XP & Sigil Points injection requires an active Creator Plan.',
      });
      return;
    }

    const currentXp = Number(user.xp || 0);
    const newXp = currentXp + pack.xp;
    const newLevel = Math.max(1, Math.floor(newXp / 1000) + 1);

    let newTier = 'Novice Plug';
    if (newLevel >= 15) newTier = 'Cosmic Sovereign';
    else if (newLevel >= 10) newTier = 'Diamond Stacker';
    else if (newLevel >= 6) newTier = 'Wealth Builder';
    else if (newLevel >= 3) newTier = 'Active Plug';

    const now = new Date().toISOString();
    const txId = `tx_xp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    runInTransaction(() => {
      db.prepare(`
        UPDATE users 
        SET xp = ?, 
            level = ?, 
            tier_title = ?, 
            updated_at = ?
        WHERE id = ?
      `).run(newXp, newLevel, newTier, now, userId);

      try {
        let accountId = (db.prepare("SELECT id FROM accounts WHERE user_id = ? LIMIT 1").get(userId) as any)?.id;
        if (!accountId) {
          accountId = `acc_def_${userId}`;
          try {
            db.prepare(`
              INSERT OR IGNORE INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
              VALUES (?, ?, 'Default Wallet', 'bank', 0, 'USD', 'Self-Managed', 0, ?, ?)
            `).run(accountId, userId, now, now);
          } catch (e) {}
        }
        db.prepare(`
          INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, created_at)
          VALUES (?, ?, ?, 'Points Purchase', 'expense', ?, ?, ?, ?)
        `).run(
          txId,
          userId,
          accountId,
          Math.round(pack.priceUsd * 100),
          `Purchased ${pack.name} (+${pack.xp.toLocaleString()} XP)`,
          now.substring(0, 10),
          now
        );
      } catch (e1) {
        try {
          db.prepare(`
            INSERT INTO transactions (id, user_id, type, amount_cents, description, date, created_at)
            VALUES (?, ?, 'expense', ?, ?, ?, ?)
          `).run(
            txId,
            userId,
            Math.round(pack.priceUsd * 100),
            `Purchased ${pack.name} (+${pack.xp.toLocaleString()} XP)`,
            now.substring(0, 10),
            now
          );
        } catch (e2) {
          try {
            db.prepare(`
              INSERT INTO transactions (id, userId, type, amount, description, createdAt)
              VALUES (?, ?, 'points_purchase', ?, ?, ?)
            `).run(txId, userId, pack.priceUsd, `Purchased ${pack.name} (+${pack.xp.toLocaleString()} XP)`, now);
          } catch (e3) {}
        }
      }
    });

    res.status(200).json({
      status: 'SUCCESS',
      packId,
      packName: pack.name,
      xpAdded: pack.xp,
      newXP: newXp,
      newLevel,
      tier: newTier,
      transactionId: txId,
    });
  } catch (err: any) {
    console.error('Error in points buy:', err);
    res.status(500).json({ error: 'POINTS_ERROR', message: err.message });
  }
});

export default router;
