import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Run against a throwaway database only:
//   DB_PATH=<temp file> npx tsx --test tests/creatorQuestVerification.test.ts
if (!process.env.DB_PATH) {
  throw new Error('Set DB_PATH to a temporary database file before running this test.');
}

describe('Creator quest verification', () => {
  let db: typeof import('../src/backend/db').db;
  let verifyQuestCompletion: typeof import('../src/backend/routes/gamification').verifyQuestCompletion;
  const userId = `quest_test_${Date.now()}`;
  const now = new Date().toISOString();

  before(async () => {
    const dbModule = await import('../src/backend/db');
    db = dbModule.db;
    dbModule.initDb();
    // These route modules create viral_squad_members and referral_clicks on load
    await import('../src/backend/routes/viral');
    await import('../src/backend/routes/referrals');
    ({ verifyQuestCompletion } = await import('../src/backend/routes/gamification'));

    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, ?, 'x', 'Quest Tester', 'user', ?, NULL, 0, 0, 1, 0, 'Novice Plug', ?, ?)
    `).run(userId, `${userId}@test.moneyplughub.local`, `PLUG-${userId}`, now, now);
  });

  it('seeds the three creator quests', () => {
    const ids = (db.prepare('SELECT id FROM tasks WHERE is_active = 1').all() as { id: string }[]).map(t => t.id);
    for (const id of ['task_viral_hook_post', 'task_squad_coop', 'task_sigil_flex']) {
      assert.ok(ids.includes(id), `${id} should be seeded`);
    }
  });

  it('blocks task_viral_hook_post until a script is queued', () => {
    assert.equal(verifyQuestCompletion(userId, 'task_viral_hook_post').verified, false);

    db.prepare(`
      INSERT INTO content_queue (id, user_id, video_idea, script, hook, status, created_at)
      VALUES (?, ?, 'Idea only', 'Script', 'Hook', 'Idea', ?)
    `).run(`cq_idea_${userId}`, userId, now);
    assert.equal(verifyQuestCompletion(userId, 'task_viral_hook_post').verified, false, 'an Idea row is not enough');

    db.prepare(`
      INSERT INTO content_queue (id, user_id, video_idea, script, hook, status, created_at)
      VALUES (?, ?, 'Scripted idea', 'Script', 'Hook', 'Scripted', ?)
    `).run(`cq_scripted_${userId}`, userId, now);
    assert.equal(verifyQuestCompletion(userId, 'task_viral_hook_post').verified, true);
  });

  it('blocks task_squad_coop until the user is in a squad', () => {
    assert.equal(verifyQuestCompletion(userId, 'task_squad_coop').verified, false);

    const squadId = `squad_${userId}`;
    db.prepare(`
      INSERT INTO viral_squads (id, leader_user_id, squad_name, squad_code, created_at)
      VALUES (?, ?, 'Test Squad', ?, ?)
    `).run(squadId, userId, `SQ-${userId}`, now);
    db.prepare(`
      INSERT INTO viral_squad_members (squad_id, user_id, role, joined_at) VALUES (?, ?, 'leader', ?)
    `).run(squadId, userId, now);
    assert.equal(verifyQuestCompletion(userId, 'task_squad_coop').verified, true);
  });

  it('blocks task_sigil_flex until a referral click is tracked', () => {
    assert.equal(verifyQuestCompletion(userId, 'task_sigil_flex').verified, false);

    db.prepare(`
      INSERT INTO referral_clicks (id, referral_code, referrer_user_id, created_at) VALUES (?, ?, ?, ?)
    `).run(`click_${userId}`, `PLUG-${userId}`, userId, now);
    assert.equal(verifyQuestCompletion(userId, 'task_sigil_flex').verified, true);
  });

  it('blocks quests that have no verification rule', () => {
    const result = verifyQuestCompletion(userId, 'task_does_not_exist');
    assert.equal(result.verified, false);
    assert.ok(result.reason.length > 0);
  });
});
