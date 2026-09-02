import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLivingRealm } from '../context/LivingRealmContext';
import { useGamificationXp } from '../context/GamificationXpContext';
import { PointPackButton } from '../components/PointPackButton';
import { NiagaraParticleCanvas } from '../components/NiagaraParticleCanvas';
import { forgeAudio } from '../utils/forgeAudio';
import { 
  Compass, Sparkles, Shield, Trophy, Zap, 
  RotateCw, Eye, Check, ShoppingBag, Lock, Crown, Award, 
  ExternalLink, Maximize2, RefreshCw, Loader2, Download,
  Sliders, Copy, Dices, Layers, ShieldCheck, Share2,
  Terminal, Sparkle, Flame, Gem, Palette, Type, Scan,
  Volume2, VolumeX, Image as ImageIcon, Wand2, Sun, Moon, Orbit, Cpu, Fingerprint,
  Code, Radio, Smartphone, Music, CheckCircle2
} from 'lucide-react';

interface SigilForgePageProps {
  onNavigate?: (tab: string) => void;
}

interface MarketItem {
  id: string;
  name: string;
  category: 'aura' | 'glyph' | 'ring' | 'crest';
  rarity: 'rare' | 'epic' | 'legendary' | 'cosmic';
  cost_xp: number;
  min_level: number;
  description: string;
  preview_accent: string;
}

interface MythicArchetype {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  accent: string;
  min_level: number;
  config: {
    aura: string;
    glyph: string;
    ring: string;
    crest: string;
    motto: string;
    monogram?: string;
  };
}

const MYTHIC_ARCHETYPES: MythicArchetype[] = [
  {
    id: 'novice_origin',
    name: 'Vector Novice',
    tagline: 'Cyber Matrix & Subatomic PCB Traces',
    icon: '🌱',
    accent: '#00ff88',
    min_level: 1,
    config: {
      aura: 'aura_cyber_emerald',
      glyph: 'glyph_quantum_hex',
      ring: 'ring_circuit_traces',
      crest: 'crest_cyber_spikes',
      motto: 'GENESIS OF WEALTH',
      monogram: 'PLUG',
    }
  },
  {
    id: 'synthwave_rider',
    name: 'Synthwave Pilot',
    tagline: 'Retro Horizon & 80s Grid',
    icon: '🌆',
    accent: '#ec4899',
    min_level: 2,
    config: {
      aura: 'aura_synthwave_sunset',
      glyph: 'glyph_processor_ic',
      ring: 'ring_radar_crosshairs',
      crest: 'crest_aerodynamic_fin',
      motto: 'SPEED & HORIZON',
      monogram: 'WAVE',
    }
  },
  {
    id: 'alchemist',
    name: 'Cosmic Alchemist',
    tagline: 'Cosmic Nebula & Sacred Geometry',
    icon: '🌌',
    accent: '#a855f7',
    min_level: 3,
    config: {
      aura: 'aura_cosmic_nebula',
      glyph: 'glyph_octagram',
      ring: 'ring_rune_encryption',
      crest: 'crest_valkyrie_horns',
      motto: 'INFINITE TRANSCENDENCE',
      monogram: 'ALCH',
    }
  },
  {
    id: 'frost_architect',
    name: 'Glacial Cryo Architect',
    tagline: 'Subzero Ice & Geometric Tesseract',
    icon: '❄️',
    accent: '#22d3ee',
    min_level: 4,
    config: {
      aura: 'aura_quantum_ice',
      glyph: 'glyph_tesseract',
      ring: 'ring_cryo_crystals',
      crest: 'crest_stellar_prism',
      motto: 'ZERO ENTROPY FLOW',
      monogram: 'CRYO',
    }
  },
  {
    id: 'phoenix',
    name: 'Phoenix Sovereign',
    tagline: 'Solar Flare & Continuous Rebirth',
    icon: '🔥',
    accent: '#f97316',
    min_level: 5,
    config: {
      aura: 'aura_solar_flare',
      glyph: 'glyph_apex_crown',
      ring: 'ring_particle_flux',
      crest: 'crest_ouroboros_shield',
      motto: 'UNSTOPPABLE REBIRTH',
      monogram: 'FIRE',
    }
  },
  {
    id: 'jade_emperor',
    name: 'Imperial Dynastic Jade',
    tagline: 'Dynastic Jade & Solar Prominence',
    icon: '🐲',
    accent: '#10b981',
    min_level: 6,
    config: {
      aura: 'aura_jade_dragon',
      glyph: 'glyph_flower_of_life',
      ring: 'ring_solar_prominence',
      crest: 'crest_halo_ascendance',
      motto: 'DYNASTIC HARMONY',
      monogram: 'JADE',
    }
  },
  {
    id: 'seraphim',
    name: 'Seraphim Ascendant',
    tagline: 'Osmium Crystal Light & Biometric Wings',
    icon: '🕊️',
    accent: '#38bdf8',
    min_level: 7,
    config: {
      aura: 'aura_osmium_diamond',
      glyph: 'glyph_merkaba_vehicle',
      ring: 'ring_hex_shield_grid',
      crest: 'crest_angel_wings',
      motto: 'PURE LIGHT ASCENT',
      monogram: 'SOV',
    }
  },
  {
    id: 'dragonlord',
    name: 'Cyber Dragonlord',
    tagline: 'Void Singularity & Mecha Dominance',
    icon: '🐉',
    accent: '#ef4444',
    min_level: 8,
    config: {
      aura: 'aura_void_singularity',
      glyph: 'glyph_dragon_crest',
      ring: 'ring_astral_zodiac',
      crest: 'crest_dragon_horns',
      motto: 'ETERNAL REIGN',
      monogram: 'DRGN',
    }
  },
  {
    id: 'stealth_titan',
    name: 'Stealth Carbon Titan',
    tagline: 'Carbon Fiber & Nanite Cloud Defense',
    icon: '🛡️',
    accent: '#94a3b8',
    min_level: 8,
    config: {
      aura: 'aura_stealth_carbon',
      glyph: 'glyph_archangel_sigil',
      ring: 'ring_nanite_swarm',
      crest: 'crest_ironclad_ram',
      motto: 'UNBREAKABLE DEFENSE',
      monogram: 'IRON',
    }
  },
  {
    id: 'archon_herald',
    name: 'Archon 6-Wing Herald',
    tagline: 'Tachyon Warp & Hexa-Wing Radiance',
    icon: '✨',
    accent: '#c084fc',
    min_level: 9,
    config: {
      aura: 'aura_warp_speed',
      glyph: 'glyph_primordia_eye',
      ring: 'ring_warp_bubble',
      crest: 'crest_archon_wings',
      motto: 'OMNISCIENT VISIONS',
      monogram: 'EYE',
    }
  },
  {
    id: 'emperor',
    name: 'Sovereign Emperor',
    tagline: 'Imperial 24K Gold & Osmium Dominion',
    icon: '👑',
    accent: '#ffd700',
    min_level: 10,
    config: {
      aura: 'aura_primordial_gold',
      glyph: 'glyph_infinity_ouroboros',
      ring: 'ring_ouroboros_orbit',
      crest: 'crest_omni_sovereign',
      motto: 'SOVEREIGN SUPREME',
      monogram: 'APEX',
    }
  },
  {
    id: 'omega_singularity',
    name: 'Omega Singularity Core',
    tagline: 'Bifrost Core & Zero-Entropy Singularity',
    icon: '🪐',
    accent: '#f472b6',
    min_level: 10,
    config: {
      aura: 'aura_bifrost_spectrum',
      glyph: 'glyph_osmium_singularity',
      ring: 'ring_singularity_vortex',
      crest: 'crest_omega_singularity',
      motto: 'INFINITE PRIME MATRIX',
      monogram: 'OMEG',
    }
  },
];

