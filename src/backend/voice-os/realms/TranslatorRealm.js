export class TranslatorRealm {
    realm = 'TRANSLATOR';
    id = 'realm_translator_gemini35';
    status = 'IDLE';
    metrics = { invocations: 0, avgLatencyMs: 0, errorRate: 0, lastActive: Date.now() };
    bus;
    activeBurstSessions = new Map();
    defaultBurstTimeoutSeconds = 45;
    constructor(bus) {
        this.bus = bus;
    }
    async activate() {
        this.status = 'ACTIVE';
        this.bus.on('VOICE_INTENT', async (payload) => {
            if (payload.requiresTranslation || payload.intent === 'TRANSLATION_BURST') {
                await this.handleTranslationRequest(payload);
            }
        });
        console.log('[TranslatorRealm] 🌐 Gemini 3.5 Burst-Mode Live Translate Node Online.');
    }
    async deactivate() {
        this.status = 'STANDBY';
        for (const [_, session] of this.activeBurstSessions.entries()) {
            if (session.timer)
                clearTimeout(session.timer);
        }
        this.activeBurstSessions.clear();
        console.log('[TranslatorRealm] Standby state activated.');
    }
    async handleTranslationRequest(intent) {
        const start = Date.now();
        this.metrics.invocations++;
        this.metrics.lastActive = Date.now();
        try {
            const sessionId = intent.sessionId;
            const targetLang = intent.entities.targetLanguage || 'en';
            const sourceLang = intent.entities.targetLanguage === 'en' ? 'es' : 'en';
            // 1. Maintain or refresh Burst Session
            this.refreshBurstSession(sessionId, targetLang);
            // 2. Execute translation
            const translatedText = await this.translateText(intent.rawQuery, sourceLang, targetLang);
            const session = this.activeBurstSessions.get(sessionId);
            const remaining = session ? Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)) : 0;
            const payload = {
                sessionId,
                userId: intent.userId,
                sourceText: intent.rawQuery,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                translatedText,
                burstSessionActive: true,
                autoCloseRemainingSeconds: remaining,
                timestamp: Date.now()
            };
            this.bus.emit('VOICE_TRANSLATION', payload);
            this.metrics.avgLatencyMs = (this.metrics.avgLatencyMs * 0.9) + ((Date.now() - start) * 0.1);
        }
        catch (err) {
            this.metrics.errorRate += 0.01;
            console.error('[TranslatorRealm] Translation burst error:', err);
        }
    }
    refreshBurstSession(sessionId, targetLang) {
        const existing = this.activeBurstSessions.get(sessionId);
        if (existing?.timer) {
            clearTimeout(existing.timer);
        }
        const expiresAt = Date.now() + (this.defaultBurstTimeoutSeconds * 1000);
        const timer = setTimeout(() => {
            this.closeBurstSession(sessionId);
        }, this.defaultBurstTimeoutSeconds * 1000);
        this.activeBurstSessions.set(sessionId, { targetLang, expiresAt, timer });
        this.status = 'BURST';
    }
    closeBurstSession(sessionId) {
        this.activeBurstSessions.delete(sessionId);
        if (this.activeBurstSessions.size === 0) {
            this.status = 'ACTIVE';
        }
        console.log(`[TranslatorRealm] ⏱️ Burst session auto-closed for session: ${sessionId}`);
    }
    async translateText(text, fromLang, toLang) {
        const dictionary = {
            'es': {
                'check balance': 'consultar saldo',
                'payout requested': 'retiro solicitado',
                'earnings boosted': 'ganancias aceleradas',
                'secure verification': 'verificación segura'
            },
            'fr': {
                'check balance': 'vérifier le solde',
                'payout requested': 'demande de retrait effectuée',
                'earnings boosted': 'gains accélérés'
            },
            'ja': {
                'check balance': '残高確認',
                'payout requested': '出金リクエスト完了',
                'earnings boosted': 'ブースト報酬適用'
            }
        };
        if (dictionary[toLang]?.[text.toLowerCase()]) {
            return dictionary[toLang][text.toLowerCase()];
        }
        return `[${toLang.toUpperCase()}] ${text}`;
    }
}
