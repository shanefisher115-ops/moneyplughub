import { createClient } from '@supabase/supabase-js';
const metaEnv = import.meta?.env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://jccxdlvzeckyaqprkmba.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';
let client = null;
export function getFrontendSupabase() {
    if (client)
        return client;
    if (!supabaseUrl || !supabaseAnonKey)
        return null;
    try {
        client = createClient(supabaseUrl, supabaseAnonKey);
        return client;
    }
    catch (err) {
        console.warn('[Supabase Frontend] Init warning:', err);
        return null;
    }
}
export async function fetchSupabaseStatus() {
    try {
        const res = await fetch('/api/supabase/status');
        const json = await res.json();
        return json.data || { connected: false, url: '', status: 'Offline', latencyMs: 0, mode: 'Local' };
    }
    catch (err) {
        return {
            connected: false,
            url: supabaseUrl,
            status: 'Server Unreachable',
            latencyMs: 0,
            mode: 'Local SQLite WAL Fallback',
        };
    }
}
export async function triggerSupabaseSync(token) {
    const res = await fetch('/api/supabase/sync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    return res.json();
}