const AURAS_LIST: MarketItem[] = [
  { id: 'aura_cyber_emerald', name: 'Cyber Matrix', category: 'aura', rarity: 'rare', cost_xp: 250, min_level: 1, description: 'Neon Emerald & Cybernetic Laser Pulse shader (Starter Default).', preview_accent: '#00ff88' },
  { id: 'aura_synthwave_sunset', name: 'Retro Synthwave', category: 'aura', rarity: 'rare', cost_xp: 300, min_level: 2, description: 'Neon Magenta & Sunset Orange 80s synthwave horizon.', preview_accent: '#ec4899' },
  { id: 'aura_electric_plasma', name: 'Hyper Plasma', category: 'aura', rarity: 'rare', cost_xp: 350, min_level: 2, description: 'Ultraviolet laser discharge with ionized blue lightning arcs.', preview_accent: '#818cf8' },
  { id: 'aura_cosmic_nebula', name: 'Cosmic Nebula', category: 'aura', rarity: 'epic', cost_xp: 400, min_level: 3, description: 'Deep Supernova Violet & Cyan atmospheric plasma.', preview_accent: '#a855f7' },
  { id: 'aura_quantum_ice', name: 'Quantum Frost', category: 'aura', rarity: 'epic', cost_xp: 600, min_level: 4, description: 'Sub-zero Arctic Cyan & Diamond Frost refraction.', preview_accent: '#22d3ee' },
  { id: 'aura_solar_flare', name: 'Solar Flare', category: 'aura', rarity: 'epic', cost_xp: 750, min_level: 5, description: 'Radiant 24K Gold & Amber thermonuclear rays.', preview_accent: '#eab308' },
  { id: 'aura_jade_dragon', name: 'Jade Sovereign', category: 'aura', rarity: 'epic', cost_xp: 900, min_level: 6, description: 'Deep Dynastic Jade with incandescent emerald flame refraction.', preview_accent: '#10b981' },
  { id: 'aura_osmium_diamond', name: 'Osmium Diamond', category: 'aura', rarity: 'legendary', cost_xp: 1500, min_level: 7, description: 'Prismatic crystal refraction with iridescent dispersion.', preview_accent: '#38bdf8' },
  { id: 'aura_stealth_carbon', name: 'Stealth Carbon', category: 'aura', rarity: 'legendary', cost_xp: 1800, min_level: 8, description: 'Matte carbon-fiber weave with titanium laser telemetry accents.', preview_accent: '#94a3b8' },
  { id: 'aura_void_singularity', name: 'Void Singularity', category: 'aura', rarity: 'cosmic', cost_xp: 2500, min_level: 9, description: 'Event Horizon Dark Matter with glowing crimson accretion disk.', preview_accent: '#f43f5e' },
  { id: 'aura_primordial_gold', name: 'Primordia 24K Alchemy', category: 'aura', rarity: 'cosmic', cost_xp: 3500, min_level: 10, description: 'Liquid 24K Molten Gold with Aureate hyper-radiance.', preview_accent: '#ffd700' },
  { id: 'aura_bifrost_spectrum', name: 'Bifrost Spectrum', category: 'aura', rarity: 'cosmic', cost_xp: 4000, min_level: 10, description: 'Chromatic hyper-spectrum dispersion warping spacetime geometry.', preview_accent: '#f472b6' },
  { id: 'aura_hyper_violet', name: 'Hyper-Violet Supernova', category: 'aura', rarity: 'epic', cost_xp: 800, min_level: 4, description: 'Ultra-saturated magenta-violet cosmic radiation aura.', preview_accent: '#d946ef' },
  { id: 'aura_chrono_matrix', name: 'Chrono Quantum Matrix', category: 'aura', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'Temporal flux amber and cyan relativistic grid.', preview_accent: '#06b6d4' },
  { id: 'aura_aurora_borealis', name: 'Arctic Aurora Sky', category: 'aura', rarity: 'epic', cost_xp: 950, min_level: 5, description: 'Shifting emerald green and violet ionosphere curtains.', preview_accent: '#34d399' },
  { id: 'aura_antimatter_crimson', name: 'Anti-Matter Crimson', category: 'aura', rarity: 'legendary', cost_xp: 1600, min_level: 7, description: 'Deep ruby dark energy pulse with high-intensity gamma discharge.', preview_accent: '#e11d48' },
  { id: 'aura_cyber_sakura', name: 'Neon Cyber Sakura', category: 'aura', rarity: 'rare', cost_xp: 450, min_level: 2, description: 'Futuristic cherry blossom pink laser refraction.', preview_accent: '#fb7185' },
  { id: 'aura_abyssal_trench', name: 'Deep Abyssal Blue', category: 'aura', rarity: 'rare', cost_xp: 500, min_level: 3, description: 'Oceanic deep trench bioluminescence and sapphire glow.', preview_accent: '#2563eb' },
  { id: 'aura_solar_eclipse', name: 'Total Solar Eclipse', category: 'aura', rarity: 'legendary', cost_xp: 1700, min_level: 8, description: 'Pitch-black silhouette with glowing diamond-ring corona.', preview_accent: '#fef08a' },
  { id: 'aura_quantum_mirage', name: 'Quantum Mirage Flux', category: 'aura', rarity: 'legendary', cost_xp: 1850, min_level: 8, description: 'Probability wave interference with translucent light dispersion.', preview_accent: '#a78bfa' },
  { id: 'aura_starlight_opal', name: 'Starlight Opal Core', category: 'aura', rarity: 'cosmic', cost_xp: 2600, min_level: 9, description: 'Multifaceted gemstone dispersion refracting all cosmic wavelengths.', preview_accent: '#e0e7ff' },
  { id: 'aura_celestial_silver', name: 'Celestial Argentum Silver', category: 'aura', rarity: 'epic', cost_xp: 1000, min_level: 6, description: 'Liquid platinum mercury reflection with mirror radiance.', preview_accent: '#cbd5e1' },
  { id: 'aura_dark_matter', name: 'Dark Matter Obsidian', category: 'aura', rarity: 'legendary', cost_xp: 2000, min_level: 8, description: 'Negative gravity shadow warping background light photons.', preview_accent: '#475569' },
  { id: 'aura_bioluminescent', name: 'Bio-Luminescent Reef', category: 'aura', rarity: 'rare', cost_xp: 400, min_level: 3, description: 'Electric cyan and lime organic fluorescence.', preview_accent: '#4ade80' },
  { id: 'aura_solfeggio_528', name: 'Solfeggio 528Hz Miracle', category: 'aura', rarity: 'legendary', cost_xp: 1900, min_level: 8, description: 'Golden ratio harmonic resonance field tuned to DNA repair.', preview_accent: '#22c55e' },
  { id: 'aura_warp_speed', name: 'Tachyon Warp Speed', category: 'aura', rarity: 'cosmic', cost_xp: 3000, min_level: 9, description: 'Relativistic star streaks stretching across the event horizon.', preview_accent: '#60a5fa' },
  { id: 'aura_helium_3', name: 'Lunar Helium-3 Fusion', category: 'aura', rarity: 'epic', cost_xp: 1100, min_level: 6, description: 'Clean thermonuclear plasma ignition with azure brilliance.', preview_accent: '#38bdf8' },
  { id: 'aura_gamma_burst', name: 'Gamma Ray Hyper-Burst', category: 'aura', rarity: 'cosmic', cost_xp: 3200, min_level: 10, description: 'Highest energy photon explosion in the observable universe.', preview_accent: '#facc15' },
  { id: 'aura_pulsar_beacon', name: 'Neutron Pulsar Beacon', category: 'aura', rarity: 'cosmic', cost_xp: 3400, min_level: 10, description: 'High-speed rotating magnetic poles flashing concentrated lasers.', preview_accent: '#c084fc' },
  { id: 'aura_event_horizon', name: 'Event Horizon Aureate', category: 'aura', rarity: 'cosmic', cost_xp: 4500, min_level: 10, description: 'Pure 24K gold gravitational capture ring of infinite wealth.', preview_accent: '#fbbf24' },
];

const GLYPHS_LIST: MarketItem[] = [
  { id: 'glyph_quantum_hex', name: 'Quantum Hex', category: 'glyph', rarity: 'rare', cost_xp: 450, min_level: 1, description: 'Subatomic hexagonal matrix pulsing with data streams (Starter Default).', preview_accent: '#10b981' },
  { id: 'glyph_metatron', name: "Metatron's Cube", category: 'glyph', rarity: 'rare', cost_xp: 350, min_level: 2, description: 'Ancient Sacred Geometry core mapping multi-dimensional harmony.', preview_accent: '#3b82f6' },
  { id: 'glyph_octagram', name: 'Celestial Octagram', category: 'glyph', rarity: 'epic', cost_xp: 650, min_level: 3, description: '8-Pointed Star of Supreme Alignment and Abundance.', preview_accent: '#f59e0b' },
  { id: 'glyph_flower_of_life', name: 'Flower of Life', category: 'glyph', rarity: 'epic', cost_xp: 850, min_level: 4, description: 'Ancient overlapping circles generating universal resonance.', preview_accent: '#06b6d4' },
  { id: 'glyph_apex_crown', name: 'Apex Sovereign Seal', category: 'glyph', rarity: 'epic', cost_xp: 950, min_level: 5, description: 'Imperial 7-Point diamond-studded crest of digital sovereignty.', preview_accent: '#ffd700' },
  { id: 'glyph_tesseract', name: '4D Tesseract', category: 'glyph', rarity: 'legendary', cost_xp: 1200, min_level: 6, description: 'Transcendent fourth-dimensional mathematical hypercube.', preview_accent: '#8b5cf6' },
  { id: 'glyph_merkaba_vehicle', name: 'Merkaba Star', category: 'glyph', rarity: 'legendary', cost_xp: 1600, min_level: 7, description: 'Dual interlocking tetrahedrons of light and ascension.', preview_accent: '#fbbf24' },
  { id: 'glyph_dragon_crest', name: 'Cyber Dragon', category: 'glyph', rarity: 'legendary', cost_xp: 1750, min_level: 8, description: 'Mecha Dragon crest symbolizing supreme market dominance.', preview_accent: '#ef4444' },
  { id: 'glyph_phoenix_core', name: 'Phoenix Fire Heart', category: 'glyph', rarity: 'legendary', cost_xp: 1900, min_level: 9, description: 'Immortal firebird core generating continuous capital rebirth.', preview_accent: '#f97316' },
  { id: 'glyph_primordia_eye', name: 'Eye of Primordia', category: 'glyph', rarity: 'cosmic', cost_xp: 2000, min_level: 9, description: 'Omniscient core glyph seeing all cashflow vectors in real-time.', preview_accent: '#ec4899' },
  { id: 'glyph_infinity_ouroboros', name: 'Ouroboros Knot', category: 'glyph', rarity: 'cosmic', cost_xp: 2800, min_level: 10, description: 'Infinite dragon loop generating eternal compounding wealth.', preview_accent: '#14b8a6' },
  { id: 'glyph_cyber_lotus', name: 'Geometric Cyber Lotus', category: 'glyph', rarity: 'cosmic', cost_xp: 3200, min_level: 10, description: 'Sacred 8-petal vector lotus of inner peace and compounding.', preview_accent: '#a855f7' },
  { id: 'glyph_seed_of_life', name: 'Seed of Life Genesis', category: 'glyph', rarity: 'rare', cost_xp: 400, min_level: 2, description: 'The 7 interlocking genesis circles of creation.', preview_accent: '#34d399' },
  { id: 'glyph_sri_yantra', name: 'Sri Yantra Abundance', category: 'glyph', rarity: 'epic', cost_xp: 900, min_level: 5, description: 'Nine interlocking triangles of cosmic material and spiritual wealth.', preview_accent: '#fbbf24' },
  { id: 'glyph_torus_knot', name: 'Torus Energy Vortex', category: 'glyph', rarity: 'epic', cost_xp: 800, min_level: 4, description: 'Self-sustaining magnetic doughnut vortex of infinite recycling.', preview_accent: '#38bdf8' },
  { id: 'glyph_vesica_piscis', name: 'Vesica Piscis Portal', category: 'glyph', rarity: 'rare', cost_xp: 350, min_level: 2, description: 'The sacred portal of geometry intersecting dual dimensions.', preview_accent: '#c084fc' },
  { id: 'glyph_golden_spiral', name: 'Golden Spiral Phi', category: 'glyph', rarity: 'epic', cost_xp: 750, min_level: 4, description: 'Fibonacci logarithmic spiral describing organic capital expansion.', preview_accent: '#f59e0b' },
  { id: 'glyph_valkyrie_cross', name: 'Platinum Valkyrie Cross', category: 'glyph', rarity: 'legendary', cost_xp: 1400, min_level: 7, description: 'High-precision solar cross of divine protection.', preview_accent: '#e0e7ff' },
  { id: 'glyph_cyber_skull', name: 'Mecha Cyberspace Skull', category: 'glyph', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'Cybernetic skull core of fearless digital operators.', preview_accent: '#f43f5e' },
  { id: 'glyph_anchor_eternity', name: 'Anchor of Eternity', category: 'glyph', rarity: 'rare', cost_xp: 450, min_level: 3, description: 'Heavy nautical anchor stabilizing assets in market storms.', preview_accent: '#0284c7' },
  { id: 'glyph_tree_of_life', name: 'Tree of Life Sephirot', category: 'glyph', rarity: 'legendary', cost_xp: 1650, min_level: 7, description: '10 Emanations mapping celestial balance and harmony.', preview_accent: '#10b981' },
  { id: 'glyph_archangel_sigil', name: 'Archangel Michael Shield', category: 'glyph', rarity: 'legendary', cost_xp: 1800, min_level: 8, description: 'Invincible glyph shielding creators from market drawdowns.', preview_accent: '#38bdf8' },
  { id: 'glyph_hyper_pentagram', name: 'Golden Ratio Pentagram', category: 'glyph', rarity: 'epic', cost_xp: 700, min_level: 4, description: '5-Pointed golden star symbolizing microcosm harmony.', preview_accent: '#eab308' },
  { id: 'glyph_chrono_dial', name: 'Chronos Temporal Dial', category: 'glyph', rarity: 'epic', cost_xp: 950, min_level: 5, description: 'Precision temporal clockwork calculating compounding runway.', preview_accent: '#f97316' },
  { id: 'glyph_sun_disc_ra', name: 'Solar Disc of Ra', category: 'glyph', rarity: 'legendary', cost_xp: 1700, min_level: 8, description: 'Aureate sun disc radiating life force and limitless cashflow.', preview_accent: '#ffd700' },
  { id: 'glyph_ankh_immortality', name: 'Ankh of Digital Immortality', category: 'glyph', rarity: 'epic', cost_xp: 900, min_level: 5, description: 'Ancient key of eternal life preserving ledger records.', preview_accent: '#14b8a6' },
  { id: 'glyph_triquetra_knot', name: 'Triquetra Trinity Knot', category: 'glyph', rarity: 'rare', cost_xp: 500, min_level: 3, description: 'Tri-pointed endless loop representing Creator, Value, and Growth.', preview_accent: '#a855f7' },
  { id: 'glyph_cyber_falcon', name: 'High-Velocity Cyber Falcon', category: 'glyph', rarity: 'legendary', cost_xp: 1550, min_level: 7, description: 'Aerodynamic predator raptor striking high-converting referral targets.', preview_accent: '#38bdf8' },
  { id: 'glyph_processor_ic', name: 'Quantum Neural Processor', category: 'glyph', rarity: 'rare', cost_xp: 450, min_level: 2, description: 'Silicon micro-die computing viral automation logic.', preview_accent: '#00ff88' },
  { id: 'glyph_tetragrammaton', name: 'Sacred Tetragrammaton', category: 'glyph', rarity: 'cosmic', cost_xp: 2900, min_level: 9, description: 'Sacred 4-letter divine code of primeval creation.', preview_accent: '#fbbf24' },
  { id: 'glyph_osmium_singularity', name: 'Osmium Singularity Core', category: 'glyph', rarity: 'cosmic', cost_xp: 3800, min_level: 10, description: 'Ultra-dense celestial sphere emitting zero-entropy energy.', preview_accent: '#38bdf8' },
  { id: 'glyph_hyper_monolith', name: 'Hyper-Dimensional Monolith', category: 'glyph', rarity: 'cosmic', cost_xp: 3500, min_level: 10, description: 'Extraterrestrial black obsidian monolith guiding evolution.', preview_accent: '#94a3b8' },
  { id: 'glyph_dna_helix', name: 'Double Helix Biometric Matrix', category: 'glyph', rarity: 'legendary', cost_xp: 1600, min_level: 7, description: 'Intertwined biological genetic code of sovereign operators.', preview_accent: '#22c55e' },
  { id: 'glyph_heptagram_star', name: '7-Pointed Elven Star', category: 'glyph', rarity: 'epic', cost_xp: 850, min_level: 4, description: 'Mystical Heptagram balancing all 7 chakras of abundance.', preview_accent: '#d946ef' },
  { id: 'glyph_sovereign_scepter', name: 'Imperial Sovereign Scepter', category: 'glyph', rarity: 'cosmic', cost_xp: 4200, min_level: 10, description: 'Supreme royal artifact commanding all automated AI swarms.', preview_accent: '#ffd700' },
];

