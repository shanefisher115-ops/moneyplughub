import { Router, Response } from 'express';
import { db, recordAuditLog } from '../db';
import { config } from '../config';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  notifyCommissionEarned,
  notifyRankPromotion,
} from '../services/webhookService';

const router = Router();

// Ensure user_webhook_settings table exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_webhook_settings (
      user_id TEXT PRIMARY KEY,
      discord_url TEXT NOT NULL DEFAULT '',
      telegram_bot_token TEXT NOT NULL DEFAULT '',
      telegram_chat_id TEXT NOT NULL DEFAULT '',
      notify_commissions INTEGER NOT NULL DEFAULT 1,
      notify_rank_promotions INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
} catch (e: any) {
  console.error('[Webhooks Table Init Warning]:', e.message);
}

/**
 * GET /api/webhooks/settings
 * Fetch user-specific or global fallback webhook settings
 */
router.get('/settings', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = db.prepare(`
      SELECT * FROM user_webhook_settings WHERE user_id = ?
    `).get(userId) as any;

    res.json({
      success: true,
      data: {
        discordUrl: settings?.discord_url || config.webhooks.discordUrl,
        telegramBotToken: settings?.telegram_bot_token || config.webhooks.telegramBotToken,
        telegramChatId: settings?.telegram_chat_id || config.webhooks.telegramChatId,
        notifyCommissions: settings ? Boolean(settings.notify_commissions) : true,
        notifyRankPromotions: settings ? Boolean(settings.notify_rank_promotions) : true,
        hasGlobalDiscord: Boolean(config.webhooks.discordUrl),
        hasGlobalTelegram: Boolean(config.webhooks.telegramBotToken && config.webhooks.telegramChatId),
      },
    });
  } catch (err: any) {
    console.error('Error fetching webhook settings:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch webhook settings.' });
  }
});

/**
 * POST /api/webhooks/settings
 * Save user webhook URLs & notification preferences
 */
router.post('/settings', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      discordUrl = '',
      telegramBotToken = '',
      telegramChatId = '',
      notifyCommissions = true,
      notifyRankPromotions = true,
    } = req.body;

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_webhook_settings (
        user_id, discord_url, telegram_bot_token, telegram_chat_id,
        notify_commissions, notify_rank_promotions, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        discord_url = excluded.discord_url,
        telegram_bot_token = excluded.telegram_bot_token,
        telegram_chat_id = excluded.telegram_chat_id,
        notify_commissions = excluded.notify_commissions,
        notify_rank_promotions = excluded.notify_rank_promotions,
        updated_at = excluded.updated_at
    `).run(
      userId,
      discordUrl.trim(),
      telegramBotToken.trim(),
      telegramChatId.trim(),
      notifyCommissions ? 1 : 0,
      notifyRankPromotions ? 1 : 0,
      now
    );

    recordAuditLog(userId, 'WEBHOOK_SETTINGS_UPDATED', 'user_webhook_settings', userId, {
      discordUrlConfigured: Boolean(discordUrl.trim()),
      telegramConfigured: Boolean(telegramBotToken.trim() && telegramChatId.trim()),
      notifyCommissions,
      notifyRankPromotions,
    });

    res.json({
      success: true,
      message: 'Webhook settings updated successfully.',
      data: {
        discordUrl: discordUrl.trim(),
        telegramBotToken: telegramBotToken.trim(),
        telegramChatId: telegramChatId.trim(),
        notifyCommissions,
        notifyRankPromotions,
      },
    });
  } catch (err: any) {
    console.error('Error saving webhook settings:', err);
    res.status(500).json({ success: false, error: 'Failed to save webhook settings.' });
  }
});

/**
 * POST /api/webhooks/test
 * Dispatch test notification to Discord / Telegram
 */
router.post('/test', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      type = 'commission',
      discordUrl,
      telegramBotToken,
      telegramChatId,
    } = req.body;

    const override = {
      discordUrl: discordUrl || config.webhooks.discordUrl,
      telegramBotToken: telegramBotToken || config.webhooks.telegramBotToken,
      telegramChatId: telegramChatId || config.webhooks.telegramChatId,
    };

    let result = { discord: false, telegram: false };

    if (type === 'rank_promotion' || type === 'promotion') {
      result = await notifyRankPromotion(
        {
          creatorName: user.display_name,
          creatorEmail: user.email,
          oldLevel: Math.max(1, user.level - 1),
          newLevel: user.level,
          oldTier: 'Novice Plug',
          newTier: user.tier_title || 'Wealth Builder',
          totalXp: user.xp,
        },
        override
      );
    } else {
      result = await notifyCommissionEarned(
        {
          creatorName: user.display_name,
          creatorEmail: user.email,
          amountCents: 1000,
          currency: 'USD',
          referredName: 'Alex Test (Test Creator)',
          notes: 'Test real-time commission notification dispatch',
          commissionId: `comm_test_${Date.now()}`,
        },
        override
      );
    }

    res.json({
      success: true,
      message: 'Test notification processed.',
      data: {
        dispatchedType: type,
        discordDispatched: result.discord,
        telegramDispatched: result.telegram,
      },
    });
  } catch (err: any) {
    console.error('Error dispatching test webhook:', err);
    res.status(500).json({ success: false, error: 'Failed to dispatch test notification.' });
  }
});

export default router;
