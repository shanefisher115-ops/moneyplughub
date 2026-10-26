const sigilEngine = require('./sigil_engine');

function attachSigilMiddleware(req, res, next) {
    if (req.body && req.body.action) {
        // Extract or default to the workspace owner identifier
        const userIdentifier = req.body.user || 'ShaneFisher_Core';
        
        // Cryptographically sign and attach referral data
        req.body = sigilEngine.injectReferralPayload(req.body, userIdentifier);
        
        console.log(`🔐 [Sigil Auth] Task signed with referral sigil: ${req.body.metadata.referralSigil}`);
    }
    if (typeof next === 'function') next();
}

module.exports = attachSigilMiddleware;
