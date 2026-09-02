/**
 * E2E Test Suite Utilities & Test Harness for Creator Money OS (MoneyPlugHub)
 * Location: tests/e2e/test-utils.ts
 */

import { Request, Response } from 'express';
import { db, runInTransaction, initDb } from '../../src/backend/db';
import { config } from '../../src/backend/config';
import jwt from 'jsonwebtoken';

export interface TestResult {
  name: string;
  tier: string;
  feature?: string;
  passed: boolean;
  durationMs: number;
  error?: Error | string;
}

export type TestCase = () => Promise<void> | void;

export class TestSuite {
  public results: TestResult[] = [];
  public currentTier: string = 'Tier 1';
  public currentFeature: string = 'General';

  public setTier(tier: string) {
    this.currentTier = tier;
  }

  public setFeature(feature: string) {
    this.currentFeature = feature;
  }

  public async test(name: string, fn: TestCase): Promise<boolean> {
    const start = performance.now();
    try {
      await fn();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      this.results.push({
        name,
        tier: this.currentTier,
        feature: this.currentFeature,
        passed: true,
        durationMs,
      });
      return true;
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      this.results.push({
        name,
        tier: this.currentTier,
        feature: this.currentFeature,
        passed: false,
        durationMs,
        error: err,
      });
      return false;
    }
  }

  public getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const totalDurationMs = Math.round(this.results.reduce((acc, r) => acc + r.durationMs, 0) * 100) / 100;
    return { total, passed, failed, totalDurationMs };
  }
}

/**
 * Mock Request & Response helpers for Express route handler testing
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  params?: Record<string, string>;
  query?: Record<string, string | any>;
  body?: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  user?: any;
} = {}): Request {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    path: options.url || '/',
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
    socket: { remoteAddress: '127.0.0.1' },
    user: options.user,
  } as unknown as Request;
}

export interface MockResponseResult {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  cookies: Record<string, { value: string; options: any }>;
  redirectUrl: string | null;
}

export function createMockResponse(): { res: Response; result: MockResponseResult } {
  const result: MockResponseResult = {
    statusCode: 200,
    body: null,
    headers: {},
    cookies: {},
    redirectUrl: null,
  };

  const res = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    json(data: any) {
      result.body = data;
      return this;
    },
    send(data: any) {
      result.body = data;
      return this;
    },
    set(headers: Record<string, string> | string, val?: string) {
      if (typeof headers === 'string') {
        result.headers[headers.toLowerCase()] = val || '';
      } else {
        Object.entries(headers).forEach(([k, v]) => {
          result.headers[k.toLowerCase()] = v;
        });
      }
      return this;
    },
    cookie(name: string, value: string, options: any) {
      result.cookies[name] = { value, options };
      return this;
    },
    redirect(url: string) {
      result.redirectUrl = url;
      return this;
    },
    writeHead(code: number, headers: Record<string, any>) {
      result.statusCode = code;
      if (headers) {
        Object.entries(headers).forEach(([k, v]) => {
          result.headers[k.toLowerCase()] = String(v);
        });
      }
      return this;
    },
  } as unknown as Response;

  return { res, result };
}

/**
 * Generate authenticated JWT token for testing
 */
export function generateTestToken(user: { id: string; email: string; role: 'user' | 'admin' }) {
  return jwt.sign(
    { userId: user.id, id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

/**
 * Creates isolated test user fixture
 */
export function createTestUserFixture(prefix: string = 'test_usr') {
  const uniqueId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const email = `${uniqueId}@test.moneyplughub.local`;
  const referralCode = `PLUG-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, ?, 'testhash123', 'Test Creator', 'user', ?, NULL, 0, 500, 1, 1, 'Novice Plug', ?, ?)
    `).run(uniqueId, email, referralCode, now, now);
  });

  return {
    id: uniqueId,
    email,
    referralCode,
    token: generateTestToken({ id: uniqueId, email, role: 'user' }),
  };
}

/**
 * Cleans up test user fixture and dependent records
 */
export function cleanupTestUserFixture(userId: string) {
  try {
    runInTransaction(() => {
      db.prepare('DELETE FROM referral_clicks WHERE referrer_user_id = ?').run(userId);
      db.prepare('DELETE FROM commission_ledger WHERE referrer_user_id = ? OR referred_user_id = ?').run(userId, userId);
      db.prepare('DELETE FROM subscriptions WHERE user_id = ? OR userId = ?').run(userId, userId);
      db.prepare('DELETE FROM user_sigil_config WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM user_sigil_inventory WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM xp_conversions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM accounts WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });
  } catch (e) {}
}
