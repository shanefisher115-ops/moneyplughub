const sigilEngine = require('./sigil_engine');

class SigilKernelGuard {
    /**
     * Validates that an incoming task payload carries a cryptographically valid sigil.
     */
    validateTask(task) {
        if (!task || !task.metadata || !task.metadata.referralSigil) {
            return { valid: false, reason: 'Missing cryptographic sigil signature.' };
        }

        const receivedSigil = task.metadata.referralSigil;
        const userIdentifier = task.user || 'ShaneFisher_Core';
        
        // Re-generate expected sigil for validation
        const expectedSigil = sigilEngine.generateSigil(userIdentifier);

        if (receivedSigil !== expectedSigil) {
            return { valid: false, reason: 'Cryptographic sigil signature mismatch (Unauthorized).' };
        }

        return { valid: true, user: userIdentifier, sigil: receivedSigil };
    }

    /**
     * Middleware wrapper for Express API queue
     */
    middleware() {
        return (req, res, next) => {
            const validation = this.validateTask(req.body);
            if (!validation.valid) {
                console.warn(`🚨 [Kernel Security] Rejected unauthorized task: ${validation.reason}`);
                return res.status(403).json({
                    success: false,
                    error: 'Access Denied by PrimordiaOS Kernel Guard',
                    reason: validation.reason
                });
            }

            console.log(`🛡️ [Kernel Security] Sigil verified successfully for user: ${validation.user} [${validation.sigil}]`);
            next();
        };
    }
}

module.exports = new SigilKernelGuard();
console.log('🔮 [SigilKernelGuard] Cryptographic execution security online.');
