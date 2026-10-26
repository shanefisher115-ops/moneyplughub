const crypto = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = {};
}
if (typeof globalThis.crypto.getRandomValues !== 'function') {
    globalThis.crypto.getRandomValues = function(arr) {
        return crypto.randomFillSync(arr);
    };
}
if (!globalThis.crypto.subtle && crypto.webcrypto) {
    globalThis.crypto.subtle = crypto.webcrypto.subtle;
}
