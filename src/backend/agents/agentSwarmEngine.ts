import { db, runInTransaction } from '../db';
import { BalanceAgent } from './balanceAgent';
import { EarningsAgent } from './earningsAgent';
import { ReferralAgent } from './referralAgent';
import { AutomationAgent } from './automationAgent';
import { InsightAgent } from './insightAgent';
import { generateSigil } from '../routes/sigil';
import http from 'http';

export interface SwarmStepResult {
  agent: string;
  action: string;
  status: 'success' | 'failed' | 'skipped';
  durationMs: number;
  output: unknown;
  error?: string;
}

export interface SwarmExecutionTrace {
  id: string;
  userId: string;
  directive: string;
  plannedAgents: string[];
  steps: SwarmStepResult[];
  totalLatencyMs: number;
  status: 'completed' | 'partial' | 'failed';
  xpAwarded: number;
  createdAt: string;
}

export interface AgentManifest {
  schema_version: string;
  name: string;
  tagline: string;
  description: string;
  protocol: string;
  swarm_version: string;
  autonomous_status: string;
  endpoint_base: string;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    capabilities: string[];
    description: string;
  }>;
  tools: Array<{
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  }>;
  authentication: {
    type: string;
    supported_headers: string[];
  };
}

export class AgentSwarmEngine {
  public static readonly swarmVersion = '5.0.0-cosmic';

