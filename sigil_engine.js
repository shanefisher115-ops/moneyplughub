const crypto = require('crypto');

class SigilEngine {
    constructor(salt = 'PRIMORDIA_COSMIC_SALT_2026') {
        this.salt = salt;
    }

    /**
     * Generates a unique, deterministic cryptographic sigil for a user identifier.
     */
    generateSigil(userIdentifier) {
        const hash = crypto
            .createHmac('sha256', this.salt)
            .update(userIdentifier)
            .digest('hex');
        
        // Format into a clean, stylized cosmic sigil token
        return `SIGIL-${hash.substring(0, 8).toUpperCase()}-${hash.substring(8, 16).toUpperCase()}`;
    }

    /**
     * Embeds the user's personal referral sigil into any outgoing deployment payload or URL.
     */
    injectReferralPayload(payload, userIdentifier) {
        const sigil = this.generateSigil(userIdentifier);
        return {
            ...payload,
            metadata: {
                ...(payload.metadata || {}),
                referralSigil: sigil,
                injectedAt: new Date().toISOString()
            },
            referralUrl: `https://moneyplughub.io/ref/${sigil}`
        };
    }
}

module.exports = new SigilEngine();
console.log('🔮 [SigilEngine] Cryptographic referral module online.');
