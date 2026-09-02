import React, { useState } from 'react';
import { usePeerPush } from '../context/PeerPushContext';
import { Zap, ShieldCheck, Flame, X, Sparkles, Radio, ArrowUpRight, Heart } from 'lucide-react';

export const PeerPushBanner: React.FC = () => {
  const { activeNotification, dismissNotification, endorseEvent, agkMetrics, triggerCascade } = usePeerPush();
  const [endorsed, setEndorsed] = useState(false);

  if (!activeNotification) return null;

  const handleEndorse = () => {
    if (endorsed) return;
    setEndorsed(true);
    endorseEvent(activeNotification.id);
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'LIFT_CASCADE': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'ABILITY_UNLOCK': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'SIGIL_MINT': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'VIRAL_MILESTONE': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-3 relative overflow-hidden group">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header with Live Pulse */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-400 uppercase">
              PEERPUSH • LIVE SIGNAL
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${getBadgeColor(activeNotification.eventType)}`}>
              {activeNotification.eventType.replace('_', ' ')}
            </span>
            <button
              onClick={dismissNotification}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-1">
          <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
            <span>{activeNotification.headline}</span>
          </div>
          <div className="text-[11px] text-slate-400 leading-snug">
            {activeNotification.body}
          </div>
        </div>

        {/* Footer with Trust Score and Interactive Endorse */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2 text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{activeNotification.trustScore.toFixed(1)}% Trust</span>
            </span>
            <span>•</span>
            <span>{activeNotification.influenceCount} Influenced</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleEndorse}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                endorsed
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-400'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400 fill-current" />
              <span>{endorsed ? 'Boosted!' : 'Boost'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
