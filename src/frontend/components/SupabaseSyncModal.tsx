import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle, AlertCircle, Shield, Link, Copy, Check, Server, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchSupabaseStatus, triggerSupabaseSync, SupabaseSyncStatus } from '../lib/supabase';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({ isOpen, onClose }) => {
  const { token, user } = useAuth();
  const [status, setStatus] = useState<SupabaseSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Form Inputs
  const [supabaseUrl, setSupabaseUrl] = useState('https://jccxdlvzeckyaqprkmba.supabase.co');
  const [anonKey, setAnonKey] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    setIsLoading(true);
    const data = await fetchSupabaseStatus();
    setStatus(data);
    if (data.url && data.url !== 'Not set') {
      setSupabaseUrl(data.url);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setSyncResult(null);
      setSaveMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/supabase/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: supabaseUrl,
          anonKey,
          serviceRoleKey,
        }),
      });
      const data = await res.json();
      setSaveMessage(data.message || 'Config saved.');
      await loadStatus();
    } catch (err: any) {
      setSaveMessage('Failed to update config: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      const res = await triggerSupabaseSync(token);
      setSyncResult(res.data);
      await loadStatus();
    } catch (err: any) {
      setSyncResult({ errors: [err.message] });
    } finally {
      setIsSyncing(false);
    }
  };

  const sqlSchemaSnippet = `-- MoneyPlugHub Supabase Cloud Schema
CREATE TABLE IF NOT EXISTS moneyplughub_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  total_earnings_usd REAL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moneyplughub_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,
  amount REAL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moneyplughub_referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT,
  program_slug TEXT,
  status TEXT,
  commission_amount REAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moneyplughub_sigils (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  sigil_code TEXT UNIQUE,
  power_level INTEGER,
  archetype TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moneyplughub_prospects (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  company_name TEXT,
  decision_maker TEXT,
  decision_maker_title TEXT,
  email TEXT,
  wealth_tier TEXT,
  bond_omega INTEGER,
  mx_valid INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchemaSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/10 text-white max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-white">Supabase Cloud Bridge</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                status?.connected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {status?.connected ? '🟢 Connected' : '🟡 Standby'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Dual-write cloud replication & Postgres ACID persistence for MoneyPlugHub.
            </p>
          </div>
        </div>

        {/* Live Status Card */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 mb-6 space-y-2.5 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500">Supabase Endpoint:</span>
            <span className="text-emerald-400 font-bold truncate max-w-xs">{supabaseUrl}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500">Database Engine:</span>
            <span className="text-cyan-400">PostgreSQL (Supabase REST / Realtime)</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500">Cloud Roundtrip Latency:</span>
            <span className="text-amber-400">{status?.latencyMs ? `${status.latencyMs} ms` : 'Live'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500">Active Storage Mode:</span>
            <span className="text-purple-400">{status?.mode || 'Hybrid Cloud Sync Active'}</span>
          </div>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold font-mono text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Tables to Supabase...' : '⚡ Trigger 1-Click Cloud Sync'}</span>
          </button>
          <button
            onClick={loadStatus}
            disabled={isLoading}
            className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs border border-slate-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Sync Results Banner */}
        {syncResult && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 mb-6 font-mono text-xs text-emerald-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-400">
              <CheckCircle className="w-4 h-4" /> Cloud Sync Completed Successfully:
            </div>
            <div>• Synced Users: {syncResult.syncedUsers || 0}</div>
            <div>• Synced Referrals: {syncResult.syncedReferrals || 0}</div>
            <div>• Synced Transactions: {syncResult.syncedTransactions || 0}</div>
            <div>• Synced Sigils: {syncResult.syncedSigils || 0}</div>
            <div>• Synced PHOM Prospects: {syncResult.syncedProspects || 0}</div>
            {syncResult.errors && syncResult.errors.length > 0 && (
              <div className="text-amber-400 pt-1">
                Notice: {syncResult.errors.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSaveConfig} className="space-y-4 mb-6">
          <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            Supabase Project Credentials
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">Project URL</label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Anon / Public Key</label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1Ni..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Service Role Key (Admin)</label>
              <input
                type="password"
                value={serviceRoleKey}
                onChange={(e) => setServiceRoleKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1Ni..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {saveMessage && (
            <div className="text-xs font-mono text-emerald-400 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
              {saveMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold border border-slate-700 transition"
          >
            {isSaving ? 'Saving & Verifying...' : '💾 Save & Bind Supabase Keys'}
          </button>
        </form>

        {/* SQL Migration Script Box */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 font-bold">PostgreSQL Table Schema for Supabase SQL Editor:</span>
            <button
              onClick={copySql}
              className="flex items-center gap-1 text-xs font-mono text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-slate-800"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>
          <pre className="text-[10px] font-mono text-slate-400 bg-slate-900/90 p-3 rounded-xl overflow-x-auto max-h-36 border border-slate-800/80">
            {sqlSchemaSnippet}
          </pre>
        </div>

      </div>
    </div>
  );
};
