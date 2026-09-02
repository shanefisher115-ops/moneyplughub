-- ==============================================================================
-- 🚀 MONEYPLUGHUB & PRIMORDIAOS PRODUCTION SUPABASE BACKEND SCHEMA
-- ==============================================================================
-- Complete production schema for Supabase Postgres with Full RLS, Triggers,
-- Automated Timestamps, Verification Procedures, and Indexes.
-- ==============================================================================

-- Enable required Postgres extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper trigger function to automatically update `updated_at`
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==============================================================================
-- 1. USERS & PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.moneyplughub_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    referral_code TEXT UNIQUE NOT NULL,
    referrer_user_id TEXT REFERENCES public.moneyplughub_users(id) ON DELETE SET NULL,
    referral_count INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    streak_days INTEGER NOT NULL DEFAULT 1,
    tier_title TEXT NOT NULL DEFAULT 'Novice Plug',
    total_earnings_usd NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mph_users_email ON public.moneyplughub_users(email);
CREATE INDEX IF NOT EXISTS idx_mph_users_ref_code ON public.moneyplughub_users(referral_code);
CREATE INDEX IF NOT EXISTS idx_mph_users_referrer ON public.moneyplughub_users(referrer_user_id);

-- Auto-update updated_at for users
CREATE TRIGGER update_mph_users_updated_at
BEFORE UPDATE ON public.moneyplughub_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 2. TRANSACTIONS & FINANCIAL LEDGER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.moneyplughub_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    account_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'commission', 'reward', 'withdrawal', 'deposit')),
    amount NUMERIC(14, 2) NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    category TEXT NOT NULL DEFAULT 'General',
    description TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    reference_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mph_tx_user ON public.moneyplughub_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mph_tx_type ON public.moneyplughub_transactions(type);
CREATE INDEX IF NOT EXISTS idx_mph_tx_created ON public.moneyplughub_transactions(created_at);

-- ==============================================================================
-- 3. COMMISSION LEDGER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.commission_ledger (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    referrer_user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE RESTRICT,
    referred_user_id TEXT NOT NULL UNIQUE REFERENCES public.moneyplughub_users(id) ON DELETE RESTRICT,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    notes TEXT,
    payout_batch_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_referrer ON public.commission_ledger(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_comm_status ON public.commission_ledger(status);

-- ==============================================================================
-- 4. ACCOUNTS (WALLETS, BANKS, CRYPTO, DEBTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bank', 'crypto', 'investment', 'cash', 'credit_card', 'loan')),
    balance_cents BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    institution TEXT NOT NULL DEFAULT 'Self-Managed',
    is_liability BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);

-- ==============================================================================
-- 5. FINANCIAL GOALS & BUDGETS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.financial_goals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('emergency_fund', 'crypto', 'savings', 'purchase', 'investment')),
    target_cents BIGINT NOT NULL,
    current_cents BIGINT NOT NULL DEFAULT 0,
    target_date TIMESTAMPTZ NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Target',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON public.financial_goals(user_id);

CREATE TABLE IF NOT EXISTS public.budgets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    limit_cents BIGINT NOT NULL,
    spent_cents BIGINT NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'annual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON public.budgets(user_id);

-- ==============================================================================
-- 6. SYNDICATES & GUILD WARS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.syndicates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tag TEXT NOT NULL UNIQUE,
    founder_user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    total_xp BIGINT NOT NULL DEFAULT 0,
    total_commission_cents BIGINT NOT NULL DEFAULT 0,
    member_count INTEGER NOT NULL DEFAULT 1,
    max_members INTEGER NOT NULL DEFAULT 25,
    banner_gradient TEXT DEFAULT 'from-emerald-950 via-slate-900 to-cyan-950',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.syndicate_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    syndicate_id TEXT NOT NULL REFERENCES public.syndicates(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL UNIQUE REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
    contributed_xp BIGINT NOT NULL DEFAULT 0,
    contributed_commission_cents BIGINT NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_synd_members_synd ON public.syndicate_members(syndicate_id);

-- ==============================================================================
-- 7. ACHIEVEMENTS & PRESTIGE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.achievements (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward_xp INTEGER NOT NULL DEFAULT 50,
    reward_cents INTEGER NOT NULL DEFAULT 0,
    badge_icon TEXT NOT NULL DEFAULT 'Trophy',
    tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'mythic', 'celestial')),
    requirement_metric TEXT NOT NULL,
    requirement_value NUMERIC(14, 2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    progress NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);

-- ==============================================================================
-- 8. QUANTUM SIGIL FORGE & COSMETICS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sigil_market_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('sigil_skin', 'aura', 'sound_pack', 'telemetry_shader', 'booster')),
    cost_xp INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rarity TEXT NOT NULL DEFAULT 'rare' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'cosmic')),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_sigil_inventory (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.sigil_market_items(id) ON DELETE CASCADE,
    equipped BOOLEAN NOT NULL DEFAULT FALSE,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, item_id)
);

