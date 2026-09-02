import { SwarmNode, RealmStatus, VoiceIntentPayload, VoicePayoutPayload, VoiceFraudPayload, VoiceTranslationPayload, VoiceOutputPayload } from '../types';
import { VoiceOSEventBus } from '../eventBus';

export class HeraldRealm implements SwarmNode {
  public realm = 'HERALD' as const;
  public id = 'realm_herald_tts';
  public status: RealmStatus = 'IDLE';
  public metrics = { invocations: 0, avgLatencyMs: 0, errorRate: 0, lastActive: Date.now() };

  private bus: VoiceOSEventBus;

  constructor(bus: VoiceOSEventBus) {
    this.bus = bus;
  }

  public async activate(): Promise<void> {
    this.status = 'ACTIVE';

    this.bus.on('VOICE_INTENT', async (payload: VoiceIntentPayload) => {
      await this.synthesizeIntentResponse(payload);
    });

    this.bus.on('VOICE_PAYOUT', async (payload: VoicePayoutPayload) => {
      await this.synthesizePayoutResponse(payload);
    });

    this.bus.on('VOICE_FRAUD', async (payload: VoiceFraudPayload) => {
      if (payload.action !== 'ALLOW') {
        await this.synthesizeFraudWarning(payload);
      }
    });

    console.log('[HeraldRealm] 🗣️ Multilingual Cinematic TTS & Voice Herald Online.');
  }

  public async deactivate(): Promise<void> {
    this.status = 'STANDBY';
    console.log('[HeraldRealm] Standby state activated.');
  }

  private async synthesizeIntentResponse(intent: VoiceIntentPayload): Promise<void> {
    const start = Date.now();
    this.metrics.invocations++;
    this.metrics.lastActive = Date.now();

    let text = '';
    let persona = 'Adam • Architect';
    let targetTone: VoiceOutputPayload['targetTone'] = 'AUTHORITATIVE';

    switch (intent.intent) {
      case 'CHECK_BALANCE':
        text = 'Your current available sovereign balance is $1,420.50 USD, with $250.00 locked in high-yield compounding escrow.';
        persona = 'Adam • Architect';
        targetTone = 'AUTHORITATIVE';
        break;
      case 'REFERRAL_INQUIRY':
        text = 'You have generated 48 qualified peer activations under code FOUNDER-PLUG, driving a 1.85x daily cash cascade.';
        persona = 'Antoni • Optimizer';
        targetTone = 'OPTIMISTIC';
        break;
      case 'COMMISSION_BOOST':
        text = 'Velocity multiplier engaged. Your direct referral yield is accelerated to $18.50 per qualified signup today.';
        persona = 'Josh • Motivator';
        targetTone = 'OPTIMISTIC';
        break;
      case 'KYC_ASSISTANCE':
        text = 'Your identity verification is recorded at Tier 3 Sovereign on the Osmium ledger. Instant withdrawals are enabled.';
        persona = 'Lyra • Sentinel';
        targetTone = 'CALM';
        break;
      case 'GENERAL_CONVERSATION':
        text = 'MoneyPlugHub Voice OS standing by. State your directive: balance audit, referral yield, or payout release.';
        persona = 'Aurelius • Sovereign';
        targetTone = 'MYTHIC';
        break;
      default:
        return;
    }

    const payload: VoiceOutputPayload = {
      sessionId: intent.sessionId,
      userId: intent.userId,
      text,
      language: intent.entities.targetLanguage || 'en',
      persona,
      targetTone,
      durationSeconds: 3.2,
      timestamp: Date.now()
    };

    this.bus.emit('VOICE_OUTPUT', payload);
    this.metrics.avgLatencyMs = (this.metrics.avgLatencyMs * 0.9) + ((Date.now() - start) * 0.1);
  }

  private async synthesizePayoutResponse(payout: VoicePayoutPayload): Promise<void> {
    let text = '';
    if (payout.status === 'PENDING_VOICE_CONFIRMATION') {
      text = `Payout request initiated for $${payout.amount.toFixed(2)} ${payout.currency} via ${payout.destination}. Please speak the confirmation phrase: ${payout.confirmationPhrase} to execute.`;
    } else if (payout.status === 'CONFIRMED') {
      text = `Voice biometrics verified. Payout ${payout.payoutId} for $${payout.amount.toFixed(2)} is now broadcasting to the payment network.`;
    }

    const payload: VoiceOutputPayload = {
      sessionId: payout.sessionId,
      userId: payout.userId,
      text,
      language: 'en',
      persona: 'Lyra • Sentinel',
      targetTone: 'AUTHORITATIVE',
      durationSeconds: 4.1,
      timestamp: Date.now()
    };

    this.bus.emit('VOICE_OUTPUT', payload);
  }

  private async synthesizeFraudWarning(fraud: VoiceFraudPayload): Promise<void> {
    const text = `Security alert. High risk score of ${fraud.riskScore} detected. Action required: ${fraud.action.replace(/_/g, ' ')}. Escalating to Sentinel chamber.`;
    const payload: VoiceOutputPayload = {
      sessionId: fraud.sessionId,
      userId: fraud.userId,
      text,
      language: 'en',
      persona: 'Lyra • Sentinel',
      targetTone: 'VIGILANT',
      durationSeconds: 3.8,
      timestamp: Date.now()
    };

    this.bus.emit('VOICE_OUTPUT', payload);
  }
}
