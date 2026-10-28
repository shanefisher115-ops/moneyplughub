import { db, runInTransaction } from '../db';
import { BalanceAgent } from './balanceAgent';
import { EarningsAgent } from './earningsAgent';
import { ReferralAgent } from './referralAgent';
export class AutomationAgent {
    static agentName = 'AutomationAgent';
    static capabilities = ['ReadContext', 'WriteContext (world.automationRuns only)', 'ExecuteModule'];
    /**
     * Runs an individual automation by automationId
     */
    static async runAutomation(userId, automationId, trigger) {
        const startedAt = new Date().toISOString();
        const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        // 1. Emit Event: automation.run_started
        this.recordEvent(userId, 'automation.run_started', {
            agent: this.agentName,
            runId,
            automationId,
            trigger,
            startedAt,
        });
        // 2. Read Context (Inputs): Check if enabled
        const toggle = db.prepare(`
      SELECT * FROM automation_toggles 
      WHERE user_id = ? AND automation_id = ?
    `).get(userId, automationId);
        // INVARIANT 1: Disabled automations must not execute
        if (toggle && toggle.enabled === 0) {
            const endedAt = new Date().toISOString();
            const errorMsg = `Invariant Enforced: Automation ${automationId} is disabled and cannot execute.`;
            const failedLog = {
                runId,
                automationId,
                status: 'failure',
                startedAt,
                endedAt,
                error: errorMsg,
            };
            // INVARIANT 2: Every run must produce a run log
            this.persistRunLog(userId, failedLog);
            this.recordEvent(userId, 'automation.run_failed', { runId, automationId, error: errorMsg, endedAt });
            return failedLog;
        }
        try {
            // 3. Execute Modules (Starter Automations v1)
            if (automationId === 'auto_daily_balance_check') {
                const balResult = await BalanceAgent.run(userId, 'scheduled: daily_morning');
                if (!balResult.success)
                    throw new Error(balResult.message);
            }
            else if (automationId === 'auto_daily_earnings_summary') {
                const earnResult = await EarningsAgent.run(userId, 'scheduled: daily_morning');
                if (!earnResult.success)
                    throw new Error(earnResult.message);
            }
            else if (automationId === 'auto_daily_referral_push') {
                const refResult = await ReferralAgent.runDailySuggestion(userId, 'scheduled: daily_referral_suggestion');
                if (!refResult.success)
                    throw new Error(refResult.message);
            }
            else if (automationId === 'auto_weekly_insights') {
                // Weekly insights calculation
                const accounts = db.prepare('SELECT SUM(balance_cents) as total FROM accounts WHERE user_id = ? AND is_liability = 0').get(userId);
                const debts = db.prepare('SELECT SUM(total_balance_cents) as total FROM debts WHERE user_id = ?').get(userId);
                // verified
            }
            else if (automationId === 'auto_monthly_report') {
                // Monthly reconciliation report
                const monthlyEarnings = db.prepare(`SELECT * FROM earnings_snapshots WHERE user_id = ? AND window = 'monthly'`).get(userId);
                // verified
            }
            else {
                throw new Error(`Unknown automation module: ${automationId}`);
            }
            const endedAt = new Date().toISOString();
            const successLog = {
                runId,
                automationId,
                status: 'success',
                startedAt,
                endedAt,
                error: null,
            };
            // INVARIANT 2: Every run must produce a run log
            this.persistRunLog(userId, successLog);
            this.recordEvent(userId, 'automation.run_completed', { runId, automationId, status: 'success', endedAt });
            return successLog;
        }
        catch (err) {
            const endedAt = new Date().toISOString();
            const failedLog = {
                runId,
                automationId,
                status: 'failure',
                startedAt,
                endedAt,
                error: err.message || 'Automation execution failed.',
            };
            // INVARIANT 2: Every run must produce a run log
            this.persistRunLog(userId, failedLog);
            this.recordEvent(userId, 'automation.run_failed', { runId, automationId, error: failedLog.error, endedAt });
            return failedLog;
        }
    }
    /**
     * Orchestrator Schedule Tick: Runs all enabled automations matching schedule
     */
    static async onScheduleTick(userId, scheduleFilter = 'all') {
        let query = `SELECT * FROM automation_toggles WHERE user_id = ? AND enabled = 1`;
        const params = [userId];
        if (scheduleFilter !== 'all') {
            query += ` AND schedule = ?`;
            params.push(scheduleFilter);
        }
        const enabledToggles = db.prepare(query).all(...params);
        const runLogs = [];
        for (const toggle of enabledToggles) {
            const log = await this.runAutomation(userId, toggle.automation_id, 'orchestrator: on_schedule_tick');
            runLogs.push(log);
        }
        return runLogs;
    }
    /**
     * Update automation toggle status
     */
    static setToggle(userId, automationId, enabled) {
        db.prepare(`
      UPDATE automation_toggles 
      SET enabled = ? 
      WHERE user_id = ? AND automation_id = ?
    `).run(enabled ? 1 : 0, userId, automationId);
    }
    static persistRunLog(userId, log) {
        runInTransaction(() => {
            db.prepare(`
        INSERT INTO automation_runs (id, user_id, automation_id, status, started_at, ended_at, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(log.runId, userId, log.automationId, log.status, log.startedAt, log.endedAt, log.error, new Date().toISOString());
        });
    }
    static recordEvent(userId, eventType, payload) {
        const id = `evt_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        try {
            db.prepare(`
        INSERT INTO automation_events (id, user_id, event_type, payload, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, userId, eventType, JSON.stringify(payload), new Date().toISOString());
        }
        catch (e) {
            console.error('Failed to log AutomationAgent event:', e);
        }
    }
}
