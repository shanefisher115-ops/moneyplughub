import React, { useState, useEffect } from 'react';
import {
  Bell,
  Webhook,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Bot,
} from 'lucide-react';

interface NotificationSettings {
  user_id: string;
  discord_webhook_url: string;
  telegram_webhook_url: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  notify_commissions: boolean;
  notify_quests: boolean;
  notify_tier_levelups: boolean;
  is_active: boolean;
}

interface NotificationLog {
  id: string;
  event_type: string;
  channel: string;
  title: string;
  message: string;
  status: string;
  error_details?: string;
  created_at: string;
}

export const WebhookNotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    user_id: '',
    discord_webhook_url: '',
    telegram_webhook_url: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
    notify_commissions: true,
    notify_quests: true,
    notify_tier_levelups: true,
    is_active: true,
  });

  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettingsAndLogs = async () => {
    try {
      setLoading(true);
      const [settingsRes, logsRes] = await Promise.all([
        fetch('/api/notifications/settings', { headers: { 'Content-Type': 'application/json' } }),
        fetch('/api/notifications/logs?limit=10', { headers: { 'Content-Type': 'application/json' } }),
      ]);

      if (settingsRes.ok) {
        const sJson = await settingsRes.json();
        if (sJson.success && sJson.data) {
          setSettings(sJson.data);
        }
      }

      if (logsRes.ok) {
        const lJson = await logsRes.json();
        if (lJson.success && Array.isArray(lJson.data)) {
          setLogs(lJson.data);
        }
      }
    } catch (err) {
      console.error('Failed to load webhook settings or logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndLogs();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const json = await res.json();
      if (json.success) {
        setStatusMessage({ type: 'success', text: 'Webhook settings saved successfully!' });
        if (json.data) setSettings(json.data);
      } else {
        setStatusMessage({ type: 'error', text: json.error || 'Failed to save webhook settings' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Network error saving webhook settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async (channel: 'discord' | 'telegram' | 'both') => {
    setTesting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });

      const json = await res.json();
      if (json.success) {
        setStatusMessage({ type: 'success', text: json.message || 'Test alert dispatched successfully!' });
      } else {
        setStatusMessage({
          type: 'error',
          text: json.message || json.error || 'Test webhook delivery failed. Please check your URLs.',
        });
      }
      fetchSettingsAndLogs();
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to trigger test alert' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl animate-pulse text-slate-400">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading Discord & Telegram Webhook Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-emerald-500/20 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Bell className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Discord & Telegram Webhook Engine
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                Real-Time Alerts
              </span>
            </h2>
            <p className="text-sm text-slate-400">
              Receive real-time alerts on your Discord channel or Telegram bot when you earn commissions, complete quests, or level up tiers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleTestWebhook('both')}
            disabled={testing}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm flex items-center gap-2 transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Test Alert
          </button>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Master Switch */}
        <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <div className="font-semibold text-white">Enable Webhook Notifications</div>
              <div className="text-xs text-slate-400">Master toggle to pause or activate all real-time outgoing webhook triggers</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.is_active}
              onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        {/* Channels Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Discord Webhook URL */}
          <div className="p-5 bg-slate-800/30 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <MessageSquare className="w-4 h-4" />
              Discord Webhook Integration
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Discord Webhook URL
              </label>
              <input
                type="url"
                value={settings.discord_webhook_url}
                onChange={(e) => setSettings({ ...settings, discord_webhook_url: e.target.value })}
                placeholder="https://discord.com/api/webhooks/123456/abcdef..."
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <p className="text-xs text-slate-500">
              Create a webhook in Discord: Server Settings &gt; Integrations &gt; Webhooks &gt; New Webhook &gt; Copy Webhook URL.
            </p>
          </div>

          {/* Telegram Integration */}
          <div className="p-5 bg-slate-800/30 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
              <Bot className="w-4 h-4" />
              Telegram Webhook & Bot Integration
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Telegram Webhook Endpoint URL
              </label>
              <input
                type="url"
                value={settings.telegram_webhook_url}
                onChange={(e) => setSettings({ ...settings, telegram_webhook_url: e.target.value })}
                placeholder="https://your-bot-relay.com/telegram-webhook"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition mb-3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={settings.telegram_bot_token}
                  onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                  placeholder="123456789:ABCdef..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  value={settings.telegram_chat_id}
                  onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                  placeholder="987654321"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Create bot with @BotFather on Telegram, paste token &amp; your chat ID, or use a custom relay webhook URL.
            </p>
          </div>
        </div>

        {/* Event Toggles */}
        <div className="p-5 bg-slate-800/30 border border-slate-800 rounded-xl space-y-3">
          <div className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <Webhook className="w-4 h-4 text-emerald-400" />
            Real-Time Alert Event Subscriptions
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Commission Toggle */}
            <label className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500/40 transition">
              <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                💰 Real-Time Commissions
              </span>
              <input
                type="checkbox"
                checked={settings.notify_commissions}
                onChange={(e) => setSettings({ ...settings, notify_commissions: e.target.checked })}
                className="w-4 h-4 text-emerald-500 rounded border-slate-700 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
            </label>

            {/* Quests Toggle */}
            <label className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl cursor-pointer hover:border-purple-500/40 transition">
              <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                🎯 Quest Unlocks &amp; Claims
              </span>
              <input
                type="checkbox"
                checked={settings.notify_quests}
                onChange={(e) => setSettings({ ...settings, notify_quests: e.target.checked })}
                className="w-4 h-4 text-purple-500 rounded border-slate-700 focus:ring-purple-500 focus:ring-offset-slate-900"
              />
            </label>

            {/* Level-Up Toggle */}
            <label className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl cursor-pointer hover:border-amber-500/40 transition">
              <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                🚀 Tier Level-Up Ascension
              </span>
              <input
                type="checkbox"
                checked={settings.notify_tier_levelups}
                onChange={(e) => setSettings({ ...settings, notify_tier_levelups: e.target.checked })}
                className="w-4 h-4 text-amber-500 rounded border-slate-700 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Save Webhook Preferences
          </button>
        </div>
      </form>

      {/* Webhook Delivery Activity & Audit Logs */}
      <div className="border-t border-slate-800 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Recent Webhook Delivery Logs
          </h3>
          <button
            type="button"
            onClick={fetchSettingsAndLogs}
            className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Logs
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-800/20 rounded-xl border border-slate-800/50">
            No webhook delivery attempts logged yet. Click &quot;Send Test Alert&quot; to test your endpoints.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 rounded-l-lg">Event</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 rounded-r-lg">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-3 py-2.5 font-medium text-white capitalize">{log.event_type}</td>
                    <td className="px-3 py-2.5 text-slate-400 uppercase">{log.channel}</td>
                    <td className="px-3 py-2.5 text-slate-300">{log.title}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          log.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : log.status === 'partial'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
