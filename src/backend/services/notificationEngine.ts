import { db } from '../db';

export interface CreatorNotificationSettings {
  user_id: string;
  discord_webhook_url: string;
  telegram_webhook_url: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  notify_commissions: boolean;
  notify_quests: boolean;
  notify_tier_levelups: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type NotificationEventType = 'commission' | 'quest' | 'tier_levelup' | 'test';

export interface NotificationEventPayload {
  type: NotificationEventType;
  title?: string;
  message?: string;
  amount_cents?: number;
  commission_status?: string;
  referred_user_name?: string;
  program_name?: string;
  quest_title?: string;
  reward_xp?: number;
  reward_cents?: number;
  old_level?: number;
  new_level?: number;
  old_tier_title?: string;
  new_tier_title?: string;
  total_xp?: number;
  channel_override?: 'discord' | 'telegram' | 'both';
}

export interface NotificationDispatchResult {
  success: boolean;
  channel: 'discord' | 'telegram' | 'both' | 'none';
  discord_sent: boolean;
  telegram_sent: boolean;
  error_details?: string;
}

/**
 * Get or initialize notification settings for a creator
 */
export function getNotificationSettings(userId: string): CreatorNotificationSettings {
  const row = db.prepare(`
    SELECT * FROM creator_notification_settings WHERE user_id = ?
  `).get(userId) as any;

  if (row) {
    return {
      user_id: row.user_id,
      discord_webhook_url: row.discord_webhook_url || '',
      telegram_webhook_url: row.telegram_webhook_url || '',
      telegram_bot_token: row.telegram_bot_token || '',
      telegram_chat_id: row.telegram_chat_id || '',
      notify_commissions: Boolean(row.notify_commissions),
      notify_quests: Boolean(row.notify_quests),
      notify_tier_levelups: Boolean(row.notify_tier_levelups),
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // Default record
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO creator_notification_settings (
      user_id, discord_webhook_url, telegram_webhook_url, telegram_bot_token, telegram_chat_id,
      notify_commissions, notify_quests, notify_tier_levelups, is_active, created_at, updated_at
    ) VALUES (?, '', '', '', '', 1, 1, 1, 1, ?, ?)
  `).run(userId, now, now);

  return {
    user_id: userId,
    discord_webhook_url: '',
    telegram_webhook_url: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
    notify_commissions: true,
    notify_quests: true,
    notify_tier_levelups: true,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update creator notification settings
 */
export function updateNotificationSettings(
  userId: string,
  settings: Partial<CreatorNotificationSettings>
): CreatorNotificationSettings {
  const current = getNotificationSettings(userId);
  const now = new Date().toISOString();

  const updated: CreatorNotificationSettings = {
    user_id: userId,
    discord_webhook_url: settings.discord_webhook_url !== undefined ? settings.discord_webhook_url.trim() : current.discord_webhook_url,
    telegram_webhook_url: settings.telegram_webhook_url !== undefined ? settings.telegram_webhook_url.trim() : current.telegram_webhook_url,
    telegram_bot_token: settings.telegram_bot_token !== undefined ? settings.telegram_bot_token.trim() : current.telegram_bot_token,
    telegram_chat_id: settings.telegram_chat_id !== undefined ? settings.telegram_chat_id.trim() : current.telegram_chat_id,
    notify_commissions: settings.notify_commissions !== undefined ? Boolean(settings.notify_commissions) : current.notify_commissions,
    notify_quests: settings.notify_quests !== undefined ? Boolean(settings.notify_quests) : current.notify_quests,
    notify_tier_levelups: settings.notify_tier_levelups !== undefined ? Boolean(settings.notify_tier_levelups) : current.notify_tier_levelups,
    is_active: settings.is_active !== undefined ? Boolean(settings.is_active) : current.is_active,
    created_at: current.created_at,
    updated_at: now,
  };

  db.prepare(`
    INSERT OR REPLACE INTO creator_notification_settings (
      user_id, discord_webhook_url, telegram_webhook_url, telegram_bot_token, telegram_chat_id,
      notify_commissions, notify_quests, notify_tier_levelups, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    updated.user_id,
    updated.discord_webhook_url,
    updated.telegram_webhook_url,
    updated.telegram_bot_token,
    updated.telegram_chat_id,
    updated.notify_commissions ? 1 : 0,
    updated.notify_quests ? 1 : 0,
    updated.notify_tier_levelups ? 1 : 0,
    updated.is_active ? 1 : 0,
    updated.created_at,
    updated.updated_at
  );

  return updated;
}

/**
 * Format Discord Webhook Rich Embed
 */
function buildDiscordEmbed(payload: NotificationEventPayload) {
  const timestamp = new Date().toISOString();

  switch (payload.type) {
    case 'commission': {
      const amountStr = payload.amount_cents !== undefined ? `$${(payload.amount_cents / 100).toFixed(2)} USD` : 'Commission';
      const statusStr = payload.commission_status ? payload.commission_status.toUpperCase() : 'PENDING';
      return {
        username: 'MoneyPlug Real-Time Alerts',
        avatar_url: 'https://moneyplughub.local/favicon.ico',
        embeds: [
          {
            title: `💰 Real-Time Commission Alert: ${amountStr}`,
            description: `Congratulations! A new affiliate commission has been recorded on your MoneyPlugHub ledger.`,
            color: 0x22c55e, // Green
            fields: [
              { name: '💵 Amount', value: amountStr, inline: true },
              { name: '⚡ Status', value: `\`${statusStr}\``, inline: true },
              { name: '👤 Referred Lead', value: payload.referred_user_name || 'Anonymous User', inline: true },
              { name: '📌 Program / Offer', value: payload.program_name || 'Referral Network', inline: true },
            ],
            footer: {
              text: 'MoneyPlugHub Webhook Notification Engine v5.0',
            },
            timestamp,
          },
        ],
      };
    }

    case 'quest': {
      const rewardStr = `$${((payload.reward_cents || 0) / 100).toFixed(2)}`;
      return {
        username: 'MoneyPlug Real-Time Alerts',
        avatar_url: 'https://moneyplughub.local/favicon.ico',
        embeds: [
          {
            title: `🎯 Quest Completed & Unlocked: ${payload.quest_title || 'Creator Quest'}`,
            description: `You completed a creator quest task and claimed your rewards!`,
            color: 0xa855f7, // Purple
            fields: [
              { name: '⚔️ Quest Name', value: payload.quest_title || 'Creator Task', inline: false },
              { name: '✨ XP Earned', value: `+${payload.reward_xp || 0} XP`, inline: true },
              { name: '💵 Cash Bonus', value: rewardStr, inline: true },
            ],
            footer: {
              text: 'MoneyPlugHub Webhook Notification Engine v5.0',
            },
            timestamp,
          },
        ],
      };
    }

    case 'tier_levelup': {
      return {
        username: 'MoneyPlug Real-Time Alerts',
        avatar_url: 'https://moneyplughub.local/favicon.ico',
        embeds: [
          {
            title: `🚀 LEVEL UP! Ascended to Level ${payload.new_level || 1}: ${payload.new_tier_title || 'Sovereign Plug'}`,
            description: `🔥 Real-time Ascension Alert! You have unlocked a new Creator Wealth Tier.`,
            color: 0xf59e0b, // Gold
            fields: [
              { name: '🏆 Previous Tier', value: `Lv. ${payload.old_level || 1} (${payload.old_tier_title || 'Novice'})`, inline: true },
              { name: '🌟 New Tier', value: `**Lv. ${payload.new_level || 1} (${payload.new_tier_title || 'Sovereign'})**`, inline: true },
              { name: '⚡ Total XP', value: `${payload.total_xp || 0} XP`, inline: true },
            ],
            footer: {
              text: 'MoneyPlugHub Webhook Notification Engine v5.0',
            },
            timestamp,
          },
        ],
      };
    }

    case 'test':
    default: {
      return {
        username: 'MoneyPlug Real-Time Alerts',
        avatar_url: 'https://moneyplughub.local/favicon.ico',
        embeds: [
          {
            title: `🔔 Webhook Connection Verified!`,
            description: payload.message || `Your Discord webhook notification pipeline is active and verified working in real time.`,
            color: 0x3b82f6, // Blue
            fields: [
              { name: '⚡ Status', value: '`ONLINE & HEALTHY`', inline: true },
              { name: '📡 Connection Test', value: '`100% Delivery Success`', inline: true },
            ],
            footer: {
              text: 'MoneyPlugHub Webhook Notification Engine v5.0',
            },
            timestamp,
          },
        ],
      };
    }
  }
}

/**
 * Format Telegram HTML Message Payload
 */
function buildTelegramPayload(payload: NotificationEventPayload, chatId: string) {
  let text = '';

  switch (payload.type) {
    case 'commission': {
      const amountStr = payload.amount_cents !== undefined ? `$${(payload.amount_cents / 100).toFixed(2)} USD` : 'Commission';
      const statusStr = payload.commission_status ? payload.commission_status.toUpperCase() : 'PENDING';
      text = `<b>💰 Real-Time Commission Alert!</b>\n\n` +
             `<b>💵 Amount:</b> ${amountStr}\n` +
             `<b>⚡ Status:</b> <code>${statusStr}</code>\n` +
             `<b>👤 Lead:</b> ${payload.referred_user_name || 'Anonymous Creator'}\n` +
             `<b>📌 Program:</b> ${payload.program_name || 'MoneyPlugHub Referral'}\n\n` +
             `<i>MoneyPlugHub Creator Engine v5.0</i>`;
      break;
    }

    case 'quest': {
      const rewardStr = `$${((payload.reward_cents || 0) / 100).toFixed(2)}`;
      text = `<b>🎯 Quest Completed & Rewards Claimed!</b>\n\n` +
             `<b>⚔️ Task:</b> ${payload.quest_title || 'Creator Quest'}\n` +
             `<b>✨ XP Reward:</b> +${payload.reward_xp || 0} XP\n` +
             `<b>💵 Cash Bonus:</b> ${rewardStr}\n\n` +
             `<i>MoneyPlugHub Creator Engine v5.0</i>`;
      break;
    }

    case 'tier_levelup': {
      text = `<b>🚀 LEVEL UP! ASCENSION UNLOCKED!</b>\n\n` +
             `<b>🌟 New Level:</b> Level ${payload.new_level || 1} — <b>${payload.new_tier_title || 'Sovereign'}</b>\n` +
             `<b>🏆 Prior Rank:</b> Level ${payload.old_level || 1} (${payload.old_tier_title || 'Novice'})\n` +
             `<b>⚡ Total XP:</b> ${payload.total_xp || 0} XP\n\n` +
             `<i>MoneyPlugHub Creator Engine v5.0</i>`;
      break;
    }

    case 'test':
    default: {
      text = `<b>🔔 Telegram Webhook Verified!</b>\n\n` +
             `${payload.message || 'Your Telegram webhook connection is online and receiving real-time creator alerts.'}\n\n` +
             `<b>Status:</b> <code>ONLINE</code>\n` +
             `<i>MoneyPlugHub Creator Engine v5.0</i>`;
      break;
    }
  }

  return {
    chat_id: chatId,
    parse_mode: 'HTML',
    text,
  };
}

/**
 * Dispatch real-time notification to creator's Discord & Telegram webhooks
 */
export async function sendCreatorNotification(
  userId: string,
  payload: NotificationEventPayload
): Promise<NotificationDispatchResult> {
  const settings = getNotificationSettings(userId);

  // Check if global settings are active
  if (!settings.is_active && payload.type !== 'test') {
    return {
      success: false,
      channel: 'none',
      discord_sent: false,
      telegram_sent: false,
      error_details: 'Creator notifications are disabled in settings.',
    };
  }

  // Check event-specific toggles (skip for test)
  if (payload.type === 'commission' && !settings.notify_commissions) {
    return { success: false, channel: 'none', discord_sent: false, telegram_sent: false, error_details: 'Commission alerts disabled.' };
  }
  if (payload.type === 'quest' && !settings.notify_quests) {
    return { success: false, channel: 'none', discord_sent: false, telegram_sent: false, error_details: 'Quest alerts disabled.' };
  }
  if (payload.type === 'tier_levelup' && !settings.notify_tier_levelups) {
    return { success: false, channel: 'none', discord_sent: false, telegram_sent: false, error_details: 'Tier level-up alerts disabled.' };
  }

  let discordSent = false;
  let telegramSent = false;
  const errors: string[] = [];

  // 1. Dispatch Discord Webhook
  const shouldSendDiscord =
    Boolean(settings.discord_webhook_url) &&
    (!payload.channel_override || payload.channel_override === 'discord' || payload.channel_override === 'both');

  if (shouldSendDiscord) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const discordData = buildDiscordEmbed(payload);
      const res = await fetch(settings.discord_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordData),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok || res.status === 204) {
        discordSent = true;
      } else {
        const text = await res.text().catch(() => '');
        errors.push(`Discord Webhook failed [${res.status}]: ${text}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      errors.push(`Discord Webhook error: ${err.message}`);
    }
  }

  // 2. Dispatch Telegram Webhook / Bot
  const shouldSendTelegram =
    (Boolean(settings.telegram_webhook_url) || (Boolean(settings.telegram_bot_token) && Boolean(settings.telegram_chat_id))) &&
    (!payload.channel_override || payload.channel_override === 'telegram' || payload.channel_override === 'both');

  if (shouldSendTelegram) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const chatId = settings.telegram_chat_id || 'default';
      const telegramData = buildTelegramPayload(payload, chatId);

      let targetUrl = settings.telegram_webhook_url;
      if (!targetUrl && settings.telegram_bot_token) {
        targetUrl = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
      }

      if (targetUrl) {
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telegramData),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          telegramSent = true;
        } else {
          const text = await res.text().catch(() => '');
          errors.push(`Telegram Webhook failed [${res.status}]: ${text}`);
        }
      } else {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      errors.push(`Telegram Webhook error: ${err.message}`);
    }
  }

  const overallSuccess = discordSent || telegramSent;
  const channel: 'discord' | 'telegram' | 'both' | 'none' =
    discordSent && telegramSent
      ? 'both'
      : discordSent
      ? 'discord'
      : telegramSent
      ? 'telegram'
      : 'none';

  // Log to database
  const logId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const title = payload.title || `Alert: ${payload.type}`;
  const message = payload.message || `Event type: ${payload.type}`;

  try {
    db.prepare(`
      INSERT INTO notification_logs (
        id, user_id, event_type, channel, title, message, payload_json, status, error_details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      userId,
      payload.type,
      channel,
      title,
      message,
      JSON.stringify(payload),
      overallSuccess ? (discordSent && telegramSent ? 'success' : 'partial') : 'failed',
      errors.length > 0 ? errors.join(' | ') : null,
      now
    );
  } catch (err) {
    console.error('[Notification Log DB Error]:', err);
  }

  return {
    success: overallSuccess,
    channel,
    discord_sent: discordSent,
    telegram_sent: telegramSent,
    error_details: errors.length > 0 ? errors.join(' | ') : undefined,
  };
}

/**
 * Get notification logs for a creator
 */
export function getNotificationLogs(userId: string, limit: number = 20) {
  return db.prepare(`
    SELECT * FROM notification_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as any[];
}
