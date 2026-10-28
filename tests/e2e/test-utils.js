/**
 * E2E Test Suite Utilities & Test Harness for Creator Money OS (MoneyPlugHub)
 * Location: tests/e2e/test-utils.ts
 */
import { db, runInTransaction } from '../../src/backend/db';
import { config } from '../../src/backend/config';
import jwt from 'jsonwebtoken';
export class TestSuite {
    results = [];
    currentTier = 'Tier 1';
    currentFeature = 'General';
    setTier(tier) {
        this.currentTier = tier;
    }
    setFeature(feature) {
        this.currentFeature = feature;
    }
    async test(name, fn) {
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
        }
        catch (err) {
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
    getSummary() {
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
export function createMockRequest(options = {}) {
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
    };
}
export function createMockResponse() {
    const result = {
        statusCode: 200,
        body: null,
        headers: {},
        cookies: {},
        redirectUrl: null,
    };
    const res = {
        status(code) {
            result.statusCode = code;
            return this;
        },
        json(data) {
            result.body = data;
            return this;
        },
        send(data) {
            result.body = data;
            return this;
        },
        set(headers, val) {
            if (typeof headers === 'string') {
                result.headers[headers.toLowerCase()] = val || '';
            }
            else {
                Object.entries(headers).forEach(([k, v]) => {
                    result.headers[k.toLowerCase()] = v;
                });
            }
            return this;
        },
        cookie(name, value, options) {
            result.cookies[name] = { value, options };
            return this;
        },
        redirect(url) {
            result.redirectUrl = url;
            return this;
        },
        writeHead(code, headers) {
            result.statusCode = code;
            if (headers) {
                Object.entries(headers).forEach(([k, v]) => {
                    result.headers[k.toLowerCase()] = String(v);
                });
            }
            return this;
        },
    };
    return { res, result };
}
/**
 * Generate authenticated JWT token for testing
 */
export function generateTestToken(user) {
    return jwt.sign({ userId: user.id, id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
}
/**
 * Creates isolated test user fixture
 */
export function createTestUserFixture(prefix = 'test_usr') {
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
export function cleanupTestUserFixture(userId) {
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
    }
    catch (e) { }
}