const RINGS_LIST: MarketItem[] = [
  { id: 'ring_circuit_traces', name: 'Cyber PCB Traces', category: 'ring', rarity: 'rare', cost_xp: 500, min_level: 1, description: 'Gold microchip motherboard circuit traces and bus nodes (Starter Default).', preview_accent: '#10b981' },
  { id: 'ring_celestial_corona', name: 'Celestial Corona', category: 'ring', rarity: 'rare', cost_xp: 300, min_level: 2, description: 'Pulsing radial solar corona surrounding outer perimeter.', preview_accent: '#06b6d4' },
  { id: 'ring_rune_encryption', name: 'Runic Cipher Ring', category: 'ring', rarity: 'rare', cost_xp: 400, min_level: 3, description: 'Ancient Nordic runic encryption boundary guarding the sigil.', preview_accent: '#94a3b8' },
  { id: 'ring_laser_scanlines', name: 'Laser Radar Sweep', category: 'ring', rarity: 'rare', cost_xp: 450, min_level: 4, description: 'Twin high-precision radar laser sweep lines scanning 360 degrees.', preview_accent: '#34d399' },
  { id: 'ring_particle_flux', name: 'Particle Flux Orbit', category: 'ring', rarity: 'epic', cost_xp: 600, min_level: 5, description: 'Dotted particle orbit ring simulating relativistic motion.', preview_accent: '#a855f7' },
  { id: 'ring_dual_event_horizon', name: 'Dual Event Horizon', category: 'ring', rarity: 'epic', cost_xp: 750, min_level: 6, description: 'Twin intersecting tilted gravitational event horizon rings.', preview_accent: '#38bdf8' },
  { id: 'ring_hex_shield_grid', name: 'Aegis Hex Grid', category: 'ring', rarity: 'epic', cost_xp: 850, min_level: 7, description: 'Fortified hexagonal nano-shield grid perimeter.', preview_accent: '#38bdf8' },
  { id: 'ring_astral_zodiac', name: 'Astral Constellation', category: 'ring', rarity: 'legendary', cost_xp: 1300, min_level: 8, description: '12-node celestial star alignment ring with connecting lines.', preview_accent: '#f59e0b' },
  { id: 'ring_harmonic_pulse', name: 'Harmonic Resonator', category: 'ring', rarity: 'legendary', cost_xp: 1400, min_level: 9, description: 'Triple frequency sinusoidal oscillation wave.', preview_accent: '#f97316' },
  { id: 'ring_diamond_bezel', name: '16-Facet Diamond Bezel', category: 'ring', rarity: 'legendary', cost_xp: 1600, min_level: 9, description: 'Ultra-luxurious multi-faceted gemstone vector bevel ring.', preview_accent: '#e0e7ff' },
  { id: 'ring_singularity_vortex', name: 'Singularity Vortex', category: 'ring', rarity: 'cosmic', cost_xp: 2200, min_level: 10, description: 'Deep space warping spiral galaxy arms twisting inward.', preview_accent: '#e11d48' },
  { id: 'ring_ouroboros_orbit', name: 'Celestial Dragon Orbit', category: 'ring', rarity: 'cosmic', cost_xp: 3000, min_level: 10, description: 'Mythic serpent encircling the perimeter with glowing scales.', preview_accent: '#ffd700' },
  { id: 'ring_quantum_gyroscope', name: 'Quantum Multi-Axis Gyro', category: 'ring', rarity: 'epic', cost_xp: 800, min_level: 5, description: 'Triple gimbal concentric stabilizing rings.', preview_accent: '#06b6d4' },
  { id: 'ring_tachyon_accelerator', name: 'Tachyon Particle Ring', category: 'ring', rarity: 'legendary', cost_xp: 1500, min_level: 8, description: 'Continuous particle collider accelerating photons beyond c.', preview_accent: '#60a5fa' },
  { id: 'ring_radar_crosshairs', name: 'Tactical Targeting Reticle', category: 'ring', rarity: 'rare', cost_xp: 400, min_level: 2, description: 'Precision crosshairs and millimeter tick marks.', preview_accent: '#ef4444' },
  { id: 'ring_orbital_stations', name: '8-Satellite Orbital Mesh', category: 'ring', rarity: 'epic', cost_xp: 900, min_level: 6, description: 'Relay satellites broadcasting telemetry around perimeter.', preview_accent: '#a855f7' },
  { id: 'ring_steampunk_gears', name: 'Chronometer Gear Perimeter', category: 'ring', rarity: 'epic', cost_xp: 750, min_level: 4, description: 'Interlocking brass and gold mechanical teeth.', preview_accent: '#d97706' },
  { id: 'ring_ancient_glyphs', name: 'Ancient Cuneiform Band', category: 'ring', rarity: 'rare', cost_xp: 500, min_level: 3, description: 'Historic Sumerian financial accounting inscriptions.', preview_accent: '#ca8a04' },
  { id: 'ring_solar_prominence', name: 'Solar Flare Prominence Arcs', category: 'ring', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'Erupting coronal loops leaping across the boundary.', preview_accent: '#f97316' },
  { id: 'ring_magnetic_field', name: 'Bipolar Magnetic Flux Lines', category: 'ring', rarity: 'rare', cost_xp: 450, min_level: 2, description: 'Earth magnetosphere protective dipole curvature.', preview_accent: '#3b82f6' },
  { id: 'ring_golden_spiral', name: 'Phi Golden Ratio Concentric', category: 'ring', rarity: 'epic', cost_xp: 950, min_level: 6, description: 'Rings spaced precisely by 1.618 golden proportion.', preview_accent: '#ffd700' },
  { id: 'ring_superstring_lattice', name: '10D Superstring Loom', category: 'ring', rarity: 'legendary', cost_xp: 1750, min_level: 8, description: 'Vibrating multi-dimensional string harmonics.', preview_accent: '#c084fc' },
  { id: 'ring_warp_bubble', name: 'Alcubierre Spacetime Bubble', category: 'ring', rarity: 'cosmic', cost_xp: 2500, min_level: 9, description: 'Gravitational compression ahead and expansion behind.', preview_accent: '#38bdf8' },
  { id: 'ring_cryo_crystals', name: 'Glacial Cryo Shard Ring', category: 'ring', rarity: 'epic', cost_xp: 700, min_level: 4, description: 'Radial razor-sharp ice crystals refracting light.', preview_accent: '#a5f3fc' },
  { id: 'ring_hyperdrive_fins', name: 'Warp Drive Exhaust Fins', category: 'ring', rarity: 'rare', cost_xp: 550, min_level: 3, description: 'Directional thrust fins ionizing plasma exhaust.', preview_accent: '#00ff88' },
  { id: 'ring_nanite_swarm', name: 'Self-Assembling Nanite Cloud', category: 'ring', rarity: 'legendary', cost_xp: 1650, min_level: 8, description: 'Trillions of microscopic constructors repairing armor.', preview_accent: '#94a3b8' },
  { id: 'ring_ionic_thruster', name: 'Blue Ion Plasma Ring', category: 'ring', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'High-specific impulse electrostatic thruster glow.', preview_accent: '#60a5fa' },
  { id: 'ring_decagram_star', name: '10-Fold Sacred Decagram', category: 'ring', rarity: 'epic', cost_xp: 900, min_level: 6, description: 'Perfect 10-pointed star boundary of completeness.', preview_accent: '#facc15' },
  { id: 'ring_quantum_entanglement', name: 'Twin Entangled Orbitals', category: 'ring', rarity: 'legendary', cost_xp: 1800, min_level: 8, description: 'Paired photons spinning in instant nonlocal harmony.', preview_accent: '#e879f9' },
  { id: 'ring_asteroid_dust', name: 'Protoplanetary Disc Orbit', category: 'ring', rarity: 'rare', cost_xp: 400, min_level: 2, description: 'Dense celestial dust band forming new wealth planets.', preview_accent: '#d97706' },
  { id: 'ring_laser_diffraction', name: 'Optical Laser Diffraction Grating', category: 'ring', rarity: 'legendary', cost_xp: 1450, min_level: 7, description: 'Split spectral laser beams creating interference fringes.', preview_accent: '#22d3ee' },
  { id: 'ring_plasma_confinement', name: 'Tokamak Magnetic Toroid', category: 'ring', rarity: 'cosmic', cost_xp: 2800, min_level: 9, description: 'Superconducting magnetic coils holding 100M°C plasma.', preview_accent: '#f43f5e' },
  { id: 'ring_biometric_scanner', name: 'Optical Fingerprint Sweep', category: 'ring', rarity: 'rare', cost_xp: 350, min_level: 1, description: 'Concentric biometric identification rings.', preview_accent: '#10b981' },
  { id: 'ring_celestial_equator', name: 'Astrolabe Celestial Equator', category: 'ring', rarity: 'epic', cost_xp: 950, min_level: 6, description: 'Ancient navigational ring calibrated to Polaris.', preview_accent: '#fbbf24' },
  { id: 'ring_chronos_ring', name: 'Hourglass Chronos Band', category: 'ring', rarity: 'cosmic', cost_xp: 3500, min_level: 10, description: 'Grains of golden time circulating endlessly.', preview_accent: '#ffd700' },
];

