import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  LeaderboardEntry,
  SyndicateLeaderboardEntry,
  MilestoneBadge,
  LeaderboardWsServerFrame,
} from '../../types';
import {
  Trophy,
  Flame,
  Award,
  Crown,
  Sparkles,
  Shield,
  TrendingUp,
  Radio,
  Zap,
  Users,
  DollarSign,
  ChevronUp,
  ChevronDown,
  Minus,
  Star,
  Search,
  Filter,
  Info,
} from 'lucide-react';

export const LeaderboardPage: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'creators' | 'syndicates' | 'tiers'>('creators');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [syndicates, setSyndicates] = useState<SyndicateLeaderboardEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial data via HTTP fallback
  const fetchLeaderboardHttp = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/gamification/leaderboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setEntries(json.data);
          if (json.syndicates) setSyndicates(json.syndicates);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      }
    } catch (e) {
      console.error('HTTP leaderboard fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup WebSocket connection
  useEffect(() => {
    fetchLeaderboardHttp();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/leaderboard`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'all' }));
      };

      ws.onmessage = (event) => {
        try {
          const frame: LeaderboardWsServerFrame = JSON.parse(event.data);
          if (frame.type === 'snapshot') {
            setEntries(frame.creators);
            setSyndicates(frame.syndicates);
            setLastUpdated(new Date(frame.timestamp).toLocaleTimeString());
          } else if (frame.type === 'leaderboard_update') {
            setEntries(frame.updatedCreators);
            setLastUpdated(new Date(frame.timestamp).toLocaleTimeString());
          } else if (frame.type === 'syndicate_update') {
            setSyndicates(frame.updatedSyndicates);
          }
        } catch (e) {
          console.error('Leaderboard WS parse error:', e);
        }
      };

      ws.onerror = () => {
        setIsWsConnected(false);
      };

      ws.onclose = () => {
        setIsWsConnected(false);
      };
    } catch (err) {
      setIsWsConnected(false);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token]);

  const formatUsd = (cents: number = 0) =>
    `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      e.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.syndicate_tag && e.syndicate_tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.syndicate_name && e.syndicate_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTier = tierFilter === 'all' || e.earnings_tier.id === tierFilter;
    return matchesSearch && matchesTier;
  });

  const topThree = filteredEntries.slice(0, 3);

  const getBadgeAnimation = (effect: string) => {
    switch (effect) {
      case 'sparkle':
        return 'animate-pulse scale-105 transition-transform duration-300';
      case 'glow':
        return 'shadow-[0_0_12px_rgba(56,189,248,0.8)] border-sky-400';
      case 'bounce':
        return 'animate-bounce';
      case 'pulse':
        return 'animate-pulse';
      default:
        return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 min-h-screen">
      {/* Header & Live WebSocket Status */}
      <div className="relative text-center max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-lg backdrop-blur-md">
          <div className={`w-2.5 h-2.5 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            {isWsConnected ? 'WebSocket Live Feed' : 'HTTP Auto-Sync'}
          </span>
          {lastUpdated && <span className="text-[10px] font-mono text-slate-500">| {lastUpdated}</span>}
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight">
          Real-Time Creator Leaderboard
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
          Top 100 Creators, Earnings Tiers, Syndicate Guild Wars, and Live Animated Milestone Badges.
        </p>

        {/* View Switcher Tabs */}
        <div className="flex justify-center pt-2">
          <div className="inline-flex p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <button
              onClick={() => setActiveTab('creators')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'creators'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Top 100 Creators
            </button>
            <button
              onClick={() => setActiveTab('syndicates')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'syndicates'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Syndicate Rankings
            </button>
            <button
              onClick={() => setActiveTab('tiers')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'tiers'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-4 h-4" />
              Earnings Tiers & Badges
            </button>
          </div>
        </div>
      </div>

      {/* CREATORS TAB */}
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
                className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 text-center space-y-4 relative overflow-hidden order-2 md:order-1 hover:border-slate-500 transition-all shadow-xl"
              >
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-600 text-slate-300 font-mono text-[10px] font-bold">
                  #2 Silver Crown
                </div>
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-500 text-slate-200 mx-auto flex items-center justify-center font-black text-2xl shadow-lg">
                  🥈
                </div>
                <div>
                  <h3 className="font-bold text-white text-xl flex items-center justify-center gap-2">
                    {topThree[1].display_name}
                    {topThree[1].syndicate_tag && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-mono">
                        [{topThree[1].syndicate_tag}]
                      </span>
                    )}
                  </h3>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    Level {topThree[1].level} • {topThree[1].tier_title}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-800/50 p-2 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">MRR Velocity</span>
                    <span className="text-emerald-400 font-bold">{formatUsd(topThree[1].monthly_mrr_cents)}</span>
                  </div>
                  <div className="bg-slate-800/50 p-2 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">Total XP</span>
                    <span className="text-cyan-400 font-bold">{topThree[1].xp} XP</span>
                  </div>
                </div>

                {/* Animated Badges */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {topThree[1].badges.slice(0, 3).map((badge) => (
                    <span
                      key={badge.key}
                      title={badge.description}
                      className={`px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono flex items-center gap-1 ${getBadgeAnimation(
                        badge.animation_effect
                      )}`}
                    >
                      <span>{badge.icon}</span>
                      <span className="text-slate-300 font-bold">{badge.label}</span>
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Rank 1 (Gold Champion) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-2 border-amber-500/80 rounded-3xl p-8 text-center space-y-5 relative overflow-hidden order-1 md:order-2 -mt-4 shadow-2xl shadow-amber-500/10"
              >
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono text-xs font-black uppercase tracking-wider flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Grand Champion
                </div>

                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-100 text-slate-950 mx-auto flex items-center justify-center font-black text-4xl shadow-xl shadow-amber-500/30">
                  👑
                </div>

                <div>
                  <h2 className="font-black text-white text-2xl flex items-center justify-center gap-2">
                    {topThree[0].display_name}
                    {topThree[0].syndicate_tag && (
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold">
                        [{topThree[0].syndicate_tag}]
                      </span>
                    )}
                  </h2>
                  <div className="text-xs font-mono text-amber-300/80 mt-1">
                    Level {topThree[0].level} • {topThree[0].earnings_tier.name}
                  </div>
                </div>

                <div className="pt-3 border-t border-amber-500/20 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-amber-950/40 border border-amber-500/20 p-2.5 rounded-xl">
                    <span className="text-amber-300/60 text-[10px] block">Total Earnings</span>
                    <span className="text-emerald-400 font-black text-sm">{formatUsd(topThree[0].total_earnings_cents)}</span>
                  </div>
                  <div className="bg-amber-950/40 border border-amber-500/20 p-2.5 rounded-xl">
                    <span className="text-amber-300/60 text-[10px] block">Monthly MRR</span>
                    <span className="text-cyan-400 font-black text-sm">{formatUsd(topThree[0].monthly_mrr_cents)}</span>
                  </div>
                </div>

                {/* Animated Badges */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {topThree[0].badges.map((badge) => (
                    <span
                      key={badge.key}
                      title={badge.description}
                      className={`px-2.5 py-1 rounded-lg bg-amber-900/40 border border-amber-500/40 text-xs font-mono flex items-center gap-1 text-amber-200 ${getBadgeAnimation(
                        badge.animation_effect
                      )}`}
                    >
                      <span>{badge.icon}</span>
                      <span className="font-bold">{badge.label}</span>
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Rank 3 (Bronze) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 text-center space-y-4 relative overflow-hidden order-3 hover:border-slate-500 transition-all shadow-xl"
              >
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-600 text-amber-500 font-mono text-[10px] font-bold">
                  #3 Bronze Crown
                </div>
                <div className="w-16 h-16 rounded-2xl bg-amber-950/30 border-2 border-amber-800/60 text-amber-500 mx-auto flex items-center justify-center font-black text-2xl shadow-lg">
                  🥉
                </div>
                <div>
                  <h3 className="font-bold text-white text-xl flex items-center justify-center gap-2">
                    {topThree[2].display_name}
                    {topThree[2].syndicate_tag && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-mono">
                        [{topThree[2].syndicate_tag}]
                      </span>
                    )}
                  </h3>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    Level {topThree[2].level} • {topThree[2].tier_title}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-800/50 p-2 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">MRR Velocity</span>
                    <span className="text-emerald-400 font-bold">{formatUsd(topThree[2].monthly_mrr_cents)}</span>
                  </div>
                  <div className="bg-slate-800/50 p-2 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">Total XP</span>
                    <span className="text-cyan-400 font-bold">{topThree[2].xp} XP</span>
                  </div>
                </div>

                {/* Animated Badges */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {topThree[2].badges.slice(0, 3).map((badge) => (
                    <span
                      key={badge.key}
                      title={badge.description}
                      className={`px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono flex items-center gap-1 ${getBadgeAnimation(
                        badge.animation_effect
                      )}`}
                    >
                      <span>{badge.icon}</span>
                      <span className="text-slate-300 font-bold">{badge.label}</span>
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {/* Controls: Search & Tier Filters */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search creator name or syndicate tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" /> Tier:
              </span>
              {['all', 'cosmic', 'diamond', 'platinum', 'gold', 'silver', 'bronze'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold capitalize transition-all ${
                    tierFilter === tier
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Full Top 100 Leaderboard Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-emerald-400" />
                Top 100 Creators Ranks Directory
              </h3>
              <span className="text-xs font-mono text-slate-400">
                Showing {filteredEntries.length} of {entries.length} Creators
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 w-16">Rank</th>
                    <th className="py-3.5 px-4">Creator</th>
                    <th className="py-3.5 px-4">Earnings Tier</th>
                    <th className="py-3.5 px-4">Total Earnings</th>
                    <th className="py-3.5 px-4">Monthly MRR</th>
                    <th className="py-3.5 px-4">Streak & XP</th>
                    <th className="py-3.5 px-4">Milestone Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredEntries.map((item) => (
                    <tr
                      key={item.user_id}
                      className={`transition-colors hover:bg-slate-800/30 ${
                        item.is_current_user ? 'bg-emerald-950/30 border-l-4 border-emerald-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-sm">
                        {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.avatar_url}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full border border-slate-700 bg-slate-950"
                          />
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              {item.display_name}
                              {item.syndicate_tag && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-mono text-[10px]">
                                  [{item.syndicate_tag}]
                                </span>
                              )}
                              {item.is_current_user && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[9px] uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Level {item.level} • {item.referral_count} referrals
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span
                          className="px-2.5 py-1 rounded-full border text-[10px] font-bold inline-flex items-center gap-1"
                          style={{
                            borderColor: item.earnings_tier.color,
                            color: item.earnings_tier.color,
                            backgroundColor: `${item.earnings_tier.color}15`,
                          }}
                        >
                          <span>{item.earnings_tier.badge_icon}</span>
                          <span>{item.earnings_tier.name}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                        {formatUsd(item.total_earnings_cents)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                        {formatUsd(item.monthly_mrr_cents)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                            <Flame className="w-3.5 h-3.5 fill-amber-400" />
                            {item.streak_days}d
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-300">{item.xp} XP</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {item.badges.map((badge) => (
                            <span
                              key={badge.key}
                              title={badge.description}
                              className={`px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono flex items-center gap-1 ${getBadgeAnimation(
                                badge.animation_effect
                              )}`}
                            >
                              <span>{badge.icon}</span>
                              <span className="text-slate-300 font-medium">{badge.label}</span>
                            </span>
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

      {/* SYNDICATES TAB */}
      {activeTab === 'syndicates' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  Creator Syndicate Guild Wars Directory
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Ranked by weekly score, communal net worth, and referral velocity.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold">
                Season 4 Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {syndicates.map((syn) => (
                <div
                  key={syn.id}
                  className={`bg-slate-950/80 border p-5 rounded-2xl space-y-3 transition-all ${
                    syn.is_user_syndicate
                      ? 'border-cyan-500 shadow-lg shadow-cyan-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🛡️</span>
                      <div>
                        <h4 className="font-bold text-white text-base">{syn.name}</h4>
                        <span className="text-xs font-mono text-cyan-400">[{syn.tag}]</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-300">
                      Rank #{syn.rank}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/60 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Weekly Score</span>
                      <span className="text-amber-400 font-bold">{syn.weekly_score.toLocaleString()} PTS</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Guild Net Worth</span>
                      <span className="text-emerald-400 font-bold">{formatUsd(syn.total_net_worth_cents)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Members</span>
                      <span className="text-slate-300 font-bold">{syn.member_count} Operatives</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Overseer</span>
                      <span className="text-slate-300 font-bold">{syn.top_creator_name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EARNINGS TIERS TAB */}
      {activeTab === 'tiers' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl font-black text-white">Creator Earnings Tier System</h2>
              <p className="text-xs text-slate-400">
                Unlock higher MRR dividend bonuses and exclusive animated milestone badges as you scale your earnings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  name: 'Cosmic Apex Plug',
                  min: '$100,000+',
                  bonus: '+50% MRR Bonus',
                  color: '#A855F7',
                  icon: '🌌',
                  desc: 'Sovereign high-roller commanding cross-network referral matrix.',
                },
                {
                  name: 'Diamond Stacker',
                  min: '$25,000+',
                  bonus: '+35% MRR Bonus',
                  color: '#38BDF8',
                  icon: '💎',
                  desc: 'Top-tier creator generating passive multi-channel affiliate dividends.',
                },
                {
                  name: 'Platinum Sovereign',
                  min: '$10,000+',
                  bonus: '+25% MRR Bonus',
                  color: '#E2E8F0',
                  icon: '🛡️',
                  desc: 'Established guild operator with recurring viral distribution loops.',
                },
                {
                  name: 'Gold Syndicate',
                  min: '$2,500+',
                  bonus: '+15% MRR Bonus',
                  color: '#F59E0B',
                  icon: '👑',
                  desc: 'High-growth creator accelerating referral volume and yield.',
                },
                {
                  name: 'Silver Velocity',
                  min: '$500+',
                  bonus: '+10% MRR Bonus',
                  color: '#94A3B8',
                  icon: '⚡',
                  desc: 'Active affiliate stacker scaling initial commission streams.',
                },
                {
                  name: 'Bronze Apprentice',
                  min: '$0+',
                  bonus: '+5% MRR Bonus',
                  color: '#CD7F32',
                  icon: '🌱',
                  desc: 'Onboarding plug building foundation for wealth ascension.',
                },
              ].map((tier) => (
                <div
                  key={tier.name}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{tier.icon}</span>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-mono font-bold"
                      style={{ color: tier.color, backgroundColor: `${tier.color}20` }}
                    >
                      {tier.bonus}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">{tier.name}</h4>
                    <span className="text-xs font-mono text-slate-400">Earnings Gate: {tier.min}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{tier.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
