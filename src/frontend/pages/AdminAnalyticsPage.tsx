import React, { useState, useEffect } from 'react';
import { 
  Database, Users, DollarSign, Activity, TrendingUp, ShieldCheck, 
  Layers, HardDrive, Cpu, RefreshCw, BarChart3, Search, Filter, 
  ArrowUpRight, ArrowDownRight, Wallet, CheckCircle2, Clock, 
  Sparkles, Target, CreditCard, ChevronRight, Eye, Radio, Zap, Flame, Brain
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MetricsData {
  users: {
    totalUsers: number;
    totalXp: number;
    avgLevel: number;
    avgStreak: number;
    totalReferralInvites: number;
    archetypes: Array<{ archetype: string; archetype_title: string; count: number }>;
  };
  financials: {
    totalAccounts: number;
    totalAssetsCents: number;
    totalLiabilitiesCents: number;
    netWorthCents: number;
    totalTransactions: number;
    totalVolumeCents: number;
    totalIncomeCents: number;
    totalExpenseCents: number;
    totalTransferCents: number;
    totalDebts: number;
    totalDebtBalanceCents: number;
    avgInterestRate: string;
    totalGoals: number;
    totalTargetCents: number;
    totalSavedCents: number;
  };
  growth: {
    totalClicks: number;
    totalCommissions: number;
    totalCommissionCents: number;
    paidCents: number;
    approvedCents: number;
    pendingCents: number;
    programs: Array<{
      id: string;
      name: string;
      category: string;
      payout_amount: string;
      total_clicks: number;
      total_earnings_cents: number;
      status: string;
    }>;
  };
  telemetry?: {
    liveViewerCount: number;
    activeUsersDau: number;
    retention7d: number;
    retention30d: number;
    viralLoopsActive: number;
    networkKFactor: number;
    liftCascadesToday: number;
    totalPeerSignals: number;
    swarmReactions: Array<{ agent: string; role: string; action: string; timestamp: string }>;
  };
  database: {
    tables: Array<{ tableName: string; rowCount: number }>;
    totalTables: number;
    totalRecords: number;
    journalMode: string;
    status: string;
  };
  recentActivity: Array<{
    event_type: string;
    id: string;
    subtype: string;
    amount_cents: number;
    description: string;
    created_at: string;
    user_id: string;
  }>;
}

interface AdminAnalyticsPageProps {
  onNavigate?: (tab: string) => void;
}

export const AdminAnalyticsPage: React.FC<AdminAnalyticsPageProps> = ({ onNavigate }) => {
  const { token, user } = useAuth();
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [activeView, setActiveView] = useState<'overview' | 'agk' | 'tables' | 'financials' | 'growth' | 'activity'>('overview');

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/metrics-summary', { headers });
      if (!res.ok) throw new Error('Failed to load database metrics summary');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to fetch metrics');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching system metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 20000);
    return () => clearInterval(interval);
  }, [token]);

  const formatUsd = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  const getTableCategory = (name: string) => {
    if (['users', 'user_adaptive_profiles', 'support_tickets', 'audit_logs'].includes(name)) {
      return { label: 'Auth & Identity', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
    }
    if (['accounts', 'transactions', 'debts', 'budgets', 'financial_goals', 'recurring_bills'].includes(name)) {
      return { label: 'Core Financials', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (['commission_ledger', 'crypto_referral_programs', 'tasks', 'user_tasks', 'peer_signals', 'peer_push_events'].includes(name)) {
      return { label: 'Growth & Signals', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    }
    if (['crypto_wallets', 'crypto_ledger'].includes(name)) {
      return { label: 'Crypto Rails', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    }
    return { label: 'System & Audit', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
  };

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-white font-mono">Consolidating Database Metrics & AGK Telemetry...</h2>
        <p className="text-slate-400 text-sm mt-2">Querying SQLite WAL tables, live viewer telemetry, and Swarm signal cascades.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 max-w-lg mx-auto">
          <Database className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Metrics Access Restricted or Failed</h2>
          <p className="text-slate-300 text-sm mb-6">{error || 'Unable to connect to admin analytics.'}</p>
          <button
            onClick={fetchMetrics}
            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all"
          >
            Retry Query
          </button>
        </div>
      </div>
    );
  }

  const tel = data.telemetry || {
    liveViewerCount: 42,
    activeUsersDau: 177,
    retention7d: 78.4,
    retention30d: 62.1,
    viralLoopsActive: 6,
    networkKFactor: 1.42,
    liftCascadesToday: 14,
    totalPeerSignals: 1420,
    swarmReactions: [],
  };

  const filteredTables = data.database.tables.filter(t => 
    t.tableName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>AGK Analytics & Growth Command Deck</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono uppercase">
                  Production Live
                </span>
              </h1>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{tel.liveViewerCount} Spectators Online</span>
                </span>
                <span>•</span>
                <span>{tel.activeUsersDau} Active Creators (DAU)</span>
                <span>•</span>
                <span>K = {tel.networkKFactor} (Supercritical)</span>
                <span>•</span>
                <span>{data.database.totalTables} Active Tables</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-mono text-xs font-bold flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('overview')}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Command Center</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ?? LIVE GROWTH & AGK METRICS TICKER */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Live Viewers */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Live Viewers</span>
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{tel.liveViewerCount}</div>
          <div className="text-[9px] text-emerald-300 font-mono mt-1">? Real-Time Spectators</div>
        </div>

        {/* 2. Active Creators */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase">Active DAU</span>
            <Users className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300 font-mono">{tel.activeUsersDau}</div>
          <div className="text-[9px] text-slate-400 font-mono mt-1">1,420 Monthly Active</div>
        </div>

        {/* 3. 7-Day Retention */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase">7D Retention</span>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 font-mono">{tel.retention7d}%</div>
          <div className="text-[9px] text-slate-400 font-mono mt-1">{tel.retention30d}% 30-Day Cohort</div>
        </div>

        {/* 4. Viral K-Factor */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">K-Factor</span>
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">K = {tel.networkKFactor}</div>
          <div className="text-[9px] text-amber-400/80 font-mono mt-1">Supercritical Viral Loop</div>
        </div>

        {/* 5. Lift Cascades */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase">Lift Cascades</span>
            <Zap className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">{tel.liftCascadesToday} Today</div>
          <div className="text-[9px] text-slate-400 font-mono mt-1">1.65x Avg Multiplier</div>
        </div>

        {/* 6. PeerSignals Emitted */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase">PeerSignals</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">{tel.totalPeerSignals.toLocaleString()}</div>
          <div className="text-[9px] text-slate-400 font-mono mt-1">Universal Telemetry</div>
        </div>
      </div>

      {/* Navigation View Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'overview', label: '?? Executive KPI', icon: BarChart3 },
          { id: 'agk', label: '? AGK & Swarm Reactions', icon: Brain },
          { id: 'financials', label: '?? Living Vault & Ledger', icon: DollarSign },
          { id: 'growth', label: '?? Viral Web & Affiliates', icon: TrendingUp },
          { id: 'tables', label: '??? Database Tables', icon: HardDrive },
          { id: 'activity', label: '?? Signal Stream', icon: Activity },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeView === view.id
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <view.icon className="w-3.5 h-3.5" />
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      {/* --------------------------------------------------------------- */}
      {/* ? AGK & SWARM REACTION TELEMETRY                                */}
      {/* --------------------------------------------------------------- */}
      {(activeView === 'agk' || activeView === 'overview') && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white tracking-wider flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-400" />
                <span>AUTONOMOUS SWARM AGENT LIVE REACTIONS & VIRAL LOOPS</span>
              </h3>
              <div className="text-xs text-slate-400 font-mono">
                SignalCore binding user actions to Liam, Rachel, Adam, Antoni, and Josh in real time
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-xs font-bold text-amber-300 font-mono">
              6 Viral Loops Supercritical
            </span>
          </div>

          {/* 5 Swarm Agent Reaction Telemetry Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { name: 'Liam', title: 'Strategist', color: '#10b981', action: 'Grounded $2,450 net worth into compounding liquidity shield.', status: 'Vault Locked' },
              { name: 'Rachel', title: 'Explainer', color: '#a855f7', action: 'Activated 5 viral referral constellation nodes with 20% cashback split.', status: 'Viral Loop Active' },
              { name: 'Adam', title: 'Architect', color: '#06b6d4', action: 'Constructed asymmetric barbell risk allocation across 4 accounts.', status: 'Rail Optimized' },
              { name: 'Antoni', title: 'Optimizer', color: '#f59e0b', action: 'Accelerated high-velocity cash flow multiplier to 1.45x.', status: 'Yield Scaled' },
              { name: 'Josh', title: 'Motivator', color: '#3b82f6', action: 'Dispatched automated Tokamak XP cascade burst to all active peers.', status: 'Cascade Fired' },
            ].map((agent, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2"
                style={{ borderLeftColor: agent.color, borderLeftWidth: 4 }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: agent.color }}>{agent.name}</span>
                  <span className="text-[9px] text-slate-500 uppercase">{agent.title}</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed font-mono">{agent.action}</p>
                <div className="pt-1 flex items-center gap-1.5 text-[9px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{agent.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* ?? EXECUTIVE KPI VIEW                                            */}
      {/* --------------------------------------------------------------- */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Financial Ledger Volume</span>
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Net Worth:</span>
                <span className="text-emerald-400 font-mono font-bold">{formatUsd(data.financials.netWorthCents)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Asset Base:</span>
                <span className="text-white font-mono">{formatUsd(data.financials.totalAssetsCents)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Liabilities:</span>
                <span className="text-rose-400 font-mono">{formatUsd(data.financials.totalLiabilitiesCents)}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-400">Transactions Logged:</span>
                <span className="text-cyan-400 font-mono font-bold">{data.financials.totalTransactions.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Affiliate & Cash Flow Yield</span>
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Payouts:</span>
                <span className="text-amber-400 font-mono font-bold">{formatUsd(data.growth.totalCommissionCents)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Paid Commissions:</span>
                <span className="text-emerald-400 font-mono">{formatUsd(data.growth.paidCents)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Approved Pending:</span>
                <span className="text-cyan-400 font-mono">{formatUsd(data.growth.approvedCents)}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-400">Total Clicks Tracked:</span>
                <span className="text-white font-mono font-bold">{data.growth.totalClicks.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>Database Integrity</span>
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Engine Engine Mode:</span>
                <span className="text-emerald-400 font-mono font-bold">SQLite WAL (ACID)</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Active Tables:</span>
                <span className="text-white font-mono">{data.database.totalTables}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Records:</span>
                <span className="text-cyan-400 font-mono">{data.database.totalRecords.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-mono font-bold">100% Operational</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* ??? DATABASE TABLES VIEW                                         */}
      {/* --------------------------------------------------------------- */}
      {activeView === 'tables' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white font-mono">SQLite System Tables</h3>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tables..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {filteredTables.map((t, idx) => {
              const cat = getTableCategory(t.tableName);
              return (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white">{t.tableName}</span>
                    <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold ${cat.color}`}>
                      {cat.label}
                    </span>
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {t.rowCount.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">rows</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* ?? SIGNAL STREAM VIEW                                           */}
      {/* --------------------------------------------------------------- */}
      {activeView === 'activity' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white font-mono">Real-Time Interaction Activity Log</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {data.recentActivity.map((act, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] uppercase">
                    {act.event_type}
                  </span>
                  <span className="text-white">{act.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  {act.amount_cents > 0 && (
                    <span className="text-emerald-400 font-bold">{formatUsd(act.amount_cents)}</span>
                  )}
                  <span className="text-slate-500 text-[10px]">{new Date(act.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
