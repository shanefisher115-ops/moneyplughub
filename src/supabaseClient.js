const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(process.cwd(), '.env.local');
let envConfig = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) envConfig[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
  });
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL || 'https://jccxdlvzeckyaqprkmba.supabase.co';
const supabaseAnonKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase };
