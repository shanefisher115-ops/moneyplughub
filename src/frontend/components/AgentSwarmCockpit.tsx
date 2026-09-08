import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  Activity, 
  Send, 
  CheckCircle2, 
  Clock, 
  Radio, 
  Layers, 
  Code2, 
  Terminal, 
  Zap, 
  ShieldCheck, 
  Share2, 
  TrendingUp, 
  Flame, 
  Maximize2, 
  Minimize2, 
  X, 
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: string;
  icon: string;
  latencyMs: number;
  capabilities: string[];
  description: string;
}

interface StepTrace {
  agent: string;
  action: string;
  status: 'success' | 'failed' | 'skipped' | 'running';
  durationMs: number;
  output?: any;
  error?: string;
}

interface ExecutionTrace {
  id: string;
  directive: string;
  plannedAgents: string[];
  steps: StepTrace[];
  totalLatencyMs: number;
  status: 'completed' | 'partial' | 'failed' | 'running';
  xpAwarded: number;
  createdAt: string;
}

const SWARM_AGENTS: AgentInfo[] = [
  {
    id: 'balance_agent',
    name: 'BalanceAgent',
    role: 'Financial Reconciliation',
    status: 'ONLINE',
    icon: '🛡️',
    latencyMs: 14,
    capabilities: ['ReconcileAccounts', 'ComputeNetWorth', 'TrackCashflows'],
    description: 'Synchronizes balances across connected banking, card, and crypto wallets with invariant enforcement and ACID deduplication.'
  },
  {
    id: 'earnings_agent',
    name: 'EarningsAgent',
    role: 'Revenue & Commission Engine',
    status: 'ONLINE',
    icon: '💰',
    latencyMs: 18,
    capabilities: ['CalculateDailyRevenue', 'WindowedRollups', 'AuditLedgers'],
    description: 'Aggregates gross and net earnings across daily, weekly, and monthly intervals with automated fee deductions.'
  },
  {
    id: 'referral_agent',
    name: 'ReferralAgent',
    role: 'Viral Funnel & Hook Strategist',
    status: 'ONLINE',
    icon: '🎯',
    latencyMs: 22,
    capabilities: ['RecommendPrograms', 'GenerateViralHooks', 'SynthesizeScripts'],
    description: 'Analyzes conversion clickthroughs and synthesizes high-velocity social video hooks and affiliate scripts.'
  },
  {
    id: 'viral_swarm_agent',
    name: 'ViralSwarmAgent',
    role: 'Autonomous Content Syndication',
    status: 'ONLINE',
    icon: '🚀',
    latencyMs: 12,
    capabilities: ['PublishSocialFeeds', 'TriggerSurgeVelocity', 'DispatchMicroservice'],
    description: 'Relays scripted hooks to multi-platform queues and the decoupled autoposter microservice on port 3005.'
  },
  {
    id: 'sigil_forge_agent',
    name: 'SigilForgeAgent',
    role: '3D Sacred Geometry Forge',
    status: 'ONLINE',
    icon: '🔮',
    latencyMs: 16,
    capabilities: ['Synthesize3DMedallion', 'ComputeAcousticAura', 'AscendVaultTier'],
    description: 'Forges procedural deterministic vector medallions and aligns 528Hz Solfeggio acoustic resonance with vault progression.'
  },
  {
    id: 'automation_agent',
    name: 'AutomationAgent',
    role: 'Chronos Workflow Scheduler',
    status: 'ONLINE',
    icon: '⚡',
    latencyMs: 9,
    capabilities: ['CronTicks', 'ExecuteWebhooks', 'EnforceSchedules'],
    description: 'Orchestrates recurring background actions, Zapier/Make.com webhooks, and interval tickers.'
  },
  {
    id: 'insight_agent',
    name: 'InsightAgent',
    role: 'Cross-Financial Intelligence',
    status: 'ONLINE',
    icon: '🧠',
    latencyMs: 28,
    capabilities: ['SynthesizeBriefing', 'DetectAnomalies', 'PrescribeGrowthActions'],
    description: 'Combines real-time telemetry, liquidity ratios, and velocity to formulate daily operator executive briefings.'
  }
];

