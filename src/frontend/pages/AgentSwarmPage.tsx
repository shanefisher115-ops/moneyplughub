import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bot, 
  Terminal, 
  Layers, 
  Activity, 
  Code2, 
  Send, 
  Zap, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ShieldCheck, 
  ArrowRight, 
  Cpu, 
  Radio, 
  Share2, 
  DollarSign, 
  Flame 
} from 'lucide-react';

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

export const AgentSwarmPage: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'console' | 'swarm' | 'traces' | 'mcp'>('console');
  const [directive, setDirective] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [traces, setTraces] = useState<any[]>([]);
  const [manifest, setManifest] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(SWARM_AGENTS[0]);

  useEffect(() => {
    fetch('/api/agent/manifest')
      .then(r => r.json())
      .then(d => setManifest(JSON.stringify(d, null, 2)))
      .catch(() => {});

    fetch('/api/agent/traces')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) setTraces(d.data);
      })
      .catch(() => {});
  }, []);

  const handleExecuteDirective = async (cmdToRun?: string) => {
    const text = (cmdToRun || directive).trim();
    if (!text || isExecuting) return;

    setIsExecuting(true);
    setDirective('');

    try {
      const res = await fetch('/api/agent/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directive: text })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setExecutionResult(data.data);
        setTraces(prev => [data.data, ...prev]);
      } else {
        setExecutionResult({
          directive: text,
          status: 'failed',
          error: data.error || 'Execution rejected',
          steps: []
        });
      }
    } catch (e: any) {
      setExecutionResult({
        directive: text,
        status: 'failed',
        error: e.message,
        steps: []
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyManifest = () => {
    navigator.clipboard.writeText(manifest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      
      {/* ── Page Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/30 p-6 sm:p-10 shadow-2xl shadow-emerald-950/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              AGENT-NATIVE PROTOCOL v1.0 • SOVEREIGN SWARM
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Autonomous Agent Swarm Runtime
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              MoneyPlugHub operates as a fully agent-native platform. Seven specialized autonomous agents communicate across an event bus with durable SQLite memory, automated viral syndication, and 3D geometric state.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-center font-mono">
              <div className="text-xl font-bold text-emerald-400">7/7</div>
              <div className="text-[10px] text-slate-400 uppercase">Agents Online</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-center font-mono">
              <div className="text-xl font-bold text-cyan-400">528Hz</div>
              <div className="text-[10px] text-slate-400 uppercase">Harmonic Sync</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-center font-mono">
              <div className="text-xl font-bold text-amber-400">{user?.xp || 100}</div>
              <div className="text-[10px] text-slate-400 uppercase">Operator XP</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Subsystem Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 font-mono text-xs font-bold">
        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'console'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Directive Console (Swarm)
        </button>
        <button
          onClick={() => setActiveTab('swarm')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'swarm'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          Active Swarm Mesh (7 Agents)
        </button>
        <button
          onClick={() => setActiveTab('traces')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'traces'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          ACID Execution Traces
        </button>
        <button
          onClick={() => setActiveTab('mcp')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'mcp'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Code2 className="w-4 h-4" />
          Agent Protocol & MCP Schema
        </button>
      </div>

      {/* ── TAB 1: DIRECTIVE CONSOLE ── */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          {/* Command Bar */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Terminal className="w-4 h-4" />
              </div>
              <div className="text-sm font-bold text-white">
                Dispatch Natural Language Directive across Multi-Agent Swarm
              </div>
            </div>

            <div className="flex items-center rounded-2xl bg-slate-950 border border-emerald-500/40 p-2 focus-within:border-emerald-400 transition-all">
              <input
                type="text"
                value={directive}
                onChange={(e) => setDirective(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteDirective();
                }}
                placeholder="Enter plain English directive (e.g. 'Run full morning sync loop and publish viral TikTok hook')..."
                className="w-full bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none px-3 py-2 font-mono"
                disabled={isExecuting}
              />
              <button
                onClick={() => handleExecuteDirective()}
                disabled={!directive.trim() || isExecuting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shrink-0"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Dispatch
                  </>
                )}
              </button>
            </div>

            {/* Quick Action Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { label: '⚡ Daily Morning Loop (+150 XP)', cmd: 'Run daily morning loop across all agents' },
                { label: '🔥 Generate Viral Hook & Autopost (+50 XP)', cmd: 'Generate high converting viral affiliate script and dispatch to autoposter' },
                { label: '🛡️ Reconcile Accounts & Net Worth (+50 XP)', cmd: 'Sync balances from all connected providers and compute net worth' },
                { label: '🔮 Synthesize 3D Ascension Sigil (+100 XP)', cmd: 'Forge resonant 3D vector sigil with 528Hz acoustic harmonics' },
                { label: '📈 Cross-Financial Briefing (+75 XP)', cmd: 'Synthesize cross-financial telemetry into daily executive insight briefing' },
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExecuteDirective(chip.cmd)}
                  disabled={isExecuting}
                  className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 hover:border-emerald-500/40 text-slate-300 hover:text-white font-mono text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Execution Output Stream */}
          {executionResult && (
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
                <div className="flex items-center gap-2 text-sm text-white font-bold">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Directive: "{executionResult.directive}"
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">
                    Latency: <span className="text-emerald-400 font-bold">{executionResult.totalLatencyMs}ms</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase">
                    {executionResult.status}
                  </span>
                  {executionResult.xpAwarded > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                      +{executionResult.xpAwarded} XP
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {executionResult.steps?.map((step: any, sIdx: number) => (
                  <div 
                    key={sIdx}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs font-mono space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {step.status === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="text-white font-bold">{step.agent}</span>
                        <span className="text-slate-400">→ {step.action}</span>
                      </div>
                      <span className="text-slate-500 text-[11px]">{step.durationMs}ms</span>
                    </div>

                    {step.output && (
                      <pre className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 overflow-x-auto max-h-40">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ACTIVE SWARM MESH ── */}
      {activeTab === 'swarm' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Agent list */}
          <div className="space-y-3">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
              Swarm Agent Node Catalog
            </div>
            {SWARM_AGENTS.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  selectedAgent?.id === agent.id
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-md'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{agent.icon}</span>
                  <div>
                    <div className="font-bold text-xs">{agent.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{agent.role}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  {agent.latencyMs}ms
                </span>
              </button>
            ))}
          </div>

          {/* Selected Agent Deep Dive */}
          {selectedAgent && (
            <div className="md:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                    {selectedAgent.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {selectedAgent.name}
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {selectedAgent.status}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{selectedAgent.role}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleExecuteDirective(`Run ${selectedAgent.name}`)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all cursor-pointer"
                >
                  Direct Dispatch
                </button>
              </div>

              <div>
                <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider mb-2">Description</h4>
                <p className="text-sm text-slate-200 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  {selectedAgent.description}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider mb-2">Capabilities</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.capabilities.map((cap, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: ACID EXECUTION TRACES ── */}
      {activeTab === 'traces' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Durable SQLite Swarm Traces (`agent_swarm_traces`)</span>
            <span>{traces.length} Historical Records</span>
          </div>

          {traces.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-3xl">
              No historical swarm execution traces recorded yet. Execute a directive in the console.
            </div>
          ) : (
            traces.map((tr, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-sm">"{tr.directive}"</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{new Date(tr.createdAt).toLocaleString()}</span>
                    <span className="text-emerald-400 font-bold">{tr.totalLatencyMs}ms</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] uppercase font-bold">
                      {tr.status}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      +{tr.xpAwarded} XP
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {tr.steps?.map((st: any, sIdx: number) => (
                    <span 
                      key={sIdx}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[10px]"
                    >
                      {st.agent} → {st.action} ({st.durationMs}ms)
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 4: AGENT PROTOCOL & MCP SCHEMA ── */}
      {activeTab === 'mcp' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Machine-Readable Agent Protocol Manifest
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono border border-emerald-500/30">
                    /.well-known/agent.json
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Standardized JSON schema for Model Context Protocol (MCP 1.0) and Agent-to-Agent (A2A) discovery.
                </p>
              </div>

              <button
                onClick={copyManifest}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy JSON
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[45vh] leading-relaxed">
              {manifest || '// Loading agent manifest...'}
            </pre>
          </div>

          {/* Quick Integration Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="text-white font-bold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                REST / cURL Directive Invocation
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 border border-slate-800 overflow-x-auto text-[11px]">
{`curl -X POST https://moneyplughub.com/api/agent/dispatch \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: <YOUR_KEY>" \\
  -d '{"directive": "Run daily loop"}'`}
              </pre>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="text-white font-bold flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                MCP / JSON-RPC Tool Call
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 border border-slate-800 overflow-x-auto text-[11px]">
{`curl -X POST https://moneyplughub.com/api/agent/invoke \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "balance.sync", "params": {}}'`}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
