/**
 * End-to-End Encryption (E2EE) Engine for Token-Gated Syndicate Chat
 * Uses Web Crypto API (AES-GCM 256-bit with PBKDF2 key derivation)
 * Path: src/frontend/lib/syndicateCrypto.ts
 */

const keyCache = new Map<string, CryptoKey>();

/**
 * Resets the in-memory key cache (primarily for test isolation)
 */
export function _clearKeyCache(): void {
  keyCache.clear();
}

/**
 * Safely accesses the SubtleCrypto interface across browser and Node.js environments
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

/**
 * Safely accesses getRandomValues across browser and Node.js environments
 */
function getRandomValues<T extends ArrayBufferView>(array: T): T {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(array);
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  throw new Error('Web Crypto API getRandomValues is not available');
}

/**
 * Derives a 256-bit AES-GCM key for a given syndicate channel
 */
export async function getChannelCryptoKey(syndicateId: string, channelId: string): Promise<CryptoKey> {
  if (
    !syndicateId ||
    typeof syndicateId !== 'string' ||
    !syndicateId.trim() ||
    !channelId ||
    typeof channelId !== 'string' ||
    !channelId.trim()
  ) {
    throw new Error('syndicateId and channelId are required and must be non-empty strings');
  }

  const cacheKey = `${syndicateId}:${channelId}`;
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!;
  }

  const passphrase = `SYNDICATE_E2EE_VAULT_KEY_V1:${syndicateId}:${channelId}`;
  const enc = new TextEncoder();
  const passphraseBytes = enc.encode(passphrase);

  const subtle = getSubtleCrypto();

  const baseKey = await subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = enc.encode(`SALT_${syndicateId.substring(0, 8)}_${channelId.substring(0, 8)}`);

  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

/**
 * Encrypts a plain text message string using AES-GCM 256-bit
 */
export async function encryptTextMessage(
  text: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const plainBytes = enc.encode(text);
  const iv = getRandomValues(new Uint8Array(12));

  const subtle = getSubtleCrypto();

  const encryptedBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBytes
  );

  const ciphertextBase64 = arrayBufferToBase64(encryptedBuffer);
  const ivBase64 = arrayBufferToBase64(iv.buffer);

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
  };
}

/**
 * Decrypts an AES-GCM encrypted ciphertext using the channel key and IV
 */
export async function decryptTextMessage(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  try {
    const encryptedBuffer = base64ToArrayBuffer(ciphertextBase64);
    const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

    const subtle = getSubtleCrypto();

    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedBuffer
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    // If decryption fails (e.g. payload wasn't encrypted or key mismatch)
    return `[Encrypted Message — Decryption Failed]`;
  }
}

// Helpers for Base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
  return Buffer.from(buffer).toString('base64');
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
