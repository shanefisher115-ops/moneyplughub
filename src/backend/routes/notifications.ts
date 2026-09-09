import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendCreatorNotification,
  getNotificationLogs,
} from '../services/notificationEngine';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/notifications/settings
 * Retrieve creator's webhook notification settings
 */
router.get('/settings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = getNotificationSettings(userId);
    res.json({
      success: true,
      data: settings,
    });
  } catch (err: any) {
    console.error('[Notification Settings GET Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch notification settings' });
  }
});

/**
 * POST /api/notifications/settings
 * Update creator's webhook notification settings
 */
router.post('/settings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      discord_webhook_url,
      telegram_webhook_url,
      telegram_bot_token,
      telegram_chat_id,
      notify_commissions,
      notify_quests,
      notify_tier_levelups,
      is_active,
    } = req.body;

    const updated = updateNotificationSettings(userId, {
      discord_webhook_url,
      telegram_webhook_url,
      telegram_bot_token,
      telegram_chat_id,
      notify_commissions,
      notify_quests,
      notify_tier_levelups,
      is_active,
    });

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: updated,
    });
  } catch (err: any) {
    console.error('[Notification Settings POST Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to update notification settings' });
  }
});

/**
 * POST /api/notifications/test
 * Send a live test alert to Discord and/or Telegram
 */
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { channel } = req.body; // 'discord' | 'telegram' | 'both'

    const result = await sendCreatorNotification(userId, {
      type: 'test',
      title: '🔔 MoneyPlug Webhook Test Alert',
      message: 'This is a real-time notification engine verification alert sent from MoneyPlugHub.',
      channel_override: channel || 'both',
    });

    res.json({
      success: result.success,
      data: result,
      message: result.success
        ? `Test notification dispatched successfully via ${result.channel}!`
        : `Notification delivery attempted. Details: ${result.error_details || 'No webhooks configured or delivery failed.'}`,
    });
  } catch (err: any) {
    console.error('[Notification Test POST Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to dispatch test notification' });
  }
});

/**
 * GET /api/notifications/logs
 * Retrieve recent delivery history and status logs
 */
router.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Number(req.query.limit) || 20;
    const logs = getNotificationLogs(userId, limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (err: any) {
    console.error('[Notification Logs GET Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch notification logs' });
  }
});

export default router;
