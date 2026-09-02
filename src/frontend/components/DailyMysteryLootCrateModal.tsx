import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGamificationXp } from '../context/GamificationXpContext';
import { forgeAudio } from '../utils/forgeAudio';
import {
  Gift, Sparkles, Zap, Flame, Crown, Trophy, Check,
  Clock, X, ArrowRight, ShieldCheck, Lock, Unlock,
  Compass, Share2, Volume2, VolumeX, Award,
  DollarSign, Star, Loader2, Dices, Copy, CheckCheck
} from 'lucide-react';

export interface LootRewardDrop {
  claimId: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  badgeAccent: string;
  baseXp: number;
  xpEarned: number;
  cashCredit: number;
  cashCreditCents: number;
  cashCreditFormatted: string;
  rewardType: string;
  rewardDescription: string;
  perks: string[];
  sigilUnlocked: string | null;
  sigilName: string | null;
  multiplierAwarded: number | null;
  multiplierDurationHours: number | null;
  streakDays: number;
  nextBonusMultiplier: number;
  totalXp: number;
  newLevel: number;
  newTier: string;
  claimedAt: string;
  isGuest: boolean;
}

export interface DailyLootStatus {
  eligible: boolean;
  secondsRemaining: number;
  streakDays: number;
  nextBonusMultiplier: number;
  lastClaimedAt: string | null;
  isAuthenticated?: boolean;
}

export interface DailyMysteryLootCrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimSuccess?: (drop: LootRewardDrop) => void;
}

