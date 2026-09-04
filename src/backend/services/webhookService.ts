import { config } from '../config';

export interface CommissionNotificationPayload {
  creatorName: string;
  creatorEmail?: string;
  amountCents: number;
  currency?: string;
  referredName?: string;
  notes?: string;
  commissionId?: string;
}

export interface RankPromotionNotificationPayload {
  creatorName: string;
  creatorEmail?: string;
  oldLevel?: number;
  newLevel: number;
  oldTier?: string;
  newTier: string;
  totalXp?: number;
}

export interface WebhookConfigOverride {
  discordUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

/**
 * Dispatch HTTP POST request using fetch
 */
async function postJson(url: string, body: any): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err: any) {
    return { ok: false, status: 0, text: err.message || 'Network Error' };
  }
}

/**
 * Send embed payload to Discord Webhook
 */
export async function sendDiscordNotification(embed: any, customDiscordUrl?: string): Promise<boolean> {
  const url = customDiscordUrl || config.webhooks.discordUrl;
  if (!url) {
    console.log('[WebhookService] Discord webhook URL not configured. Skipping Discord dispatch.');
    return false;
  }

  const payload = {
    username: 'MoneyPlugHub Creator OS',
    avatar_url: 'https://moneyplughub.com/logo.png',
    embeds: [embed],
  };

  const result = await postJson(url, payload);
  if (!result.ok) {
    console.error(`[WebhookService] Discord dispatch failed (${result.status}): ${result.text}`);
  } else {
    console.log('[WebhookService] Discord notification dispatched successfully.');
  }
  return result.ok;
}

/**
 * Send HTML message to Telegram Bot
 */
export async function sendTelegramNotification(text: string, customConfig?: { botToken?: string; chatId?: string }): Promise<boolean> {
  const botToken = customConfig?.botToken || config.webhooks.telegramBotToken;
  const chatId = customConfig?.chatId || config.webhooks.telegramChatId;

  if (!botToken || !chatId) {
    console.log('[WebhookService] Telegram bot token or chat ID not configured. Skipping Telegram dispatch.');
    return false;
  }

  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  const result = await postJson(telegramUrl, payload);
  if (!result.ok) {
    console.error(`[WebhookService] Telegram dispatch failed (${result.status}): ${result.text}`);
  } else {
    console.log('[WebhookService] Telegram notification dispatched successfully.');
  }
  return result.ok;
}

/**
 * Format & Dispatch Real-Time Commission Notification to Discord and Telegram
 */
export async function notifyCommissionEarned(
  payload: CommissionNotificationPayload,
  override?: WebhookConfigOverride
): Promise<{ discord: boolean; telegram: boolean }> {
  const amountUsd = (payload.amountCents / 100).toFixed(2);
  const currency = payload.currency || 'USD';

  // 1. Build Discord Embed
  const discordEmbed = {
    title: '💰 New Commission Earned!',
    description: `**${payload.creatorName}** just earned **$${amountUsd} ${currency}**!`,
    color: 0x00ff88, // Emerald green
    fields: [
      { name: 'Amount', value: `$${amountUsd} ${currency}`, inline: true },
      { name: 'Referred Creator', value: payload.referredName || 'New Creator', inline: true },
    ],
    footer: {
      text: 'MoneyPlugHub Creator OS • Real-Time Financial Ledger',
    },
    timestamp: new Date().toISOString(),
  };

  if (payload.commissionId) {
    discordEmbed.fields.push({ name: 'Commission ID', value: payload.commissionId, inline: false });
  }
  if (payload.notes) {
    discordEmbed.fields.push({ name: 'Details', value: payload.notes, inline: false });
  }

  // 2. Build Telegram Text Message
  let telegramMessage = `💰 <b>New Commission Earned!</b>\n\n`;
  telegramMessage += `Creator: <b>${escapeHtml(payload.creatorName)}</b>\n`;
  telegramMessage += `Amount: <b>$${amountUsd} ${currency}</b>\n`;
  if (payload.referredName) {
    telegramMessage += `Referred: <b>${escapeHtml(payload.referredName)}</b>\n`;
  }
  if (payload.notes) {
    telegramMessage += `Details: <i>${escapeHtml(payload.notes)}</i>\n`;
  }
  telegramMessage += `\n⚡ <i>MoneyPlugHub Creator OS</i>`;

  // 3. Dispatch concurrently
  const [discordRes, telegramRes] = await Promise.all([
    sendDiscordNotification(discordEmbed, override?.discordUrl),
    sendTelegramNotification(telegramMessage, {
      botToken: override?.telegramBotToken,
      chatId: override?.telegramChatId,
    }),
  ]);

  return { discord: discordRes, telegram: telegramRes };
}

/**
 * Format & Dispatch Real-Time Rank Promotion Notification to Discord and Telegram
 */
export async function notifyRankPromotion(
  payload: RankPromotionNotificationPayload,
  override?: WebhookConfigOverride
): Promise<{ discord: boolean; telegram: boolean }> {
  // 1. Build Discord Embed
  const discordEmbed = {
    title: '🚀 Rank Promotion Unlocked!',
    description: `**${payload.creatorName}** has ascended to **Level ${payload.newLevel} — ${payload.newTier}**!`,
    color: 0xffd700, // Gold
    fields: [
      { name: 'New Rank', value: `Level ${payload.newLevel}`, inline: true },
      { name: 'New Tier Title', value: payload.newTier, inline: true },
    ],
    footer: {
      text: 'MoneyPlugHub Creator OS • Ascension Ceremony',
    },
    timestamp: new Date().toISOString(),
  };

  if (payload.oldLevel || payload.oldTier) {
    discordEmbed.fields.unshift({
      name: 'Previous Rank',
      value: `Level ${payload.oldLevel || payload.newLevel - 1}${payload.oldTier ? ` (${payload.oldTier})` : ''}`,
      inline: false,
    });
  }

  if (payload.totalXp !== undefined) {
    discordEmbed.fields.push({
      name: 'Total XP',
      value: `${payload.totalXp.toLocaleString()} XP`,
      inline: true,
    });
  }

  // 2. Build Telegram Text Message
  let telegramMessage = `🚀 <b>Rank Promotion Unlocked!</b>\n\n`;
  telegramMessage += `Creator: <b>${escapeHtml(payload.creatorName)}</b>\n`;
  if (payload.oldLevel || payload.oldTier) {
    telegramMessage += `Previous: Level ${payload.oldLevel || payload.newLevel - 1} (${escapeHtml(payload.oldTier || '')})\n`;
  }
  telegramMessage += `New Rank: <b>Level ${payload.newLevel}</b> — <b>${escapeHtml(payload.newTier)}</b>\n`;
  if (payload.totalXp !== undefined) {
    telegramMessage += `Total XP: <b>${payload.totalXp.toLocaleString()} XP</b>\n`;
  }
  telegramMessage += `\n⚡ <i>MoneyPlugHub Creator OS</i>`;

  // 3. Dispatch concurrently
  const [discordRes, telegramRes] = await Promise.all([
    sendDiscordNotification(discordEmbed, override?.discordUrl),
    sendTelegramNotification(telegramMessage, {
      botToken: override?.telegramBotToken,
      chatId: override?.telegramChatId,
    }),
  ]);

  return { discord: discordRes, telegram: telegramRes };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
