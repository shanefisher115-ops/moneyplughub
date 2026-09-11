import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { Request } from 'express';
import { generateClientFingerprint } from '../../src/backend/middleware/referralAntiFraud';

describe('Referral Anti-Fraud Middleware - generateClientFingerprint', () => {
  it('should generate a valid SHA-256 hash using default headers (happy path)', () => {
    const mockReq = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Google Chrome";v="113"',
        'sec-ch-ua-platform': '"Windows"',
        'accept-encoding': 'gzip, deflate, br'
      },
      socket: { remoteAddress: '192.168.1.1' }
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(mockReq);

    // Verify it is a valid 64-character hex string (SHA-256)
    assert.strictEqual(fingerprint.length, 64);
    assert.match(fingerprint, /^[a-f0-9]{64}$/);

    // Verify it's deterministic and matches manual calculation
    const rawFingerprint = [
      'ip:192.168.1.1',
      'ua:Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'lang:en-US,en;q=0.9',
      'sec_ua:"Google Chrome";v="113"',
      'sec_platform:"Windows"',
      'encoding:gzip, deflate, br'
    ].join('|');
    const expectedHash = crypto.createHash('sha256').update(rawFingerprint).digest('hex');

    assert.strictEqual(fingerprint, expectedHash);
  });

  it('should prioritize explicit x-client-fingerprint header', () => {
    const explicitFp = 'my-explicit-device-id-123';
    const mockReq = {
      headers: {
        'x-client-fingerprint': explicitFp,
        'user-agent': 'Mozilla/5.0', // Should be ignored
        'accept-language': 'en-US' // Should be ignored
      },
      socket: { remoteAddress: '192.168.1.1' } // Should be ignored
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(mockReq);

    // The hash should be based purely on `explicit:${explicitFp}`
    const expectedHash = crypto.createHash('sha256').update(`explicit:${explicitFp}`).digest('hex');
    assert.strictEqual(fingerprint, expectedHash);
  });

  it('should trim explicit x-client-fingerprint header', () => {
    const mockReq = {
      headers: {
        'x-client-fingerprint': '  padded-id  '
      }
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(mockReq);
    const expectedHash = crypto.createHash('sha256').update('explicit:padded-id').digest('hex');
    assert.strictEqual(fingerprint, expectedHash);
  });

  it('should handle missing and empty headers safely', () => {
    // A request with almost no headers
    const mockReq = {
      headers: {},
      socket: {} // Missing remoteAddress
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(mockReq);

    // Manual calculation of fallback values
    const rawFingerprint = [
      'ip:127.0.0.1',
      'ua:',
      'lang:',
      'sec_ua:',
      'sec_platform:',
      'encoding:'
    ].join('|');
    const expectedHash = crypto.createHash('sha256').update(rawFingerprint).digest('hex');

    assert.strictEqual(fingerprint, expectedHash);
  });

  it('should handle undefined socket object safely', () => {
    const mockReq = {
      headers: {}
    } as unknown as Request; // socket is completely undefined

    const fingerprint = generateClientFingerprint(mockReq);

    const rawFingerprint = [
      'ip:127.0.0.1',
      'ua:',
      'lang:',
      'sec_ua:',
      'sec_platform:',
      'encoding:'
    ].join('|');
    const expectedHash = crypto.createHash('sha256').update(rawFingerprint).digest('hex');

    assert.strictEqual(fingerprint, expectedHash);
  });

  it('should generate deterministic hashes for the same inputs', () => {
    const mockReq = {
      headers: {
        'user-agent': 'Test UA',
        'accept-language': 'en'
      },
      socket: { remoteAddress: '10.0.0.1' }
    } as unknown as Request;

    const fingerprint1 = generateClientFingerprint(mockReq);
    const fingerprint2 = generateClientFingerprint(mockReq);

    assert.strictEqual(fingerprint1, fingerprint2);
  });

  it('should handle x-forwarded-for proxy headers correctly', () => {
    const mockReq = {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
        'user-agent': 'Test UA'
      },
      socket: { remoteAddress: '10.0.0.1' } // Should be ignored in favor of x-forwarded-for
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(mockReq);

    const rawFingerprint = [
      'ip:203.0.113.195',
      'ua:Test UA',
      'lang:',
      'sec_ua:',
      'sec_platform:',
      'encoding:'
    ].join('|');
    const expectedHash = crypto.createHash('sha256').update(rawFingerprint).digest('hex');

    assert.strictEqual(fingerprint, expectedHash);
  });
});

// Adding explicit exit as standalone test runners might hang