export const DailyMysteryLootCrateModal: React.FC<DailyMysteryLootCrateModalProps> = ({
  isOpen,
  onClose,
  onClaimSuccess,
}) => {
  const { user, token, refreshUser } = useAuth();
  const { awardXp } = useGamificationXp();

  // Modal Visual States: 'idle' | 'opening' | 'revealed'
  const [modalState, setModalState] = useState<'idle' | 'opening' | 'revealed'>('idle');
  const [status, setStatus] = useState<DailyLootStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const [reward, setReward] = useState<LootRewardDrop | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOdds, setShowOdds] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(forgeAudio.getMuted());

  // Crate Tier Selection: 'daily_standard' | 'golden_stacker' | 'osmium_vault' | 'primordia_jackpot'
  const [selectedCrateTier, setSelectedCrateTier] = useState<'daily_standard' | 'golden_stacker' | 'osmium_vault' | 'primordia_jackpot'>('daily_standard');
  
  // Quantum Overcharge State
  const [isOvercharging, setIsOvercharging] = useState<boolean>(false);
  const [overchargeMessage, setOverchargeMessage] = useState<string | null>(null);
  const [overchargeUsed, setOverchargeUsed] = useState<boolean>(false);

  // Live Jackpot Feed
  const [liveFeed, setLiveFeed] = useState<Array<{ id: string; user: string; reward: string; rarity: string; time: string; accent: string }>>([]);

  // Real-time Countdown Timer
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  // 3D Parallax Tilt state
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Fetch Daily Loot Status & Feed
  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      setErrorMessage(null);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [statusRes, feedRes] = await Promise.all([
        fetch('/api/loot/daily/status', { headers }),
        fetch('/api/loot/feed')
      ]);

      if (statusRes.ok) {
        const json = await statusRes.json();
        if (json.success && json.data) {
          setStatus(json.data);
          setCountdownSeconds(json.data.secondsRemaining || 0);
        }
      }

      if (feedRes.ok) {
        const feedJson = await feedRes.json();
        if (feedJson.success && feedJson.data) {
          setLiveFeed(feedJson.data);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch loot crate status:', err);
      setErrorMessage('Could not load crate status. Please try again.');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setModalState('idle');
      setReward(null);
      setOverchargeUsed(false);
      setOverchargeMessage(null);
      fetchStatus();
    }
  }, [isOpen, token]);

  // 2. Countdown timer interval
  useEffect(() => {
    if (!isOpen || countdownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          fetchStatus(); // Re-check status once cooldown reaches zero
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, countdownSeconds]);

  // Format seconds to HH:MM:SS
  const formatCountdown = (secs: number): string => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 3. Open Loot Crate Action
  const handleOpenCrate = async () => {
    if (isOpening || (status && !status.eligible && countdownSeconds > 0)) return;

    try {
      setIsOpening(true);
      setErrorMessage(null);
      setModalState('opening');

      // Play continuous high-tech roll sound
      forgeAudio.playCosmicRoll();

      // Call Backend Open Crate Endpoint
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/loot/daily/open', {
        method: 'POST',
        headers,
        body: JSON.stringify({ crateType: selectedCrateTier }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error || 'Failed to open loot crate.');
        setModalState('idle');
        setIsOpening(false);
        return;
      }

      const drop: LootRewardDrop = json.data;

      // Dramatic opening sequence delay (1.8s of shaking & vibration build-up)
      setTimeout(async () => {
        setReward(drop);
        setModalState('revealed');
        setIsOpening(false);

        // Trigger floating XP particles
        awardXp(drop.xpEarned, `Mystery Crate: ${drop.rarity} Drop! 🎁`, 1);

        // Play Shockwave bass drop & Solfeggio Ascension
        forgeAudio.playShockwave();
        forgeAudio.playAscensionChord();

        // Refresh user context if logged in
        if (token && refreshUser) {
          try {
            await refreshUser();
          } catch {}
        }

        if (onClaimSuccess) {
          onClaimSuccess(drop);
        }
      }, 1800);
    } catch (err: any) {
      console.error('Error opening loot crate:', err);
      setErrorMessage('Network error while opening crate. Please retry.');
      setModalState('idle');
      setIsOpening(false);
    }
  };

  // 4. Quantum Overcharge Action (Double or Nothing)
  const handleQuantumOvercharge = async () => {
    if (!reward || isOvercharging || overchargeUsed) return;
    setIsOvercharging(true);
    setOverchargeMessage(null);

    try {
      forgeAudio.playLaserPulse(1400, 0.4);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/loot/daily/overcharge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          claimId: reward.claimId,
          xpEarned: reward.xpEarned,
          cashCreditCents: reward.cashCreditCents,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const { isWin, finalXp, finalCash, finalCashFormatted, message } = json.data;
        setOverchargeUsed(true);
        setOverchargeMessage(message);

        if (isWin) {
          forgeAudio.playAscensionChord();
          awardXp(finalXp - reward.xpEarned, '⚡ Quantum Double Critical Hit!', 1);
          setReward(prev => prev ? {
            ...prev,
            xpEarned: finalXp,
            cashCredit: finalCash,
            cashCreditCents: Math.round(finalCash * 100),
            cashCreditFormatted: finalCashFormatted,
          } : null);
        } else {
          forgeAudio.playTick(600);
          awardXp(100, '🛡️ Quantum Shield Safeguard (+100 XP)');
        }

        if (token && refreshUser) {
          try { await refreshUser(); } catch {}
        }
      }
    } catch (e: any) {
      setOverchargeMessage(e.message || 'Overcharge connection failed.');
    } finally {
      setIsOvercharging(false);
    }
  };

  // 4. Parallax Tilt Handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    setTilt({ x: y, y: x });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // 5. Share reward copy
  const handleShareReward = (e?: React.MouseEvent) => {
    if (!reward) return;
    const shareText = `💎 I just unlocked a ${reward.rarity.toUpperCase()} Daily Mystery Loot Crate on Creator Money OS! +${reward.xpEarned} XP & ${reward.cashCreditFormatted} Cash! Claim yours daily: https://moneyplughub.com`;
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    awardXp(15, 'Loot Crate Flex Shared! 📢', undefined, e ? { x: e.clientX, y: e.clientY } : undefined);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  if (!isOpen) return null;

  // Rarity Theme Specs
  const rarityColors: Record<string, any> = {
    Common: {
      bg: 'from-emerald-950/90 via-slate-900 to-slate-950',
      border: 'border-emerald-500/50',
      shadow: 'shadow-emerald-500/20',
      text: 'text-emerald-400',
      glow: '#38ef7d',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      name: 'Common Tier Crate',
    },
    Rare: {
      bg: 'from-sky-950/90 via-slate-900 to-slate-950',
      border: 'border-sky-500/50',
      shadow: 'shadow-sky-500/25',
      text: 'text-sky-400',
      glow: '#38bdf8',
      badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      name: 'Rare Pulse Crate',
    },
    Epic: {
      bg: 'from-purple-950/90 via-slate-900 to-slate-950',
      border: 'border-purple-500/60',
      shadow: 'shadow-purple-500/30',
      text: 'text-purple-400',
      glow: '#c084fc',
      badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      name: 'Epic Stacker Crate',
    },
    Legendary: {
      bg: 'from-cyan-950/95 via-slate-900 to-slate-950',
      border: 'border-cyan-400/80',
      shadow: 'shadow-cyan-500/40',
      text: 'text-cyan-400',
      glow: '#38bdf8',
      badgeBg: 'bg-gradient-to-r from-cyan-500 to-sky-300 text-slate-950 border-cyan-300 font-black',
      name: 'Osmium Vault Crate',
    },
    Cosmic: {
      bg: 'from-amber-950/95 via-purple-950 to-slate-950',
      border: 'border-amber-400/90',
      shadow: 'shadow-amber-500/50',
      text: 'text-amber-300',
      glow: '#ffd700',
      badgeBg: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-amber-300 font-black shadow-lg shadow-amber-400/30',
      name: '👑 Primordia Sovereign Omni-Jackpot',
    },
  };

  const currentRarityTheme = reward ? (rarityColors[reward.rarity] || rarityColors.Common) : rarityColors.Common;
  const isEligible = status ? status.eligible && countdownSeconds <= 0 : false;
  const streakDays = status ? status.streakDays : (user?.streak_days || 1);
  const streakMultiplier = status ? status.nextBonusMultiplier : 1.0;
  const userLevel = user?.level || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300 overflow-y-auto">
      {/* Modal Card Container */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative w-full max-w-lg overflow-hidden rounded-3xl border bg-gradient-to-b ${
          modalState === 'revealed' ? currentRarityTheme.bg : 'from-slate-900/95 via-plug-dark to-slate-950'
        } ${modalState === 'revealed' ? currentRarityTheme.border : 'border-slate-800'} p-5 sm:p-7 shadow-2xl transition-all duration-300`}
        style={{
          transform: modalState !== 'opening' ? `perspective(1000px) rotateX(${tilt.x * 0.5}deg) rotateY(${tilt.y * 0.5}deg)` : undefined,
          boxShadow: modalState === 'revealed'
            ? `0 25px 60px -15px ${currentRarityTheme.glow}44, 0 0 35px ${currentRarityTheme.glow}22`
            : '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Ambient Corona Radiance Glow */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-30"
          style={{
            background: modalState === 'revealed' ? currentRarityTheme.glow : '#10b981',
          }}
        />

        {/* Top Control Bar */}
        <div className="flex items-center justify-between relative z-10 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              {streakDays} Day Streak ({streakMultiplier}× Multiplier)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute Toggle */}
            <button
              onClick={() => {
                const muted = forgeAudio.toggleMute();
                setIsAudioMuted(muted);
              }}
              className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {!isAudioMuted ? <Volume2 className="w-3.5 h-3.5 text-plug-accent" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Network Jackpot Ticker */}
        {liveFeed.length > 0 && modalState !== 'opening' && (
          <div className="mb-4 py-1.5 px-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between overflow-hidden">
            <span className="flex items-center gap-1 text-amber-400 font-bold shrink-0">
              <Sparkles className="w-3 h-3 animate-spin" />
              <span>LIVE WINS:</span>
            </span>
            <div className="truncate text-slate-300 ml-2 animate-pulse">
              <strong className="text-purple-300">{liveFeed[0]?.user}</strong> unlocked <span className="text-emerald-400 font-bold">{liveFeed[0]?.reward}</span> ({liveFeed[0]?.time})
            </div>
          </div>
        )}

        {/* ── STATE 1: IDLE / COOLDOWN ── */}
        {modalState === 'idle' && (
          <div className="text-center relative z-10">

            {/* Selectable Crate Tier Switcher Bar */}
            <div className="grid grid-cols-4 gap-1.5 mb-3 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-[10px] font-mono">
              {[
                { id: 'daily_standard', name: 'Standard', mult: '1×', minLv: 1, icon: '🎁', color: 'emerald' },
                { id: 'golden_stacker', name: 'Golden', mult: '2×', minLv: 3, icon: '⚡', color: 'purple' },
                { id: 'osmium_vault', name: 'Osmium', mult: '4×', minLv: 6, icon: '🔮', color: 'cyan' },
                { id: 'primordia_jackpot', name: 'Omni', mult: '8×', minLv: 10, icon: '👑', color: 'amber' },
              ].map((tier) => {
                const isSelected = selectedCrateTier === tier.id;
                const isLocked = userLevel < tier.minLv && streakDays < tier.minLv;
                return (
                  <button
                    key={tier.id}
                    onClick={() => {
                      if (!isLocked) {
                        setSelectedCrateTier(tier.id as any);
                        forgeAudio.playTick(900);
                      } else {
                        forgeAudio.playTick(400);
                        setErrorMessage(`🔒 ${tier.name} Crate unlocks at Level ${tier.minLv} or ${tier.minLv}-Day Streak!`);
                      }
                    }}
                    className={`py-1.5 px-1 rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer relative ${
                      isSelected
                        ? 'bg-gradient-to-b from-plug-accent/20 to-purple-600/20 border border-plug-accent text-white font-bold shadow'
                        : isLocked
                        ? 'opacity-40 text-slate-500 hover:opacity-60'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <div className="text-sm">{tier.icon}</div>
                    <div className="font-bold truncate w-full text-center mt-0.5">{tier.name}</div>
                    <div className="text-[8px] text-plug-accent font-black">{tier.mult}</div>
                  </button>
                );
              })}
            </div>

            {/* 3D Holographic Crate Visual Representation */}
            <div className="relative mx-auto w-36 h-36 sm:w-40 sm:h-40 my-3 flex items-center justify-center group cursor-pointer" onClick={isEligible ? handleOpenCrate : undefined}>
              {/* Outer Pulsing Aura Rings */}
              <div className={`absolute inset-0 rounded-3xl ${isEligible ? 'bg-gradient-to-tr from-emerald-500/20 via-plug-accent/20 to-cyan-500/20 animate-pulse' : 'bg-slate-800/30'} blur-xl`} />

              {/* Floating Holographic Chest Vector Box */}
              <div className={`relative w-full h-full rounded-3xl p-1 bg-gradient-to-b ${
                selectedCrateTier === 'primordia_jackpot'
                  ? 'from-amber-400 via-purple-500 to-yellow-300'
                  : selectedCrateTier === 'osmium_vault'
                  ? 'from-cyan-400 via-sky-500 to-indigo-600'
                  : selectedCrateTier === 'golden_stacker'
                  ? 'from-purple-400 via-indigo-500 to-emerald-400'
                  : 'from-emerald-400 via-plug-accent to-indigo-600'
              } shadow-2xl flex items-center justify-center transition-transform duration-300 ${isEligible ? 'group-hover:scale-105 animate-bounce' : 'opacity-85'}`}>
                <div className="w-full h-full rounded-[22px] bg-slate-950/90 border border-slate-800/80 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                  
                  {/* Glowing Laser Scanline across chest */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,136,0)_50%,rgba(0,255,136,0.15)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

                  {/* Central Lock / Rune Emblem */}
                  <div className="relative z-10 flex flex-col items-center">
                    {isEligible ? (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-plug-accent p-0.5 shadow-lg shadow-plug-accent/40 flex items-center justify-center">
                        <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-2xl">
                          {selectedCrateTier === 'primordia_jackpot' ? '👑' : selectedCrateTier === 'osmium_vault' ? '🔮' : selectedCrateTier === 'golden_stacker' ? '⚡' : '🎁'}
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 p-0.5 shadow-md flex items-center justify-center">
                        <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
                          <Lock className="w-7 h-7 text-slate-500" />
                        </div>
                      </div>
                    )}

                    <div className="mt-2 text-[10px] font-mono font-bold tracking-wider uppercase text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      {isEligible ? `${selectedCrateTier.replace('_', ' ').toUpperCase()} • READY` : 'COOLDOWN ACTIVE'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Header Titles */}
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
              Quantum Daily <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-plug-accent to-cyan-300">Mystery Crate</span>
            </h2>
            <p className="text-xs text-slate-300 font-mono max-w-sm mx-auto mb-4 leading-relaxed">
              Roll the quantum gacha for instant cash balances, massive XP boosts, and exclusive mythic 24K sigils.
            </p>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold flex items-center justify-between">
                <span>⚠️ {errorMessage}</span>
                <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold ml-2">✕</button>
              </div>
            )}

            {/* Cooldown Timer or Open CTA */}
            {loadingStatus ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-plug-accent" />
                <span>Checking Quantum Cooldown...</span>
              </div>
            ) : isEligible ? (
              <div className="space-y-3">
                <button
                  onClick={handleOpenCrate}
                  disabled={isOpening}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-plug-accent to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-mono font-black text-sm tracking-wide uppercase shadow-xl shadow-plug-accent/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-5 h-5 fill-current" />
                  <span>Open {selectedCrateTier.replace('_', ' ').toUpperCase()} Now</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Guaranteed Drop: Up to $50.00 USD + XP + Streak Multiplier</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Live Countdown Display Box */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    Next Daily Crate Available In
                  </div>
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-amber-200 tracking-wider">
                    {formatCountdown(countdownSeconds)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Your {streakDays}-day streak is secured. Return tomorrow to maintain your {streakMultiplier}× multiplier.
                  </div>
                </div>

                <button
                  disabled
                  className="w-full py-3 px-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 font-mono font-bold text-xs tracking-wide flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                >
                  <Lock className="w-4 h-4" />
                  <span>Crate Recharging ({formatCountdown(countdownSeconds)})</span>
                </button>
              </div>
            )}

            {/* Drop Rates Odds Accordion Toggle */}
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => {
                  setShowOdds(!showOdds);
                  forgeAudio.playTick(800);
                }}
                className="text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <Dices className="w-3.5 h-3.5 text-purple-400" />
                <span>{showOdds ? 'Hide Probability Table' : 'View Drop Table & Odds'}</span>
              </button>

              {showOdds && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-left font-mono text-[11px] animate-in fade-in duration-200">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                    <div className="font-bold text-emerald-400 flex items-center justify-between">
                      <span>20% Common</span>
                      <span className="text-[10px] text-slate-400">$1.00</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">+250 to +450 XP</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-sky-500/30">
                    <div className="font-bold text-sky-400 flex items-center justify-between">
                      <span>30% Rare</span>
                      <span className="text-[10px] text-slate-400">$2.00</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">+500 to +800 XP + 2× Surge</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-purple-500/30">
                    <div className="font-bold text-purple-400 flex items-center justify-between">
                      <span>30% Epic</span>
                      <span className="text-[10px] text-slate-400">$3 - $6</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">+800 to +1,500 XP + Rare Sigil</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/30 col-span-2">
                    <div className="font-bold text-amber-400 flex items-center justify-between">
                      <span>👑 20% Mythic / Cosmic Jackpot</span>
                      <span className="text-[10px] text-amber-300 font-bold">$10 - $50.00 Max</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">+2,000 to +10,000 XP + 5x/10x Multiplier + 24K Molten Gold Aura</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STATE 2: OPENING / SHAKING VIBRATION ── */}
        {modalState === 'opening' && (
          <div className="text-center py-10 relative z-10 animate-pulse">
            {/* Shaking Vibrating Crate with Shockwaves */}
            <div className="relative mx-auto w-40 h-40 my-6 flex items-center justify-center">
              {/* Expanding Shockwave Waves */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 via-purple-500 to-amber-400 opacity-60 blur-2xl animate-ping" />
              
              <div className="relative w-36 h-36 rounded-3xl bg-gradient-to-tr from-amber-400 via-purple-500 to-emerald-400 p-1 shadow-2xl animate-[spin_3s_linear_infinite] flex items-center justify-center">
                <div className="w-full h-full rounded-[22px] bg-slate-950 flex flex-col items-center justify-center p-4">
                  <Loader2 className="w-12 h-12 text-plug-accent animate-spin" />
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-black text-white tracking-tight uppercase animate-pulse">
              Synthesizing Quantum Drop...
            </h3>
            <p className="text-xs font-mono text-plug-accent mt-1 tracking-widest uppercase">
              Decentralized Random Beacon Active
            </p>
          </div>
        )}

        {/* ── STATE 3: REVEALED REWARD CARD ── */}
        {modalState === 'revealed' && reward && (
          <div className="text-center relative z-10 animate-in zoom-in-95 duration-400">
            {/* Rarity Header Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-extrabold uppercase tracking-widest mb-3 border shadow-lg animate-bounce" style={{ backgroundColor: `${currentRarityTheme.glow}22`, borderColor: currentRarityTheme.glow, color: currentRarityTheme.glow }}>
              <Sparkles className="w-4 h-4 fill-current" />
              <span>{reward.rarity} Reward Unlocked!</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">
              {currentRarityTheme.name}
            </h2>

            <p className="text-xs text-slate-300 font-mono max-w-sm mx-auto mb-4">
              {reward.rewardDescription}
            </p>

            {/* Overcharge Banner Notice if triggered */}
            {overchargeMessage && (
              <div className={`mb-4 p-3 rounded-2xl border text-xs font-mono font-bold animate-fadeIn ${
                overchargeMessage.includes('DOUBLED') 
                  ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-lg shadow-amber-500/20' 
                  : 'bg-indigo-950/60 border-indigo-400 text-indigo-300'
              }`}>
                {overchargeMessage}
              </div>
            )}

            {/* Primary Rewards Showcase Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-left font-mono">
              {/* Cash Credit Card */}
              <div className="p-3.5 rounded-2xl bg-slate-900/95 border border-emerald-500/40 shadow-lg shadow-emerald-500/10">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Cash Credit
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {reward.cashCreditFormatted}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">Credited to Balance</div>
              </div>

              {/* XP Earned Card */}
              <div className="p-3.5 rounded-2xl bg-slate-900/95 border border-purple-500/40 shadow-lg shadow-purple-500/10">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  XP Awarded
                </div>
                <div className="text-2xl font-black text-purple-300">
                  +{reward.xpEarned.toLocaleString()} XP
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">Includes Streak Bonus</div>
              </div>
            </div>

            {/* Quantum Overcharge (Double or Nothing) Minigame Button */}
            {!overchargeUsed && (
              <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-purple-950/60 via-indigo-950/60 to-purple-950/60 border border-purple-500/40 text-left font-mono">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>⚡ Quantum Overcharge (1-Tap Double)</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    FREE MINIGAME
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  Quantum flux gives a high chance to <strong>DOUBLE</strong> your cash and XP rewards right now! (Safeguarded against loss).
                </p>
                <button
                  onClick={handleQuantumOvercharge}
                  disabled={isOvercharging}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:opacity-95 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isOvercharging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Flame className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>Overcharge & Double Drop (+100 XP)</span>
                </button>
              </div>
            )}

            {/* Special Perks / Multipliers List */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-left mb-5 space-y-1.5 font-mono text-xs">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                Unlocked Perks & Modifiers
              </div>
              {reward.perks.map((perk, index) => (
                <div key={index} className="flex items-center gap-2 text-slate-200 text-xs">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>

            {/* CTA Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={onClose}
                className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-plug-accent to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-mono font-black text-sm tracking-wide uppercase shadow-lg shadow-plug-accent/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Claim & Equip All Rewards</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleShareReward}
                className="w-full py-2 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedShare ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Brag to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Share / Flex Crate Drop</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyMysteryLootCrateModal;
