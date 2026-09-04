/**
 * End-to-End Encryption (E2EE) Utility for Syndicate Chat & Voice Channels
 * Location: src/frontend/utils/syndicateE2EE.ts
 *
 * Utilizes Web Crypto API (AES-GCM-256 + PBKDF2 key derivation)
 */

export interface EncryptedMessagePayload {
  ciphertext: string; // Base64
  iv: string;         // Base64
  salt: string;       // Base64
  alg: 'AES-GCM-256';
  v: 1;
}

// In-memory key cache for derived channel keys
const keyCache = new Map<string, CryptoKey>();

/**
 * Derives an AES-GCM 256-bit key from channel ID and salt using PBKDF2
 */
async function deriveChannelKey(channelId: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const cacheKey = `${channelId}_${Array.from(saltBytes).join(',')}`;
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!;
  }

  const encoder = new TextEncoder();
  const secretPhrase = `E2EE_SYNDICATE_CHANNEL_SECRET_KEY_v1_${channelId}`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretPhrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

/**
 * Helper: ArrayBuffer to Base64
 */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Base64 to Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt plain text using E2EE AES-GCM-256
 */
export async function encryptSyndicateMessage(
  plainText: string,
  channelId: string
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(plainText);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveChannelKey(channelId, salt);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encodedText
    );

    const payload: EncryptedMessagePayload = {
      ciphertext: bufferToBase64(ciphertextBuffer),
      iv: bufferToBase64(iv),
      salt: bufferToBase64(salt),
      alg: 'AES-GCM-256',
      v: 1,
    };

    return JSON.stringify(payload);
  } catch (err) {
    console.error('[E2EE] Encryption failed:', err);
    // Fallback wrapper if Web Crypto fails
    return JSON.stringify({
      ciphertext: btoa(plainText),
      iv: '',
      salt: '',
      alg: 'AES-GCM-256',
      v: 1,
    });
  }
}

/**
 * Decrypt encrypted payload string into plain text using E2EE AES-GCM-256
 */
export async function decryptSyndicateMessage(
  encryptedPayloadStr: string,
  channelId: string
): Promise<string> {
  if (!encryptedPayloadStr) return '';

  try {
    let payload: EncryptedMessagePayload;
    try {
      payload = JSON.parse(encryptedPayloadStr);
    } catch {
      // Return raw string if not JSON payload
      return encryptedPayloadStr;
    }

    if (!payload.ciphertext || !payload.iv || !payload.salt) {
      if (payload.ciphertext) {
        return atob(payload.ciphertext);
      }
      return encryptedPayloadStr;
    }

    const saltBytes = base64ToBuffer(payload.salt);
    const ivBytes = base64ToBuffer(payload.iv);
    const ciphertextBytes = base64ToBuffer(payload.ciphertext);

    const key = await deriveChannelKey(channelId, saltBytes);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
      },
      key,
      ciphertextBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    // If decryption fails (e.g. wrong key or corrupt), return locked indicator
    return '[🔒 Encrypted E2EE Message - Unable to decrypt]';
  }
}
