import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLivingRealm } from '../context/LivingRealmContext';
import { 
  Orbit, Sparkles, Lock, Unlock, Zap, Trophy, Users, 
  ArrowRight, Check, Copy, Flame, Shield, Coins, Radio, 
  ExternalLink, Compass, Activity, Award, RefreshCw, Eye
} from 'lucide-react';

interface RealmCitizen {
  id: string;
  displayName: string;
  email: string;
  joinedAt: string;
  sigilUrl: string;
  status: string;
}

interface SovereignRealm {
  realmIndex: number;
  id: string;
  name: string;
  title: string;
  archetype: string;
  tagline: string;
  accentColor: string;
  glowColor: string;
  gradient: string;
  solfeggioFreq: number;
  yieldMultiplierBoost: number;
  specialPerk: string;
  description: string;
  unlocked: boolean;
  citizen: RealmCitizen | null;
  harvestableXp: number;
}

export const ReferralRealmMatrix: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { user, token } = useAuth();
  const { playSound } = useLivingRealm();

  const [realms, setRealms] = useState<SovereignRealm[]>([]);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [totalYieldBoost, setTotalYieldBoost] = useState<number>(0);
  const [unlockedCount, setUnlockedCount] = useState<number>(0);
  const [nextChamberName, setNextChamberName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [harvesting, setHarvesting] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeWarpedRealm, setActiveWarpedRealm] = useState<SovereignRealm | null>(null);

  const referralCode = user?.referral_code || 'FOUNDER-PLUG';
  const referralLink = `https://moneyplughub.com/?ref=${referralCode}`;

  const fetchRealms = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/referrals/realms', { headers });
      const j = await res.json();

      if (j.success && j.data) {
        setRealms(j.data.realms || []);
        setReferralCount(j.data.referralCount || 0);
        setUnlockedCount(j.data.unlockedRealmCount || 0);
        setTotalYieldBoost(j.data.totalYieldBoost || 0);
        setNextChamberName(j.data.nextChamberName || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealms();
  }, []);

  const handleHarvest = async () => {
    try {
      setHarvesting(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/referrals/realms/harvest', {
        method: 'POST',
        headers
      });

      const j = await res.json();
      if (j.success) {
        playSound('powerup');
        setToast(j.message);
        setTimeout(() => setToast(null), 4000);
        fetchRealms();
      } else {
        setToast(`⚠️ ${j.error || 'Harvest failed'}`);
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e: any) {
      setToast(`⚠️ ${e.message}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setHarvesting(false);
    }
  };

  const handleWarp = (realm: SovereignRealm) => {
    if (!realm.unlocked) return;
    setActiveWarpedRealm(realm);
    playSound('warp');
    setToast(`🌌 Warped into ${realm.name} (${realm.solfeggioFreq}Hz Resonance Active)!`);
    setTimeout(() => setToast(null), 3500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    playSound('laser');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-8 font-sans text-white animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          {toast}
        </div>
      )}

      {/* ── Realm Multiverse Telemetry Header ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900/95 via-purple-950/80 to-slate-950/95 border-2 border-purple-500/40 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        
        {/* Ambient Grid Corona */}
        <div className="absolute inset-0 bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-mono font-bold uppercase tracking-wider border border-purple-500/40">
              <Orbit className="w-3.5 h-3.5 animate-spin" />
              <span>1 Referral = 1 Sovereign Realm Unlocked</span>
            </div>
            
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Sovereign Referral Realms Matrix
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-mono leading-relaxed">
              Every creator who joins via your smart link becomes the <span className="text-emerald-400 font-bold">Realm Citizen</span> of a newly unlocked cosmic territory, permanently boosting your passive compounding stream.
            </p>
          </div>

          {/* Key Metrics / Harvest Action */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[110px]">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Realms Active</span>
              <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                {unlockedCount} <span className="text-xs text-slate-500 font-normal">/ {realms.length}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[120px]">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Yield Boost</span>
              <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                +{totalYieldBoost.toFixed(2)}x
              </div>
            </div>

            <button
              onClick={handleHarvest}
              disabled={harvesting || (unlockedCount === 0 && user?.role !== 'admin')}
              className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${harvesting ? 'animate-spin' : ''}`} />
              <span>Harvest Energy</span>
            </button>
          </div>
        </div>

        {/* Next Frontier Banner */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>Next Frontier Target: <strong className="text-purple-300">{nextChamberName}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 hidden sm:inline">Your Smart Code: <code className="text-emerald-400 font-bold">{referralCode}</code></span>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Realms Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {realms.map((realm) => {
          const isUnlocked = realm.unlocked;

          return (
            <div
              key={realm.id}
              className={`rounded-3xl border transition-all duration-300 flex flex-col justify-between relative overflow-hidden shadow-2xl group ${
                isUnlocked
                  ? 'bg-slate-900/90 border-slate-800 hover:border-purple-500/60 hover:shadow-purple-500/20'
                  : 'bg-slate-950/60 border-slate-900 opacity-60 hover:opacity-80'
              }`}
            >
              {/* Dynamic Gradient Atmosphere */}
              <div 
                className={`absolute inset-0 bg-gradient-to-br ${realm.gradient} opacity-20 pointer-events-none transition-opacity group-hover:opacity-35`}
              />

              <div className="p-6 relative z-10 space-y-4">
                
                {/* Realm Header Tag & Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border"
                      style={{ 
                        backgroundColor: `${realm.accentColor}20`,
                        borderColor: `${realm.accentColor}40`,
                        color: realm.accentColor
                      }}
                    >
                      REALM {realm.realmIndex}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {realm.solfeggioFreq} Hz
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isUnlocked ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
                        <Unlock className="w-3 h-3 text-emerald-400" />
                        UNLOCKED
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-500" />
                        LOCKED
                      </span>
                    )}
                  </div>
                </div>

                {/* Realm Emblem & Name */}
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <span>{realm.name}</span>
                  </h3>
                  <div className="text-xs text-purple-300 font-mono mt-0.5 font-bold">
                    {realm.title}
                  </div>
                  <p className="text-xs text-slate-300 font-sans mt-2 leading-relaxed">
                    {realm.description}
                  </p>
                </div>

                {/* Realm Citizen Binding */}
                {isUnlocked && realm.citizen ? (
                  <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border"
                      style={{ backgroundColor: `${realm.accentColor}20`, borderColor: `${realm.accentColor}40`, color: realm.accentColor }}
                    >
                      {realm.citizen.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                        <span>{realm.citizen.displayName}</span>
                        <span className="text-[9px] font-mono text-emerald-400 font-normal">● Citizen</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        Joined: {new Date(realm.citizen.joinedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ) : isUnlocked ? (
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-400 italic">
                    👑 Sovereign Founder Territory • Awaiting First Citizen
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-950/40 border border-slate-900 text-xs font-mono text-slate-500 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>Invite 1 friend with code <strong className="text-slate-400">{referralCode}</strong> to unlock</span>
                  </div>
                )}

                {/* Special Perk Card */}
                <div 
                  className="p-2.5 rounded-xl border text-xs font-mono space-y-1"
                  style={{ backgroundColor: `${realm.accentColor}10`, borderColor: `${realm.accentColor}30` }}
                >
                  <div className="text-[10px] uppercase font-bold text-slate-400">Realm Sovereign Powers:</div>
                  <div className="text-slate-200 font-medium text-[11px] leading-snug">
                    {realm.specialPerk}
                  </div>
                </div>

              </div>

              {/* Card Footer Actions */}
              <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 relative z-10 flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>+{realm.yieldMultiplierBoost.toFixed(2)}x Yield</span>
                </div>

                {isUnlocked ? (
                  <button
                    onClick={() => handleWarp(realm)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    style={{ 
                      backgroundColor: `${realm.accentColor}30`,
                      color: '#ffffff',
                      border: `1px solid ${realm.accentColor}60`
                    }}
                  >
                    <span>🌌 Warp In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Unlock with Invite</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default ReferralRealmMatrix;