-- ==============================================================================
-- 9. GEMINI OMNI FLASH JOBS & LOOPENGINEER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.video_loops (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    template_id TEXT NOT NULL,
    loop_depth INTEGER NOT NULL DEFAULT 1,
    max_depth INTEGER NOT NULL DEFAULT 5,
    idempotency_hash TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'executed',
    antigrav_score NUMERIC(5, 2) NOT NULL DEFAULT 88.5,
    last_execution TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    log_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.omni_flash_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('text_to_video', 'first_frame', 'image_referenced', 'interpolation', 'video_edit')),
    prompt TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '9:16',
    duration_seconds INTEGER NOT NULL DEFAULT 5,
    strip_audio BOOLEAN NOT NULL DEFAULT FALSE,
    audio_prompt TEXT,
    previous_interaction_id TEXT,
    keyframe_start TEXT,
    keyframe_end TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    output_url TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.media_assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'audio', 'storyboard')),
    prompt TEXT NOT NULL,
    title TEXT NOT NULL,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    aspect_ratio TEXT NOT NULL DEFAULT '1:1',
    style_preset TEXT,
    duration_seconds NUMERIC(8, 2) DEFAULT 0,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_user ON public.media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON public.media_assets(type);

-- ==============================================================================
-- 10. PHOM COLD OUTREACH & SIGNAL REALM
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.phom_prospects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT NOT NULL,
    role TEXT,
    industry TEXT,
    website TEXT,
    equipment_tags JSONB,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'enriched', 'in_campaign', 'replied', 'unsubscribed', 'bounced')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.phom_campaigns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.moneyplughub_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    persona_blueprint TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    total_prospects INTEGER NOT NULL DEFAULT 0,
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_replied INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.phom_dispatches (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES public.phom_campaigns(id) ON DELETE CASCADE,
    prospect_id TEXT NOT NULL REFERENCES public.phom_prospects(id) ON DELETE CASCADE,
    touch_step INTEGER NOT NULL DEFAULT 1,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'opened', 'clicked', 'replied', 'bounced')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. UNREAL ENGINE 5.4+ REALITY SIMULATION TELEMETRY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.unreal_simulation_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES public.moneyplughub_users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    physics_impulse NUMERIC(10, 4) DEFAULT 0.0,
    niagara_particle_count INTEGER DEFAULT 100,
    solfeggio_freq NUMERIC(8, 2) DEFAULT 528.00,
    camera_mode TEXT DEFAULT 'CINEMATIC_ORBIT',
    viewport_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unreal_events_user ON public.unreal_simulation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_unreal_events_created ON public.unreal_simulation_events(created_at);

-- ==============================================================================
-- 12. AUDIT LOGS (SECURITY & SOVEREIGNTY TRACKING)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES public.moneyplughub_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at);

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.moneyplughub_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moneyplughub_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syndicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syndicate_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sigil_market_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sigil_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_flash_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phom_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phom_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phom_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unreal_simulation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 🛡️ Standard RLS: Users can read and write their own rows; Service Role has full admin
CREATE POLICY "Users can manage their own profile"
ON public.moneyplughub_users FOR ALL
USING (auth.uid()::text = id OR auth.role() = 'service_role');

CREATE POLICY "Users can view and manage their transactions"
ON public.moneyplughub_transactions FOR ALL
USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

CREATE POLICY "Referrers can view their commissions"
ON public.commission_ledger FOR SELECT
USING (auth.uid()::text = referrer_user_id OR auth.uid()::text = referred_user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can manage their accounts"
ON public.accounts FOR ALL
USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can manage their goals"
ON public.financial_goals FOR ALL
USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can manage their media assets"
ON public.media_assets FOR ALL
USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can manage their video loops"
ON public.video_loops FOR ALL
USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

CREATE POLICY "Public read for sigil items"
ON public.sigil_market_items FOR SELECT
USING (true);

CREATE POLICY "Public read for achievements"
ON public.achievements FOR SELECT
USING (true);

CREATE POLICY "Public read for syndicates"
ON public.syndicates FOR SELECT
USING (true);

CREATE POLICY "Users can view simulation events"
ON public.unreal_simulation_events FOR ALL
USING (true);

-- ==============================================================================
-- 14. REAL-TIME REPLICATION PUBLICATION
-- ==============================================================================
-- Add key tables to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.moneyplughub_users,
    public.moneyplughub_transactions,
    public.commission_ledger,
    public.accounts,
    public.syndicates,
    public.unreal_simulation_events,
    public.video_loops;
