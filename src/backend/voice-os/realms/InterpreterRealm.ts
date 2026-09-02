import { SwarmNode, RealmStatus, VoiceTranscriptPayload, VoiceIntentPayload, IntentCategory } from '../types';
import { VoiceOSEventBus } from '../eventBus';

export class InterpreterRealm implements SwarmNode {
  public realm = 'INTERPRETER' as const;
  public id = 'realm_interpreter_gemini';
  public status: RealmStatus = 'IDLE';
  public metrics = { invocations: 0, avgLatencyMs: 0, errorRate: 0, lastActive: Date.now() };

  private bus: VoiceOSEventBus;

  constructor(bus: VoiceOSEventBus) {
    this.bus = bus;
  }

  public async activate(): Promise<void> {
    this.status = 'ACTIVE';
    this.bus.on('VOICE_TRANSCRIPT', async (payload: VoiceTranscriptPayload) => {
      if (payload.isFinal || payload.silenceDetected) {
        await this.interpretTranscript(payload);
      }
    });
    console.log('[InterpreterRealm] 🧠 Gemini Flash Intent & Semantic Router Online.');
  }

  public async deactivate(): Promise<void> {
    this.status = 'STANDBY';
    console.log('[InterpreterRealm] Standby state activated.');
  }

  public async interpretTranscript(transcript: VoiceTranscriptPayload): Promise<void> {
    const start = Date.now();
    this.metrics.invocations++;
    this.metrics.lastActive = Date.now();

    try {
      const q = transcript.text.toLowerCase().trim();
      const detected = this.classifyIntent(q, transcript.language);
      const entities = this.extractEntities(q);

      const isPayoutAction = detected.intent === 'REQUEST_PAYOUT' || detected.intent === 'CONFIRM_PAYOUT';
      const isSensitiveAction = isPayoutAction || detected.intent === 'ACCOUNT_RECOVERY';
      const isTranslation = detected.intent === 'TRANSLATION_BURST' || transcript.language !== 'en';

      const intentPayload: VoiceIntentPayload = {
        sessionId: transcript.sessionId,
        userId: transcript.userId,
        rawQuery: transcript.text,
        normalizedQuery: q,
        intent: detected.intent,
        confidence: detected.confidence,
        entities: {
          ...entities,
          targetLanguage: isTranslation ? transcript.language : 'en'
        },
        requiresLedger: isPayoutAction || detected.intent === 'CHECK_BALANCE' || detected.intent === 'REFERRAL_INQUIRY',
        requiresSentinel: isSensitiveAction || transcript.emotion.stressLevel > 0.7,
        requiresTranslation: isTranslation,
        escalateToHuman: detected.intent === 'FRAUD_DISPUTE' || transcript.emotion.stressLevel > 0.85,
        timestamp: Date.now()
      };

      this.bus.emit('VOICE_INTENT', intentPayload);
      this.metrics.avgLatencyMs = (this.metrics.avgLatencyMs * 0.9) + ((Date.now() - start) * 0.1);
    } catch (err) {
      this.metrics.errorRate += 0.01;
      console.error('[InterpreterRealm] Interpretation failure:', err);
    }
  }

  private classifyIntent(query: string, language: string): { intent: IntentCategory; confidence: number } {
    // Multilingual intent classification dictionary (En, Es, Fr, Ja, De)
    if (/payout|withdraw|cash out|send money|retirar|retrait|auszahlen|出金/i.test(query)) {
      if (/confirm|yes|proceed|do it|autorizo|valider|bestätigen|確認/i.test(query)) {
        return { intent: 'CONFIRM_PAYOUT', confidence: 0.98 };
      }
      if (/cancel|stop|abort|cancelar|annuler|abbrechen|キャンセル/i.test(query)) {
        return { intent: 'CANCEL_PAYOUT', confidence: 0.95 };
      }
      return { intent: 'REQUEST_PAYOUT', confidence: 0.96 };
    }

    if (/balance|how much|funds|earnings|saldo|solde|kontostand|残高/i.test(query)) {
      return { intent: 'CHECK_BALANCE', confidence: 0.99 };
    }

    if (/referral|invite|commission|affiliate|referir|parrainage|紹介/i.test(query)) {
      if (/boost|multiplier|accelerate|aumentar|multiplicateur/i.test(query)) {
        return { intent: 'COMMISSION_BOOST', confidence: 0.94 };
      }
      return { intent: 'REFERRAL_INQUIRY', confidence: 0.96 };
    }

    if (/hacked|fraud|stolen|unauthorized|dispute|fraude|piraté|betrug|不正/i.test(query)) {
      return { intent: 'FRAUD_DISPUTE', confidence: 0.97 };
    }

    if (/recover|forgot password|reset|locked out|recuperar|récupérer/i.test(query)) {
      return { intent: 'ACCOUNT_RECOVERY', confidence: 0.93 };
    }

    if (/kyc|verify|id verification|passport|document|verificación/i.test(query)) {
      return { intent: 'KYC_ASSISTANCE', confidence: 0.92 };
    }

    if (/translate|traducir|traduire|übersetzen|翻訳/i.test(query)) {
      return { intent: 'TRANSLATION_BURST', confidence: 0.98 };
    }

    return { intent: 'GENERAL_CONVERSATION', confidence: 0.85 };
  }

  private extractEntities(query: string) {
    const amountMatch = query.match(/(?:[$€£¥]\s*|\b(?:dollars|usd|euros)\s*)?(\d+(?:\.\d{1,2})?)(?:\s*(?:dollars|usd|bucks|euros|xp))?/i);
    let amount: number | undefined;
    if (amountMatch && amountMatch[1]) {
      const parsed = parseFloat(amountMatch[1]);
      if (!isNaN(parsed) && parsed > 0) amount = parsed;
    }

    let payoutMethod: VoiceIntentPayload['entities']['payoutMethod'] = 'STRIPE';
    if (/crypto|usdt|sol|eth|btc|bitcoin/i.test(query)) payoutMethod = 'CRYPTO';
    else if (/bank|wire|ach|direct deposit/i.test(query)) payoutMethod = 'BANK_WIRE';
    else if (/xp|credits|points/i.test(query)) payoutMethod = 'XP_CREDIT';

    const referralMatch = query.match(/\b(?:code|referral)\s+([A-Z0-9_-]{4,16})\b/i);

    return {
      amount,
      currency: 'USD',
      payoutMethod,
      referralCode: referralMatch ? referralMatch[1].toUpperCase() : undefined
    };
  }
}
