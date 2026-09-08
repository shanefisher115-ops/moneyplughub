import React from 'react';
import { useLivingRealm } from '../context/LivingRealmContext';

interface LiveCompoundingTickerProps {
  onNavigate?: (tab: string) => void;
}

export const LiveCompoundingTicker: React.FC<LiveCompoundingTickerProps> = ({ onNavigate }) => {
  const { liveEarnedCents, perSecondYieldCents, annualRunRateUsd, referralVelocity } = useLivingRealm();

  return (
    <div className="w-full bg-slate-950/95 border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300 shadow-inner relative z-30">
      {/* Telemetry Pills Row: [ STATUS ] [ METRIC NAME ]: [ VALUE ] */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Metric 1: Live Stream (Read-Only) */}
        <div className="pill-metric inline-flex items-center gap-2 bg-slate-900/90 border border-emerald-500/30 rounded-full px-3 py-1 shadow-sm">
          <span className="pill-dot live w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
          <span className="pill-label text-slate-400 font-medium">Live Stream:</span>
          <span className="pill-value text-emerald-400 font-bold font-mono">
            +${(liveEarnedCents / 100).toFixed(4)}/s
          </span>
        </div>

        {/* Metric 2: Burn / Earn (Read-Only) */}
        <div className="pill-metric inline-flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-full px-3 py-1">
          <span className="pill-icon text-amber-400 font-bold">⚡</span>
          <span className="pill-label text-slate-400 font-medium">Burn/Earn:</span>
          <span className="pill-value text-cyan-400 font-bold font-mono">
            +{perSecondYieldCents.toFixed(4)}/s
          </span>
        </div>

        {/* Metric 3: Run Rate (Read-Only) */}
        <div className="pill-metric inline-flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-full px-3 py-1">
          <span className="pill-icon text-sky-400 font-bold">📈</span>
          <span className="pill-label text-slate-400 font-medium">Run Rate:</span>
          <span className="pill-value text-white font-bold font-mono">
            ${annualRunRateUsd.toLocaleString()}/yr
          </span>
        </div>

        {/* Metric 4: Multiplier (Read-Only) */}
        <div className="pill-metric inline-flex items-center gap-1.5 bg-slate-900/90 border border-amber-500/20 rounded-full px-3 py-1">
          <span className="pill-icon text-amber-400 font-bold">🔥</span>
          <span className="pill-label text-slate-400 font-medium">Multiplier:</span>
          <span className="pill-value text-amber-300 font-bold font-mono">
            {referralVelocity}x
          </span>
        </div>

        {/* Interactive Trigger Pill */}
        {onNavigate && (
          <button
            onClick={() => onNavigate('referral-hub')}
            className="pill-action inline-flex items-center gap-1.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/60 hover:border-cyan-400 rounded-full px-3.5 py-1 text-cyan-300 hover:text-white font-mono font-bold text-[11px] shadow-[0_0_12px_rgba(0,240,255,0.25)] transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Boost Velocity Multiplier"
          >
            <span className="pill-icon text-cyan-300 font-bold">⚡</span>
            <span className="pill-label">Boost Rate +</span>
          </button>
        )}
      </div>

      {/* Right Indicator */}
      <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 font-mono">
        <span>QUANTUM HARMONIC:</span>
        <span className="text-emerald-400 font-bold">528Hz ACTIVE</span>
      </div>
    </div>
  );
};

export default LiveCompoundingTicker;
