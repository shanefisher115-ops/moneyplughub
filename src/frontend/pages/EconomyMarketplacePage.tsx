import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGamificationXp } from '../context/GamificationXpContext';
import { useGenerativeDesign, CosmicPillBackgroundKey } from '../context/GenerativeDesignContext';
import { forgeAudio } from '../utils/forgeAudio';
import {
  Coins, Sparkles, Zap, Flame, Shield, ShieldCheck, ArrowRight,
  TrendingUp, RefreshCw, ShoppingBag, Hammer, Lock, Unlock,
  Layers, Check, Copy, CheckCheck, Loader2, ArrowUpRight,
  FlameKindling, Star, Compass, Atom, Cpu, Award, DollarSign,
  Wand2, Orbit, Palette, Eye, CheckCircle2
} from 'lucide-react';

interface WalletData {
  coreUnits: number;
  stardust: number;
  quantumCharges: number;
  jackpotTokens: number;
  totalEarned: number;
  totalSpent: number;
}

interface StoreItem {
  id: string;
  name: string;
  category: 'click_ability' | 'pill_background';
  ability_key?: string;
  background_key?: string;
  description: string;
  rarity: 'rare' | 'epic' | 'legendary' | 'cosmic';
  cost_xp: number;
  cost_core_units: number;
  preview_color: string;
  preview_css?: string;
  icon_name?: string;
  required_level: number;
  isOwned: boolean;
  isEquipped: boolean;
}

interface MarketplaceListing {
  id: string;
  seller_id: string;
  seller_name: string;
  item_id: string;
  item_name: string;
  item_type: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'cosmic';
  price_core_units: number;
  status: 'active' | 'sold' | 'cancelled';
  created_at: string;
}

interface CraftingRecipe {
  id: string;
  output_item_id: string;
  output_name: string;
  output_type: string;
  output_rarity: string;
  cost_stardust: number;
  cost_core_units: number;
  required_level: number;
  success_rate_pct: number;
  description: string;
  accent_color: string;
}

interface LedgerBlock {
  id: string;
  user_id: string;
  action_type: string;
  item_id: string | null;
  item_name: string | null;
  units_delta: number;
  stardust_delta: number;
  block_hash: string;
  prev_hash: string;
  details_json: string;
  created_at: string;
}