  /**
   * Initializes database table for agent swarm trace logs
   */
  public static initSchema(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_swarm_traces (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        directive TEXT NOT NULL,
        planned_agents TEXT NOT NULL,
        steps_json TEXT NOT NULL,
        total_latency_ms INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('completed', 'partial', 'failed')),
        xp_awarded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_swarm_traces_user ON agent_swarm_traces(user_id);
      CREATE INDEX IF NOT EXISTS idx_swarm_traces_created ON agent_swarm_traces(created_at DESC);
    `);
  }

  /**
   * Get machine-readable Agent Protocol Manifest
   */
  public static getManifest(): AgentManifest {
    return {
      schema_version: '1.0.0',
      name: 'MoneyPlugHub Autonomous Swarm Protocol',
      tagline: 'Fully Agent-Native Creator Money OS & Swarm Execution Runtime',
      description: 'Production-grade agent protocol exposing 7 specialized financial, viral syndication, and 3D forge agents for internal and A2A autonomous execution.',
      protocol: 'agent-protocol/v1.0 (A2A + MCP 1.0)',
      swarm_version: this.swarmVersion,
      autonomous_status: 'SUPERCRITICAL_ONLINE',
      endpoint_base: 'https://moneyplughub.com/api/agent',
      agents: [
        {
          id: 'balance_agent',
          name: 'BalanceAgent',
          role: 'Multi-Account Financial Reconciliation',
          status: 'ONLINE',
          capabilities: ['ReconcileAccounts', 'ComputeNetWorth', 'TrackCashflows'],
          description: 'Synchronizes balances across connected banking, card, and crypto wallets with invariant enforcement and ACID deduplication.'
        },
        {
          id: 'earnings_agent',
          name: 'EarningsAgent',
          role: 'Revenue & Commission Engine',
          status: 'ONLINE',
          capabilities: ['CalculateDailyRevenue', 'WindowedRollups', 'AuditLedgers'],
          description: 'Aggregates gross and net earnings across daily, weekly, and monthly intervals with automated fee deductions.'
        },
        {
          id: 'referral_agent',
          name: 'ReferralAgent',
          role: 'Viral Funnel & Hook Strategist',
          status: 'ONLINE',
          capabilities: ['RecommendPrograms', 'GenerateViralHooks', 'SynthesizeScripts'],
          description: 'Analyzes conversion clickthroughs and synthesizes high-velocity social video hooks and affiliate scripts.'
        },
        {
          id: 'viral_swarm_agent',
          name: 'ViralSwarmAgent',
          role: 'Autonomous Content Syndication',
          status: 'ONLINE',
          capabilities: ['PublishSocialFeeds', 'TriggerSurgeVelocity', 'DispatchMicroservice'],
          description: 'Relays scripted hooks to multi-platform queues and the decoupled autoposter microservice on port 3005.'
        },
        {
          id: 'sigil_forge_agent',
          name: 'SigilForgeAgent',
          role: '3D Sacred Geometry & Cryptographic Minting',
          status: 'ONLINE',
          capabilities: ['Synthesize3DMedallion', 'ComputeAcousticAura', 'AscendVaultTier'],
          description: 'Forges procedural deterministic vector medallions and aligns 528Hz Solfeggio acoustic resonance with vault progression.'
        },
        {
          id: 'automation_agent',
          name: 'AutomationAgent',
          role: 'Chronos Scheduled Workflow Executor',
          status: 'ONLINE',
          capabilities: ['CronTicks', 'ExecuteWebhooks', 'EnforceSchedules'],
          description: 'Orchestrates recurring background actions, Zapier/Make.com webhooks, and interval tickers.'
        },
        {
          id: 'insight_agent',
          name: 'InsightAgent',
          role: 'Cross-Financial Strategic Intelligence',
          status: 'ONLINE',
          capabilities: ['SynthesizeBriefing', 'DetectAnomalies', 'PrescribeGrowthActions'],
          description: 'Combines real-time telemetry, liquidity ratios, and velocity to formulate daily operator executive briefings.'
        }
      ],
      tools: [
        {
          name: 'swarm.dispatch',
          description: 'Execute arbitrary natural language directive across the multi-agent swarm.',
          parameters: {
            type: 'object',
            properties: {
              directive: {
                type: 'string',
                description: 'The natural language command or intent to execute (e.g. "Sync balances and generate my daily viral hook").'
              }
            },
            required: ['directive']
          }
        },
        {
          name: 'swarm.daily_loop',
          description: 'Triggers the complete synchronized daily morning financial loop across all agents.',
          parameters: {
            type: 'object',
            properties: {
              includeViralPost: {
                type: 'boolean',
                description: 'Whether to immediately dispatch generated viral hook to the autoposter queue.'
              }
            }
          }
        },
        {
          name: 'balance.sync',
          description: 'Triggers BalanceAgent to reconcile all connected provider accounts.',
          parameters: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'earnings.compute',
          description: 'Triggers EarningsAgent to compute daily/weekly/monthly revenue snapshots.',
          parameters: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'referral.generate_hook',
          description: 'Triggers ReferralAgent to generate a high-conversion social script.',
          parameters: {
            type: 'object',
            properties: {
              preferredSlug: {
                type: 'string',
                description: 'Target referral program slug (e.g. "rakuten", "coinbase", "moneyplughub").'
              },
              platform: {
                type: 'string',
                description: 'Target social platform (tiktok, reels, shorts, x).'
              }
            }
          }
        },
        {
          name: 'viral.autopost',
          description: 'Dispatches content directly to the social queue and decoupled autoposter microservice.',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Post text or video hook caption.' },
              platform: { type: 'string', description: 'Platform to publish to.' }
            },
            required: ['content']
          }
        },
        {
          name: 'sigil.forge',
          description: 'Synthesizes or updates the user 3D sacred geometry crest and harmonics.',
          parameters: {
            type: 'object',
            properties: {
              aura: { type: 'string', description: 'Aura color theme (emerald, gold, diamond, amethyst, obsidian).' },
              frequencyHz: { type: 'number', description: 'Harmonic frequency in Hz (default 528).' }
            }
          }
        },
        {
          name: 'insight.generate',
          description: 'Synthesizes an updated daily cross-financial intelligence briefing.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ],
      authentication: {
        type: 'bearer_token_or_api_key',
        supported_headers: ['Authorization: Bearer <jwt>', 'x-agent-key: <key>', 'x-api-key: <key>']
      }
    };
  }

  /**
   * Main Natural Language Directive Dispatcher
   */
  public static async dispatchDirective(
    userId: string,
    directive: string
  ): Promise<SwarmExecutionTrace> {
    const startTime = Date.now();
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lower = directive.toLowerCase().trim();

    // 1. Plan Multi-Agent Execution Path based on Directive Intent
    const plannedAgents: string[] = [];

    const isDailyLoop = lower.includes('daily loop') || lower.includes('morning loop') || lower.includes('sync all') || lower.includes('full loop');
    const wantsBalance = isDailyLoop || lower.includes('balance') || lower.includes('sync') || lower.includes('net worth') || lower.includes('account');
    const wantsEarnings = isDailyLoop || lower.includes('earning') || lower.includes('revenue') || lower.includes('profit') || lower.includes('commission');
    const wantsReferral = isDailyLoop || lower.includes('referral') || lower.includes('hook') || lower.includes('script') || lower.includes('suggest') || lower.includes('affiliate');
    const wantsViral = isDailyLoop || lower.includes('viral') || lower.includes('autopost') || lower.includes('post') || lower.includes('publish') || lower.includes('tiktok') || lower.includes('reels');
    const wantsSigil = lower.includes('sigil') || lower.includes('forge') || lower.includes('aura') || lower.includes('medallion') || lower.includes('harmonic');
    const wantsAutomation = lower.includes('automation') || lower.includes('cron') || lower.includes('tick') || lower.includes('schedule');
    const wantsInsight = isDailyLoop || lower.includes('insight') || lower.includes('briefing') || lower.includes('audit') || lower.includes('report');

    if (wantsBalance) plannedAgents.push('BalanceAgent');
    if (wantsEarnings) plannedAgents.push('EarningsAgent');
    if (wantsReferral) plannedAgents.push('ReferralAgent');
    if (wantsViral) plannedAgents.push('ViralSwarmAgent');
    if (wantsSigil) plannedAgents.push('SigilForgeAgent');
    if (wantsAutomation) plannedAgents.push('AutomationAgent');
    if (wantsInsight) plannedAgents.push('InsightAgent');

    // Default fallback to referral + insight if nothing matched
    if (plannedAgents.length === 0) {
      plannedAgents.push('ReferralAgent', 'InsightAgent');
    }

    const steps: SwarmStepResult[] = [];
    let accumulatedXp = 0;
    let hasFailure = false;

    // 2. Execute Step Chain
    for (const agent of plannedAgents) {
      const stepStart = Date.now();
      try {
        switch (agent) {
          case 'BalanceAgent': {
            const res = await BalanceAgent.run(userId, 'manual: user_command');
            steps.push({
              agent,
              action: 'sync_balances',
              status: res.success ? 'success' : 'failed',
              durationMs: Date.now() - stepStart,
              output: res.balances,
              error: res.success ? undefined : res.message,
            });
            if (res.success) accumulatedXp += 50;
            break;
          }

          case 'EarningsAgent': {
            const res = await EarningsAgent.run(userId, 'manual: user_command');
            steps.push({
              agent,
              action: 'compute_earnings',
              status: res.success ? 'success' : 'failed',
              durationMs: Date.now() - stepStart,
              output: res.earnings,
              error: res.success ? undefined : res.message,
            });
            if (res.success) accumulatedXp += 50;
            break;
          }

          case 'ReferralAgent': {
            const res = await ReferralAgent.runDailySuggestion(userId, 'manual: user_command');
            steps.push({
              agent,
              action: 'generate_hook_and_script',
              status: res.success ? 'success' : 'failed',
              durationMs: Date.now() - stepStart,
              output: {
                suggestion: res.suggestion,
                script: res.script
              },
              error: res.success ? undefined : res.message,
            });
            if (res.success) accumulatedXp += 50;
            break;
          }

          case 'ViralSwarmAgent': {
            // Find script from previous step or generate one
            const referralStep = steps.find(s => s.agent === 'ReferralAgent');
            const scriptData = (referralStep?.output as any)?.script;
            const contentToPost = scriptData?.hook 
              ? `${scriptData.hook} - Access the sovereign vault at https://moneyplughub.com #moneyos`
              : "Plug In OS v5.0 is live: Self-hosted Creator Money OS with realtime Solfeggio 528Hz acoustic harmonics. #moneyos #passiveincome";

            const postResult = await this.relayToAutoposter(userId, contentToPost, 'MoneyPlugHub');
            steps.push({
              agent,
              action: 'dispatch_autopost',
              status: postResult.success ? 'success' : 'failed',
              durationMs: Date.now() - stepStart,
              output: postResult.data,
              error: postResult.error,
            });
            if (postResult.success) accumulatedXp += 50;
            break;
          }

