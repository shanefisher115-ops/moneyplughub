import { SwarmNode, RealmStatus, VoiceIntentPayload, VoicePayoutPayload } from '../types';
import { VoiceOSEventBus } from '../eventBus';

export class LedgerRealm implements SwarmNode {
  public realm = 'LEDGER' as const;
  public id = 'realm_ledger_financial';
  public status: RealmStatus = 'IDLE';
  public metrics = { invocations: 0, avgLatencyMs: 0, errorRate: 0, lastActive: Date.now() };

  private bus: VoiceOSEventBus;
  private pendingPayouts = new Map<string, VoicePayoutPayload>();

  constructor(bus: VoiceOSEventBus) {
    this.bus = bus;
  }

  public async activate(): Promise<void> {
    this.status = 'ACTIVE';
    this.bus.on('VOICE_INTENT', async (payload: VoiceIntentPayload) => {
      if (payload.requiresLedger) {
        await this.handleFinancialIntent(payload);
      }
    });
    console.log('[LedgerRealm] 💰 Financial Context Engine & Sovereign Ledger Online.');
  }

  public async deactivate(): Promise<void> {
    this.status = 'STANDBY';
    console.log('[LedgerRealm] Standby state activated.');
  }

  public async handleFinancialIntent(intent: VoiceIntentPayload): Promise<void> {
    const start = Date.now();
    this.metrics.invocations++;
    this.metrics.lastActive = Date.now();

    try {
      const sessionId = intent.sessionId;
      const userId = intent.userId;

      if (intent.intent === 'REQUEST_PAYOUT') {
        const amount = intent.entities.amount || 50.00;
        const payoutId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const confirmationPhrase = `AUTHORIZE-PLUG-${Math.floor(100 + Math.random() * 900)}`;

        const payoutPayload: VoicePayoutPayload = {
          sessionId,
          userId,
          payoutId,
          amount,
          currency: intent.entities.currency || 'USD',
          destination: intent.entities.payoutMethod || 'STRIPE',
          status: 'PENDING_VOICE_CONFIRMATION',
          biometricVoiceToken: `vtoken_${Buffer.from(userId + payoutId).toString('hex').substring(0, 16)}`,
          confirmationPhrase,
          riskScore: 10,
          timestamp: Date.now()
        };

        this.pendingPayouts.set(userId, payoutPayload);
        this.bus.emit('VOICE_PAYOUT', payoutPayload);
      } else if (intent.intent === 'CONFIRM_PAYOUT') {
        const existing = this.pendingPayouts.get(userId);
        if (existing) {
          existing.status = 'CONFIRMED';
          existing.timestamp = Date.now();
          this.bus.emit('VOICE_PAYOUT', existing);
          this.pendingPayouts.delete(userId);
        }
      }

      this.metrics.avgLatencyMs = (this.metrics.avgLatencyMs * 0.9) + ((Date.now() - start) * 0.1);
    } catch (err) {
      this.metrics.errorRate += 0.01;
      console.error('[LedgerRealm] Financial operation error:', err);
    }
  }

  public getFinancialContext(userId: string) {
    return {
      userId,
      availableBalanceUsd: 1420.50,
      escrowLockedUsd: 250.00,
      kycTier: 'TIER_3_SOVEREIGN',
      riskScore: 8,
      commissionRateUsd: 10.00,
      referralMultiplier: 1.85,
      lifetimeEarningsUsd: 4890.00,
      recentTransactions: [
        { type: 'COMMISSION', amount: 50.00, date: '2026-08-27' },
        { type: 'PAYOUT', amount: 300.00, date: '2026-08-25' }
      ]
    };
  }
}
