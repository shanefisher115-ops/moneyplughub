import React, { createContext, useContext, useState, useEffect } from 'react';
const WEALTH_MOTTO_POOL = [
    '“Cash flow is the lifeblood of freedom. Automate the inflow.”',
    '“Zero capital at risk. Infinite return on distribution.”',
    '“Every smart link is a synthetic dividend asset yielding 24/7.”',
    '“Stack cashflow, lock the vault, let compounding run.”',
    '“Convert network attention into immutable ledger revenue.”',
    '“Replace monetary risk with autonomous AI infrastructure.”',
    '“Hold the keys. Own the vault. Accelerate velocity.”',
    '“Yield that never sleeps. Cash flow that never stops.”',
    '“Turn everyday recurring actions into residual royalties.”',
    '“Financial velocity: High savings rate + automated referral yield.”',
];
const PALETTES_CONFIG = {
    'emerald-cashflow': {
        primary: '#10b981',
        secondary: '#34d399',
        glow: 'rgba(16, 185, 129, 0.25)',
    },
    'gold-vault': {
        primary: '#f59e0b',
        secondary: '#fbbf24',
        glow: 'rgba(245, 158, 11, 0.28)',
    },
    'cyber-crypto': {
        primary: '#06b6d4',
        secondary: '#10b981',
        glow: 'rgba(6, 182, 212, 0.25)',
    },
    'cosmic-revenue': {
        primary: '#a855f7',
        secondary: '#10b981',
        glow: 'rgba(168, 85, 247, 0.25)',
    },
    'titanium-reserve': {
        primary: '#38bdf8',
        secondary: '#f59e0b',
        glow: 'rgba(56, 189, 248, 0.22)',
    },
};
const PALETTE_KEYS = [
    'emerald-cashflow',
    'gold-vault',
    'cyber-crypto',
    'cosmic-revenue',
    'titanium-reserve',
];
const CARD_AESTHETICS = [
    'glass-cyber',
    'gold-trim',
    'emerald-glow',
    'titanium-bevel',
];
export const COSMIC_PILL_CONFIG = {
    nebula_void: {
        name: '🌌 Nebula Void Pill',
        css: 'bg-gradient-to-b from-purple-950/80 via-slate-950/95 to-slate-900/90 border-purple-500/40 shadow-purple-500/20',
        accent: '#8b5cf6',
    },
    solar_gold: {
        name: '🌟 Solar Flare Gold Pill',
        css: 'bg-gradient-to-b from-amber-950/85 via-slate-950/95 to-amber-950/80 border-amber-500/50 shadow-amber-500/30',
        accent: '#f59e0b',
    },
    cyber_matrix: {
        name: '🔮 Cyber Matrix Pill',
        css: 'bg-gradient-to-b from-slate-950 via-cyan-950/40 to-slate-950 border-cyan-500/50 shadow-cyan-500/25',
        accent: '#06b6d4',
    },
    emerald_vault: {
        name: '🟢 Living Emerald Vault Pill',
        css: 'bg-gradient-to-b from-emerald-950/85 via-slate-950/95 to-emerald-950/80 border-emerald-500/50 shadow-emerald-500/30',
        accent: '#10b981',
    },
    singularity: {
        name: '⚛️ Quantum Singularity Pill',
        css: 'bg-gradient-to-b from-black via-rose-950/30 to-black border-rose-500/40 shadow-rose-500/20',
        accent: '#f43f5e',
    },
    spacetime_warp: {
        name: '🚀 Spacetime Warp Pill',
        css: 'bg-gradient-to-b from-indigo-950/85 via-slate-950/95 to-blue-950/85 border-blue-400/50 shadow-blue-500/30',
        accent: '#3b82f6',
    },
};
const GenerativeDesignContext = createContext(undefined);
export const GenerativeDesignProvider = ({ children }) => {
    const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000000));
    const [paletteIndex, setPaletteIndex] = useState(() => Math.floor(Math.random() * PALETTE_KEYS.length));
    const [aestheticIndex, setAestheticIndex] = useState(() => Math.floor(Math.random() * CARD_AESTHETICS.length));
    const [mottoIndex, setMottoIndex] = useState(() => Math.floor(Math.random() * WEALTH_MOTTO_POOL.length));
    const [pillKey, setPillKey] = useState('nebula_void');
    const [pillCss, setPillCss] = useState(COSMIC_PILL_CONFIG['nebula_void'].css);
    const shiftDesign = () => {
        setSeed(Date.now());
        setPaletteIndex((prev) => (prev + 1) % PALETTE_KEYS.length);
        setAestheticIndex((prev) => (prev + 1) % CARD_AESTHETICS.length);
        setMottoIndex((prev) => (prev + 1) % WEALTH_MOTTO_POOL.length);
    };
    const setPillBackground = (key, customCss) => {
        setPillKey(key);
        setPillCss(customCss || COSMIC_PILL_CONFIG[key]?.css || COSMIC_PILL_CONFIG['nebula_void'].css);
    };
    // Fetch equipped loadout from backend
    useEffect(() => {
        const fetchCosmetics = async () => {
            try {
                const res = await fetch('/api/economy/store/loadout');
                if (res.ok) {
                    const j = await res.json();
                    if (j.success && j.data?.pillBackgroundKey) {
                        const key = j.data.pillBackgroundKey;
                        setPillKey(key);
                        setPillCss(j.data.pillPreviewCss || COSMIC_PILL_CONFIG[key]?.css || COSMIC_PILL_CONFIG['nebula_void'].css);
                    }
                }
            }
            catch { }
        };
        fetchCosmetics();
    }, []);
    // Keyboard shortcut: Press 'Shift + D' to randomly morph design
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === 'D' || e.key === 'd') && e.shiftKey) {
                shiftDesign();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    const currentPalette = PALETTE_KEYS[paletteIndex];
    const config = PALETTES_CONFIG[currentPalette];
    const cardAesthetic = CARD_AESTHETICS[aestheticIndex];
    const wealthMotto = WEALTH_MOTTO_POOL[mottoIndex];
    const value = {
        seed,
        palette: currentPalette,
        cardAesthetic,
        glowIntensity: 'vibrant',
        primaryAccent: config.primary,
        secondaryAccent: config.secondary,
        glowColor: config.glow,
        wealthMotto,
        particleDensity: 1.0,
        billSymbolRatio: 0.5,
        pillBackgroundKey: pillKey,
        pillBackgroundCss: pillCss,
        setPillBackground,
        shiftDesign,
    };
    return (<GenerativeDesignContext.Provider value={value}>
      {children}
    </GenerativeDesignContext.Provider>);
};
export const useGenerativeDesign = () => {
    const context = useContext(GenerativeDesignContext);
    if (!context) {
        throw new Error('useGenerativeDesign must be used within a GenerativeDesignProvider');
    }
    return context;
};