export const EconomyMarketplacePage: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const { awardXp } = useGamificationXp();
  const { pillBackgroundKey, setPillBackground } = useGenerativeDesign();

  // Active Main Tab: 'store' | 'marketplace' | 'forge' | 'wallet' | 'ledger'
  const [activeTab, setActiveTab] = useState<'store' | 'marketplace' | 'forge' | 'wallet' | 'ledger'>('store');
  
  // Store Catalog State
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [storeFilter, setStoreFilter] = useState<'all' | 'click_ability' | 'pill_background'>('all');
  const [isBuyingItemId, setIsBuyingItemId] = useState<string | null>(null);
  const [isEquippingItemId, setIsEquippingItemId] = useState<string | null>(null);

  // Overview State
  const [loading, setLoading] = useState<boolean>(true);
  const [wallet, setWallet] = useState<WalletData>({
    coreUnits: 250,
    stardust: 1000,
    quantumCharges: 5,
    jackpotTokens: 2,
    totalEarned: 250,
    totalSpent: 0,
  });
  const [telemetry, setTelemetry] = useState<any>({
    circulatingCoreUnits: 1000000,
    burnedCoreUnits: 3420,
    totalMarketVolume: 14250,
    activeListingsCount: 7,
    ledgerBlocksCount: 1,
    marketBurnFeePct: 2.5,
  });
  const [userInventory, setUserInventory] = useState<any[]>([]);

  // Marketplace Listings State
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [selectedRarityFilter, setSelectedRarityFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [isBuyingId, setIsBuyingId] = useState<string | null>(null);

  // Crafting Forge State
  const [recipes, setRecipes] = useState<CraftingRecipe[]>([]);
  const [isForgingId, setIsForgingId] = useState<string | null>(null);
  const [forgeResult, setForgeResult] = useState<string | null>(null);

  // Conversion Hub State
  const [xpToConvert, setXpToConvert] = useState<number>(1000);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [convertMessage, setConvertMessage] = useState<string | null>(null);

  // Ledger State
  const [ledgerBlocks, setLedgerBlocks] = useState<LedgerBlock[]>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Toast / Status Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Economy Overview
  const fetchOverview = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/economy/overview', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setWallet(json.data.wallet);
          setTelemetry(json.data.economyTelemetry);
          setUserInventory(json.data.inventory || []);
        }
      }
    } catch (err) {
      console.error('Error fetching economy overview:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Marketplace Listings
  const fetchListings = async () => {
    try {
      const url = `/api/economy/market?rarity=${selectedRarityFilter}&type=${selectedTypeFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setListings(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching market listings:', err);
    }
  };

  // 3. Fetch Crafting Recipes
  const fetchRecipes = async () => {
    try {
      const res = await fetch('/api/economy/crafting/recipes');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setRecipes(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching crafting recipes:', err);
    }
  };

  // 4. Fetch Ledger Blocks
  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/economy/ledger');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setLedgerBlocks(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching ledger:', err);
    }
  };

  // 5. Fetch Store Catalog
  const fetchStoreCatalog = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/economy/store/catalog', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          setStoreItems(json.data.items);
        }
      }
    } catch (err) {
      console.error('Error fetching store catalog:', err);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchStoreCatalog();
    fetchListings();
    fetchRecipes();
    fetchLedger();
  }, [token]);

  // Handle Buy Store Item (Mouseclick ability or Cosmic Pill)
  const handleBuyStoreItem = async (item: StoreItem, paymentMethod: 'xp' | 'core_units', e?: React.MouseEvent) => {
    if (item.isOwned) return;

    const userLevel = user?.level || 1;
    if (userLevel < item.required_level) {
      showToast(`🔒 Requires Level ${item.required_level} to unlock!`, 'error');
      forgeAudio.playTick(400);
      return;
    }

    const userXp = user?.xp ?? 0;
    if (paymentMethod === 'xp' && (!user || userXp < item.cost_xp)) {
      showToast(`Insufficient XP. Requires ${item.cost_xp.toLocaleString()} XP (You have ${userXp.toLocaleString()} XP).`, 'error');
      forgeAudio.playTick(400);
      return;
    }

    if (paymentMethod === 'core_units' && wallet.coreUnits < item.cost_core_units) {
      showToast(`Insufficient Core Units. Requires ${item.cost_core_units} Units (You have ${wallet.coreUnits}).`, 'error');
      forgeAudio.playTick(400);
      return;
    }

    try {
      setIsBuyingItemId(item.id);
      forgeAudio.playTick(1200);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/economy/store/buy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemId: item.id, paymentMethod }),
      });

      const json = await res.json();
      if (json.success) {
        forgeAudio.playAscensionChord();
        forgeAudio.playShockwave();
        awardXp(150, `Cosmic Store: Unlocked ${item.name}! ✨`, undefined, e ? { x: e.clientX, y: e.clientY } : undefined);
        showToast(json.message, 'success');

        // Optimistically apply loadout
        if (item.category === 'click_ability' && item.ability_key && (window as any).setEquippedClickAbility) {
          (window as any).setEquippedClickAbility(item.ability_key);
        } else if (item.category === 'pill_background' && item.background_key) {
          setPillBackground(item.background_key as CosmicPillBackgroundKey, item.preview_css);
        }

        fetchStoreCatalog();
        fetchOverview();
        if (refreshUser) refreshUser();
      } else {
        forgeAudio.playTick(400);
        showToast(json.error || 'Failed to unlock store item.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Store purchase timed out.', 'error');
    } finally {
      setIsBuyingItemId(null);
    }
  };

  // Handle Equip Store Item
  const handleEquipStoreItem = async (item: StoreItem) => {
    try {
      setIsEquippingItemId(item.id);
      forgeAudio.playTick(1000);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/economy/store/equip', {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemId: item.id }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message, 'success');

        // Trigger live change
        if (item.category === 'click_ability' && item.ability_key && (window as any).setEquippedClickAbility) {
          (window as any).setEquippedClickAbility(item.ability_key);
          if ((window as any).triggerMagicalClick) {
            (window as any).triggerMagicalClick(window.innerWidth / 2, window.innerHeight / 2, item.ability_key);
          }
        } else if (item.category === 'pill_background' && item.background_key) {
          setPillBackground(item.background_key as CosmicPillBackgroundKey, item.preview_css);
        }

        fetchStoreCatalog();
      } else {
        showToast(json.error || 'Failed to equip item.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Equip error.', 'error');
    } finally {
      setIsEquippingItemId(null);
    }
  };

  // Trigger live particle test preview
  const handleTestPreviewAbility = (item: StoreItem, e: React.MouseEvent) => {
    e.stopPropagation();
    forgeAudio.playTick(1400);
    if (item.category === 'click_ability' && item.ability_key && (window as any).triggerMagicalClick) {
      (window as any).triggerMagicalClick(e.clientX, e.clientY, item.ability_key);
    } else if (item.category === 'pill_background' && item.background_key) {
      setPillBackground(item.background_key as CosmicPillBackgroundKey, item.preview_css);
      showToast(`Applied ${item.name} visual preview!`, 'success');
    }
  };

  useEffect(() => {
    fetchListings();
  }, [selectedRarityFilter, selectedTypeFilter]);

  // Handle Buy Marketplace Item
  const handleBuyItem = async (listing: MarketplaceListing, e?: React.MouseEvent) => {
    if (wallet.coreUnits < listing.price_core_units) {
      showToast(`Insufficient Core Units. You need ${listing.price_core_units} Units.`, 'error');
      forgeAudio.playTick(400);
      return;
    }

    try {
      setIsBuyingId(listing.id);
      forgeAudio.playTick(1200);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/economy/market/buy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ listingId: listing.id }),
      });

      const json = await res.json();
      if (json.success) {
        forgeAudio.playAscensionChord();
        awardXp(100, `Market Trade: ${listing.item_name} Purchased! 🛍️`, undefined, e ? { x: e.clientX, y: e.clientY } : undefined);
        showToast(json.message || `Acquired ${listing.item_name}!`, 'success');
        fetchOverview();
        fetchListings();
        fetchLedger();
        if (refreshUser) refreshUser();
      } else {
        showToast(json.error || 'Failed to complete trade.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Trade network failed.', 'error');
    } finally {
      setIsBuyingId(null);
    }
  };

  // Handle Forge Crafting Recipe
  const handleForgeRecipe = async (recipe: CraftingRecipe, e?: React.MouseEvent) => {
    if (wallet.stardust < recipe.cost_stardust || wallet.coreUnits < recipe.cost_core_units) {
      showToast('Insufficient materials. Check your Stardust and Core Unit balances.', 'error');
      forgeAudio.playTick(400);
      return;
    }

    try {
      setIsForgingId(recipe.id);
      forgeAudio.playLaserPulse(880, 0.5);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/economy/crafting/forge', {
        method: 'POST',
        headers,
        body: JSON.stringify({ recipeId: recipe.id }),
      });

      const json = await res.json();
      if (json.success) {
        forgeAudio.playAscensionChord();
        forgeAudio.playShockwave();
        awardXp(250, `Alchemical Forge: ${recipe.output_name} Synthesized! ⚗️`, undefined, e ? { x: e.clientX, y: e.clientY } : undefined);
        showToast(json.message, 'success');
        setForgeResult(json.message);
        fetchOverview();
        fetchRecipes();
        fetchLedger();
        if (refreshUser) refreshUser();
      } else {
        forgeAudio.playTick(500);
        showToast(json.error || 'Alchemical synthesis failed.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Crafting reactor timeout.', 'error');
    } finally {
      setIsForgingId(null);
    }
  };

  // Handle Convert XP -> Core Units
  const handleConvertXp = async (e?: React.MouseEvent) => {
    const userXp = user?.xp ?? 0;
    if (!user || userXp < xpToConvert) {
      showToast(`Insufficient XP. You have ${userXp.toLocaleString()} XP.`, 'error');
      return;
    }

    try {
      setIsConverting(true);
      forgeAudio.playTick(1100);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/economy/convert-xp', {
        method: 'POST',
        headers,
        body: JSON.stringify({ xpAmount: xpToConvert }),
      });

      const json = await res.json();
      if (json.success) {
        forgeAudio.playAscensionChord();
        awardXp(50, 'XP ➔ MPH Core Units Mined! 🪙', undefined, e ? { x: e.clientX, y: e.clientY } : undefined);
        showToast(json.message, 'success');
        setConvertMessage(json.message);
        fetchOverview();
        fetchLedger();
        if (refreshUser) refreshUser();
      } else {
        showToast(json.error || 'Conversion failed.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Conversion connection error.', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'cosmic':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/30';
      case 'legendary':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/30';
      case 'epic':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-purple-500/30';
      case 'rare':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-20 right-6 z-50 p-4 rounded-2xl border text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-emerald-500/20' 
            : 'bg-rose-950/90 border-rose-500 text-rose-300 shadow-rose-500/20'
        }`}>
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ── HEADER BANNER: ANTIGRAVITY CLOSED DIGITAL ECONOMY ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-plug-dark to-slate-950 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-plug-accent/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-plug-accent/10 text-plug-accent border border-plug-accent/30 tracking-widest uppercase">
              <Atom className="w-3.5 h-3.5 animate-spin" />
              <span>PrimordiaOS Closed Economic Realm</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Antigravity <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-plug-accent to-cyan-300">Ledger & Asset Genesis</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-mono max-w-2xl leading-relaxed">
              Universal value layer anchoring MPH Core Units, Stardust essence, Artifact Sigil trading, and an immutable cryptographic ledger.
            </p>
          </div>

          {/* 4 Universal Currency Balances */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
            {/* Core Units */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/40 shadow-lg shadow-emerald-500/10">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                Core Units
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                {wallet.coreUnits.toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">${(wallet.coreUnits * 0.01).toFixed(2)} USD Value</div>
            </div>

            {/* Stardust */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-purple-500/40 shadow-lg shadow-purple-500/10">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Stardust
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-300 mt-0.5">
                {wallet.stardust.toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Crafting Essence</div>
            </div>

            {/* Quantum Charges */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-sky-500/40 shadow-lg shadow-sky-500/10">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                Charges
              </div>
              <div className="text-xl sm:text-2xl font-black text-sky-300 mt-0.5">
                {wallet.quantumCharges}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Overcharge Ready</div>
            </div>

            {/* Jackpot Tokens */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/40 shadow-lg shadow-amber-500/10">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Relic Tokens
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">
                {wallet.jackpotTokens}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Loot Boosters</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── EDUCATIONAL ARCHITECTURAL BANNER: IDENTITY SIGILS vs ARTIFACT SIGILS ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30 font-mono text-xs text-slate-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <ShieldCheck className="w-4 h-4 text-plug-accent" />
            <span>Sovereignty Architecture: Identity vs. Artifact Sigils</span>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 font-black">
            DUAL-REALM PERSISTENCE
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5" />
              <span>🧿 1. Referral Link = Identity Sigil (Non-Transferable)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Cryptographically bound to your user account (SHA-256 hash). Powers referral commission routing, creator verification, and streak inheritance. Cannot be traded or alienated.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <div className="text-cyan-400 font-bold flex items-center gap-1.5 mb-1">
              <Unlock className="w-3.5 h-3.5" />
              <span>🔮 2. Tradable Sigils = Digital Artifacts (Freely Transferable)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Loot drops, crafted Aura shaders, Glyphs, and Stardust relics. Freely listed, traded on the Antigravity marketplace, equipped, or recycled for crafting essence.
            </p>
          </div>
        </div>
      </div>

      {/* ── CHAMBER NAVIGATION TABS ── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto font-mono text-xs">
        <button
          onClick={() => { setActiveTab('store'); forgeAudio.playTick(750); }}
          className={`py-2.5 px-4 rounded-2xl font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'store'
              ? 'bg-gradient-to-r from-purple-500/25 via-cyan-500/25 to-emerald-500/25 text-white border border-cyan-500/50 shadow-lg shadow-cyan-500/15 scale-[1.02]'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Wand2 className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>✨ Ability & Cosmic Store ({storeItems.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('marketplace'); forgeAudio.playTick(800); }}
          className={`py-2.5 px-4 rounded-2xl font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'marketplace'
              ? 'bg-plug-accent/20 text-plug-accent border border-plug-accent/40 shadow-lg shadow-plug-accent/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Artifact Marketplace ({listings.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('forge'); forgeAudio.playTick(900); }}
          className={`py-2.5 px-4 rounded-2xl font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'forge'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Hammer className="w-4 h-4" />
          <span>Alchemical Crafting Forge ({recipes.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('wallet'); forgeAudio.playTick(1000); }}
          className={`py-2.5 px-4 rounded-2xl font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'wallet'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Universal Currency & XP Hub</span>
        </button>

        <button
          onClick={() => { setActiveTab('ledger'); forgeAudio.playTick(1100); }}
          className={`py-2.5 px-4 rounded-2xl font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ledger'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Antigravity Ledger Blocks ({ledgerBlocks.length})</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 0: ✨ MAGICAL MOUSECLICK ABILITIES & COSMIC PILL STORE
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'store' && (
        <div className="space-y-6 animate-in fade-in duration-300 font-mono">
          
          {/* Store Category Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <span className="text-slate-400 font-bold text-xs shrink-0">Store Category:</span>
              <button
                onClick={() => setStoreFilter('all')}
                className={`px-3 py-1.5 rounded-xl uppercase font-bold text-xs transition-all cursor-pointer ${
                  storeFilter === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Gear ({storeItems.length})
              </button>
              <button
                onClick={() => setStoreFilter('click_ability')}
                className={`px-3 py-1.5 rounded-xl uppercase font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  storeFilter === 'click_ability'
                    ? 'bg-purple-500 text-white font-black shadow-md shadow-purple-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Mouseclick Abilities ({storeItems.filter(i => i.category === 'click_ability').length})</span>
              </button>
              <button
                onClick={() => setStoreFilter('pill_background')}
                className={`px-3 py-1.5 rounded-xl uppercase font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  storeFilter === 'pill_background'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Cosmic Pill Backgrounds ({storeItems.filter(i => i.category === 'pill_background').length})</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Available XP: <strong className="text-emerald-400">{user?.xp?.toLocaleString() || 0} XP</strong></span>
            </div>
          </div>

          {/* Interactive Hint Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Click anywhere on any ability card to trigger an instant 60 FPS live particle test preview!</span>
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:inline">Equipped abilities persist globally across the entire operating system</span>
          </div>

          {/* Store Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {storeItems
              .filter(item => storeFilter === 'all' || item.category === storeFilter)
              .map(item => {
                const isLocked = (user?.level || 1) < item.required_level;
                const canAffordXp = (user?.xp || 0) >= item.cost_xp;
                const canAffordUnits = wallet.coreUnits >= item.cost_core_units;

                return (
                  <div
                    key={item.id}
                    onClick={(e) => handleTestPreviewAbility(item, e)}
                    className={`relative p-5 sm:p-6 rounded-3xl border transition-all duration-300 flex flex-col justify-between group cursor-pointer ${
                      item.isEquipped
                        ? 'bg-slate-900/90 border-2 border-emerald-500/80 shadow-2xl shadow-emerald-500/20 ring-1 ring-emerald-500/30'
                        : item.isOwned
                        ? 'bg-slate-950/90 border-slate-700/80 hover:border-slate-500 shadow-xl'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 shadow-lg'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black border ${getRarityBadge(item.rarity)}`}>
                          {item.rarity} {item.category === 'click_ability' ? 'Ability' : 'Pill Theme'}
                        </span>
                        
                        {item.isEquipped ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            EQUIPPED
                          </span>
                        ) : item.isOwned ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-300">
                            OWNED
                          </span>
                        ) : isLocked ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-950/60 border border-rose-500/30 text-rose-300 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            LVL {item.required_level}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-300">
                            UNLOCKED
                          </span>
                        )}
                      </div>

                      {/* Pill Background Preview OR Ability Icon Preview */}
                      {item.category === 'pill_background' ? (
                        <div className={`w-full h-24 rounded-2xl p-3 border mb-3 flex flex-col justify-between transition-transform duration-300 group-hover:scale-[1.02] ${item.preview_css || 'bg-slate-900'}`}>
                          <div className="flex items-center justify-between text-[10px] text-white/80 font-bold uppercase tracking-wider">
                            <span>Cosmic Pill Preview</span>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.preview_color }} />
                          </div>
                          <div className="text-xs font-black text-white truncate drop-shadow-md">
                            {item.name}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110"
                            style={{
                              backgroundColor: `${item.preview_color}20`,
                              borderColor: `${item.preview_color}60`,
                              borderWidth: 1.5,
                            }}
                          >
                            <Wand2 className="w-6 h-6 animate-pulse" style={{ color: item.preview_color }} />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                              {item.name}
                            </h3>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Tap anywhere on card to test burst
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      <p className="text-xs text-slate-300 leading-relaxed mb-4">
                        {item.description}
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      {item.isEquipped ? (
                        <div className="w-full py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Active on Cursor & Dashboard</span>
                        </div>
                      ) : item.isOwned ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEquipStoreItem(item); }}
                          disabled={isEquippingItemId === item.id}
                          className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs transition-all border border-slate-600 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{isEquippingItemId === item.id ? 'Equipping...' : '✨ Equip Loadout'}</span>
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {/* Unlock with XP */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleBuyStoreItem(item, 'xp', e); }}
                            disabled={isLocked || !canAffordXp || isBuyingItemId === item.id}
                            className={`py-2 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              isLocked
                                ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                                : canAffordXp
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25'
                                : 'bg-slate-900 text-slate-500 border border-slate-800'
                            }`}
                            title={!canAffordXp ? 'Insufficient XP' : ''}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{item.cost_xp.toLocaleString()} XP</span>
                          </button>

                          {/* Unlock with Core Units */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleBuyStoreItem(item, 'core_units', e); }}
                            disabled={isLocked || !canAffordUnits || isBuyingItemId === item.id}
                            className={`py-2 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              isLocked
                                ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                                : canAffordUnits
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25'
                                : 'bg-slate-900 text-slate-500 border border-slate-800'
                            }`}
                            title={!canAffordUnits ? 'Insufficient Core Units' : ''}
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>{item.cost_core_units} Units</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: ARTIFACT MARKETPLACE (ORDER BOOK)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'marketplace' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 font-mono text-xs">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <span className="text-slate-400 font-bold shrink-0">Rarity:</span>
              {['all', 'rare', 'epic', 'legendary', 'cosmic'].map((rarity) => (
                <button
                  key={rarity}
                  onClick={() => setSelectedRarityFilter(rarity)}
                  className={`px-3 py-1 rounded-xl uppercase font-bold text-[10px] transition-all cursor-pointer ${
                    selectedRarityFilter === rarity
                      ? 'bg-plug-accent text-slate-950'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {rarity}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <span className="text-slate-400 font-bold shrink-0">Type:</span>
              {['all', 'glyph', 'aura', 'ring', 'stardust_bundle'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedTypeFilter(type)}
                  className={`px-3 py-1 rounded-xl uppercase font-bold text-[10px] transition-all cursor-pointer ${
                    selectedTypeFilter === type
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="relative p-5 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 hover:border-plug-accent/50 shadow-xl hover:shadow-2xl transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black border ${getRarityBadge(listing.rarity)}`}>
                      {listing.rarity} {listing.item_type}
                    </span>
                    <span className="text-[10px] text-slate-500">{listing.seller_name}</span>
                  </div>

                  <h3 className="text-lg font-black text-white group-hover:text-plug-accent transition-colors">
                    {listing.item_name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Verified digital asset on the Antigravity Ledger.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Price</div>
                    <div className="text-xl font-black text-emerald-400 flex items-center gap-1">
                      <Coins className="w-4 h-4" />
                      <span>{listing.price_core_units.toLocaleString()} Units</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleBuyItem(listing, e)}
                    disabled={isBuyingId === listing.id}
                    className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-plug-accent hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-plug-accent/20 transition-all cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                  >
                    {isBuyingId === listing.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShoppingBag className="w-3.5 h-3.5" />
                    )}
                    <span>Buy Now</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: ALCHEMICAL FUSION CRAFTING FORGE
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'forge' && (
        <div className="space-y-6 animate-in fade-in duration-300 font-mono">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Hammer className="w-4 h-4 text-purple-400" />
                <span>Alchemical Fusion Reactor & Transmutation Forge</span>
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Fuse Stardust and Core Units into Mythic/Cosmic Auras & Artifact Sigils with 15% Quantum Critical Surge chance.
              </p>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[10px]">Your Stardust:</span>
              <div className="text-base font-black text-purple-300">{wallet.stardust.toLocaleString()} ✨</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black border ${getRarityBadge(recipe.output_rarity)}`}>
                      {recipe.output_rarity} {recipe.output_type}
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold">
                      {recipe.required_level > 1 ? `Requires Lv. ${recipe.required_level}` : 'All Levels'}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white" style={{ color: recipe.accent_color }}>
                    {recipe.output_name}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">{recipe.description}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-[10px] text-slate-500 uppercase block">Required Materials</span>
                    <span className="text-purple-300 font-bold">{recipe.cost_stardust} Stardust</span>
                    <span className="text-slate-500 mx-1.5">+</span>
                    <span className="text-emerald-400 font-bold">{recipe.cost_core_units} Core Units</span>
                  </div>

                  <button
                    onClick={(e) => handleForgeRecipe(recipe, e)}
                    disabled={isForgingId === recipe.id || wallet.stardust < recipe.cost_stardust || wallet.coreUnits < recipe.cost_core_units}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-40 hover:scale-105 active:scale-95"
                  >
                    {isForgingId === recipe.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Hammer className="w-3.5 h-3.5" />
                    )}
                    <span>Ignite Forge</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: UNIVERSAL CURRENCY & XP CONVERTER
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wallet' && (
        <div className="space-y-6 animate-in fade-in duration-300 font-mono">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 mb-2 uppercase">
                <Coins className="w-3.5 h-3.5" />
                <span>Interoperable Value Mint</span>
              </div>
              <h2 className="text-2xl font-black text-white">
                Convert XP into <span className="text-emerald-400">MPH Core Units</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Exchange gamified experience into universal tokens to buy marketplace artifacts, craft mythic auras, and unlock realm keys.
              </p>

              {/* Conversion Presets */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[500, 1000, 2500, 5000, 10000, 25000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setXpToConvert(amt); forgeAudio.playTick(900); }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      xpToConvert === amt
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {amt.toLocaleString()} XP
                  </button>
                ))}
              </div>
            </div>

            {/* Conversion Calculation Card */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">XP to Convert:</span>
                <span className="text-white font-bold">{xpToConvert.toLocaleString()} XP</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Core Units Minted:</span>
                <span className="text-emerald-400 font-bold">+{Math.round(xpToConvert * 0.01)} Units</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Bonus Stardust:</span>
                <span className="text-purple-300 font-bold">+{Math.round(xpToConvert * 0.05)} Stardust</span>
              </div>

              <button
                onClick={(e) => handleConvertXp(e)}
                disabled={isConverting || !user || (user?.xp ?? 0) < xpToConvert}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-plug-accent to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-plug-accent/20 transition-all cursor-pointer disabled:opacity-40"
              >
                {isConverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                <span>Mint Core Units & Stardust</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: IMMUTABLE ANTIGRAVITY LEDGER BLOCKS
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <div className="space-y-4 animate-in fade-in duration-300 font-mono text-xs">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white">Immutable Hash-Chained Ledger Blocks</span>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
              SHA-256 VERIFIED
            </span>
          </div>

          <div className="space-y-2">
            {ledgerBlocks.map((block) => (
              <div
                key={block.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-cyan-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase">
                      {block.action_type}
                    </span>
                    <span className="text-white font-bold">{block.item_name || 'System Block'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                    <span>Block Hash: {block.block_hash.substring(0, 16)}...</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(block.block_hash);
                        setCopiedHash(block.id);
                        setTimeout(() => setCopiedHash(null), 2000);
                      }}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      {copiedHash === block.id ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-emerald-400 font-bold">
                    {block.units_delta > 0 ? `+${block.units_delta}` : block.units_delta} Units
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(block.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default EconomyMarketplacePage;