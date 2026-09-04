import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LeaderboardEntry, MilestoneBadge, EarningsTierInfo, Syndicate } from '../../types';
import {
  Trophy, Flame, Award, Medal, Crown, Sparkles, Zap, Users, Search, Filter,
  TrendingUp, Shield, DollarSign, Activity, RefreshCw, Star, Info, ChevronRight, X
} from 'lucide-react';

export const EARNINGS_TIERS: EarningsTierInfo[] = [
  {
    tier_number: 6,
    name: 'Sovereign Diamond',
    title: 'Sovereign Diamond Creator',
    badge: '💎',
    color: '#38bdf8',
    min_earnings_cents: 10000000,
  },
  {
    tier_number: 5,
    name: 'Imperial Gold',
    title: 'Imperial Gold Creator',
    badge: '👑',
    color: '#fbbf24',
    min_earnings_cents: 2500000,
  },
  {
    tier_number: 4,
    name: 'Amethyst Vault',
    title: 'Amethyst Vault Stacker',
    badge: '🔮',
    color: '#c084fc',
    min_earnings_cents: 500000,
  },
  {
    tier_number: 3,
    name: 'Cyan River',
    title: 'Cyan River Builder',
    badge: '🌊',
    color: '#22d3ee',
    min_earnings_cents: 100000,
  },
  {
    tier_number: 2,
    name: 'Neo Seed',
    title: 'Neo Seed Plug',
    badge: '🌱',
    color: '#10b981',
    min_earnings_cents: 10000,
  },
  {
    tier_number: 1,
    name: 'Novice Creator',
    title: 'Novice Creator',
    badge: '⚡',
    color: '#94a3b8',
    min_earnings_cents: 0,
  },
];

export const MASTER_MILESTONE_BADGES: MilestoneBadge[] = [
  {
    id: 'badge_100k_club',
    title: '$100K Sovereign Earner',
    category: 'Earnings',
    icon: '💎',
    rarity: 'cosmic',
    description: 'Generated over $100,000 in verified creator commissions.',
    animated_effect: 'sparkle',
  },
  {
    id: 'badge_50k_earner',
    title: '$50K Diamond Stacker',
    category: 'Earnings',
    icon: '👑',
    rarity: 'legendary',
    description: 'Surpassed $50,000 in lifetime referral revenue.',
    animated_effect: 'glow',
  },
  {
    id: 'badge_10k_earner',
    title: '$10K Imperial Velocity',
    category: 'Earnings',
    icon: '🏆',
    rarity: 'epic',
    description: 'Broke the $10,000 threshold in digital earnings.',
    animated_effect: 'shimmer',
  },
  {
    id: 'badge_1k_referrals',
    title: '1,000 Network Invites',
    category: 'Referrals',
    icon: '⚡',
    rarity: 'cosmic',
    description: 'Built an active network of 1,000+ referred creators.',
    animated_effect: 'flame',
  },
  {
    id: 'badge_100_referrals',
    title: 'Viral Magnet',
    category: 'Referrals',
    icon: '🚀',
    rarity: 'legendary',
    description: 'Attracted over 100 creator sign-ups.',
    animated_effect: 'pulse',
  },
  {
    id: 'badge_syndicate_leader',
    title: 'Guild Sovereign',
    category: 'Syndicate',
    icon: '🏛️',
    rarity: 'cosmic',
    description: 'Founding leader of a top-ranked Creator Syndicate.',
    animated_effect: 'orbit',
  },
  {
    id: 'badge_30d_streak',
    title: '30-Day Unstoppable Streak',
    category: 'Streak',
    icon: '🔥',
    rarity: 'epic',
    description: 'Maintained a 30-day active daily execution streak.',
    animated_effect: 'flame',
  },
  {
    id: 'badge_level_10',
    title: 'Level 10 Cosmic Plug',
    category: 'XP',
    icon: '🌟',
    rarity: 'legendary',
    description: 'Achieved Level 10 Maximum XP Rank.',
    animated_effect: 'sparkle',
  },
];

