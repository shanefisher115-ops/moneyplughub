import { SwarmNode, RealmStatus, VoiceIntentPayload, VoiceTranscriptPayload, VoiceFraudPayload, FraudRiskFactor } from '../types';
import { VoiceOSEventBus } from '../eventBus';

export class SentinelRealm implements SwarmNode {
  public realm = 'SENTINEL' as const;
  public id = 'realm_sentinel_risk';
  public status: RealmStatus = 'IDLE';
  public metrics = { invocations: 0, avgLatencyMs: 0, errorRate: 0, lastActive: Date.now() };

  private bus: VoiceOSEventBus;
  private recentSessionScores = new Map<string, number>();

  constructor(bus: VoiceOSEventBus) {
    this.bus = bus;
  }

  public async activate(): Promise<void> {
    this.status = 'ACTIVE';
    this.bus.on('VOICE_INTENT', async (payload: VoiceIntentPayload) => {
      await this.evaluateRisk(payload);
    });
    console.log('[SentinelRealm] 🛡️ Autonomous Risk & Deepfake Sentinel Node Online.');
  }

  public async deactivate(): Promise<void> {
    this.status = 'STANDBY';
    console.log('[SentinelRealm] Standby state activated.');
  }

  public async evaluateRisk(intent: VoiceIntentPayload): Promise<void> {
    const start = Date.now();
    this.metrics.invocations++;
    this.metrics.lastActive = Date.now();

    try {
      const flags: FraudRiskFactor[] = [];
      let calculatedScore = 5; // Baseline pristine score

      const q = intent.normalizedQuery;

      // 1. Social Engineering & Urgency Heuristics
      if (/urgent|emergency|right now|immediately|urgente|tout de suite|sofort/i.test(q)) {
        flags.push({
          code: 'SE_URGENCY_STRESS',
          severity: 'MEDIUM',
          description: 'High artificial urgency detected in request query',
          scoreImpact: 20
        });
        calculatedScore += 20;
      }

      // 2. Security Bypass Attempts
      if (/bypass|override|disable 2fa|skip verification|no code|desactivar/i.test(q)) {
        flags.push({
          code: 'SEC_BYPASS_ATTEMPT',
          severity: 'HIGH',
          description: 'Explicit request to circumvent 2FA or KYC checks',
          scoreImpact: 45
        });
        calculatedScore += 45;
      }

      // 3. High-Value Payout Spike
      if (intent.entities.amount && intent.entities.amount > 500) {
        flags.push({
          code: 'LARGE_PAYOUT_REQUEST',
          severity: 'LOW',
          description: 'Payout amount exceeds  threshold, requiring heightened voice telemetry',
          scoreImpact: 15
        });
        calculatedScore += 15;
      }

      // 4. Voice Stress / Anomaly Analysis (Heuristic Simulation)
      const syntheticVoiceProbability = (intent.rawQuery.length % 7 === 0) ? 0.05 : 0.01;
      const voiceStressDetected = calculatedScore > 35;

      // 5. Account Takeover Risk Level
      let atoRisk: VoiceFraudPayload['accountTakeoverRisk'] = 'NONE';
      if (calculatedScore >= 75) atoRisk = 'DEFINITIVE';
      else if (calculatedScore >= 50) atoRisk = 'PROBABLE';
      else if (calculatedScore >= 25) atoRisk = 'POSSIBLE';

      // 6. Action Resolution
      let action: VoiceFraudPayload['action'] = 'ALLOW';
      if (calculatedScore >= 80) action = 'LOCK_SESSION';
      else if (calculatedScore >= 55) action = 'FREEZE_PAYOUT';
      else if (calculatedScore >= 30) action = 'STEP_UP_2FA';

      const payload: VoiceFraudPayload = {
        sessionId: intent.sessionId,
        userId: intent.userId,
        riskScore: Math.min(100, calculatedScore),
        isAnomaly: calculatedScore > 40,
        syntheticVoiceProbability,
        voiceStressDetected,
        flags,
        accountTakeoverRisk: atoRisk,
        action,
        timestamp: Date.now()
      };

      this.recentSessionScores.set(intent.sessionId, payload.riskScore);
      this.bus.emit('VOICE_FRAUD', payload);

      this.metrics.avgLatencyMs = (this.metrics.avgLatencyMs * 0.9) + ((Date.now() - start) * 0.1);
    } catch (err) {
      this.metrics.errorRate += 0.01;
      console.error('[SentinelRealm] Risk assessment error:', err);
    }
  }
}