const CRESTS_LIST: MarketItem[] = [
  { id: 'crest_cyber_spikes', name: 'Mecha Hyper-Spikes', category: 'crest', rarity: 'rare', cost_xp: 550, min_level: 1, description: 'Tri-blade aggressive aerodynamic mecha crown spikes (Starter Default).', preview_accent: '#34d399' },
  { id: 'crest_lightning', name: 'Zeus Dual Lightning', category: 'crest', rarity: 'rare', cost_xp: 350, min_level: 2, description: 'Twin electrostatic bolts crowning the upper sigil arc.', preview_accent: '#38bdf8' },
  { id: 'crest_valkyrie_horns', name: 'Valkyrie Sonic Horns', category: 'crest', rarity: 'rare', cost_xp: 450, min_level: 3, description: 'Neo-Nordic high-frequency resonance antennae.', preview_accent: '#c084fc' },
  { id: 'crest_crown', name: 'Imperial Plug Crown', category: 'crest', rarity: 'epic', cost_xp: 650, min_level: 4, description: '5-Point Imperial Crown of Digital Sovereignty.', preview_accent: '#eab308' },
  { id: 'crest_ouroboros_shield', name: 'Aegis Diamond Shield', category: 'crest', rarity: 'epic', cost_xp: 800, min_level: 5, description: 'Heavy fortified diamond barricade crest guarding against loss.', preview_accent: '#06b6d4' },
  { id: 'crest_halo_ascendance', name: 'Ascendant Tri-Halo', category: 'crest', rarity: 'epic', cost_xp: 1250, min_level: 6, description: 'Floating angelic luminous triple-ring halo of enlightenment.', preview_accent: '#fef08a' },
  { id: 'crest_angel_wings', name: 'Seraphim Cyber Wings', category: 'crest', rarity: 'legendary', cost_xp: 1100, min_level: 7, description: 'Dual biometric angel wings arching across the sigil.', preview_accent: '#c084fc' },
  { id: 'crest_phoenix_rebirth', name: 'Phoenix Fire Wings', category: 'crest', rarity: 'legendary', cost_xp: 1500, min_level: 8, description: 'Immortal golden firebird crest ascending from the ashes.', preview_accent: '#f97316' },
  { id: 'crest_dragon_horns', name: 'Mecha Dragon Horns', category: 'crest', rarity: 'legendary', cost_xp: 1650, min_level: 8, description: 'Twin curved cybernetic dragon horns radiating dominance.', preview_accent: '#ef4444' },
  { id: 'crest_vault_seal', name: 'Imperial Vault Seal', category: 'crest', rarity: 'cosmic', cost_xp: 1800, min_level: 9, description: 'Ancient runic encryption ring sealing the living vault.', preview_accent: '#14b8a6' },
  { id: 'crest_quantum_antenna', name: 'Quantum Telemetry', category: 'crest', rarity: 'cosmic', cost_xp: 3400, min_level: 9, description: 'Subatomic orbital communications antenna bridging realms.', preview_accent: '#38bdf8' },
  { id: 'crest_omni_sovereign', name: 'Crown of Osmium', category: 'crest', rarity: 'cosmic', cost_xp: 5000, min_level: 10, description: 'The supreme master crest of PrimordiaOS. Infinite status.', preview_accent: '#ffd700' },
  { id: 'crest_apex_spires', name: 'Apex Obsidian Spires', category: 'crest', rarity: 'epic', cost_xp: 750, min_level: 4, description: 'Gothic-cybernetic razor spires piercing the heavens.', preview_accent: '#64748b' },
  { id: 'crest_celestial_aureole', name: 'Celestial Diamond Aureole', category: 'crest', rarity: 'legendary', cost_xp: 1600, min_level: 7, description: 'Diamond-encrusted radiant nimbus around the crown.', preview_accent: '#e0e7ff' },
  { id: 'crest_cyber_antlers', name: 'Mecha Hyper-Antlers', category: 'crest', rarity: 'epic', cost_xp: 850, min_level: 5, description: 'Elk-inspired fractal cybernetic antennae branching outward.', preview_accent: '#10b981' },
  { id: 'crest_archon_wings', name: '6-Wing Archon Array', category: 'crest', rarity: 'cosmic', cost_xp: 3200, min_level: 9, description: 'Hexa-wing celestial array of higher dimensional guardians.', preview_accent: '#c084fc' },
  { id: 'crest_dragon_crown', name: 'Dragon Sovereign Warcrest', category: 'crest', rarity: 'legendary', cost_xp: 1750, min_level: 8, description: 'Heavy scaled dragon battle crest forged in magma.', preview_accent: '#b91c1c' },
  { id: 'crest_valkyrie_wings', name: 'Valkyrie Feather Wings', category: 'crest', rarity: 'epic', cost_xp: 950, min_level: 6, description: 'Nordic battle maiden wings carrying souls to victory.', preview_accent: '#38bdf8' },
  { id: 'crest_sun_god_corona', name: 'Ra Sun God Corona', category: 'crest', rarity: 'legendary', cost_xp: 1850, min_level: 8, description: '12 radiating solar rays crowning the sovereign.', preview_accent: '#f59e0b' },
  { id: 'crest_laser_diadem', name: 'Laser Refraction Diadem', category: 'crest', rarity: 'rare', cost_xp: 400, min_level: 2, description: 'Sleek cyberpunk headband projecting hologram HUD.', preview_accent: '#06b6d4' },
  { id: 'crest_quantum_dish', name: 'Deep Space Radar Dish', category: 'crest', rarity: 'epic', cost_xp: 900, min_level: 5, description: 'Parabolic antenna locking onto viral traffic nodes.', preview_accent: '#a855f7' },
  { id: 'crest_ironclad_ram', name: 'Fortified Titan Ramming Crest', category: 'crest', rarity: 'rare', cost_xp: 500, min_level: 3, description: 'Armored heavy prow shattering all competition.', preview_accent: '#94a3b8' },
  { id: 'crest_trident_poseidon', name: 'Abyssal Trident Crest', category: 'crest', rarity: 'legendary', cost_xp: 1550, min_level: 7, description: 'Triple ocean fork commanding global liquidity flows.', preview_accent: '#0284c7' },
  { id: 'crest_triple_crown', name: 'Triple Imperial Crown', category: 'crest', rarity: 'cosmic', cost_xp: 4200, min_level: 10, description: 'Three tiered crowns of Wealth, Sovereignty, and Peace.', preview_accent: '#ffd700' },
  { id: 'crest_stellar_prism', name: 'Stellar Prism Reflector', category: 'crest', rarity: 'epic', cost_xp: 800, min_level: 4, description: 'Crystalline pyramid splitting single rays into 7 colors.', preview_accent: '#f472b6' },
  { id: 'crest_eternity_halo', name: 'Floating Star Halo', category: 'crest', rarity: 'legendary', cost_xp: 1900, min_level: 8, description: 'Dotted halo of 24 pulsing stars hovering overhead.', preview_accent: '#fef08a' },
  { id: 'crest_aerodynamic_fin', name: 'Stealth Stabilizer Fin', category: 'crest', rarity: 'rare', cost_xp: 450, min_level: 2, description: 'Twin vertical tails of supersonic stealth interceptor.', preview_accent: '#475569' },
  { id: 'crest_omega_singularity', name: 'Omega Point Graviton Crest', category: 'crest', rarity: 'cosmic', cost_xp: 4800, min_level: 10, description: 'The final destination of universal evolution.', preview_accent: '#e11d48' },
  { id: 'crest_anubis_jackal', name: 'Cyber Anubis Guardian Ears', category: 'crest', rarity: 'legendary', cost_xp: 1700, min_level: 8, description: 'Sleek Egyptian jackal silhouette weighing heart against feather.', preview_accent: '#ca8a04' },
  { id: 'crest_horus_falcon', name: 'Eye of Horus Sun Wings', category: 'crest', rarity: 'cosmic', cost_xp: 3600, min_level: 9, description: 'Royal falcon wings carrying the sun disc across the sky.', preview_accent: '#38bdf8' },
];

