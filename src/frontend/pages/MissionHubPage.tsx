import React, { useEffect, useState } from 'react';
import { Compass, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Mission {
  id: string;
  slug: string;
  title: string;
  description: string;
  requirements: string;
  payout_type: string;
  payout_amount: string;
  tags: string[];
  category: string;
  reward_xp: number;
  disclosure: string;
}

export const MissionHubPage: React.FC = () => {
  const { token } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/missions', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) setMissions(payload.data);
      })
      .catch(() => setNotice('Mission catalog is temporarily unavailable.'))
      .finally(() => setLoading(false));
  }, [token]);

  const startMission = async (slug: string) => {
    if (!token) return;
    setStarting(slug);
    setNotice(null);
    try {
      const response = await fetch(`/api/missions/${slug}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to start mission');
      setNotice(`Mission started: ${payload.data.program}. Review the requirements before continuing.`);
      window.open(payload.data.tracking_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to start mission.');
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-emerald-950/50 p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3 text-cyan-300 text-xs font-mono font-bold uppercase tracking-wider">
          <Compass className="w-4 h-4" /> Mission Hub
        </div>
        <h1 className="mt-3 text-3xl sm:text-5xl font-black text-white">Earn progress by making informed moves.</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 leading-relaxed">
          Explore opportunities, understand the requirements, and continue only when an offer fits your goals. Clicks do not guarantee rewards or earnings.
        </p>
      </header>

      {notice && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{notice}</div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">Loading missions...</div>
      ) : missions.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">No active missions are available.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {missions.map((mission) => (
            <article key={mission.id} className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl hover:border-cyan-500/40 transition-colors">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300">{mission.category}</span>
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-300"><Sparkles className="w-3 h-3" /> +{mission.reward_xp} XP</span>
                </div>
                <h2 className="text-xl font-black text-white">{mission.title}</h2>
                <p className="text-sm text-slate-400">{mission.description}</p>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
                  <strong className="block text-slate-200 mb-1">Offer details</strong>
                  {mission.requirements}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mission.tags.map((tag) => <span key={tag} className="rounded-md bg-slate-900 px-2 py-1 text-[10px] text-slate-400 border border-slate-800">#{tag}</span>)}
                </div>
                <p className="text-[11px] text-slate-500">{mission.disclosure}</p>
              </div>
              <button onClick={() => startMission(mission.slug)} disabled={starting === mission.slug} className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-xs font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
                <ExternalLink className="w-4 h-4" /> {starting === mission.slug ? 'Starting...' : 'Review Mission'}
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Affiliate terms, eligibility, and verification rules always apply.</div>
    </div>
  );
};

export default MissionHubPage;
