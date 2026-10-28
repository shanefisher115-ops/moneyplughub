import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';
import { InsightAgent } from '../agents/insightAgent';
const router = Router();
/**
 * Generate Daily Insight (manual: user_command)
 */
router.post('/generate', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { date } = req.body;
    const result = await InsightAgent.generateDailyInsight(userId, 'manual: user_command', date);
    if (result.success) {
        // Award +50 XP for daily insight review habit
        db.prepare('UPDATE users SET xp = xp + 50, updated_at = ? WHERE id = ?').run(new Date().toISOString(), userId);
    }
    res.json({
        success: result.success,
        data: result.insight,
        event: result.event,
        message: result.message,
        reward_xp: result.success ? 50 : 0,
    });
});
/**
 * Get Canonical Daily Insights (context.world.insights)
 */
router.get('/daily', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const rows = db.prepare(`
    SELECT 
      id as insightId,
      date,
      summary,
      suggestions_json,
      timestamp
    FROM daily_insights 
    WHERE user_id = ? 
    ORDER BY date DESC 
    LIMIT 15
  `).all(userId);
    const insights = rows.map(r => ({
        insightId: r.insightId,
        date: r.date,
        summary: r.summary,
        suggestions: JSON.parse(r.suggestions_json || '[]'),
        timestamp: r.timestamp,
    }));
    res.json({
        success: true,
        data: insights,
    });
});
/**
 * Get Insight Agent Events Stream
 */
router.get('/events', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const events = db.prepare(`
    SELECT * FROM insight_events 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 25
  `).all(userId);
    res.json({
        success: true,
        data: events,
    });
});
export default router;
