import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getChannelCryptoKey,
  encryptTextMessage,
  decryptTextMessage,
  _clearKeyCache
} from '../src/frontend/lib/syndicateCrypto';

describe('syndicateCrypto - E2EE Engine & Key Derivation', () => {
  beforeEach(() => {
    _clearKeyCache();
  });

  describe('getChannelCryptoKey - Input Validation for Empty/Invalid IDs', () => {
    it('should throw an error when syndicateId is an empty string', async () => {
      await assert.rejects(
        async () => {
          await getChannelCryptoKey('', 'chan_alpha');
        },
        {
          name: 'Error',
          message: 'syndicateId and channelId are required and must be non-empty strings',
        }
      );
    });

    it('should throw an error when channelId is an empty string', async () => {
      await assert.rejects(
        async () => {
          await getChannelCryptoKey('syn_vortex', '');
        },
        {
          name: 'Error',
          message: 'syndicateId and channelId are required and must be non-empty strings',
        }
      );
    });

    it('should throw an error when both syndicateId and channelId are empty strings', async () => {
      await assert.rejects(
        async () => {
          await getChannelCryptoKey('', '');
        },
        {
          name: 'Error',
          message: 'syndicateId and channelId are required and must be non-empty strings',
        }
      );
    });

    it('should throw an error when syndicateId is whitespace only', async () => {
      await assert.rejects(
        async () => {
          await getChannelCryptoKey('   ', 'chan_alpha');
        },
        {
          name: 'Error',
          message: 'syndicateId and channelId are required and must be non-empty strings',
        }
      );
    });

    it('should throw an error when channelId is whitespace only', async () => {
      await assert.rejects(
        async () => {
          await getChannelCryptoKey('syn_vortex', '   ');
        },
        {
          name: 'Error',
          message: 'syndicateId and channelId are required and must be non-empty strings',
        }
      );
    });

    it('should throw an error when inputs are null or undefined casted as string', async () => {
      await assert.rejects(
        async () => {
          await getChannelCryptoKey(null as unknown as string, 'chan_alpha');
        },
        {
          name: 'Error',
          message: 'syndicateId and channelId are required and must be non-empty strings',
        }
      );

      await assert.rejects(
        async () => {
          await getChannelCryptoKey('syn_vortex', undefined as unknown as string);
        },
        {
          name: 'Error',
          message: 'syndicateId and channelId are required and must be non-empty strings',
        }
      );
    });
  });

  describe('getChannelCryptoKey - Key Derivation & Caching', () => {
    it('should derive a valid AES-GCM CryptoKey for valid IDs', async () => {
      const key = await getChannelCryptoKey('syn_vortex', 'chan_main');
      assert.ok(key, 'Key should be defined');
      assert.equal(key.algorithm.name, 'AES-GCM');
      assert.equal((key.algorithm as any).length, 256);
      assert.equal(key.type, 'secret');
      assert.equal(key.extractable, false);
    });

    it('should return the exact cached key on repeated invocations', async () => {
      const key1 = await getChannelCryptoKey('syn_vortex', 'chan_main');
      const key2 = await getChannelCryptoKey('syn_vortex', 'chan_main');
      assert.strictEqual(key1, key2, 'Repeated calls should return identical cached key instance');
    });

    it('should derive different key instances for different syndicates or channels', async () => {
      const keyA = await getChannelCryptoKey('syn_alpha', 'chan_1');
      const keyB = await getChannelCryptoKey('syn_beta', 'chan_1');
      const keyC = await getChannelCryptoKey('syn_alpha', 'chan_2');

      assert.notStrictEqual(keyA, keyB);
      assert.notStrictEqual(keyA, keyC);
    });
  });

  describe('encryptTextMessage & decryptTextMessage', () => {
    it('should successfully encrypt and decrypt text messages', async () => {
      const key = await getChannelCryptoKey('syn_vortex', 'chan_main');
      const plainText = '🔥 Top Secret Syndicate Alpha Intelligence Payload!';

      const { ciphertext, iv } = await encryptTextMessage(plainText, key);

      assert.ok(ciphertext, 'Ciphertext should be generated');
      assert.ok(iv, 'IV should be generated');
      assert.notEqual(ciphertext, plainText);

      const decrypted = await decryptTextMessage(ciphertext, iv, key);
      assert.equal(decrypted, plainText);
    });

    it('should return fallback message when decrypting with wrong key or tampered ciphertext', async () => {
      const key1 = await getChannelCryptoKey('syn_vortex', 'chan_main');
      const key2 = await getChannelCryptoKey('syn_apex', 'chan_main');

      const plainText = 'Confidential message';
      const { ciphertext, iv } = await encryptTextMessage(plainText, key1);

      // Decrypt with key2 (mismatched key)
      const decryptedMismatch = await decryptTextMessage(ciphertext, iv, key2);
      assert.equal(decryptedMismatch, '[Encrypted Message — Decryption Failed]');

      // Decrypt tampered ciphertext with key1
      const tamperedCiphertext = ciphertext.substring(0, ciphertext.length - 4) + 'AAAA';
      const decryptedTampered = await decryptTextMessage(tamperedCiphertext, iv, key1);
      assert.equal(decryptedTampered, '[Encrypted Message — Decryption Failed]');
    });
  });
});