          case 'SigilForgeAgent': {
            const user = db.prepare('SELECT xp, level, tier_title FROM users WHERE id = ?').get(userId) as any;
            const sigil = generateSigil(user?.tier_title || 'Novice Plug', {
              seed: userId,
              ringCount: Math.min(8, 2 + Math.floor((user?.level || 1) / 2)),
              primaryColor: '#10b981',
              accentColor: '#38bdf8',
            });
            steps.push({
              agent,
              action: 'synthesize_3d_medallion',
              status: 'success',
              durationMs: Date.now() - stepStart,
              output: {
                sigilSeed: userId,
                rings: sigil?.rings?.length || 4,
                frequencyHz: 528,
                rarity: (user?.level || 1) >= 5 ? 'Epic' : 'Rare'
              }
            });
            accumulatedXp += 50;
            break;
          }

          case 'AutomationAgent': {
            const tickRes = await AutomationAgent.onScheduleTick(userId, 'all');
            steps.push({
              agent,
              action: 'cron_tick',
              status: 'success',
              durationMs: Date.now() - stepStart,
              output: tickRes,
            });
            accumulatedXp += 25;
            break;
          }

          case 'InsightAgent': {
            const res = await InsightAgent.generateDailyInsight(userId, 'manual: user_command');
            steps.push({
              agent,
              action: 'synthesize_daily_briefing',
              status: res.success ? 'success' : 'failed',
              durationMs: Date.now() - stepStart,
              output: res.insight,
              error: res.success ? undefined : res.message,
            });
            if (res.success) accumulatedXp += 50;
            break;
          }
        }
      } catch (err: any) {
        console.error(`Swarm step failed for ${agent}:`, err);
        hasFailure = true;
        steps.push({
          agent,
          action: 'execution_exception',
          status: 'failed',
          durationMs: Date.now() - stepStart,
          output: null,
          error: err.message || 'Unknown agent execution error',
        });
      }
    }

    const totalLatency = Date.now() - startTime;
    const finalStatus: 'completed' | 'partial' | 'failed' = 
      hasFailure ? (steps.some(s => s.status === 'success') ? 'partial' : 'failed') : 'completed';

    // Award bonus XP if entire multi-agent swarm completed flawlessly
    if (finalStatus === 'completed' && steps.length >= 3) {
      accumulatedXp += 50; // Teamwork bonus!
    }

    // Award XP to user
    if (accumulatedXp > 0) {
      try {
        db.prepare('UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?').run(
          accumulatedXp,
          new Date().toISOString(),
          userId
        );
      } catch (e) {
        console.error('Failed to update XP for trace:', e);
      }
    }

    const trace: SwarmExecutionTrace = {
      id: traceId,
      userId,
      directive,
      plannedAgents,
      steps,
      totalLatencyMs: totalLatency,
      status: finalStatus,
      xpAwarded: accumulatedXp,
      createdAt: new Date().toISOString(),
    };

    // Durable SQLite ACID state preservation
    try {
      this.initSchema();
      db.prepare(`
        INSERT INTO agent_swarm_traces (id, user_id, directive, planned_agents, steps_json, total_latency_ms, status, xp_awarded, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        trace.id,
        trace.userId,
        trace.directive,
        JSON.stringify(trace.plannedAgents),
        JSON.stringify(trace.steps),
        trace.totalLatencyMs,
        trace.status,
        trace.xpAwarded,
        trace.createdAt
      );
    } catch (dbErr) {
      console.error('Failed to persist swarm trace:', dbErr);
    }

    return trace;
  }

  /**
   * Dispatches viral post to the decoupled autoposter microservice (port 3005) or local queue
   */
  private static async relayToAutoposter(
    userId: string,
    content: string,
    platform: string = 'MoneyPlugHub'
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const now = new Date().toISOString();
    const id = `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Always record into SQLite autoposter_queue for durability
    try {
      db.prepare(`
        INSERT INTO autoposter_queue (id, user_id, platform, content, media_url, scheduled_for, status, metrics_views, metrics_clicks, created_at)
        VALUES (?, ?, ?, ?, NULL, ?, 'queued', 0, 0, ?)
      `).run(id, userId, platform, content, now, now);
    } catch {}

    // 2. Relay via HTTP webhook to decoupled autoposter service (port 3005) if alive
    try {
      const payload = JSON.stringify({
        event: 'POST_SCHEDULED',
        data: { id, platform, content, userId, timestamp: now }
      });

      const options = {
        hostname: '127.0.0.1',
        port: 3005,
        path: '/api/primordia/autoposter/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 1500
      };

      await new Promise<void>((resolve) => {
        const req = http.request(options, (res) => {
          resolve();
        });
        req.on('error', () => resolve());
        req.on('timeout', () => {
          req.destroy();
          resolve();
        });
        req.write(payload);
        req.end();
      });

      return {
        success: true,
        data: { id, platform, content, status: 'dispatched_and_queued', timestamp: now }
      };
    } catch (relayErr: any) {
      return {
        success: true,
        data: { id, platform, content, status: 'queued_locally', timestamp: now }
      };
    }
  }

  /**
   * Fetch recent swarm traces for a user
   */
  public static getRecentTraces(userId: string, limit: number = 10): SwarmExecutionTrace[] {
    try {
      this.initSchema();
      const rows = db.prepare(`
        SELECT * FROM agent_swarm_traces 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `).all(userId, limit) as any[];

      return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        directive: r.directive,
        plannedAgents: JSON.parse(r.planned_agents || '[]'),
        steps: JSON.parse(r.steps_json || '[]'),
        totalLatencyMs: r.total_latency_ms,
        status: r.status,
        xpAwarded: r.xp_awarded,
        createdAt: r.created_at
      }));
    } catch (e) {
      return [];
    }
  }
}
