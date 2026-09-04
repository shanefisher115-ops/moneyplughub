import { db } from '../db';
import { config } from '../config';
import {
  notifyCommissionEarned,
  notifyRankPromotion,
} from '../services/webhookService';

export interface UserRankState {
  level: number;
  tier_title: string;
}

/**
 * Compute Level and Tier from XP
 */
export function computeLevelAndTier(xp: number): { level: number; tier_title: string } {
  if (xp >= 10000) return { level: 10, tier_title: 'Cosmic Money Plug' };
  if (xp >= 5000) return { level: 6, tier_title: 'Diamond Stacker' };
  if (xp >= 2500) return { level: 5, tier_title: 'Grand Money Plug' };
  if (xp >= 1200) return { level: 4, tier_title: 'Wealth Builder' };
  if (xp >= 600) return { level: 3, tier_title: 'Crypto Stacker' };
  if (xp >= 250) return { level: 2, tier_title: 'Budget Apprentice' };
  return { level: 1, tier_title: 'Novice Plug' };
}

/**
 * Fetch creator's specific webhook configuration overrides if present
 */
export function getUserWebhookOverride(userId: string) {
  try {
    const settings = db.prepare(`
      SELECT discord_url, telegram_bot_token, telegram_chat_id, notify_commissions, notify_rank_promotions
      FROM user_webhook_settings
      WHERE user_id = ?
    `).get(userId) as any;

    return {
      discordUrl: settings?.discord_url || config.webhooks.discordUrl,
      telegramBotToken: settings?.telegram_bot_token || config.webhooks.telegramBotToken,
      telegramChatId: settings?.telegram_chat_id || config.webhooks.telegramChatId,
      notifyCommissions: settings ? Boolean(settings.notify_commissions) : true,
      notifyRankPromotions: settings ? Boolean(settings.notify_rank_promotions) : true,
    };
  } catch {
    return {
      discordUrl: config.webhooks.discordUrl,
      telegramBotToken: config.webhooks.telegramBotToken,
      telegramChatId: config.webhooks.telegramChatId,
      notifyCommissions: true,
      notifyRankPromotions: true,
    };
  }
}

/**
 * Trigger commission notification for a creator
 */
export async function triggerCommissionWebhook(params: {
  userId: string;
  amountCents: number;
  referredName?: string;
  notes?: string;
  commissionId?: string;
  currency?: string;
}) {
  try {
    const user = db.prepare('SELECT display_name, email FROM users WHERE id = ?').get(params.userId) as any;
    if (!user) return;

    const webhookSettings = getUserWebhookOverride(params.userId);
    if (!webhookSettings.notifyCommissions) return;

    await notifyCommissionEarned(
      {
        creatorName: user.display_name || 'Creator',
        creatorEmail: user.email,
        amountCents: params.amountCents,
        currency: params.currency || 'USD',
        referredName: params.referredName,
        notes: params.notes,
        commissionId: params.commissionId,
      },
      webhookSettings
    );
  } catch (err) {
    console.error('[WebhookDispatcher] Error sending commission webhook:', err);
  }
}

/**
 * Check if XP update results in level or tier title promotion, and dispatch rank promotion webhook
 */
export async function checkAndNotifyRankPromotion(params: {
  userId: string;
  oldLevel: number;
  oldTierTitle?: string;
  newXp: number;
}): Promise<{ level: number; tier_title: string; promoted: boolean }> {
  const computed = computeLevelAndTier(params.newXp);

  const isPromoted = computed.level > params.oldLevel ||
    (params.oldTierTitle && computed.tier_title !== params.oldTierTitle);

  if (isPromoted) {
    try {
      const user = db.prepare('SELECT display_name, email FROM users WHERE id = ?').get(params.userId) as any;
      if (user) {
        const webhookSettings = getUserWebhookOverride(params.userId);
        if (webhookSettings.notifyRankPromotions) {
          await notifyRankPromotion(
            {
              creatorName: user.display_name || 'Creator',
              creatorEmail: user.email,
              oldLevel: params.oldLevel,
              newLevel: computed.level,
              oldTier: params.oldTierTitle,
              newTier: computed.tier_title,
              totalXp: params.newXp,
            },
            webhookSettings
          );
        }
      }
    } catch (err) {
      console.error('[WebhookDispatcher] Error sending rank promotion webhook:', err);
    }
  }

  return {
    level: computed.level,
    tier_title: computed.tier_title,
    promoted: Boolean(isPromoted),
  };
}
