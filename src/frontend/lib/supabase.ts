import { createClient, SupabaseClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any)?.env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://jccxdlvzeckyaqprkmba.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function getFrontendSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
    return client;
  } catch (err) {
    console.warn('[Supabase Frontend] Init warning:', err);
    return null;
  }
}

export interface SupabaseSyncStatus {
  connected: boolean;
  url: string;
  status: string;
  latencyMs: number;
  mode: string;
  schema?: Record<string, string>;
}

export async function fetchSupabaseStatus(): Promise<SupabaseSyncStatus> {
  try {
    const res = await fetch('/api/supabase/status');
    const json = await res.json();
    return json.data || { connected: false, url: '', status: 'Offline', latencyMs: 0, mode: 'Local' };
  } catch (err: any) {
    return {
      connected: false,
      url: supabaseUrl,
      status: 'Server Unreachable',
      latencyMs: 0,
      mode: 'Local SQLite WAL Fallback',
    };
  }
}

export async function triggerSupabaseSync(token: string): Promise<any> {
  const res = await fetch('/api/supabase/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}
