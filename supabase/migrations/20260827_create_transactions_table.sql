-- ============================================================================
-- MONEYPLUGHUB FINANCIAL ENGINE: TRANSACTIONS SCHEMA
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create the unified transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_real BOOLEAN NOT NULL DEFAULT false,
    processor_id TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraints
    CONSTRAINT transactions_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT transactions_valid_type CHECK (
        type IN ('charge', 'payout', 'xp_award', 'xp_spend', 'commission', 'refund', 'internal_transfer')
    ),
    CONSTRAINT transactions_valid_source CHECK (
        source IN ('stripe', 'xp_purchase', 'commission', 'system', 'crypto', 'manual')
    )
);

-- 2. Performance & Idempotency Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_timestamp 
    ON public.transactions (user_id, timestamp DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_processor_id 
    ON public.transactions (processor_id) 
    WHERE processor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_dedup 
    ON public.transactions (user_id, amount, timestamp);

CREATE INDEX IF NOT EXISTS idx_transactions_source_type 
    ON public.transactions (source, type);

CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin 
    ON public.transactions USING gin (metadata);

-- 3. Row-Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
    ON public.transactions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on transactions"
    ON public.transactions
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');
