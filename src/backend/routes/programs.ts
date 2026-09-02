import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { CryptoReferralProgram } from '../../types';

const router = Router();

/**
 * List Referral Programs — exclusively returns the 10 verified partner programs with custom affiliate links
 */
router.get('/', (req: Request, res: Response) => {
  const programs = db.prepare(`
    SELECT * FROM crypto_referral_programs 
    WHERE status = 'active'
    ORDER BY name ASC
  `).all() as unknown as CryptoReferralProgram[];

  res.json({
    success: true,
    data: programs
  });
});

const updateProgramSchema = z.object({
  destination_url: z.string().url(),
  bonus_desc: z.string().optional(),
});

/**
 * Update Referral Program Destination URL (Customize personal affiliate link)
 */
router.patch('/:slug', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const slug = req.params.slug.trim().toLowerCase();
  const parsed = updateProgramSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { destination_url, bonus_desc } = parsed.data;

  db.prepare(`
    UPDATE crypto_referral_programs 
    SET destination_url = ?, bonus_desc = COALESCE(?, bonus_desc)
    WHERE slug = ?
  `).run(destination_url, bonus_desc || null, slug);

  res.json({
    success: true,
    message: `Updated routing URL for /go/${slug}!`
  });
});

export default router;
