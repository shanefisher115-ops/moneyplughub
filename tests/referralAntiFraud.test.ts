import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request } from 'express';
import crypto from 'crypto';
import { generateClientFingerprint } from '../src/backend/middleware/referralAntiFraud';

describe('generateClientFingerprint', () => {
  it('should generate a deterministic SHA-256 fingerprint for a given set of headers and IP', () => {
    const req = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Chromium";v="116", "Not)A;Brand";v="24"',
        'sec-ch-ua-platform': '"Windows"',
        'accept-encoding': 'gzip, deflate, br'
      },
      socket: { remoteAddress: '192.168.1.1' }
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(req);
    const expectedRaw = 'ip:192.168.1.1|ua:Mozilla/5.0 (Windows NT 10.0; Win64; x64)|lang:en-US,en;q=0.9|sec_ua:"Chromium";v="116", "Not)A;Brand";v="24"|sec_platform:"Windows"|encoding:gzip, deflate, br';
    const expectedHash = crypto.createHash('sha256').update(expectedRaw).digest('hex');

    assert.equal(fingerprint, expectedHash);
    assert.equal(fingerprint.length, 64);
  });

  it('should prioritize x-client-fingerprint header if present', () => {
    const explicitFp = 'explicit-frontend-fingerprint-12345';
    const req = {
      headers: {
        'x-client-fingerprint': explicitFp,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      socket: { remoteAddress: '192.168.1.1' }
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(req);
    const expectedHash = crypto.createHash('sha256').update(`explicit:${explicitFp}`).digest('hex');

    assert.equal(fingerprint, expectedHash);
  });

  it('should handle missing headers gracefully', () => {
    const req = {
      headers: {},
      socket: { remoteAddress: undefined }
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(req);
    const expectedRaw = 'ip:127.0.0.1|ua:|lang:|sec_ua:|sec_platform:|encoding:';
    const expectedHash = crypto.createHash('sha256').update(expectedRaw).digest('hex');

    assert.equal(fingerprint, expectedHash);
  });

  it('should produce different fingerprints for different IPs', () => {
    const req1 = {
      headers: { 'user-agent': 'test' },
      socket: { remoteAddress: '192.168.1.1' }
    } as unknown as Request;

    const req2 = {
      headers: { 'user-agent': 'test' },
      socket: { remoteAddress: '192.168.1.2' }
    } as unknown as Request;

    const fp1 = generateClientFingerprint(req1);
    const fp2 = generateClientFingerprint(req2);

    assert.notEqual(fp1, fp2);
  });

  it('should extract client IP from x-forwarded-for header', () => {
    const req = {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178'
      },
      socket: { remoteAddress: '192.168.1.1' }
    } as unknown as Request;

    const fingerprint = generateClientFingerprint(req);
    const expectedRaw = 'ip:203.0.113.195|ua:|lang:|sec_ua:|sec_platform:|encoding:';
    const expectedHash = crypto.createHash('sha256').update(expectedRaw).digest('hex');

    assert.equal(fingerprint, expectedHash);
  });
});