const QUICK_DIRECTIVES = [
  { label: '⚡ Run Daily Swarm Loop (+150 XP)', prompt: 'Run complete daily loop across all agents and prepare viral post' },
  { label: '🔥 Viral Hook + Autopost (+50 XP)', prompt: 'Generate high converting viral affiliate script and dispatch to autoposter' },
  { label: '🛡️ Sync Balances & Net Worth (+50 XP)', prompt: 'Sync balances from all connected providers and compute net worth' },
  { label: '🔮 Forge Level 5 Sigil (+100 XP)', prompt: 'Forge resonant 3D vector sigil with 528Hz acoustic harmonics' },
  { label: '📈 Strategic Wealth Briefing (+75 XP)', prompt: 'Synthesize cross-financial telemetry into daily executive insight briefing' },
  { label: '⚙️ Chronos Automation Tick (+25 XP)', prompt: 'Trigger scheduled automation tick across all workflows' }
];

export const AgentSwarmCockpit: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'command' | 'agents' | 'traces' | 'protocol'>('command');
  
  const [directive, setDirective] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentTrace, setCurrentTrace] = useState<ExecutionTrace | null>(null);
  const [historicalTraces, setHistoricalTraces] = useState<ExecutionTrace[]>([]);
  const [manifestJson, setManifestJson] = useState<string>('');
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [xpCelebration, setXpCelebration] = useState<number | null>(null);

  const streamEndRef = useRef<HTMLDivElement>(null);

  // Global hotkey: Cmd+K or Ctrl+K opens Swarm Cockpit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch manifest and initial traces
  useEffect(() => {
    if (isOpen) {
      fetch('/api/agent/manifest')
        .then(res => res.json())
        .then(data => setManifestJson(JSON.stringify(data, null, 2)))
        .catch(() => {});

      fetch('/api/agent/traces')
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.data)) {
            setHistoricalTraces(data.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleExecute = async (promptToRun?: string) => {
    const cmd = (promptToRun || directive).trim();
    if (!cmd || isExecuting) return;

    setIsExecuting(true);
    setDirective('');
    setActiveTab('command');

    // Optimistic initial running trace
    const optimisticTrace: ExecutionTrace = {
      id: `trace_${Date.now()}`,
      directive: cmd,
      plannedAgents: ['PlannerAgent', 'Executing Swarm'],
      steps: [
        {
          agent: 'SwarmPlanner',
          action: 'synthesizing_intent_graph',
          status: 'running',
          durationMs: 0
        }
      ],
      totalLatencyMs: 0,
      status: 'running',
      xpAwarded: 0,
      createdAt: new Date().toISOString()
    };
    setCurrentTrace(optimisticTrace);

    try {
      const res = await fetch('/api/agent/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ directive: cmd })
      });

      const data = await res.json();
      if (data.success && data.data) {
        setCurrentTrace(data.data);
        setHistoricalTraces(prev => [data.data, ...prev.slice(0, 19)]);
        if (data.xpAwarded > 0) {
          setXpCelebration(data.xpAwarded);
          setTimeout(() => setXpCelebration(null), 4000);
        }
      } else {
        setCurrentTrace({
          id: `trace_${Date.now()}`,
          directive: cmd,
          plannedAgents: ['FallbackDispatcher'],
          steps: [
            {
              agent: 'DispatchError',
              action: 'dispatch_rejected',
              status: 'failed',
              durationMs: 120,
              error: data.error || 'Swarm execution failed'
            }
          ],
          totalLatencyMs: 120,
          status: 'failed',
          xpAwarded: 0,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setCurrentTrace({
        id: `trace_${Date.now()}`,
        directive: cmd,
        plannedAgents: ['FallbackDispatcher'],
        steps: [
          {
            agent: 'NetworkBridge',
            action: 'request_interrupted',
            status: 'failed',
            durationMs: 90,
            error: err.message || 'Connection timeout'
          }
        ],
        totalLatencyMs: 90,
        status: 'failed',
        xpAwarded: 0,
        createdAt: new Date().toISOString()
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyManifestToClipboard = () => {
    navigator.clipboard.writeText(manifestJson);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  return (
    <>
      {/* ── Persistent Floating Swarm Indicator Pill ── */}
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900/95 border border-emerald-500/50 hover:border-emerald-400 shadow-2xl shadow-emerald-950/80 backdrop-blur-xl text-left transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        >
          {/* Pulsing Acoustic Glow Ring */}
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping" />
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white tracking-wider flex items-center gap-1.5">
                AGENT SWARM <span className="text-[10px] text-emerald-400 font-normal">7/7</span>
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] border border-emerald-500/40">
                528Hz
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300 border border-slate-700">⌘K</kbd> to dispatch
            </span>
          </div>

          <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ── XP Celebration Toast ── */}
      {xpCelebration && (
        <div className="fixed bottom-20 right-8 z-50 animate-bounce pointer-events-none">
          <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-sm shadow-2xl flex items-center gap-2">
            <Zap className="w-4 h-4 fill-slate-950" />
            +{xpCelebration} XP EARNED (SWARM DIRECTIVE)
          </div>
        </div>
      )}

      {/* ── Full Swarm Directive Cockpit Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className={`relative w-full ${isExpanded ? 'max-w-6xl h-[92vh]' : 'max-w-4xl max-h-[88vh]'} bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300`}
          >
            {/* ── Modal Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-white tracking-wide">
                      MoneyPlugHub Agent Swarm OS
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      SUPERCRITICAL ONLINE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Autonomous Multi-Agent Substrate • 7 Swarm Agents • ACID Ledger & Decoupled Syndication
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title={isExpanded ? 'Collapse view' : 'Expand view'}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Navigation Tabs ── */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-slate-950/40 shrink-0">
              <button
                onClick={() => setActiveTab('command')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all ${
                  activeTab === 'command'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Swarm Command (Live)
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all ${
                  activeTab === 'agents'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Active Agents (7)
              </button>
              <button
                onClick={() => setActiveTab('traces')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all ${
                  activeTab === 'traces'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Execution Traces
              </button>
              <button
                onClick={() => setActiveTab('protocol')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all ${
                  activeTab === 'protocol'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Agent Protocol (MCP)
              </button>
            </div>

            {/* ── Tab Content Area ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: SWARM COMMAND (LIVE) */}
              {activeTab === 'command' && (
                <div className="space-y-6">
                  {/* Natural Language Command Bar */}
                  <div className="relative">
                    <div className="flex items-center rounded-2xl bg-slate-950 border border-emerald-500/40 shadow-inner p-1.5 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                      <div className="pl-3 pr-2 text-emerald-400">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        value={directive}
                        onChange={(e) => setDirective(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleExecute();
                        }}
                        placeholder="Enter plain English directive for the agent swarm (e.g. 'Sync balances and autopost viral script')..."
                        className="w-full bg-transparent text-white text-sm placeholder-slate-500 font-sans focus:outline-none px-2 py-2"
                        disabled={isExecuting}
                      />
                      <button
                        onClick={() => handleExecute()}
                        disabled={!directive.trim() || isExecuting}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs tracking-wider uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shrink-0 cursor-pointer"
                      >
                        {isExecuting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Dispatching...
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Execute Swarm
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Quick Directive Action Chips */}
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                      <span>Quick Intent Directives</span>
                      <span className="text-[10px] text-emerald-400">Instant +25 to +150 XP</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {QUICK_DIRECTIVES.map((qd, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleExecute(qd.prompt)}
                          disabled={isExecuting}
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 text-left transition-all text-xs font-mono text-slate-200 group cursor-pointer disabled:opacity-50"
                        >
                          <span className="truncate pr-2">{qd.label}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Execution Stream / Current Trace */}
                  {currentTrace && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-mono text-white font-bold">
                            DIRECTIVE: "{currentTrace.directive}"
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-slate-400">
                            Latency: <span className="text-emerald-400 font-bold">{currentTrace.totalLatencyMs}ms</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            currentTrace.status === 'completed' 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                              : currentTrace.status === 'running' 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}>
                            {currentTrace.status}
                          </span>
                          {currentTrace.xpAwarded > 0 && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/40">
                              +{currentTrace.xpAwarded} XP
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Execution Steps */}
                      <div className="space-y-2">
                        {currentTrace.steps.map((st, sIdx) => (
                          <div 
                            key={sIdx}
                            className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {st.status === 'success' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : st.status === 'running' ? (
                                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                                )}
                                <span className="text-white font-bold">{st.agent}</span>
                                <span className="text-slate-400">→ {st.action}</span>
                              </div>
                              <span className="text-slate-500 text-[10px]">{st.durationMs}ms</span>
                            </div>

                            {st.error && (
                              <div className="text-rose-400 text-[11px] bg-rose-950/40 p-2 rounded border border-rose-800/40">
                                {st.error}
                              </div>
                            )}

                            {st.output && (
                              <pre className="text-[11px] text-slate-300 bg-slate-950 p-2 rounded overflow-x-auto border border-slate-800/60 max-h-36">
                                {JSON.stringify(st.output, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Swarm Heartbeat Grid */}
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                      Live Swarm Topology
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      {SWARM_AGENTS.map(agent => (
                        <div 
                          key={agent.id}
                          className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center flex flex-col items-center gap-1 hover:border-emerald-500/30 transition-all"
                        >
                          <span className="text-lg">{agent.icon}</span>
                          <span className="text-[11px] font-mono font-bold text-white truncate w-full">
                            {agent.name.replace('Agent', '')}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] font-mono text-emerald-400">{agent.latencyMs}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ACTIVE AGENTS (7) */}
              {activeTab === 'agents' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SWARM_AGENTS.map(agent => (
                    <div 
                      key={agent.id}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg">
                            {agent.icon}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-1.5">
                              {agent.name}
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                {agent.latencyMs}ms
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">{agent.role}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleExecute(`Run ${agent.name}`)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-bold transition-all cursor-pointer"
                        >
                          Invoke
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {agent.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {agent.capabilities.map((cap, cIdx) => (
                          <span 
                            key={cIdx}
                            className="px-2 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-slate-300 border border-slate-800"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: EXECUTION TRACES */}
              {activeTab === 'traces' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Audit Log of Past Swarm Invocations</span>
                    <span>Total Traces: {historicalTraces.length}</span>
                  </div>

                  {historicalTraces.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-2xl">
                      No execution traces recorded yet. Run a directive to generate your first swarm trace.
                    </div>
                  ) : (
                    historicalTraces.map((trace, tIdx) => (
                      <div 
                        key={tIdx}
                        className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-emerald-400 font-bold">
                              {trace.directive}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-slate-500">{new Date(trace.createdAt).toLocaleTimeString()}</span>
                            <span className="text-slate-400 font-bold">{trace.totalLatencyMs}ms</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                              +{trace.xpAwarded} XP
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-400">
                          {trace.steps.map((s, idx) => (
                            <span 
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                            >
                              {s.agent}: {s.action} ({s.durationMs}ms)
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: AGENT PROTOCOL (MCP / JSON) */}
              {activeTab === 'protocol' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        Machine-Readable Agent Manifest
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                          /.well-known/agent.json
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Conforms to Model Context Protocol (MCP 1.0) and A2A Agent Specifications
                      </p>
                    </div>

                    <button
                      onClick={copyManifestToClipboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-all cursor-pointer"
                    >
                      {copiedManifest ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copied JSON
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Manifest
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[50vh] leading-relaxed">
                      {manifestJson || '// Loading manifest from /.well-known/agent.json...'}
                    </pre>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs font-mono space-y-2">
                    <div className="text-white font-bold flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      External Agent Invocation Snippet (cURL)
                    </div>
                    <pre className="text-[11px] text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800 overflow-x-auto">
{`curl -X POST https://moneyplughub.com/api/agent/dispatch \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: YOUR_AGENT_KEY" \\
  -d '{"directive": "Run daily morning financial loop and dispatch viral post"}'`}
                    </pre>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
};