interface LeaderboardPageProps {
  onNavigate?: (tab: string) => void;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigate }) => {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [syndicates, setSyndicates] = useState<Syndicate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'tiers' | 'syndicates' | 'badges'>('leaderboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<number | 'all'>('all');
  const [selectedBadgeModal, setSelectedBadgeModal] = useState<MilestoneBadge | null>(null);
  const [liveEvents, setLiveEvents] = useState<Array<{ id: string; text: string; time: string }>>([]);

  const socketRef = useRef<WebSocket | null>(null);

  // Fetch initial leaderboard data via REST API
  const fetchLeaderboard = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/gamification/leaderboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setEntries(data.data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch syndicates directory
  const fetchSyndicates = async () => {
    try {
      const res = await fetch('/api/syndicates', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setSyndicates(data.data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch syndicates:', e);
    }
  };

  // Connect WebSocket for real-time live updates
  useEffect(() => {
    fetchLeaderboard();
    fetchSyndicates();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/leaderboard`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === 'leaderboard_init' && frame.data?.leaderboard) {
            setEntries(frame.data.leaderboard);
          } else if (frame.type === 'creator_rank_shift' && frame.data) {
            const shift = frame.data;
            if (shift.leaderboard) {
              setEntries(shift.leaderboard);
            }
            // Add live feed toast event
            const newEvent = {
              id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              text: `⚡ ${shift.display_name} earned +$${(shift.commission_earned_cents / 100).toFixed(2)} commission & +${shift.xp_gained} XP!`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
            setLiveEvents(prev => [newEvent, ...prev.slice(0, 4)]);
          }
        } catch (e) {
          console.error('WS frame parse error:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    } catch (err) {
      console.warn('WebSocket connection failed, using HTTP polling fallback.', err);
    }

    // Polling fallback every 15s if WS is offline
    const interval = setInterval(() => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        fetchLeaderboard();
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [token]);

  const formatUsd = (cents: number = 0) =>
    `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const filteredEntries = entries.filter(e => {
    const matchesSearch = e.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.syndicate?.tag && e.syndicate.tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.tier_title && e.tier_title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTier = selectedTierFilter === 'all' || e.earnings_tier.tier_number === selectedTierFilter;
    return matchesSearch && matchesTier;
  });

  const topThree = entries.slice(0, 3);
  const userEntry = entries.find(e => e.is_current_user || e.user_id === user?.id);

  const getBadgeEffectClass = (effect: MilestoneBadge['animated_effect']) => {
    switch (effect) {
      case 'sparkle': return 'animate-pulse drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]';
      case 'flame': return 'animate-bounce drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]';
      case 'glow': return 'drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]';
      case 'pulse': return 'animate-pulse';
      case 'orbit': return 'animate-spin-slow';
      case 'shimmer': return 'brightness-125 saturate-150';
      default: return '';
    }
  };

  const getBadgeRarityBg = (rarity: MilestoneBadge['rarity']) => {
    switch (rarity) {
      case 'cosmic': return 'bg-gradient-to-r from-purple-600/30 via-pink-600/30 to-rose-600/30 border-pink-500/50 text-pink-300';
      case 'legendary': return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-400/50 text-amber-300';
      case 'epic': return 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-purple-400/50 text-purple-300';
      case 'rare': return 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400/50 text-cyan-300';
      default: return 'bg-slate-800/60 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Real-Time Status */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-plug-card/80 border border-plug-border/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-plug-accent/10 border border-plug-accent/30 text-plug-accent text-xs font-semibold uppercase tracking-wider">
            <Trophy className="w-4 h-4 text-plug-accent" />
            Top 100 Creator Leaderboard • Real-Time Arena
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Creator OS Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Live synchronized rankings powered by WebSocket telemetry. Verified by commission volume, earnings tier progression, syndicate score, and animated milestone badges.
          </p>
        </div>

        {/* Real-time WebSocket connection status badge */}
        <div className="flex flex-col items-end gap-2">
          <div className={`px-4 py-2 rounded-2xl border text-xs font-mono font-bold flex items-center gap-2.5 shadow-lg transition-all ${
            wsConnected
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-emerald-500/10'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-400 shadow-amber-500/10'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            {wsConnected ? 'LIVE WEBSOCKET STREAMING' : 'HTTP POLLING ACTIVE'}
          </div>

          {userEntry && (
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl px-3.5 py-1.5 text-xs font-mono text-slate-300 flex items-center gap-2">
              <span className="text-slate-400">Your Rank:</span>
              <span className="font-bold text-plug-accent text-sm">#{userEntry.rank}</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400 font-bold">{formatUsd(userEntry.total_earnings_cents)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Rank Shift Telemetry Ticker Feed */}
      {liveEvents.length > 0 && (
        <div className="bg-slate-950/80 border border-plug-accent/30 rounded-2xl p-3.5 flex items-center gap-3 overflow-hidden shadow-lg animate-fade-in">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-plug-accent shrink-0 uppercase tracking-wider">
            <Activity className="w-4 h-4 text-plug-accent animate-spin-slow" />
            Live Event Feed:
          </div>
          <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-none text-xs font-mono text-slate-300 flex items-center gap-6">
            {liveEvents.map((evt) => (
              <span key={evt.id} className="inline-flex items-center gap-2 bg-slate-900/90 px-3 py-1 rounded-xl border border-slate-800 text-emerald-300">
                <span>{evt.text}</span>
                <span className="text-[10px] text-slate-500">{evt.time}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top 3 Champion Podium Cards */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Rank 2 (Silver) */}
          {topThree[1] && (
            <div className="bg-gradient-to-b from-slate-800/80 via-plug-card to-slate-900 border border-slate-500/40 rounded-3xl p-6 text-center space-y-4 relative overflow-hidden order-2 md:order-1 shadow-xl hover:border-slate-400 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-slate-300 text-slate-200 mx-auto flex items-center justify-center font-black text-2xl shadow-lg shadow-slate-300/10 group-hover:scale-105 transition-transform">
                🥈
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-slate-700/50 text-slate-300 border border-slate-600/50 mb-1">
                  Rank #2 Silver
                </div>
                <h3 className="font-bold text-white text-xl flex items-center justify-center gap-1.5">
                  {topThree[1].display_name}
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Level {topThree[1].level} • {topThree[1].tier_title}
                </div>
              </div>

              {/* Earnings Tier & Syndicate Badge */}
              <div className="flex items-center justify-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-bold flex items-center gap-1">
                  <span>{topThree[1].earnings_tier.badge}</span>
                  <span>{topThree[1].earnings_tier.name}</span>
                </span>
                {topThree[1].syndicate && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-indigo-500/40 text-indigo-300 font-bold">
                    [{topThree[1].syndicate.tag}]
                  </span>
                )}
              </div>

              {/* Milestone Badges Preview */}
              {topThree[1].milestone_badges.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  {topThree[1].milestone_badges.slice(0, 4).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBadgeModal(b)}
                      title={`${b.title}: ${b.description}`}
                      className={`text-base p-1.5 rounded-xl border transition-transform hover:scale-125 cursor-pointer ${getBadgeRarityBg(b.rarity)}`}
                    >
                      <span className={getBadgeEffectClass(b.animated_effect)}>{b.icon}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                <div className="text-slate-400">Total Earnings: <span className="text-emerald-400 font-bold text-base">{formatUsd(topThree[1].total_earnings_cents)}</span></div>
                <div className="text-[11px] text-slate-500">{topThree[1].xp} XP • {topThree[1].referral_count} Referrals</div>
              </div>
            </div>
          )}

          {/* Rank 1 (Grand Champion Gold) */}
          {topThree[0] && (
            <div className="bg-gradient-to-b from-amber-950/60 via-plug-card to-slate-900 border-2 border-amber-400/80 rounded-3xl p-7 text-center space-y-4 relative overflow-hidden order-1 md:order-2 shadow-2xl shadow-amber-500/20 -mt-2 group hover:border-amber-300 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 animate-pulse" />
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-200 text-plug-dark mx-auto flex items-center justify-center font-black text-4xl shadow-2xl shadow-amber-400/40 group-hover:scale-110 transition-transform">
                👑
              </div>
              <div>
                <span className="px-3.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/50 text-xs font-bold font-mono uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  #1 Grand Champion
                </span>
                <h2 className="font-black text-white text-2xl mt-2 flex items-center justify-center gap-2">
                  {topThree[0].display_name}
                </h2>
                <div className="text-xs text-amber-200/80 font-mono mt-0.5">
                  Level {topThree[0].level} • {topThree[0].tier_title}
                </div>
              </div>

              {/* Earnings Tier & Syndicate Badge */}
              <div className="flex items-center justify-center gap-2 text-xs font-mono">
                <span className="px-3 py-1 rounded-xl bg-slate-900 border border-amber-400/60 text-amber-300 font-bold flex items-center gap-1.5 shadow-md">
                  <span>{topThree[0].earnings_tier.badge}</span>
                  <span>{topThree[0].earnings_tier.name}</span>
                </span>
                {topThree[0].syndicate && (
                  <span className="px-3 py-1 rounded-xl bg-slate-900 border border-indigo-400/60 text-indigo-300 font-bold shadow-md">
                    [{topThree[0].syndicate.tag}] {topThree[0].syndicate.name}
                  </span>
                )}
              </div>

              {/* Milestone Badges Preview */}
              {topThree[0].milestone_badges.length > 0 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  {topThree[0].milestone_badges.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBadgeModal(b)}
                      title={`${b.title}: ${b.description}`}
                      className={`text-lg p-2 rounded-2xl border transition-all hover:scale-125 cursor-pointer shadow-lg ${getBadgeRarityBg(b.rarity)}`}
                    >
                      <span className={getBadgeEffectClass(b.animated_effect)}>{b.icon}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-amber-500/30 text-xs font-mono text-white space-y-1">
                <div className="text-slate-300">Total Lifetime Revenue:</div>
                <div className="text-2xl font-black text-amber-300 tracking-tight">{formatUsd(topThree[0].total_earnings_cents)}</div>
                <div className="text-xs text-amber-400/90 font-bold mt-1">
                  {topThree[0].xp} Total XP • {topThree[0].referral_count} Invites • {topThree[0].streak_days}d Streak
                </div>
              </div>
            </div>
          )}

          {/* Rank 3 (Bronze) */}
          {topThree[2] && (
            <div className="bg-gradient-to-b from-amber-950/30 via-plug-card to-slate-900 border border-amber-700/40 rounded-3xl p-6 text-center space-y-4 relative overflow-hidden order-3 shadow-xl hover:border-amber-600 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-amber-900/40 border-2 border-amber-600 text-amber-400 mx-auto flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-600/20 group-hover:scale-105 transition-transform">
                🥉
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-900/30 text-amber-400 border border-amber-700/40 mb-1">
                  Rank #3 Bronze
                </div>
                <h3 className="font-bold text-white text-xl flex items-center justify-center gap-1.5">
                  {topThree[2].display_name}
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Level {topThree[2].level} • {topThree[2].tier_title}
                </div>
              </div>

              {/* Earnings Tier & Syndicate Badge */}
              <div className="flex items-center justify-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-bold flex items-center gap-1">
                  <span>{topThree[2].earnings_tier.badge}</span>
                  <span>{topThree[2].earnings_tier.name}</span>
                </span>
                {topThree[2].syndicate && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-indigo-500/40 text-indigo-300 font-bold">
                    [{topThree[2].syndicate.tag}]
                  </span>
                )}
              </div>

              {/* Milestone Badges Preview */}
              {topThree[2].milestone_badges.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  {topThree[2].milestone_badges.slice(0, 4).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBadgeModal(b)}
                      title={`${b.title}: ${b.description}`}
                      className={`text-base p-1.5 rounded-xl border transition-transform hover:scale-125 cursor-pointer ${getBadgeRarityBg(b.rarity)}`}
                    >
                      <span className={getBadgeEffectClass(b.animated_effect)}>{b.icon}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                <div className="text-slate-400">Total Earnings: <span className="text-emerald-400 font-bold text-base">{formatUsd(topThree[2].total_earnings_cents)}</span></div>
                <div className="text-[11px] text-slate-500">{topThree[2].xp} XP • {topThree[2].referral_count} Referrals</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-plug-border/80 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'leaderboard'
                ? 'bg-plug-accent text-plug-dark shadow-lg shadow-plug-accent/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Top 100 Leaderboard ({filteredEntries.length})
          </button>

          <button
            onClick={() => setActiveTab('tiers')}
            className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'tiers'
                ? 'bg-plug-accent text-plug-dark shadow-lg shadow-plug-accent/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            Earnings Tiers Matrix
          </button>

          <button
            onClick={() => setActiveTab('syndicates')}
            className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'syndicates'
                ? 'bg-plug-accent text-plug-dark shadow-lg shadow-plug-accent/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            Syndicate Rankings ({syndicates.length})
          </button>

          <button
            onClick={() => setActiveTab('badges')}
            className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'badges'
                ? 'bg-plug-accent text-plug-dark shadow-lg shadow-plug-accent/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Milestone Badges ({MASTER_MILESTONE_BADGES.length})
          </button>
        </div>

        {/* Search & Filters */}
        {activeTab === 'leaderboard' && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search creator, tag, or tier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-plug-accent transition-colors"
              />
            </div>

            <select
              value={selectedTierFilter}
              onChange={(e) => setSelectedTierFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-900/90 border border-slate-700 rounded-2xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-plug-accent"
            >
              <option value="all">All Earnings Tiers</option>
              {EARNINGS_TIERS.map(t => (
                <option key={t.tier_number} value={t.tier_number}>
                  {t.badge} {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: TOP 100 LEADERBOARD TABLE */}
      {activeTab === 'leaderboard' && (
        <div className="bg-plug-card border border-plug-border rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-plug-border/80 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-plug-accent" />
              Top 100 Global Creators Roster
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Showing {filteredEntries.length} creators
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 font-mono space-y-3">
              <RefreshCw className="w-8 h-8 text-plug-accent animate-spin mx-auto" />
              <div>Loading real-time creator rankings...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-plug-border/50">
                  <tr>
                    <th className="py-4 px-4 w-16">Rank</th>
                    <th className="py-4 px-4">Creator</th>
                    <th className="py-4 px-4">Earnings Tier</th>
                    <th className="py-4 px-4">Syndicate</th>
                    <th className="py-4 px-4">Milestone Badges</th>
                    <th className="py-4 px-4">30d Revenue</th>
                    <th className="py-4 px-4">Total Revenue</th>
                    <th className="py-4 px-4">Total XP</th>
                    <th className="py-4 px-4">Network Invites</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-plug-border/40 text-slate-300 font-mono">
                  {filteredEntries.map((item) => (
                    <tr
                      key={item.user_id}
                      className={`transition-colors ${
                        item.is_current_user
                          ? 'bg-plug-accent/15 border-l-4 border-l-plug-accent font-bold'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-black text-sm">
                        {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                      </td>

                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-white flex items-center gap-2 text-sm">
                          <span>{item.display_name}</span>
                          {item.is_current_user && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] bg-plug-accent text-plug-dark font-black uppercase">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Lvl {item.level} • {item.tier_title}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className="px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 border"
                          style={{
                            borderColor: `${item.earnings_tier.color}40`,
                            backgroundColor: `${item.earnings_tier.color}15`,
                            color: item.earnings_tier.color,
                          }}
                        >
                          <span>{item.earnings_tier.badge}</span>
                          <span>{item.earnings_tier.name}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {item.syndicate ? (
                          <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-indigo-500/40 text-indigo-300 font-bold text-[11px] inline-flex items-center gap-1">
                            <span>[{item.syndicate.tag}]</span>
                            <span className="text-slate-400 truncate max-w-[120px]">{item.syndicate.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">Independent</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          {item.milestone_badges.slice(0, 5).map((b) => (
                            <button
                              key={b.id}
                              onClick={() => setSelectedBadgeModal(b)}
                              title={`${b.title}: ${b.description}`}
                              className={`p-1 rounded-lg border transition-transform hover:scale-125 cursor-pointer text-xs ${getBadgeRarityBg(b.rarity)}`}
                            >
                              <span className={getBadgeEffectClass(b.animated_effect)}>{b.icon}</span>
                            </button>
                          ))}
                          {item.milestone_badges.length > 5 && (
                            <span className="text-[10px] text-slate-500 font-bold ml-1">
                              +{item.milestone_badges.length - 5}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-emerald-400 text-xs">
                        {formatUsd(item.monthly_earnings_cents)}
                      </td>

                      <td className="py-3.5 px-4 font-black text-amber-300 text-sm">
                        {formatUsd(item.total_earnings_cents)}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-plug-accent text-xs">
                        {item.xp.toLocaleString()} XP
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 text-xs">
                        {item.referral_count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EARNINGS TIERS MATRIX */}
      {activeTab === 'tiers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EARNINGS_TIERS.map((tier) => {
              const creatorsInTier = entries.filter(e => e.earnings_tier.tier_number === tier.tier_number);
              return (
                <div
                  key={tier.tier_number}
                  className="bg-plug-card border rounded-3xl p-6 space-y-4 relative overflow-hidden shadow-xl transition-all hover:border-opacity-100"
                  style={{ borderColor: `${tier.color}60` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg" style={{ backgroundColor: `${tier.color}20`, border: `1px solid ${tier.color}` }}>
                      {tier.badge}
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase" style={{ backgroundColor: `${tier.color}20`, color: tier.color }}>
                      Tier {tier.tier_number}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                    <div className="text-xs font-mono text-slate-400 mt-0.5">
                      Threshold: <span className="font-bold text-white">{formatUsd(tier.min_earnings_cents)}+</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Creators in Tier:</span>
                    <span className="font-bold text-plug-accent text-sm">{creatorsInTier.length} Creators</span>
                  </div>

                  {creatorsInTier.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Top Creators:</div>
                      <div className="space-y-1.5">
                        {creatorsInTier.slice(0, 3).map(c => (
                          <div key={c.user_id} className="bg-slate-900/80 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-300 font-bold">#{c.rank} {c.display_name}</span>
                            <span className="text-emerald-400">{formatUsd(c.total_earnings_cents)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SYNDICATE RANKINGS */}
      {activeTab === 'syndicates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {syndicates.map((syn, index) => (
              <div key={syn.id} className="bg-plug-card border border-indigo-500/30 rounded-3xl p-6 space-y-4 relative overflow-hidden shadow-2xl hover:border-indigo-400 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 flex items-center justify-center font-black text-xl shadow-lg">
                      {index === 0 ? '👑' : index === 1 ? '⚔️' : index === 2 ? '🛡️' : '⚡'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs">
                          [{syn.tag}]
                        </span>
                        <h3 className="font-bold text-white text-lg">{syn.name}</h3>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">Rank #{index + 1} Guild</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate?.('syndicates')}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-mono font-bold transition-all cursor-pointer"
                  >
                    View Guild War
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {syn.description}
                </p>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-center font-mono">
                  <div className="bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">Weekly Score</div>
                    <div className="text-sm font-bold text-indigo-400">{syn.weekly_score.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">Net Worth</div>
                    <div className="text-sm font-bold text-emerald-400">{formatUsd(syn.total_net_worth_cents)}</div>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">Members</div>
                    <div className="text-sm font-bold text-amber-300">{syn.member_count} Members</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ANIMATED MILESTONE BADGES GALLERY */}
      {activeTab === 'badges' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {MASTER_MILESTONE_BADGES.map((badge) => (
              <div
                key={badge.id}
                onClick={() => setSelectedBadgeModal(badge)}
                className={`border rounded-3xl p-6 space-y-3 cursor-pointer transition-all hover:scale-105 shadow-xl ${getBadgeRarityBg(badge.rarity)}`}
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-center text-3xl mx-auto shadow-2xl">
                  <span className={getBadgeEffectClass(badge.animated_effect)}>{badge.icon}</span>
                </div>

                <div className="text-center space-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/60 border border-slate-700">
                    {badge.rarity} • {badge.category}
                  </span>
                  <h3 className="font-bold text-white text-base pt-1">{badge.title}</h3>
                  <p className="text-xs text-slate-300 leading-normal line-clamp-2">
                    {badge.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MILESTONE BADGE DETAIL MODAL */}
      {selectedBadgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className={`max-w-md w-full border rounded-3xl p-6 space-y-5 relative shadow-2xl ${getBadgeRarityBg(selectedBadgeModal.rarity)} bg-slate-900`}>
            <button
              onClick={() => setSelectedBadgeModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-3xl bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-4xl mx-auto shadow-2xl">
                <span className={getBadgeEffectClass(selectedBadgeModal.animated_effect)}>{selectedBadgeModal.icon}</span>
              </div>

              <div>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-slate-900/80 border border-slate-700">
                  {selectedBadgeModal.rarity} Rarity Badge
                </span>
                <h3 className="text-2xl font-black text-white mt-2">{selectedBadgeModal.title}</h3>
                <span className="text-xs text-plug-accent font-mono">Category: {selectedBadgeModal.category}</span>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
              <div className="text-slate-400 font-bold uppercase">Badge Description:</div>
              <p className="text-slate-200 font-sans leading-relaxed">{selectedBadgeModal.description}</p>
              <div className="pt-2 text-[11px] text-slate-500">
                Effect Mode: <span className="text-amber-300 capitalize">{selectedBadgeModal.animated_effect}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedBadgeModal(null)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-plug-accent to-emerald-400 text-plug-dark font-black text-xs uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-plug-accent/20"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
