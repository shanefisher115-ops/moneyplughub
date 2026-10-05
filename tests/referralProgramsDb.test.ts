import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db, seedAllReferralPrograms } from '../src/backend/db';

describe('Referral Programs DB Seeding', () => {
  it('safely cleans up unverified programs and seeds verified ones', () => {
    // Insert a dummy unverified program that should be cleaned up
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO crypto_referral_programs (
        id, name, slug, destination_url, bonus_desc, payout_type, payout_amount, notes,
        earnings_today_cents, earnings_month_cents, total_earnings_cents, total_clicks, status, tags, category, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'prog_dummy_unverified',
      'Unverified Dummy',
      'dummy_unverified_slug',
      'https://example.com',
      'Bonus',
      'Cash',
      '0.00',
      'Notes',
      0, 0, 0, 0,
      'active',
      'tag',
      'category',
      now, now
    );

    // Verify dummy program exists
    const dummyBefore = db.prepare('SELECT * FROM crypto_referral_programs WHERE slug = ?').get('dummy_unverified_slug');
    assert.ok(dummyBefore, 'Dummy program should exist before seed');

    // Run seedAllReferralPrograms
    seedAllReferralPrograms();

    // Verify dummy program was deleted
    const dummyAfter = db.prepare('SELECT * FROM crypto_referral_programs WHERE slug = ?').get('dummy_unverified_slug');
    assert.equal(dummyAfter, undefined, 'Unverified dummy program should have been deleted');

    // Verify verified program exists (e.g., rakuten)
    const rakuten = db.prepare('SELECT * FROM crypto_referral_programs WHERE slug = ?').get('rakuten');
    assert.ok(rakuten, 'Verified program rakuten should exist after seed');
  });
});