const ATMOSPHERES_LIST = [
  { id: 'bg_void_matrix', name: 'Deep Void Matrix', desc: 'Obsidian cyberspace grid with drifting particle stars', preview: 'linear-gradient(135deg, #02040a 0%, #060814 100%)' },
  { id: 'bg_hyperspace_stars', name: 'Hyperspace Starfield', desc: 'Relativistic warp field stretching distant galaxies', preview: 'radial-gradient(circle at 50% 50%, #0c102a 0%, #020307 100%)' },
  { id: 'bg_cyber_city', name: 'Cyberpunk Neon City', desc: 'Neon skyscrapers through rainy holographic fog', preview: 'linear-gradient(180deg, #130324 0%, #050110 100%)' },
  { id: 'bg_quantum_plasma', name: 'Quantum Fluid Plasma', desc: 'Bioluminescent superheated fluid turbulence', preview: 'radial-gradient(circle at 70% 30%, #172554 0%, #030712 100%)' },
  { id: 'bg_molten_gold', name: 'Golden Molten Abyss', desc: 'Liquid 24K gold ocean reflecting thermonuclear skies', preview: 'linear-gradient(135deg, #241400 0%, #080400 100%)' },
  { id: 'bg_glacial_cryo', name: 'Glacial Cryo Chamber', desc: 'Subzero methane ice crystals and arctic auroras', preview: 'radial-gradient(circle at 50% 50%, #083344 0%, #020617 100%)' },
  { id: 'bg_hex_grid', name: 'Subatomic Hex Grid', desc: 'Graphene lattice calculating neural blockchain hashes', preview: 'linear-gradient(45deg, #022c22 0%, #020617 100%)' },
  { id: 'bg_solfeggio_wave', name: 'Solfeggio Sound Ripple', desc: 'Cymatic standing waves vibrating at 528 Hz', preview: 'radial-gradient(circle at 50% 50%, #2e1065 0%, #030712 100%)' },
  { id: 'bg_supernova', name: 'Supernova Explosion', desc: 'Expanding shell of stellar gas and gamma radiation', preview: 'radial-gradient(circle at 50% 40%, #450a0a 0%, #020617 100%)' },
  { id: 'bg_black_hole', name: 'Accretion Disk Singularity', desc: 'Relativistic Doppler beaming around event horizon', preview: 'radial-gradient(circle at 50% 50%, #3b0764 0%, #000000 100%)' },
  { id: 'bg_aurora_sky', name: 'Arctic Aurora Ionosphere', desc: 'Solar wind colliding with planetary magnetosphere', preview: 'linear-gradient(180deg, #064e3b 0%, #022c22 50%, #020617 100%)' },
  { id: 'bg_biomecha_lab', name: 'Bio-Mechanical Synthesizer', desc: 'Cybernetic pods cultivating digital avatars', preview: 'linear-gradient(135deg, #1e1b4b 0%, #030712 100%)' },
  { id: 'bg_hyper_grid', name: '4D Hyper-Dimensional Grid', desc: 'Non-Euclidean isometric perspective vector planes', preview: 'linear-gradient(90deg, #111827 0%, #1f2937 50%, #111827 100%)' },
  { id: 'bg_diamond_prism', name: 'Diamond Prism Chamber', desc: 'Total internal reflection splitting white laser light', preview: 'radial-gradient(circle at 30% 70%, #1e293b 0%, #020617 100%)' },
  { id: 'bg_stardust_storm', name: 'Cosmic Stardust Storm', desc: 'Whirling vortex of alchemical mineral particles', preview: 'radial-gradient(circle at 50% 50%, #312e81 0%, #020617 100%)' },
  { id: 'bg_osmium_core', name: 'Osmium Singularity Core', desc: 'Maximum mass density collapsing into pure consciousness', preview: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #000000 100%)' },
];

const SOLFEGGIO_LIST = [
  { hz: 174, name: '174 Hz Foundation', benefit: 'Pain Relief & Quantum Grounding', color: '#64748b' },
  { hz: 285, name: '285 Hz Restoration', benefit: 'Tissue & Energy Field Regeneration', color: '#0284c7' },
  { hz: 396, name: '396 Hz Liberation', benefit: 'Fear Dissolution & Guilt Cleansing', color: '#e11d48' },
  { hz: 417, name: '417 Hz Transmutation', benefit: 'Undoing Negative Situations & Facilitating Change', color: '#ea580c' },
  { hz: 528, name: '528 Hz Miracle', benefit: 'DNA Transformation & Golden Ratio Resonance', color: '#16a34a' },
  { hz: 639, name: '639 Hz Harmonic', benefit: 'Attraction, Interpersonal Love & Cohesion', color: '#06b6d4' },
  { hz: 741, name: '741 Hz Awakening', benefit: 'Intuitive Expression & Problem Solving', color: '#3b82f6' },
  { hz: 852, name: '852 Hz Spiritual Order', benefit: 'Third Eye Vision & Higher Dimensional Sight', color: '#8b5cf6' },
  { hz: 963, name: '963 Hz Primordial Crown', benefit: 'Universal Cosmic Oneness & Crown Activation', color: '#d946ef' },
];

export const SigilForgePage: React.FC<SigilForgePageProps> = ({ onNavigate }) => {
  const { user, token } = useAuth();
  const { openPassport, playSound } = useLivingRealm();
  const { awardXp } = useGamificationXp();

  const userLevel = user?.level || 1;
  const isAdmin = user?.role === 'admin';
  const userXp = user?.xp || 0;
  const referralCode = user?.referral_code || 'CREATOR-OS';

  const [activeTab, setActiveTab] = useState<'forge' | 'store'>('forge');
  const [activeCategory, setActiveCategory] = useState<'aura' | 'glyph' | 'ring' | 'crest' | 'atmosphere' | 'solfeggio' | 'inscribe' | 'advanced'>('aura');
  
  // Forge Customizer State
  const [selectedAura, setSelectedAura] = useState<string>('aura_cyber_emerald');
  const [selectedGlyph, setSelectedGlyph] = useState<string>('glyph_quantum_hex');
  const [selectedRing, setSelectedRing] = useState<string>('ring_circuit_traces');
  const [selectedCrest, setSelectedCrest] = useState<string>('crest_cyber_spikes');
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<string>('bg_void_matrix');
  const [customHandle, setCustomHandle] = useState<string>('');
  const [customMotto, setCustomMotto] = useState<string>('SOVEREIGN CREATOR');
  const [customMonogram, setCustomMonogram] = useState<string>('');

  // Creative & Immersion Controls
  const [hueShift, setHueShift] = useState<number>(0);
  const [rotationSpeed, setRotationSpeed] = useState<'off' | 'slow' | 'normal' | 'warp'>('normal');
  const [glowMode, setGlowMode] = useState<'subtle' | 'normal' | 'supernova'>('normal');
  const [particleBurst, setParticleBurst] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(forgeAudio.getMuted());
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>('novice_origin');
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);

  // Advanced Customizer Extensions
  const [orbitSpeedFactor, setOrbitSpeedFactor] = useState<number>(1.0);
  const [particleDensity, setParticleDensity] = useState<number>(24);
  const [chromaticAberration, setChromaticAberration] = useState<boolean>(false);

  // AI Sigil Architect State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isSynthesizingAi, setIsSynthesizingAi] = useState<boolean>(false);
  const [aiResultNotice, setAiResultNotice] = useState<string | null>(null);

  // Solfeggio Harmonics State
  const [activeSolfeggioHz, setActiveSolfeggioHz] = useState<number | null>(null);

  // SVG Data & Export State
  const [sigilSvgDataUri, setSigilSvgDataUri] = useState<string>('');
  const [rawSvgString, setRawSvgString] = useState<string>('');
  const [loadingSigil, setLoadingSigil] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [embedCopied, setEmbedCopied] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [isExportingStoryCard, setIsExportingStoryCard] = useState<boolean>(false);

  // 3D Tilt Parallax State
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Fetch User Equipped Sigil Configuration ───────────────────────────
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/sigil/config', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            if (data.data.aura) setSelectedAura(data.data.aura);
            if (data.data.glyph) setSelectedGlyph(data.data.glyph);
            if (data.data.ring) setSelectedRing(data.data.ring);
            if (data.data.crest) setSelectedCrest(data.data.crest);
            if (data.data.motto) setCustomMotto(data.data.motto);
            if (data.data.monogram) setCustomMonogram(data.data.monogram);
            if (data.data.handle) setCustomHandle(data.data.handle);
          }
        }
      } catch (e) {
        console.error('Failed to fetch sigil config:', e);
      }
    };

    fetchConfig();
  }, [token]);

  // ── Real-Time Live SVG Preview Synthesis ──────────────────────────────
  useEffect(() => {
    let isCancelled = false;
    const synthesizeSigil = async () => {
      setLoadingSigil(true);
      try {
        const params = new URLSearchParams({
          aura: selectedAura,
          glyph: selectedGlyph,
          ring: selectedRing,
          crest: selectedCrest,
          handle: customHandle || user?.display_name || referralCode,
          motto: customMotto,
          monogram: customMonogram,
          size: '420',
        });

        const res = await fetch(`/api/sigil/${encodeURIComponent(referralCode)}?${params.toString()}`);
        if (res.ok && !isCancelled) {
          const svgText = await res.text();
          setRawSvgString(svgText);
          const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
          setSigilSvgDataUri(encoded);
        }
      } catch (e) {
        console.error('Failed to synthesize sigil SVG:', e);
      } finally {
        if (!isCancelled) setLoadingSigil(false);
      }
    };

    const timer = setTimeout(synthesizeSigil, 120);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [selectedAura, selectedGlyph, selectedRing, selectedCrest, customHandle, customMotto, customMonogram, referralCode, user?.display_name]);

  // ── 3D Tilt Parallax Handlers ─────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const tiltX = (y / (rect.height / 2)) * -14;
    const tiltY = (x / (rect.width / 2)) * 14;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // ── Sound & Audio Triggers ────────────────────────────────────────────
  const triggerShockwave = () => {
    setParticleBurst(true);
    forgeAudio.playLaserPulse();
    setTimeout(() => setParticleBurst(false), 800);
  };

  // ── Save & Equip ──────────────────────────────────────────────────────
  const handleSaveAndEquip = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setLockedNotice(null);
    try {
      const res = await fetch('/api/sigil/config/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          aura: selectedAura,
          glyph: selectedGlyph,
          ring: selectedRing,
          crest: selectedCrest,
          monogram: customMonogram,
          motto: customMotto,
          handle: customHandle,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        forgeAudio.playAscensionChord();
        awardXp(50, 'Forged & Equipped Custom Sigil');
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setLockedNotice(data.error || 'Failed to save configuration.');
        forgeAudio.playTick(400);
      }
    } catch (e: any) {
      setLockedNotice(e.message || 'Error saving sigil.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Archetype Preset Loader ───────────────────────────────────────────
  const handleSelectArchetype = (archetype: MythicArchetype) => {
    if (userLevel < archetype.min_level && !isAdmin) {
      setLockedNotice(`🔒 "${archetype.name}" requires Level ${archetype.min_level} (Current: Lv. ${userLevel}). Earn XP from Quests to unlock!`);
      forgeAudio.playTick(400);
      return;
    }
    setLockedNotice(null);
    setSelectedArchetype(archetype.id);
    setSelectedAura(archetype.config.aura);
    setSelectedGlyph(archetype.config.glyph);
    setSelectedRing(archetype.config.ring);
    setSelectedCrest(archetype.config.crest);
    setCustomMotto(archetype.config.motto);
    if (archetype.config.monogram) setCustomMonogram(archetype.config.monogram);
    forgeAudio.playCosmicRoll();
    triggerShockwave();
    awardXp(15, `Loaded Archetype: ${archetype.name}`);
  };

  // ── Cosmic Roll Randomizer (Only Unlocked Parts) ──────────────────────
  const handleRandomize = () => {
    setLockedNotice(null);
    const validAuras = AURAS_LIST.filter(a => isAdmin || userLevel >= a.min_level);
    const validGlyphs = GLYPHS_LIST.filter(g => isAdmin || userLevel >= g.min_level);
    const validRings = RINGS_LIST.filter(r => isAdmin || userLevel >= r.min_level);
    const validCrests = CRESTS_LIST.filter(c => isAdmin || userLevel >= c.min_level);

    const randAura = validAuras[Math.floor(Math.random() * validAuras.length)] || AURAS_LIST[0];
    const randGlyph = validGlyphs[Math.floor(Math.random() * validGlyphs.length)] || GLYPHS_LIST[0];
    const randRing = validRings[Math.floor(Math.random() * validRings.length)] || RINGS_LIST[0];
    const randCrest = validCrests[Math.floor(Math.random() * validCrests.length)] || CRESTS_LIST[0];

    setSelectedAura(randAura.id);
    setSelectedGlyph(randGlyph.id);
    setSelectedRing(randRing.id);
    setSelectedCrest(randCrest.id);
    setSelectedArchetype(null);
    forgeAudio.playCosmicRoll();
    triggerShockwave();
    awardXp(10, 'Cosmic Sigil Roll');
  };

  // ── Download Helpers ──────────────────────────────────────────────────
  const handleDownloadSvg = () => {
    if (!rawSvgString) return;
    const blob = new Blob([rawSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sigil_${referralCode.toLowerCase()}_master.svg`;
    a.click();
    URL.revokeObjectURL(url);
    forgeAudio.playLaserPulse();
    awardXp(20, 'Exported Master Vector SVG');
  };

  const handleDownloadPng = async () => {
    if (!rawSvgString) return;
    setIsExportingPng(true);
    try {
      const img = new Image();
      const svgBlob = new Blob([rawSvgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL_ = window.URL || window.webkitURL || window;
      const blobURL = URL_.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 2048;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, 2048, 2048);
        ctx.drawImage(img, 0, 0, 2048, 2048);
        URL_.revokeObjectURL(blobURL);

        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `sigil_${referralCode.toLowerCase()}_2048x2048.png`;
        a.click();
        forgeAudio.playAscensionChord();
        awardXp(30, 'Exported 2048x2048 PNG Sigil');
        setIsExportingPng(false);
      };
      img.src = blobURL;
    } catch (e) {
      console.error('PNG export error:', e);
      setIsExportingPng(false);
    }
  };

  const handleCopySvgCode = () => {
    if (!rawSvgString) return;
    navigator.clipboard.writeText(rawSvgString);
    setCopySuccess(true);
    forgeAudio.playTick(1200);
    awardXp(10, 'Copied SVG XML');
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleExportStoryCard = async () => {
    if (!rawSvgString) return;
    setIsExportingStoryCard(true);
    try {
      const img = new Image();
      const svgBlob = new Blob([rawSvgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL_ = window.URL || window.webkitURL || window;
      const blobURL = URL_.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background Dark Space Gradient
        const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
        grad.addColorStop(0, '#060814');
        grad.addColorStop(0.5, '#0d111d');
        grad.addColorStop(1, '#02040a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1920);

        // Ambient Aura Radial Halo
        const auraGrad = ctx.createRadialGradient(540, 780, 100, 540, 780, 550);
        auraGrad.addColorStop(0, activeGlowColor + '55');
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.fillRect(0, 0, 1080, 1920);

        // Top Header Badge
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(540 - 240, 180, 480, 64, 32);
        ctx.fill();
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('✨ MONEYPLUGHUB CREATOR SIGIL', 540, 222);

        // Central Vector Emblem
        ctx.drawImage(img, 540 - 380, 780 - 380, 760, 760);
        URL_.revokeObjectURL(blobURL);

        // Creator Handle
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(customHandle || (user?.display_name ? `@${user.display_name.toUpperCase()}` : `@${referralCode}`), 540, 1280);

        // Motto
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(customMotto || 'SOVEREIGN CREATOR PROTOCOL', 540, 1340);

        // Code Badge Box
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = activeGlowColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(540 - 280, 1420, 560, 110, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 42px monospace';
        ctx.fillText(`CODE: ${referralCode}`, 540, 1490);

        // Footer URL
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('moneyplughub.com', 540, 1680);

        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `sigil_${referralCode.toLowerCase()}_story_1080x1920.png`;
        a.click();
        forgeAudio.playAscensionChord();
        awardXp(40, 'Exported 1080x1920 Story Card');
        setIsExportingStoryCard(false);
      };
      img.src = blobURL;
    } catch (e) {
      console.error('Story card export error:', e);
      setIsExportingStoryCard(false);
    }
  };

  const handleCopyEmbedCode = () => {
    const origin = window.location.origin;
    const iframeSnippet = `<iframe src="${origin}/api/sigil/${encodeURIComponent(referralCode)}?raw=true" width="420" height="420" frameborder="0" style="border-radius:24px;border:none;overflow:hidden;" allowtransparency="true"></iframe>`;
    navigator.clipboard.writeText(iframeSnippet);
    setEmbedCopied(true);
    forgeAudio.playTick(1200);
    awardXp(15, 'Copied Live Embed Code');
    setTimeout(() => setEmbedCopied(false), 2500);
  };

  const handlePlaySolfeggio = (hz: number) => {
    setActiveSolfeggioHz(hz);
    forgeAudio.playSolfeggioTone(hz, 3.5);
    awardXp(5, `Tuned to ${hz} Hz Solfeggio`);
    setTimeout(() => setActiveSolfeggioHz(null), 3500);
  };

  const handleSynthesizeAi = async (customText?: string) => {
    const textToSynthesize = customText || aiPrompt;
    if (!textToSynthesize.trim()) return;

    setIsSynthesizingAi(true);
    setAiResultNotice(null);
    setLockedNotice(null);

    try {
      const res = await fetch('/api/sigil/ai-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSynthesize, referralCode }),
      });

      const json = await res.json();
      if (json.success && json.data?.config) {
        const cfg = json.data.config;
        if (cfg.aura) setSelectedAura(cfg.aura);
        if (cfg.glyph) setSelectedGlyph(cfg.glyph);
        if (cfg.ring) setSelectedRing(cfg.ring);
        if (cfg.crest) setSelectedCrest(cfg.crest);
        if (cfg.motto) setCustomMotto(cfg.motto);
        if (cfg.monogram) setCustomMonogram(cfg.monogram);
        if (cfg.glow_level) setGlowMode(cfg.glow_level);
        setSelectedArchetype(null);

        forgeAudio.playAscensionChord();
        triggerShockwave();
        awardXp(50, `AI Sigil Synthesis: ${textToSynthesize.substring(0, 24)}...`);
        setAiResultNotice(`✨ Synthesized Sigil from "${textToSynthesize}"!`);
        setTimeout(() => setAiResultNotice(null), 4000);
      }
    } catch (e: any) {
      setLockedNotice(e.message || 'AI Synthesis error.');
    } finally {
      setIsSynthesizingAi(false);
    }
  };

  // ── Helper Category Resolvers ─────────────────────────────────────────
  const getCurrentCategoryItems = (): MarketItem[] => {
    switch (activeCategory) {
      case 'aura': return AURAS_LIST;
      case 'glyph': return GLYPHS_LIST;
      case 'ring': return RINGS_LIST;
      case 'crest': return CRESTS_LIST;
      default: return [];
    }
  };

  const getSelectedIdForCategory = (cat: string): string => {
    switch (cat) {
      case 'aura': return selectedAura;
      case 'glyph': return selectedGlyph;
      case 'ring': return selectedRing;
      case 'crest': return selectedCrest;
      default: return '';
    }
  };

  const setSelectedIdForCategory = (cat: string, id: string, itemMinLevel: number = 1) => {
    if (userLevel < itemMinLevel && !isAdmin) {
      setLockedNotice(`🔒 Unlocks at Level ${itemMinLevel} (Current: Lv. ${userLevel}). Complete Daily Quests & Referral Milestones to unlock!`);
      forgeAudio.playTick(400);
      return;
    }
    setLockedNotice(null);
    setSelectedArchetype(null);
    switch (cat) {
      case 'aura': setSelectedAura(id); break;
      case 'glyph': setSelectedGlyph(id); break;
      case 'ring': setSelectedRing(id); break;
      case 'crest': setSelectedCrest(id); break;
    }
    forgeAudio.playTick(1000);
  };

  const activeAuraObj = AURAS_LIST.find(a => a.id === selectedAura) || AURAS_LIST[0];
  const activeGlowColor = activeAuraObj.preview_accent;

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'rare':
        return <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold border border-blue-500/30">RARE</span>;
      case 'epic':
        return <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold border border-purple-500/30">EPIC</span>;
      case 'legendary':
        return <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">LEGENDARY</span>;
      case 'cosmic':
        return <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold border border-rose-500/30">COSMIC 🪐</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono">COMMON</span>;
    }
  };

  const getRotationClass = () => {
    switch (rotationSpeed) {
      case 'off': return '';
      case 'slow': return 'animate-[spin_60s_linear_infinite]';
      case 'normal': return 'animate-[spin_20s_linear_infinite]';
      case 'warp': return 'animate-[spin_6s_linear_infinite]';
    }
  };

  return (
    <div className="relative min-h-screen bg-[#060814] text-slate-100 pb-24 overflow-hidden">
      {/* Background Ambient Aura Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] blur-[150px] pointer-events-none transition-colors duration-700 opacity-25"
        style={{ background: activeGlowColor }}
      />

      {/* Main Studio Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 relative z-10">
        
        {/* Header HUD Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                165+ AAA Customizations
              </span>
              <span className="text-xs text-slate-500 font-mono">v5.0 PRIMORDIA</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                Lv. {userLevel} ({userXp.toLocaleString()} XP)
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 text-white flex items-center gap-3">
              🔮 Sigil Forge & Vector Studio
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
              Deterministic 3D vector art engine mapped to your cryptographic seed <code className="text-plug-accent font-mono">({referralCode})</code>. Every sigil has unique stardust coordinates ensuring no two emblems are ever identical.
            </p>
          </div>

          {/* Quick HUD Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                const muted = forgeAudio.toggleMute();
                setIsAudioMuted(muted);
              }}
              className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-mono font-bold ${
                !isAudioMuted 
                  ? 'bg-purple-950/40 border-purple-500/50 text-purple-300 shadow-lg shadow-purple-500/10' 
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
              title={isAudioMuted ? 'Unmute Procedural Audio' : 'Mute Audio'}
            >
              {!isAudioMuted ? (
                <>
                  <Volume2 className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span className="hidden sm:inline">528Hz ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">MUTED</span>
                </>
              )}
            </button>

            {/* Passport View Button */}
            <button
              onClick={() => openPassport(referralCode)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-2 text-xs font-bold"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Passport Modal
            </button>

            {/* Save & Equip CTA */}
            <button
              onClick={handleSaveAndEquip}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-plug-accent via-indigo-500 to-purple-600 hover:opacity-95 text-white text-xs font-extrabold tracking-wide uppercase shadow-lg shadow-plug-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-4 h-4 text-emerald-300" />
              ) : (
                <Flame className="w-4 h-4 text-amber-300" />
              )}
              {saveSuccess ? 'Equipped!' : 'Forge & Equip (+50 XP)'}
            </button>
          </div>
        </div>

        {/* Lock Warning / Error Banner */}
        {lockedNotice && (
          <div className="mt-4 p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{lockedNotice}</span>
            </div>
            <button
              onClick={() => setLockedNotice(null)}
              className="text-amber-400 hover:text-white text-xs font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* AI Sigil Architect Banner / Prompt Generator */}
        <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-indigo-950/40 border border-purple-500/30 backdrop-blur-xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40">
                <Wand2 className="w-4 h-4 text-purple-300 animate-pulse" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                  AI Sigil Architect <span className="text-[10px] text-purple-400 font-mono px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-500/30">NLP SYNTHESIS</span>
                </h3>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Type any vision or cosmic theme — AI deconstructs geometry, calculates resonant harmonics, and synthesizes your custom sigil in real-time.
                </p>
              </div>
            </div>

            {aiResultNotice && (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-500/30 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {aiResultNotice}
              </span>
            )}
          </div>

          {/* AI Prompt Input Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiPrompt.trim() && !isSynthesizingAi) {
                    handleSynthesizeAi();
                  }
                }}
                placeholder="e.g. 24K Solar Phoenix with Hypercube geometry & golden particle rings..."
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-950/90 border border-purple-500/40 text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-purple-400 placeholder:text-slate-500 shadow-inner"
              />
              {aiPrompt && (
                <button
                  onClick={() => setAiPrompt('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => handleSynthesizeAi()}
              disabled={isSynthesizingAi || !aiPrompt.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold font-mono uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isSynthesizingAi ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>Synthesize (+50 XP)</span>
                </>
              )}
            </button>
          </div>

          {/* Prompt Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-[11px] font-mono">
            <span className="text-slate-500 shrink-0 text-[10px] uppercase tracking-wider">Quick Invocations:</span>
            {[
              { label: '🔥 Solar Phoenix', prompt: 'Solar Phoenix with 24K gold aura and sacred geometry rings' },
              { label: '🌌 Void Singularity', prompt: 'Deep Void Singularity with dark matter event horizon and runic cipher' },
              { label: '⚡ Zeus Lightning', prompt: 'Neon cyberpunk matrix with hyper plasma lightning crest' },
              { label: '🕊️ Seraphim Osmium', prompt: 'Osmium diamond angel wings with 4D tesseract ascension' },
              { label: '🐉 Cyber Dragon', prompt: 'Mecha dragonlord with imperial jade flame and ouroboros orbit' },
              { label: '❄️ Quantum Ice', prompt: 'Subzero quantum frost with metatron crystal prism' },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  setAiPrompt(chip.prompt);
                  handleSynthesizeAi(chip.prompt);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-200 transition-all shrink-0 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mythic Archetypes Quick-Loader Bar */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                1-Click Mythic Archetype Presets (Level Gated)
              </span>
            </div>
            <button
              onClick={handleRandomize}
              className="px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-500/30 hover:border-purple-400 text-purple-300 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-purple-400" />
              🎲 Cosmic Roll
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {MYTHIC_ARCHETYPES.map((arch) => {
              const isEquipped = selectedArchetype === arch.id;
              const isArchLocked = userLevel < arch.min_level && !isAdmin;

              return (
                <button
                  key={arch.id}
                  onClick={() => handleSelectArchetype(arch)}
                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                    isEquipped 
                      ? 'bg-slate-800/90 border-amber-400/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50' 
                      : isArchLocked
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-80'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xl">{arch.icon}</span>
                    {isArchLocked ? (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono text-[9px] border border-amber-500/30 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Lv.{arch.min_level}
                      </span>
                    ) : isEquipped ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    ) : (
                      <span className="text-[9px] text-emerald-400 font-mono">UNLOCKED</span>
                    )}
                  </div>
                  <div className="text-xs font-extrabold text-white truncate group-hover:text-amber-300 transition-colors">
                    {arch.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {arch.tagline}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-Column Master Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          
          {/* LEFT: 3D Holographic Parallax Viewport (5 Columns) */}
          <div className="lg:col-span-5 flex flex-col items-center">
            
            {/* 3D Holographic Card Viewport */}
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative w-full aspect-square max-w-[420px] rounded-3xl p-6 border border-slate-800 shadow-2xl backdrop-blur-2xl transition-transform duration-100 ease-out cursor-crosshair group overflow-hidden"
              style={{
                background: ATMOSPHERES_LIST.find(a => a.id === selectedAtmosphere)?.preview || '#020617',
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transformStyle: 'preserve-3d',
                boxShadow: `0 25px 60px -15px ${activeGlowColor}33, 0 0 30px ${activeGlowColor}15`,
              }}
            >
              {/* Niagara Interactive Particle Canvas */}
              <NiagaraParticleCanvas
                glowColor={activeGlowColor}
                triggerBurst={particleBurst}
                intensity={glowMode}
              />

              {/* Holographic Foil Rainbow Reflection Sheen */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-35 transition-opacity duration-500 rounded-3xl"
                style={{
                  background: `linear-gradient(${115 + tilt.y * 3}deg, transparent 20%, rgba(255, 0, 128, 0.4) 40%, rgba(0, 255, 255, 0.4) 60%, transparent 80%)`,
                  mixBlendMode: 'color-dodge',
                }}
              />

              {/* Dynamic Specular Glare Highlight */}
              <div 
                className="absolute inset-0 pointer-events-none rounded-3xl transition-opacity duration-300 opacity-15 group-hover:opacity-30"
                style={{
                  background: `radial-gradient(circle at ${50 + tilt.y * 2}% ${50 - tilt.x * 2}%, rgba(255,255,255,0.8) 0%, transparent 60%)`,
                }}
              />

              {/* HUD Calibration Header */}
              <div className="flex items-center justify-between relative z-10 text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CRYPTOGRAPHIC_MATRIX
                </span>
                <span className="text-slate-500">
                  X:{(tilt?.x ?? 0).toFixed(1)}° Y:{(tilt?.y ?? 0).toFixed(1)}°
                </span>
              </div>

              {/* Central Vector Emblem */}
              <div className="relative w-full h-[calc(100%-28px)] flex items-center justify-center z-10">
                {!sigilSvgDataUri && loadingSigil ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-plug-accent animate-spin" />
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                      Synthesizing Geometry...
                    </span>
                  </div>
                ) : sigilSvgDataUri ? (
                  <div 
                    className={`relative w-full h-full flex items-center justify-center transition-all ${getRotationClass()}`}
                    style={{
                      filter: `${hueShift !== 0 ? `hue-rotate(${hueShift}deg)` : ''} ${chromaticAberration ? 'drop-shadow(-2px 0px 0px rgba(255,0,0,0.7)) drop-shadow(2px 0px 0px rgba(0,255,255,0.7))' : ''}`,
                    }}
                  >
                    <img
                      src={sigilSvgDataUri}
                      alt="Vector Sigil"
                      className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.15)] select-none pointer-events-none"
                    />
                    {loadingSigil && (
                      <div className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 border border-purple-500/50 shadow-md">
                        <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 font-mono">Synthesizing Sigil...</div>
                )}
              </div>

              {/* Viewport Laser Scanlines Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none rounded-3xl opacity-20" />
            </div>

            {/* Unique Cryptographic Watermark Banner */}
            <div className="w-full max-w-[420px] mt-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Fingerprint className="w-4 h-4 text-plug-accent" />
                <span>Zero-Duplicate Guarantee</span>
              </span>
              <span className="text-[10px] text-slate-500 truncate max-w-[160px]">
                SEED: {referralCode}
              </span>
            </div>

            {/* Viewport Controls Bar */}
            <div className="w-full max-w-[420px] mt-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3.5">
              
              {/* Glow Mode Selector */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 font-bold flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  Luminosity
                </span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                  {(['subtle', 'normal', 'supernova'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setGlowMode(mode);
                        forgeAudio.playTick(mode === 'supernova' ? 1200 : 800);
                      }}
                      className={`px-2.5 py-1 rounded-lg capitalize transition-colors font-bold ${
                        glowMode === mode 
                          ? 'bg-plug-accent text-white shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotation Velocity Selector */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 font-bold flex items-center gap-1.5">
                  <Orbit className="w-3.5 h-3.5 text-cyan-400" />
                  Spin Velocity
                </span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                  {[
                    { id: 'off', label: 'Static' },
                    { id: 'slow', label: '60s' },
                    { id: 'normal', label: '20s' },
                    { id: 'warp', label: '6s ⚡' },
                  ].map((speed) => (
                    <button
                      key={speed.id}
                      onClick={() => {
                        setRotationSpeed(speed.id as any);
                        forgeAudio.playTick(900);
                      }}
                      className={`px-2 py-1 rounded-lg transition-colors font-bold ${
                        rotationSpeed === speed.id 
                          ? 'bg-purple-600 text-white shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {speed.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Solfeggio Harmonic Resonance Synth Matrix */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-slate-400 font-bold flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-purple-400" />
                    Solfeggio Resonance Synth
                  </span>
                  <span className="text-[10px] font-mono text-purple-400">
                    {activeSolfeggioHz ? `🎵 ${activeSolfeggioHz} Hz ACTIVE` : '4-HARMONICS'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
                  {[
                    { hz: 432, label: '432 Hz', desc: 'Cosmic Flow' },
                    { hz: 528, label: '528 Hz', desc: 'Miracles' },
                    { hz: 639, label: '639 Hz', desc: 'Attraction' },
                    { hz: 963, label: '963 Hz', desc: 'Ascension' },
                  ].map((s) => (
                    <button
                      key={s.hz}
                      onClick={() => handlePlaySolfeggio(s.hz)}
                      className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                        activeSolfeggioHz === s.hz
                          ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-500/25 font-bold animate-pulse'
                          : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                      title={`Play pure ${s.hz} Hz tone (${s.desc})`}
                    >
                      <div className="font-bold">{s.label}</div>
                      <div className="text-[8px] text-slate-500 truncate">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 360° Chromatic Hue Shift Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-slate-400 font-bold flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-pink-400" />
                    Chromatic Hue Wheel
                  </span>
                  <span className="text-xs font-mono text-slate-300 font-bold">{hueShift}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hueShift}
                  onChange={(e) => setHueShift(Number(e.target.value))}
                  className="w-full accent-pink-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
              </div>

              {/* 4-Tier Master Exporter Suite */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* 4K Vector SVG */}
                  <button
                    onClick={handleDownloadSvg}
                    className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
                    title="Download infinite-resolution vector file"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    4K Master SVG
                  </button>

                  {/* 4K Master PNG */}
                  <button
                    onClick={handleDownloadPng}
                    disabled={isExportingPng}
                    className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-white text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow"
                    title="Export 2048x2048 ultra-high-res PNG image"
                  >
                    {isExportingPng ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    4K PNG Avatar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Story Card PNG */}
                  <button
                    onClick={handleExportStoryCard}
                    disabled={isExportingStoryCard}
                    className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-white text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow"
                    title="Export 1080x1920 vertical card for TikTok/Instagram Stories"
                  >
                    {isExportingStoryCard ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    Story Card (1080p)
                  </button>

                  {/* Embed Snippet Code */}
                  <button
                    onClick={handleCopyEmbedCode}
                    className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-white text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
                    title="Copy iframe HTML embed snippet"
                  >
                    {embedCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Code className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    {embedCopied ? 'Embed Copied!' : 'Embed Code'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Master Customization Suite (7 Columns) */}
          {/* RIGHT: Master Customization Suite (7 Columns) */}
          <div className="lg:col-span-7 flex flex-col">
            
            {/* Category Switcher Tabs */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-xl overflow-x-auto scrollbar-hide">
              {[
                { id: 'aura', label: 'Auras & Shaders', icon: Sparkle, count: 30 },
                { id: 'glyph', label: 'Core Glyphs', icon: Gem, count: 35 },
                { id: 'ring', label: 'Orbital Rings', icon: Layers, count: 35 },
                { id: 'crest', label: 'Imperial Crests', icon: Crown, count: 30 },
                { id: 'atmosphere', label: 'Cosmic Atmosphere', icon: Sun, count: 16 },
                { id: 'solfeggio', label: 'Solfeggio Harmonics', icon: Music, count: 9 },
                { id: 'advanced', label: 'FX Physics Engine', icon: Sliders, count: 10 },
                { id: 'inscribe', label: 'Laser Monogram & Inscribe', icon: Type, count: 'TXT' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveCategory(tab.id as any);
                      forgeAudio.playTick(800);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-plug-accent to-purple-600 text-white shadow-lg shadow-plug-accent/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 font-mono">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Customization Content Container */}
            <div className="mt-4 p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl flex-1 flex flex-col justify-between">
              
              {/* Category: 4 Core Progression Components (Aura, Glyph, Ring, Crest) */}
              {activeCategory === 'aura' || activeCategory === 'glyph' || activeCategory === 'ring' || activeCategory === 'crest' ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">
                      Select {activeCategory.toUpperCase()} Component ({getCurrentCategoryItems().length} Total • Progression Gated)
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Equipped: <strong className="text-white">{getCurrentCategoryItems().find(i => i.id === getSelectedIdForCategory(activeCategory))?.name || 'Standard'}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[490px] overflow-y-auto pr-1">
                    {getCurrentCategoryItems().map((item) => {
                      const isSelected = getSelectedIdForCategory(activeCategory) === item.id;
                      const isLocked = userLevel < item.min_level && !isAdmin;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedIdForCategory(activeCategory, item.id, item.min_level);
                            if (!isLocked) triggerShockwave();
                          }}
                          onMouseEnter={() => forgeAudio.playTick(1100)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                            isSelected
                              ? 'bg-slate-800/90 border-plug-accent shadow-lg shadow-plug-accent/20 ring-1 ring-plug-accent'
                              : isLocked
                              ? 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-85'
                              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                          }`}
                        >
                          {/* Accent Color Pip */}
                          <div 
                            className="absolute top-0 right-0 w-16 h-16 blur-2xl opacity-20 pointer-events-none"
                            style={{ background: item.preview_accent }}
                          />

                          <div className="flex items-center justify-between mb-2">
                            {getRarityBadge(item.rarity)}
                            {isLocked ? (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30 flex items-center gap-1 font-bold">
                                <Lock className="w-3 h-3" /> Lv. {item.min_level}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-400">
                                <Zap className="w-3 h-3 text-amber-400" />
                                {item.cost_xp} XP
                              </div>
                            )}
                          </div>

                          <div className="text-sm font-bold text-white flex items-center justify-between">
                            <span className={isLocked ? 'text-slate-300' : 'text-white'}>{item.name}</span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </div>

                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>

                          {/* Level Lock Warning */}
                          {isLocked && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-amber-400 bg-amber-950/40 px-2 py-1 rounded border border-amber-500/30">
                              <Lock className="w-3 h-3 shrink-0" />
                              <span>Requires Level {item.min_level} (You are Lv. {userLevel})</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeCategory === 'atmosphere' ? (
                /* 16 Cosmic Atmosphere Presets */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">
                      Cosmic Background Atmospheres (16 Hyperspace Environments)
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Equipped: <strong className="text-white">{ATMOSPHERES_LIST.find(a => a.id === selectedAtmosphere)?.name || 'Default'}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[490px] overflow-y-auto pr-1">
                    {ATMOSPHERES_LIST.map((atm) => {
                      const isSelected = selectedAtmosphere === atm.id;
                      return (
                        <div
                          key={atm.id}
                          onClick={() => {
                            setSelectedAtmosphere(atm.id);
                            triggerShockwave();
                            awardXp(5, `Equipped Atmosphere: ${atm.name}`);
                          }}
                          onMouseEnter={() => forgeAudio.playTick(1100)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                            isSelected
                              ? 'bg-slate-800/90 border-plug-accent shadow-lg shadow-plug-accent/20 ring-1 ring-plug-accent'
                              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                          }`}
                        >
                          <div 
                            className="h-16 w-full rounded-xl mb-2.5 border border-slate-800/60 shadow-inner flex items-center justify-center relative overflow-hidden"
                            style={{ background: atm.preview }}
                          >
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950/70 text-slate-300 border border-slate-700/50">
                              PREVIEW
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{atm.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                          </div>

                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {atm.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeCategory === 'solfeggio' ? (
                /* 9 Solfeggio Harmonic Resonances */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">
                      Solfeggio Soundscape Harmonics (9 Ancient Healing Frequencies)
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Active Resonance: <strong className="text-purple-400">{activeSolfeggioHz ? `${activeSolfeggioHz} Hz` : 'Ambient'}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[490px] overflow-y-auto pr-1">
                    {SOLFEGGIO_LIST.map((sol) => {
                      const isPlaying = activeSolfeggioHz === sol.hz;
                      return (
                        <div
                          key={sol.hz}
                          onClick={() => handlePlaySolfeggio(sol.hz)}
                          onMouseEnter={() => forgeAudio.playTick(1100)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                            isPlaying
                              ? 'bg-purple-950/40 border-purple-500/80 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500'
                              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span 
                              className="px-2 py-0.5 rounded font-mono text-[10px] font-bold border"
                              style={{ 
                                background: `${sol.color}22`,
                                color: sol.color,
                                borderColor: `${sol.color}44`
                              }}
                            >
                              {sol.hz} Hz
                            </span>
                            <button
                              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                isPlaying ? 'bg-purple-500 text-white animate-pulse' : 'bg-slate-900 text-slate-400'
                              }`}
                            >
                              <Music className="w-3 h-3" />
                              <span>{isPlaying ? 'PLAYING' : 'TEST TONE'}</span>
                            </button>
                          </div>

                          <div className="text-sm font-bold text-white">
                            {sol.name}
                          </div>

                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {sol.benefit}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeCategory === 'inscribe' ? (
                /* Laser Monogram & Inscription Studio */
                <div className="space-y-6 max-w-xl py-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Type className="w-4 h-4 text-plug-accent" />
                      <h3 className="text-base font-bold text-white">Laser Monogram & Inscription Studio</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Laser-etch your personal 1-4 character seal into the central core, and inscribe your custom creator handle and motto along the circular perimeter vector path.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Central Core Monogram Input */}
                    <div>
                      <label className="block text-xs font-mono text-slate-300 font-bold mb-1.5 flex items-center justify-between">
                        <span>Central Core Monogram / Sigil Seal (1 - 4 Chars)</span>
                        <span className="text-purple-400 font-normal text-[10px]">✨ Laser Etched</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={customMonogram}
                          placeholder="e.g. APEX, Ω, 777, ₿, VIP"
                          onChange={(e) => setCustomMonogram(e.target.value.toUpperCase())}
                          maxLength={4}
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-purple-500/50 text-white font-mono text-sm focus:outline-none focus:border-plug-accent uppercase font-bold tracking-widest"
                        />
                        <span className="absolute right-3 top-3.5 text-xs font-mono text-purple-400">
                          {customMonogram.length}/4
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-300 font-bold mb-1.5">
                        Creator Handle / Cashtag
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={customHandle}
                          placeholder={user?.display_name ? `@${user.display_name.toUpperCase()}` : `@${referralCode}`}
                          onChange={(e) => setCustomHandle(e.target.value)}
                          maxLength={24}
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-plug-accent"
                        />
                        <span className="absolute right-3 top-3.5 text-xs font-mono text-slate-500">
                          {customHandle.length}/24
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-300 font-bold mb-1.5">
                        Outer Perimeter Motto
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={customMotto}
                          placeholder="SOVEREIGN CREATOR"
                          onChange={(e) => setCustomMotto(e.target.value.toUpperCase())}
                          maxLength={32}
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-plug-accent uppercase"
                        />
                        <span className="absolute right-3 top-3.5 text-xs font-mono text-slate-500">
                          {customMotto.length}/32
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1.5 font-mono">
                      <div className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Scan className="w-3.5 h-3.5 text-purple-400" />
                        Live Vector Inscription Preview:
                      </div>
                      <div>• Core Monogram Seal: <strong className="text-purple-300 font-bold">{customMonogram || 'DEFAULT'}</strong></div>
                      <div>• Rim Inscription: <strong className="text-white">{customHandle || user?.display_name || referralCode}</strong></div>
                      <div>• Motto Circular Path: <strong className="text-white">{customMotto}</strong></div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Advanced Shader & FX Physics Controls (10 Options) */
                <div className="space-y-6 max-w-xl py-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-base font-bold text-white">FX Physics Engine & Shader Physics</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      10 Procedural controls: fine-tune subatomic particles, chromatic aberration dispersion, relativistic quantum orbit velocities, and aura luminosity.
                    </p>
                  </div>

                  <div className="space-y-4 font-mono text-xs max-h-[490px] overflow-y-auto pr-1">
                    {/* 1. Luminosity Glow Mode */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold">1. Luminosity Glow Intensity</div>
                        <div className="text-slate-500 text-[11px]">Niagara plasma bloom mode</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {(['subtle', 'normal', 'supernova'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              setGlowMode(m);
                              forgeAudio.playTick(900);
                            }}
                            className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold ${
                              glowMode === m ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Spin Velocity */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold">2. Orbital Spin Velocity</div>
                        <div className="text-slate-500 text-[11px]">Continuous gyroscopic 360° rotation</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {(['off', 'slow', 'normal', 'warp'] as const).map((spd) => (
                          <button
                            key={spd}
                            onClick={() => {
                              setRotationSpeed(spd);
                              forgeAudio.playTick(900);
                            }}
                            className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold ${
                              rotationSpeed === spd ? 'bg-plug-accent text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {spd}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Spectrum Hue Shift Slider */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-bold">3. Dynamic Spectrum Hue Shift</span>
                        <span className="text-purple-400 font-bold">{hueShift}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={hueShift}
                        onChange={(e) => setHueShift(Number(e.target.value))}
                        className="w-full accent-purple-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                      />
                    </div>

                    {/* 4. Chromatic Dispersion Toggle */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold">4. RGB Chromatic Dispersion</div>
                        <div className="text-slate-500 text-[11px]">Prismatic red/cyan color splitting effect</div>
                      </div>
                      <button
                        onClick={() => {
                          setChromaticAberration(!chromaticAberration);
                          forgeAudio.playTick(900);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                          chromaticAberration ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {chromaticAberration ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>

                    {/* 5. Particle Density */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-bold">5. Quantum Particle Density</span>
                        <span className="text-plug-accent">{particleDensity} Nodes</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="60"
                        value={particleDensity}
                        onChange={(e) => setParticleDensity(Number(e.target.value))}
                        className="w-full accent-emerald-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
                      />
                    </div>

                    {/* 6. Orbit Speed Factor */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-bold">6. Relativistic Orbit Speed Factor</span>
                        <span className="text-cyan-400 font-bold">{orbitSpeedFactor.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={orbitSpeedFactor}
                        onChange={(e) => setOrbitSpeedFactor(Number(e.target.value))}
                        className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
                      />
                    </div>

                    {/* 7. Interactive Niagara Shockwave Pulse */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold">7. Niagara Shockwave Pulse</div>
                        <div className="text-slate-500 text-[11px]">Trigger instant radiant particle discharge</div>
                      </div>
                      <button
                        onClick={triggerShockwave}
                        className="px-3 py-1.5 rounded-xl font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 transition-all flex items-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>PULSE</span>
                      </button>
                    </div>

                    {/* 8. Master Procedural Audio Toggle */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold">8. Solfeggio Audio Resonance</div>
                        <div className="text-slate-500 text-[11px]">528Hz synthesis & alchemical tone generator</div>
                      </div>
                      <button
                        onClick={() => {
                          const muted = forgeAudio.toggleMute();
                          setIsAudioMuted(muted);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                          !isAudioMuted ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {!isAudioMuted ? 'ACTIVE' : 'MUTED'}
                      </button>
                    </div>

                    {/* 9. Unique Seed Watermark Details */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 text-[11px] space-y-1">
                      <div className="text-purple-300 font-bold flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-plug-accent" />
                        <span>9. Deterministic SHA-256 Micro-Geometry Matrix</span>
                      </div>
                      <div className="text-slate-400">
                        14 Stardust vertices + {7 + (referralCode.length % 12)}-cycle harmonic wave unique to seed <code className="text-plug-accent">[{referralCode}]</code>.
                      </div>
                    </div>

                    {/* 10. Master Alchemical Preservation */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 text-[11px] space-y-1">
                      <div className="text-emerald-300 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>10. Osmium Memory & PrimordiaFlow Binding</span>
                      </div>
                      <div className="text-slate-400">
                        All configuration parameters are cryptographically anchored to your MoneyPlugHub profile and live referral telemetry.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Quick Action Banner */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-400 font-mono">
                  Current Level: <strong className="text-white">Level {userLevel}</strong> ({userXp.toLocaleString()} XP)
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <PointPackButton />
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SigilForgePage;
