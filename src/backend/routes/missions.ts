import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

/**
 * Transparent mission catalog built from active affiliate programs.
 * Clicks never award cash or XP; completion must be verified separately.
 */
router.get('/', (_req: AuthenticatedRequest, res: Response) => {
  const programs = db.prepare(`
    SELECT name, slug, bonus_desc, payout_type, payout_amount, tags, category
    FROM crypto_referral_programs
    WHERE status = 'active'
    ORDER BY name COLLATE NOCASE ASC
  `).all() as any[];

  res.json({
    success: true,
    data: programs.map((program) => ({
      id: `mission_${program.slug}`,
      slug: program.slug,
      title: `${program.name} Discovery Mission`,
      description: `Review the ${program.name} requirements and decide whether this opportunity is right for you.`,
      requirements: program.bonus_desc,
      payout_type: program.payout_type,
      payout_amount: program.payout_amount,
      tags: String(program.tags || '').split(',').map((tag: string) => tag.trim()).filter(Boolean),
      category: program.category,
      reward_xp: 25,
      reward_cents: 0,
      status: 'available',
      disclosure: 'Affiliate relationship may exist. Program terms, eligibility, and approval rules apply.',
    })),
  });
});

/** Start a mission and return the existing auditable smart-link route. */
router.post('/:slug/start', (req: AuthenticatedRequest, res: Response) => {
  const slug = req.params.slug.trim().toLowerCase();
  const program = db.prepare(`
    SELECT name, slug
    FROM crypto_referral_programs
    WHERE slug = ? COLLATE NOCASE AND status = 'active'
  `).get(slug) as { name: string; slug: string } | undefined;

  if (!program) {
    res.status(404).json({ success: false, error: 'Mission not found or unavailable.' });
    return;
  }

  res.json({
    success: true,
    data: {
      mission_id: `mission_${program.slug}`,
      program: program.name,
      status: 'started',
      tracking_url: `/go/${program.slug}?src=app&campaign=mission_${encodeURIComponent(program.slug)}`,
      reward_policy: 'Clicks alone are not rewarded. XP or cash requires independently verified, eligible completion.',
    },
  });
});

export default router;
