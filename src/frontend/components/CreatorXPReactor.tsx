import React, { useState, useEffect } from 'react';
import { Zap, Flame, ShieldAlert, Sparkles, ChevronUp, ChevronDown, RefreshCw, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CreatorXPReactorProps {
  onNavigate?: (tab: string) => void;
}

export const CreatorXPReactor: React.FC<CreatorXPReactorProps> = ({ onNavigate }) => {
  const { user, token } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [reactorData, setReactorData] = useState<any>({
    level: 1,
    plasmaChargePct: 100,
    overloadStreak: 3,
    totalPulses: 14,
    healthScore: 88,
    plasmaColor: '#10b981',
    coreStatus: 'OPTIMAL_FUSION',
    overloadBonusMultiplier: 1.25,
  });

  const fetchReactorState = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/primordia/nuclear/state', { headers });
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data?.reactor) {
          setReactorData(j.data.reactor);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchReactorState();
  }, [token]);

  const handlePulseReactor = async () => {
    if (loading) return;
    setLoading(true);
    setPulseAnimation(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/primordia/nuclear/reactor/pulse', {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        const j = await res.json();
        if (j.success) {
          fetchReactorState();
          if ((window as any).refreshGlobalBalance) (window as any).refreshGlobalBalance();
        }
      }
    } catch {} finally {
      setLoading(false);
      setTimeout(() => setPulseAnimation(false), 1200);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 font-mono select-none">
      {/* Expanded Tokamak Fusion Chamber Modal */}
      {expanded ? (
        <div className="w-80 sm:w-96 rounded-3xl bg-slate-950/95 border-2 border-emerald-500/50 p-5 shadow-2xl shadow-emerald-500/20 backdrop-blur-2xl animate-in zoom-in-95 duration-200 text-slate-200 relative overflow-hidden">
          {/* Cosmic Ambient Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Flame className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-black text-white tracking-wider flex items-center gap-1.5">
                  <span>CREATOR XP REACTOR</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px]">LVL {reactorData.level}</span>
                </div>
                <div className="text-[10px] text-slate-400">Tokamak Fusion Chamber</div>
              </div>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Tokamak Core Graphic */}
          <div className="py-6 flex flex-col items-center justify-center relative z-10">
            <div className="relative flex items-center justify-center">
              {/* Outer Containment Ring */}
              <div className={`w-36 h-36 rounded-full border-2 border-dashed border-emerald-500/40 flex items-center justify-center transition-all duration-700 ${
                pulseAnimation ? 'animate-spin scale-110 border-cyan-400' : 'animate-spin-slow'
              }`} />

              {/* Middle Magnetic Coil */}
              <div className="absolute w-28 h-28 rounded-full border border-emerald-400/60 animate-pulse" />

              {/* Glowing Fusion Core */}
              <div
                className={`absolute w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500 ${
                  pulseAnimation ? 'scale-125 shadow-cyan-400/80 bg-cyan-400' : 'shadow-emerald-500/60 bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500'
                }`}
                style={{ boxShadow: `0 0 30px ${reactorData.plasmaColor}` }}
              >
                <Zap className="w-8 h-8 text-slate-950 fill-current animate-bounce" />
                <span className="text-[9px] font-black text-slate-950 font-mono mt-0.5">{reactorData.healthScore}%</span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <div className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>{reactorData.coreStatus}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {reactorData.overloadStreak >= 3 ? '🔥 OVERLOAD STREAK ACTIVE (+25% BONUS XP)' : 'Stabilized Plasma Containment'}
              </div>
            </div>
          </div>

          {/* Reactor Stats Matrix */}
          <div className="grid grid-cols-2 gap-2 text-[11px] mb-4 relative z-10">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[9px] text-slate-400">PLASMA CHARGE</div>
              <div className="text-sm font-bold text-white mt-0.5">{reactorData.plasmaChargePct}%</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[9px] text-slate-400">TOTAL PULSES</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">{reactorData.totalPulses}⚡</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 relative z-10">
            <button
              onClick={handlePulseReactor}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{loading ? 'DISCHARGING PLASMA...' : '⚡ PULSE REACTOR (+50 XP)'}</span>
            </button>

            {onNavigate && (
              <button
                onClick={() => {
                  setExpanded(false);
                  onNavigate('reality-engine');
                }}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-[11px] border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Enter Full Reality Engine Chamber</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Minimized Docked Fusion Core Orb */
        <button
          onClick={() => setExpanded(true)}
          className="group relative flex items-center gap-2.5 p-2 pr-3.5 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/40 hover:border-emerald-400/80 shadow-xl shadow-emerald-500/20 backdrop-blur-xl transition-all duration-300 hover:scale-105 cursor-pointer"
          title="Open Creator XP Fusion Core"
        >
          {/* Pulsing Outer Aura */}
          <span className="absolute -inset-1 rounded-full bg-emerald-500/20 blur-sm group-hover:bg-emerald-500/30 animate-pulse" />

          {/* Core Mini Sphere */}
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-md">
            <Flame className="w-4 h-4 animate-bounce" />
          </div>

          <div className="relative text-left hidden sm:block">
            <div className="text-[10px] font-black text-white leading-tight flex items-center gap-1">
              <span>XP REACTOR</span>
              <span className="text-[8px] text-emerald-400">LVL {reactorData.level}</span>
            </div>
            <div className="text-[9px] text-emerald-300 font-bold leading-tight">
              {reactorData.healthScore}% FUSION
            </div>
          </div>

          <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors relative" />
        </button>
      )}
    </div>
  );
};
