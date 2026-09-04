import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Trophy, Flame, Award, Medal, Crown, Sparkles, Zap, Shield, Users,
  Search, Activity, ChevronRight, Info, X, Filter, CheckCircle, RefreshCw, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MilestoneBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Cosmic';
  color: string;
  glowColor: string;
  animation: 'pulse' | 'shimmer' | 'bounce' | 'spin' | 'float';
}

export interface CreatorEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_sigil?: string;
  xp: number;
  level: number;
  streak_days: number;
  referral_count: number;
  total_earnings_cents: number;
  earnings_tier: {
    tier: string;
    badge: string;
    color: string;
    minEarningsCents: number;
    nextTier: string | null;
    nextTierCents: number | null;
  };
  syndicate: {
    id: string;
    name: string;
    tag: string;
    emblem: string;
    role: string;
  } | null;
  milestone_badges: MilestoneBadge[];
  is_current_user?: boolean;
}

export interface SyndicateEntry {
  rank: number;
  id: string;
  name: string;
  tag: string;
  emblem_sigil: string;
  description: string;
  creator_name: string;
  member_count: number;
  weekly_score: number;
  total_net_worth_cents: number;
  total_referrals: number;
  streak_days: number;
}

export const LeaderboardPage: React.FC = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'creators' | 'syndicates' | 'badges'>('creators');
  const [entries, setEntries] = useState<CreatorEntry[]>([]);
  const [syndicates, setSyndicates] = useState<SyndicateEntry[]>([]);
  const [badgeRegistry, setBadgeRegistry] = useState<MilestoneBadge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedBadge, setSelectedBadge] = useState<MilestoneBadge | null>(null);

  // Real-Time WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const [liveViewers, setLiveViewers] = useState(1);
  const [recentLiveEvents, setRecentLiveEvents] = useState<Array<{ id: string; message: string; timestamp: string }>>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const formatUsd = (cents: number = 0) =>
    `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/leaderboard/top100', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setEntries(json.data.leaderboard || []);
        }
      }
    } catch (e) {
      console.error('Failed to load leaderboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSyndicates = async () => {
    try {
      const res = await fetch('/api/leaderboard/syndicates');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setSyndicates(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBadges = async () => {
    try {
      const res = await fetch('/api/leaderboard/badges');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setBadgeRegistry(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchSyndicates();
    fetchBadges();
  }, [token]);

  // Connect to Real-Time WebSocket Server
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/leaderboard`;

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const frame = JSON.parse(event.data);
            if (frame.type === 'leaderboard_init') {
              if (frame.data.liveViewerCount) setLiveViewers(frame.data.liveViewerCount);
            } else if (frame.type === 'viewer_count_update') {
              setLiveViewers(frame.liveViewerCount || 1);
            } else if (frame.type === 'leaderboard_live_event') {
              if (frame.event?.message) {
                const newEvt = {
                  id: `evt_${Date.now()}_${Math.random()}`,
                  message: frame.event.message,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                };
                setRecentLiveEvents((prev) => [newEvt, ...prev.slice(0, 4)]);
              }
              // Update leaderboard if provided
              if (frame.top100 && Array.isArray(frame.top100)) {
                // Merge real-time score updates cleanly
                setEntries((prevEntries) => {
                  if (prevEntries.length === 0) return prevEntries;
                  return prevEntries.map((e) => {
                    const match = frame.top100.find((u: any) => u.user_id === e.user_id);
                    if (match) {
                      return {
                        ...e,
                        rank: match.rank,
                        total_earnings_cents: match.total_earnings_cents,
                      };
                    }
                    return e;
                  });
                });
              }
            }
          } catch (err) {
            console.error('Error parsing leaderboard WS frame:', err);
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 5000);
        };

        socket.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, []);

  const topThree = entries.slice(0, 3);

  const filteredCreators = entries.filter((c) => {
    const matchesSearch =
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.syndicate && c.syndicate.tag.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedTier === 'all') return true;
    return c.earnings_tier.tier.toLowerCase().includes(selectedTier.toLowerCase());
  });

  const getRarityBadgeStyle = (rarity: string) => {
    switch (rarity) {
      case 'Cosmic':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/60 shadow-purple-500/30';
      case 'Legendary':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/60 shadow-amber-500/30';
      case 'Epic':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-500/60 shadow-indigo-500/20';
      case 'Rare':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 shadow-emerald-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-600/60';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Real-time Header & Telemetry Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-plug-accent/10 border border-plug-accent/30 text-plug-accent text-xs font-bold uppercase tracking-wider">
              <Trophy className="w-4 h-4" />
              Creator Leaderboard & Tiers
            </span>

            {/* Real-Time WebSocket Live Connection Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                wsConnected
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                  : 'bg-amber-950/80 text-amber-400 border-amber-500/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              {wsConnected ? 'Live Stream Active' : 'Connecting Stream...'}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-mono">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              {liveViewers} Viewers
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Top 100 Creators Arena
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Ranked by verified revenue, net worth discipline, syndicate score, and animated milestone badge achievements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchLeaderboard();
              fetchSyndicates();
            }}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
            title="Refresh Leaderboard"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Live Activity Ticker Stream */}
      {recentLiveEvents.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-mono">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
            <span className="text-emerald-400 font-bold uppercase shrink-0">Live Stream:</span>
            <div className="overflow-hidden whitespace-nowrap text-slate-300 font-semibold truncate">
              {recentLiveEvents[0].message}
              <span className="text-slate-500 ml-2 text-[10px]">({recentLiveEvents[0].timestamp})</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex items-center justify-center sm:justify-start gap-2 border-b border-slate-800 pb-4">
        <button
          onClick={() => setActiveTab('creators')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'creators'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Crown className="w-4 h-4" />
          Top 100 Creators
        </button>

        <button
          onClick={() => setActiveTab('syndicates')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'syndicates'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          Syndicate Rankings
        </button>

        <button
          onClick={() => setActiveTab('badges')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'badges'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          Milestone Badges ({badgeRegistry.length})
        </button>
      </div>

      {/* TAB 1: CREATORS LEADERBOARD */}
      {activeTab === 'creators' && (
        <div className="space-y-8">
          {/* Top 3 Podium Cards */}
          {topThree.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {/* Rank 2 (Silver) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 text-center space-y-4 relative overflow-hidden order-2 md:order-1 shadow-xl"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-950 mx-auto flex items-center justify-center font-black text-2xl shadow-lg">
                  🥈
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-bold font-mono uppercase">
                    #2 Runner Up
                  </span>
                  <h3 className="font-black text-white text-xl mt-1.5">{topThree[1].display_name}</h3>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Level {topThree[1].level} • {topThree[1].earnings_tier.tier}
                  </div>
                </div>

                {topThree[1].syndicate && (
                  <div className="inline-block px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-cyan-400 text-xs font-mono font-bold">
                    [{topThree[1].syndicate.tag}] {topThree[1].syndicate.name}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 font-mono text-sm">
                  <div className="text-plug-accent font-black text-xl">
                    {formatUsd(topThree[1].total_earnings_cents)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {topThree[1].referral_count} Referrals • {topThree[1].streak_days}d Streak
                  </div>
                </div>

                {/* Animated Milestone Badges Row */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  {topThree[1].milestone_badges.slice(0, 4).map((badge) => (
                    <button
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      className="p-1.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-slate-500 text-base transition-all transform hover:scale-110 cursor-pointer"
                      title={`${badge.name}: ${badge.description}`}
                    >
                      {badge.icon}
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Rank 1 (Grand Champion Gold) */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-2 border-amber-400/80 rounded-3xl p-8 text-center space-y-4 relative overflow-hidden order-1 md:order-2 -mt-4 shadow-2xl shadow-amber-500/20"
              >
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 text-slate-950 mx-auto flex items-center justify-center font-black text-4xl shadow-xl shadow-amber-400/30 animate-pulse">
                  👑
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-black font-mono uppercase tracking-wider">
                    #1 Grand Champion
                  </span>
                  <h2 className="font-black text-white text-2xl mt-2">{topThree[0].display_name}</h2>
                  <div className="text-xs text-amber-200/80 font-mono mt-1">
                    Level {topThree[0].level} • {topThree[0].earnings_tier.tier}
                  </div>
                </div>

                {topThree[0].syndicate && (
                  <div className="inline-block px-3.5 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold">
                    [{topThree[0].syndicate.tag}] {topThree[0].syndicate.name}
                  </div>
                )}

                <div className="pt-3 border-t border-amber-500/30 font-mono">
                  <div className="text-amber-300 font-black text-2xl">
                    {formatUsd(topThree[0].total_earnings_cents)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {topThree[0].referral_count} Referrals • {topThree[0].streak_days}d Streak
                  </div>
                </div>

                {/* Animated Milestone Badges Row */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {topThree[0].milestone_badges.map((badge) => (
                    <button
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      className="p-2 rounded-2xl bg-amber-950/60 border border-amber-500/40 hover:border-amber-300 text-xl transition-all transform hover:scale-125 cursor-pointer shadow-md"
                      title={`${badge.name}: ${badge.description}`}
                    >
                      {badge.icon}
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Rank 3 (Bronze) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 text-center space-y-4 relative overflow-hidden order-3 shadow-xl"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-800 to-amber-600 text-slate-950 mx-auto flex items-center justify-center font-black text-2xl shadow-lg">
                  🥉
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-amber-500 text-[10px] font-bold font-mono uppercase">
                    #3 Podium Finisher
                  </span>
                  <h3 className="font-black text-white text-xl mt-1.5">{topThree[2].display_name}</h3>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Level {topThree[2].level} • {topThree[2].earnings_tier.tier}
                  </div>
                </div>

                {topThree[2].syndicate && (
                  <div className="inline-block px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-cyan-400 text-xs font-mono font-bold">
                    [{topThree[2].syndicate.tag}] {topThree[2].syndicate.name}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 font-mono text-sm">
                  <div className="text-plug-accent font-black text-xl">
                    {formatUsd(topThree[2].total_earnings_cents)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {topThree[2].referral_count} Referrals • {topThree[2].streak_days}d Streak
                  </div>
                </div>

                {/* Animated Milestone Badges Row */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  {topThree[2].milestone_badges.slice(0, 4).map((badge) => (
                    <button
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      className="p-1.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-slate-500 text-base transition-all transform hover:scale-110 cursor-pointer"
                      title={`${badge.name}: ${badge.description}`}
                    >
                      {badge.icon}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {/* Interactive Filters & Search */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search creator or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Earnings Tier Selector Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
              {[
                { id: 'all', label: 'All Tiers' },
                { id: 'Apex Sovereign', label: '🏛️ Apex ($100k+)' },
                { id: 'Diamond Plug', label: '💎 Diamond ($50k+)' },
                { id: 'Platinum Stacker', label: '⚪ Platinum ($10k+)' },
                { id: 'Gold Architect', label: '🥇 Gold ($2.5k+)' },
                { id: 'Silver Builder', label: '🥈 Silver ($500+)' },
                { id: 'Bronze Apprentice', label: '🥉 Bronze' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTier(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono whitespace-nowrap transition-all cursor-pointer ${
                    selectedTier === t.id
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top 100 Creators Directory Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-emerald-400" />
                Global Ranks Directory ({filteredCreators.length} Creators)
              </h3>
              <span className="text-xs font-mono text-slate-500">Live Synchronized</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 w-16">Rank</th>
                    <th className="py-3.5 px-4">Creator</th>
                    <th className="py-3.5 px-4">Earnings Tier</th>
                    <th className="py-3.5 px-4">Total Revenue</th>
                    <th className="py-3.5 px-4">Syndicate Guild</th>
                    <th className="py-3.5 px-4">Streak & Refs</th>
                    <th className="py-3.5 px-4">Milestone Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredCreators.map((item) => (
                    <tr
                      key={item.user_id}
                      className={`transition-colors ${
                        item.is_current_user ? 'bg-emerald-500/10 font-semibold' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 font-mono font-black text-sm">
                        {item.rank === 1 ? (
                          '🥇'
                        ) : item.rank === 2 ? (
                          '🥈'
                        ) : item.rank === 3 ? (
                          '🥉'
                        ) : (
                          <span className={item.rank <= 10 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                            #{item.rank}
                          </span>
                        )}
                      </td>

                      {/* Creator */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-xs text-emerald-400">
                            {item.display_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {item.display_name}
                              {item.is_current_user && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-400 text-slate-950 font-black uppercase">
                                  YOU
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Level {item.level} ({item.xp} XP)
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Earnings Tier */}
                      <td className="py-3.5 px-4 font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase border ${item.earnings_tier.color}`}
                        >
                          {item.earnings_tier.badge}
                        </span>
                      </td>

                      {/* Total Revenue */}
                      <td className="py-3.5 px-4 font-mono font-black text-emerald-400 text-sm">
                        {formatUsd(item.total_earnings_cents)}
                      </td>

                      {/* Syndicate Guild */}
                      <td className="py-3.5 px-4 font-mono">
                        {item.syndicate ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400 text-[11px] font-bold">
                            [{item.syndicate.tag}] {item.syndicate.name}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">Unaffiliated</span>
                        )}
                      </td>

                      {/* Streak & Refs */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold flex items-center gap-0.5">
                            <Flame className="w-3.5 h-3.5 fill-amber-400" />
                            {item.streak_days}d
                          </span>
                          <span className="text-slate-400">• {item.referral_count} refs</span>
                        </div>
                      </td>

                      {/* Milestone Badges */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {item.milestone_badges.map((badge) => (
                            <button
                              key={badge.id}
                              onClick={() => setSelectedBadge(badge)}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm transition-all transform hover:scale-125 cursor-pointer"
                              title={`${badge.name}: ${badge.description}`}
                            >
                              {badge.icon}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SYNDICATE RANKINGS */}
      {activeTab === 'syndicates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {syndicates.map((syn) => (
              <div
                key={syn.id}
                className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-cyan-500/50 transition-all shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-cyan-500/20">
                      ⚡
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/40">
                        Rank #{syn.rank} Guild
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">[{syn.tag}] {syn.name}</h3>
                      <span className="text-xs text-slate-400 font-mono">Founder: {syn.creator_name}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xs text-slate-400">Weekly Score</span>
                    <div className="text-emerald-400 font-black text-lg">{syn.weekly_score.toLocaleString()} XP</div>
                  </div>
                </div>

                <p className="text-xs text-slate-300">{syn.description}</p>

                <div className="pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px]">Members</span>
                    <div className="font-bold text-white">{syn.member_count}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px]">Net Worth</span>
                    <div className="font-bold text-emerald-400">{formatUsd(syn.total_net_worth_cents)}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px]">Referrals</span>
                    <div className="font-bold text-amber-400">{syn.total_referrals}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MILESTONE BADGES REGISTRY */}
      {activeTab === 'badges' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {badgeRegistry.map((badge) => (
            <motion.div
              key={badge.id}
              whileHover={{ scale: 1.03 }}
              onClick={() => setSelectedBadge(badge)}
              className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 rounded-3xl p-6 text-center space-y-3 cursor-pointer transition-all shadow-xl"
            >
              <div className="text-4xl">{badge.icon}</div>
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRarityBadgeStyle(badge.rarity)}`}>
                  {badge.rarity}
                </span>
                <h3 className="font-bold text-white text-base mt-2">{badge.name}</h3>
              </div>
              <p className="text-xs text-slate-400">{badge.description}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Milestone Badge Details Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 relative shadow-2xl overflow-hidden"
            >
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-6xl pt-2">{selectedBadge.icon}</div>

              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border ${getRarityBadgeStyle(selectedBadge.rarity)}`}>
                  {selectedBadge.rarity} Badge
                </span>
                <h2 className="text-2xl font-black text-white mt-2">{selectedBadge.name}</h2>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
                {selectedBadge.description}
              </p>

              <button
                onClick={() => setSelectedBadge(null)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Close Badge Details
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
