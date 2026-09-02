# Comprehensive Survey Report: Requirements R3 & R4
## Creator Money OS (MoneyPlugHub) — Spec Miner Survey 3
**Domain:** Billing, Subscriptions, Referral Engine, Cryptographic Sigils, Gamification, Security & FTC Compliance  
**Authoritative Specification:** `C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\ORIGINAL_REQUEST.md`  
**Date:** 2026-08-26  
**Status:** Completed & Verified  

---

## Executive Summary

This specification mining report covers the authoritative discovery, mathematical modeling, schema architecture, security mechanisms, and compliance mandates for **Requirement R3** (Billing, Referral Engine, Cryptographic Sigils & Gamification) and **Requirement R4** (Security, Environment Hardening & FTC Compliance) of **Creator Money OS (MoneyPlugHub)**.

The system is designed as a zero-marginal-cost, self-hosted creator financial operating system with durable SQLite WAL persistence, deterministic vector geometry, multi-channel AI attribution, anti-cheat gamified liquidity loops, and automated regulatory overlays.

---

## 1. 4-Tier Subscription Billing & Promo Code Engine (R3)

### 1.1 Subscription Plan Hierarchy & Mathematical Pricing Model
The platform defines four discrete subscription tiers managed in `billing_plans` (`src/backend/routes/billing.ts` and `src/frontend/pages/PricingPage.tsx`):

| Plan Tier | Slug | Monthly Price (USD) | Annual Price (USD) | Effective Annual / Mo | Annual Savings | Trial Period | Key Entitlements & Features |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Free Lite** | `free` | **$0.00** | **$0.00** | $0.00/mo | $0.00 | 0 days | 5 referral links, Basic earnings dashboard, MoneyOS text chat, Commission tracking, Community access |
| **Creator** | `creator` | **$29.00** | **$290.00** | $24.17/mo | $58.00 (2 mos free) | 7 days | Unlimited smart links, MoneyOS AI Voice (ElevenLabs 241ms), Voice navigation commands, Budget/Debt tools, Yield simulator, Cashback pack, Priority support |
| **Pro** | `pro` | **$149.00** | **$1,490.00** | $124.17/mo | $298.00 (2 mos free) | 14 days | Full 12-Module AI Swarm Orchestrator, Advanced net worth analytics, Crypto portfolio tracking, Custom Living Vault themes, Multi-platform referral hub, API access, Dedicated account manager |
| **Enterprise** | `enterprise` | **$499.00** | **$4,990.00** | $415.83/mo | $998.00 (2 mos free) | 14 days | White-label deployment, Custom AI agent training, Dedicated infrastructure, SLA guarantees, Bulk referral management, Custom integrations, Priority engineering support |

### 1.2 Promo Code & Discount Redemption Logic
Promo codes are validated via `POST /api/billing/validate-promo` and applied via `POST /api/billing/subscribe`:

- **`FOUNDING50`**: VIP Founder 100% discount ($0.00 final charge) for initial cohort (38/50 claimed).
  $$\text{Price}_{\text{final}} = \$0.00$$
- **`VIPCREATOR`**: 50% discount off base plan price.
  $$\text{Price}_{\text{final}} = \text{Price}_{\text{base}} \times 0.50$$
- **`EARLYBIRD`**: 20% discount off base plan price.
  $$\text{Price}_{\text{final}} = \text{Price}_{\text{base}} \times 0.80$$
- **Dynamic Database Codes (`promo_codes` table)**: Supports `discount_type = 'percent'` or `'fixed'`, `max_uses`, and `valid_until` timestamp validation.

### 1.3 Paywall Access Control & Gating Rules
The `/api/paywall/check` endpoint determines whether a user has active premium rights:
- A user is granted `allowed` status if `subscriptionTier IN ('CREATOR', 'PRO', 'ENTERPRISE')`, `subscriptionActive == 1`, or `role == 'admin'`.
- Free users attempting direct XP point pack purchases (`POST /api/sigil/points/buy`) receive a `403 PAYWALL_REQUIRED` status.

### 1.4 Subscription State Machine
Subscriptions transition through 5 deterministic states:
1. `trialing`: Within `trial_days` period ending at `trial_end`.
2. `active`: Paid or active zero-cost subscription in current billing period.
3. `past_due`: Webhook `invoice.payment_failed` received from Stripe.
4. `canceled`: User initiated cancel (`POST /api/billing/cancel`); retains access until `current_period_end`.
5. `expired`: `current_period_end < NOW()` without renewal.

---

## 2. ACID SQLite WAL Persistence & Schema Architecture (R3)

### 2.1 Database Configuration & Pragmas
The database engine is built on Node.js native `DatabaseSync` (`node:sqlite`) with strict ACID performance pragmas:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

- **WAL Mode (Write-Ahead Logging)**: Allows concurrent readers alongside single-writer serialized writes without lock starvation.
- **`runInTransaction<T>(fn: () => T)`**: Wraps critical mutations in `BEGIN IMMEDIATE TRANSACTION;` with automatic `COMMIT;` or `ROLLBACK;` on error.

### 2.2 Complete Database Entity Catalog (30+ Tables)

```
========================================================================================
                                CORE DATABASE SCHEMA MAP
========================================================================================

 [users] (id, email, password_hash, display_name, role, referral_code, referrer_user_id,
          referral_count, xp, level, streak_days, tier_title, subscriptionTier, subscriptionActive)
    │
    ├── [commission_ledger] (referrer_user_id, referred_user_id, amount_cents, status)
    ├── [accounts] (user_id, name, type, balance_cents, institution, is_liability)
    │     ├── [transactions] (user_id, account_id, category, type, amount_cents, date)
    │     └── [balance_snapshots] (user_id, account_id, provider, balance_cents)
    ├── [debts] (user_id, name, total_balance_cents, minimum_payment_cents, strategy)
    ├── [budgets] (user_id, category, monthly_limit_cents, month)
    ├── [financial_goals] (user_id, title, category, target_cents, current_cents)
    ├── [crypto_wallets] (user_id, currency, balance, address)
    │     └── [crypto_ledger] (user_id, tx_hash, tx_type, amount, usd_value_cents)
    ├── [user_tasks] (user_id, task_id, status, completed_at, claimed_at)
    ├── [subscriptions] (user_id, plan_id, status, billing_cycle, current_period_end)
    ├── [invoices] (user_id, subscription_id, amount_cents, discount_cents, total_cents, status)
    ├── [user_sigil_inventory] (user_id, item_id, is_equipped)
    ├── [user_sigil_config] (user_id, aura, glyph, ring, crest, motto, monogram, handle)
    ├── [xp_conversions] (user_id, xp_amount, base_cash_cents, multiplier, final_cash_cents)
    ├── [user_conversion_streaks] (user_id, current_streak, last_conversion_date, weekly_claims_count)
    ├── [daily_loot_claims] (user_id, reward_type, reward_value, streak_days, claimed_at)
    ├── [user_achievements] (user_id, achievement_id, current_value, is_unlocked, is_claimed)
    ├── [referral_clicks] (referral_code, referrer_user_id, ip_address, source_category, converted)
    ├── [audit_logs] (actor_user_id, action, target_entity, target_id, details, created_at)
    └── [viral_surge_events] (user_id, surge_type, multiplier, started_at, expires_at)
```

---

## 3. Deterministic SHA-256 SVG Sigil Generation Engine (R3)

### 3.1 Mathematical Formulation & Procedural Geometry
Each referral code is deterministically hashed into a 32-byte array (0–255) using SHA-256:

$$\mathbf{H} = \text{SHA-256}(\text{referral\_code.toUpperCase()}) \in \{0, \dots, 255\}^{32}$$

Pseudo-random deterministic extraction primitives:
- **Normalized Float $[0, 1)$:**
  $$hf(i) = \frac{\mathbf{H}[i \pmod{32}]}{255}$$
- **Integer Range $[min, max]$:**
  $$hi(i, min, max) = \lfloor hf(i) \times (max - min + 1) \rfloor + min$$
- **Color Extraction (HSL):**
  $$\text{Hue} = \lfloor hf(\text{offset}) \times 360 \rfloor, \quad \text{Sat} = hi(\text{offset}+1, 50, 95), \quad \text{Light} = hi(\text{offset}+2, 45, 75)$$

### 3.2 Visual Component Layout Matrix
The sigil composition renders a multi-layered procedural SVG ($256\times256$ to $2048\times2048$):

```
Layer 0: Background Radial Gradient & Ambient Particle Matrix (18 Deterministic Points)
Layer 1: Concentric Boundary Orbitals (Outer R = 40% size, Inner R = 18-36% size)
Layer 2: Radial Ring FX (1 of 12 Procedural Orbital Ring Systems)
Layer 3: Sacred Core Geometry (1 of 12 Sacred Geometric Polygons/Stars/Tesseracts)
Layer 4: Imperial Crown / Mecha Crest (1 of 12 Cybernetic Upper Crests)
Layer 5: Micro-Text Path & Passport Cryptographic Verification Hash Overlay
```

- **48 Master Visual Components:**
  - 12 Cosmic Auras (`aura_cyber_emerald`, `aura_synthwave_sunset`, `aura_quantum_ice`, `aura_solar_flare`, `aura_osmium_diamond`, `aura_void_singularity`, `aura_primordial_gold`, etc.)
  - 12 Core Glyphs (`glyph_quantum_hex`, `glyph_metatron`, `glyph_octagram`, `glyph_flower_of_life`, `glyph_tesseract`, `glyph_merkaba_vehicle`, etc.)
  - 12 Radial Rings (`ring_circuit_traces`, `ring_celestial_corona`, `ring_rune_encryption`, `ring_particle_flux`, `ring_dual_event_horizon`, etc.)
  - 12 Crests & Seals (`crest_cyber_spikes`, `crest_lightning`, `crest_valkyrie_horns`, `crest_crown`, `crest_angel_wings`, `crest_omni_sovereign`, etc.)

### 3.3 Cryptographic Verification Signature
The creator passport generates an immutable authenticity proof:

$$\text{Signature} = \text{SHA-256}\left(\text{userId} + \text{"\_"} + \text{referral\_code} + \text{"\_"} + \text{createdAt} + \text{"\_PRIMORDIA"}\right)$$

---

## 4. 30-Day Attribution Cookie Tracking & Referral Engine (R3 & R4)

### 4.1 Click Tracking & Attribution Lifecycle
- Endpoint: `GET /api/referrals/track/:code`
- **Attribution Cookie:**
  - Name: `ref`
  - Value: `referral_code` (e.g. `PLUG-ALEX`)
  - MaxAge: $30 \text{ days} = 30 \times 24 \times 60 \times 60 \times 1000 = 2,592,000,000 \text{ ms}$
  - Flags: `httpOnly: false` (allows client-side hydration on signup forms), `SameSite: 'lax'`, `Path: '/'`.

### 4.2 Multi-Channel & AI Traffic Classifier
The attribution engine inspects HTTP headers (`Referer`, `User-Agent`, and UTM queries) to categorize incoming lead vectors and calculate intent scores:

| Category | Source Indicators | Intent Score | Special Behavior |
| :--- | :--- | :--- | :--- |
| `ai_assistant` | `chatgpt.com`, `claude.ai`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `astiva.ai` | **0.90 – 0.96** | Classifies specific AI engine; flags high-intent prompt referral |
| `social_video` | `tiktok.com`, `youtube.com`, `youtu.be` | **0.85 – 0.88** | Links to short-form video hooks & sound templates |
| `social_microblog` | `x.com`, `twitter.com`, `t.co` | **0.82** | Twitter card embed attribution |
| `newsletter_creator`| `substack.com`, `beehiiv.com`, `stan.store` | **0.91** | High-conversion creator audience traffic |
| `direct_recovered` | Missing referer (Dark Social / Direct Messaging) | **0.75** | Recovered via deterministic referral cookie/sigil |

### 4.3 Commission Tiers & Payout Math
Referrers earn instant cash commissions and XP upon qualified invitee registration:

$$\text{Base Commission} = \$10.00 \quad (1,000 \text{ cents}) + 350 \text{ XP}$$

Commission Tiers (`commission_tiers` table):
- **Bronze (0+ refs):** 20.0% RevShare / $5.00 milestone bonus
- **Silver (5+ refs):** 25.0% RevShare / $10.00 milestone bonus
- **Gold (15+ refs):** 30.0% RevShare / $25.00 milestone bonus
- **Platinum (50+ refs):** 35.0% RevShare / $50.00 milestone bonus
- **Diamond (100+ refs):** 40.0% RevShare / $100.00 milestone bonus

### 4.4 Anti-Fraud Defense Matrix
1. **IP Velocity Limit:** Maximum 5 clicks per IP address per hour. Clicks $>5$ trigger automatic `referral_fraud_log` entry.
2. **24-Hour Deduplication:** Duplicate clicks from the same IP within 24 hours are deduplicated.
3. **Self-Referral Barrier:** If `newUserId === referrerUserId`, registration blocks commission and logs `SELF_REFERRAL` fraud event.
4. **Same-IP Detection:** Flags new accounts created on the same IP as the referrer for administrative audit.

---

## 5. XP Economy & Leaderboard Gamification (R3)

### 5.1 Six Wealth Tiers (Vault Shaders Ladder)

| Tier | Wealth Tier Name | Min Net Worth (USD) | Multiplier | Daily Cash Limit | 7-Day Weekly Streak Bonus | Solfeggio Hz |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | Neo-Emerald Seed | $0.00 | **1.00×** | $2.00 / day (200¢) | +$1.00 (100¢) | 432 Hz |
| **Tier 2** | Cyan Cashflow River | $1,000.00 (100,000¢) | **1.10×** | $5.00 / day (500¢) | +$2.00 (200¢) | 528 Hz |
| **Tier 3** | Amethyst Quantum Ledger | $5,000.00 (500,000¢) | **1.25×** | $10.00 / day (1,000¢) | +$3.00 (300¢) | 639 Hz |
| **Tier 4** | 24K Imperial Bullion | $20,000.00 (2,000,000¢)| **1.50×** | $20.00 / day (2,000¢) | +$5.00 (500¢) | 741 Hz |
| **Tier 5** | Sovereign Diamond Treasury | $100,000.00 (10,000,000¢)| **2.00×** | $35.00 / day (3,500¢) | +$10.00 (1,000¢) | 852 Hz |
| **Tier 6** | Celestial Osmium Singularity | $1,000,000.00 (100,000,000¢)| **3.00×** | $50.00 / day (5,000¢) | +$20.00 (2,000¢) | 963 Hz |

### 5.2 XP to Cash Conversion Formula (Antigravity Chamber)
Base exchange rate: $1,000\text{ XP} = \$0.50 \implies 0.05\text{ cents per XP}$.

$$\text{BaseCents}(\text{XP}) = \lfloor \text{XP} \times 0.05 \rfloor$$
$$\text{FinalCashCents} = \text{round}\left(\text{BaseCents}(\text{XP}) \times \text{TierMultiplier}\right) + \text{WeeklyStreakBonus}$$

### 5.3 Server-Side Quest Verification Matrix
Quest rewards are protected by multi-layer anti-cheat checks (`src/backend/routes/gamification.ts`):

| Task ID | Title | Verification Rule | Reward XP | Reward Cash |
| :--- | :--- | :--- | :--- | :--- |
| `task_budget_checkin` | Daily Budget Check-in | Verified: `SELECT COUNT(*) FROM budgets WHERE user_id = ?` $\ge 1$ | 75 XP | $0.50 (50¢) |
| `task_debt_avalanche` | Pay Down Debt Milestone | Verified: `SELECT COUNT(*) FROM transactions` with debt category $\ge 1$ | 150 XP | $1.50 (150¢) |
| `task_emergency_fund`| Feed Emergency Vault | Verified: `SELECT balance_cents FROM accounts` (savings/hysa) $\ge 2,500$¢ | 120 XP | $1.00 (100¢) |
| `task_crypto_stack` | Stack Crypto Holdings | Verified: `SELECT COUNT(*) FROM crypto_wallets` with balance $>0 \ge 1$ | 100 XP | $0.75 (75¢) |
| `task_refer_friend` | Invite Financial Peer | Verified: `SELECT referral_count FROM users` $\ge 1$ | 350 XP | $10.00 (1000¢) |
| `task_networth_sync` | Calculate Net Worth | Verified: `SELECT COUNT(*) FROM accounts WHERE user_id = ?` $\ge 2$ | 110 XP | $1.00 (100¢) |

### 5.4 Daily Mystery Loot Crate (Gacha Drop Table)
The daily crate opens once every 24 hours (`src/backend/routes/loot.ts`):
- **40% Common**: $150–350$ Base XP + $\$0.50$ cash balance.
- **30% Rare**: $500$ XP + $\$2.00$ cash balance + $2\times$ Golden Hour multiplier (1 hr).
- **20% Epic**: $1,000$ XP + $\$5.00$ cash balance + Rare Sigil component unlock.
- **10% Legendary Mythic**: $2,500$ XP + $\$10.00$ cash balance + $3\times$ Golden Hour multiplier + Mythic Gold Aura.

---

## 6. Security, Environment Hardening & Session Handling (R4)

### 6.1 Authentication Architecture
- Dual-layer authentication mechanism:
  1. **JWT Bearer Token / HTTP-only Cookie**: Signed with `config.jwtSecret`, 7-day expiration (`jwtExpiresIn = '7d'`).
  2. **Clerk Auth Integration Wrapper**: Supports enterprise SSO, Clerk publishable keys, and role synchronization.
- **Role-Based Access Control**:
  - `user`: Standard creator access to dashboards, quests, referrals, sigils.
  - `admin`: Super-auditor privileges (`requireAdmin` middleware) for invoice approval, commission payouts, boost event creation, and fraud inspection.

### 6.2 Environment Variable Isolation & Fallbacks
Configured in `src/backend/config.ts`:

| Variable Name | Production Requirement | Development Fallback |
| :--- | :--- | :--- |
| `PORT` | Custom port | `3000` |
| `NODE_ENV` | `production` | `development` |
| `APP_URL` | `https://moneyplughub.com` | `http://localhost:3000` |
| `JWT_SECRET` | 256-bit cryptographically secure string | `moneyplughub-cosmic-secure-jwt-2026-secret-key` |
| `DB_PATH` | Persistent absolute path | `./data/moneyplughub.db` |
| `STRIPE_SECRET_KEY` | Live Stripe Secret Key | `sk_test_stripe_moneyplughub_2026` |
| `ELEVENLABS_API_KEY` | ElevenLabs Flash v2.5 Voice Key | Graceful fallback (text-only AI if absent) |

### 6.3 Input Sanitization & SQL Injection Immunity
- 100% of SQLite database queries use parameterized prepared statements (`db.prepare('... WHERE x = ?').run(...)`), preventing SQL injection.
- Zod schema validation protects `/api/auth/register` and `/api/auth/login` from payload tampering and malformed types.

---

## 7. FTC 16 CFR Part 255 Regulatory Compliance (R4)

### 7.1 Regulatory Mandate & Scope
Under **FTC 16 CFR Part 255** (*Guides Concerning the Use of Endorsements and Testimonials in Advertising*), any material connection between an endorser (creator) and a seller (MoneyPlugHub / third-party affiliate programs) must be disclosed **clearly and conspicuously**.

Key Requirements:
1. **Prominence & Proximity**: Disclosures must be unavoidable, immediately adjacent to the claim or referral link, and visible before clicking or purchasing.
2. **Visual & Audio Synchrony in Video**: In short-form video (TikTok, YouTube Shorts, Reels), disclosures must appear on-screen for sufficient duration and be audibly stated if verbal endorsements are made.
3. **No Guaranteed Income Representation**: Prohibits unsubstantiated claims of guaranteed earnings or typicality of extreme outlier results.

### 7.2 Compliance State & Discovered Gaps in Existing Implementation

```
+-----------------------------------------------------------------------------------------------+
|                      FTC 16 CFR PART 255 COMPLIANCE AUDIT MATRIX                              |
+-----------------------------+-----------------------+--------------------+--------------------+
| Component / Touchpoint      | Part 255 Requirement  | Current State      | Compliance Status  |
+-----------------------------+-----------------------+--------------------+--------------------+
| ComplianceSafetyPage.tsx    | Full legal statement  | Fully documented   | [PASS] Compliant   |
| 1200x630 Share Card SVG     | Clear affiliate label | Only hash shown    | [GAP] Missing tag  |
| 5-Pulse Cyan Video Scripts  | #ad in first 3 lines  | General tags only  | [GAP] Missing #ad  |
| 5-Pulse Magenta DM Outreaches| Clear sponsor notice | Needs disclosure   | [GAP] Needs header |
| Anti-Fraud Referral Engine  | Log auditability      | Fully implemented  | [PASS] Compliant   |
+-----------------------------+-----------------------+--------------------+--------------------+
```

---

## 8. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Billing | 4-Tier Subscription Plans | Free, Creator ($29), Pro ($149), Enterprise ($499) plan definitions | None (public) | JSON plan list with monthly/annual savings | 500 on db error | `src/backend/routes/billing.ts:155` |
| 2 | Billing | Promo Code Redemption | Validates promo codes and discounts subscription pricing | `{ planId, promoCode }` | `{ status, tier, pricePaid, subscriptionId }` | 401 unauth, 500 error | `src/backend/routes/billing.ts:182` |
| 3 | Billing | FOUNDING50 100% Discount | Hardcoded 100% discount branch for founder cohort | `promoCode='FOUNDING50'` | `finalPrice = 0.00` | None | `src/backend/routes/billing.ts:216` |
| 4 | Billing | Promo Code Validation | Checks expiration, active status, and max usage | `{ code, plan_id }` | `{ code, discount_type, discount_value }` | 400 invalid/expired, 404 not found | `src/backend/routes/billing.ts:442` |
| 5 | Billing | Paywall Authorization Check | Verifies if user has active Creator/Pro/Enterprise tier | Auth token / cookie | `{ status: 'allowed' \| 'paywall', tier }` | 200 unauthenticated | `src/backend/routes/paywall.ts:28` |
| 6 | Billing | Subscription Cancellation | Sets status to `canceled` with access retained until period end | `{ reason }` | `{ success: true, access_until }` | 404 if no active sub | `src/backend/routes/billing.ts:377` |
| 7 | Billing | Revenue Analytics Dashboard | Computes MRR, ARR, active subscribers, and 30-day churn | Admin auth token | `{ mrr, arr, total_revenue, churn_rate_30d }` | 403 non-admin | `src/backend/routes/billing.ts:641` |
| 8 | Database | SQLite WAL Persistence | High-concurrency write-ahead logging with immediate transactions | SQL queries / transactions | ACID execution result | ROLLBACK on transaction error | `src/backend/db.ts:15` |
| 9 | Database | Initial Admin & Task Seeding | Bootstraps default accounts, quests, referral programs | None (auto on boot) | Seeded SQLite records | Logs error on duplicate | `src/backend/db.ts:716` |
| 10 | Sigils | SHA-256 Vector Sigil Math | Procedural SVG rendering from referral hash | `referralCode, size, config` | Deterministic SVG XML / Data URI | Generates fallback palette | `src/backend/routes/sigil.ts:190` |
| 11 | Sigils | 48-Item Forge Marketplace | 12 Auras, 12 Glyphs, 12 Rings, 12 Crests catalog | Auth token | Catalog list with XP costs & level reqs | 401 unauth | `src/backend/routes/sigil.ts:77` |
| 12 | Sigils | Sigil Equipment Persistence | Saves custom aura/glyph/ring/crest to `user_sigil_config` | `{ aura, glyph, ring, crest, motto }` | `{ success: true }` | 400 if level locked | `src/backend/routes/sigil.ts:1458` |
| 13 | Sigils | Cryptographic Creator Passport | Full verified passport with verification hash and stats | `code` (URL param) | `{ passport_number, verification_hash, creator }` | 404 not found | `src/backend/routes/sigil.ts:1516` |
| 14 | Sigils | XP Point Pack Purchases | Direct cash-for-XP point packs with paywall check | `{ packId: 'starter' \| 'alchemist' }` | `{ status: 'SUCCESS', xpAdded, newXP }` | 403 PAYWALL_REQUIRED on free tier | `src/backend/routes/sigil.ts:1595` |
| 15 | Referrals | 30-Day Attribution Tracking | Sets 30-day attribution cookie and logs click | `code` (URL param), headers | 302 redirect + cookie `ref` | 404 on invalid code | `src/backend/routes/referrals.ts:150` |
| 16 | Referrals | AI Traffic Classifier | Detects ChatGPT, Claude, Perplexity, Gemini, Copilot | `Referer`, `User-Agent`, UTM | `{ category, aiPlatform, intentScore }` | Default to direct_recovered | `src/backend/routes/referrals.ts:82` |
| 17 | Referrals | Referral Anti-Fraud Sentinel | 5 clicks/hr IP limit, 24h deduplication, self-referral check | IP address, user ID | Logs to `referral_fraud_log` | Blocks self-referral commission | `src/backend/routes/referrals.ts:178` |
| 18 | Referrals | Single-Click Public Router | Resolves `/go/:slug` with click telemetry increment | `slug` (URL param) | 302 redirect to destination URL | 404 custom error page | `src/backend/routes/routing.ts:11` |
| 19 | Referrals | Automated Commission Approval | Approves pending commission and moves to ready state | Admin auth, `commId` | `{ success: true }` | 400 if already approved | `src/backend/routes/referrals.ts:522` |
| 20 | Referrals | Automated Commission Payout | Credits referrer bank account and records transaction | Admin auth, `commId` | `{ success: true, message }` | 400 if already paid | `src/backend/routes/referrals.ts:541` |
| 21 | Gamification | 6 Wealth Tiers & Mults | 1.0x to 3.0x multipliers based on net worth / level | Net worth cents, level | `WealthTierConfig` | Defaults to Tier 1 | `src/backend/routes/xpEconomy.ts:19` |
| 22 | Gamification | Antigravity XP Conversion | Atomic XP -> Cash liquidity swap with 30s cooldown | `{ xpAmount }` | `{ success: true, cashCreditedCents }` | 429 cooldown, 403 daily limit | `src/backend/routes/xpEconomy.ts:274` |
| 23 | Gamification | Server-Side Quest Verification | Real db state validation (budgets, debts, savings, wallets) | `taskId` | `{ verified: boolean, reason }` | 403 Quest not verified | `src/backend/routes/gamification.ts:45` |
| 24 | Gamification | Daily Quest Cooldowns | 24-hour claim window enforcement | `userId, taskId, 'daily'` | `{ allowed: boolean, reason }` | 429 Daily cooldown active | `src/backend/routes/gamification.ts:122` |
| 25 | Gamification | Daily Mystery Loot Crate | 4-tier gacha loot drop with streak multiplier | Auth token / Guest ID | `{ rarity, baseXp, cashCreditCents, perks }` | 429 Cooldown active | `src/backend/routes/loot.ts:206` |
| 26 | Gamification | 25-Achievement Prestige Matrix | 5 tiers (Bronze to Diamond Apex) with XP/cash rewards | Trigger actions | Auto-unlock & claimable status | 400 if not unlocked | `src/backend/routes/achievements.ts:57` |
| 27 | Gamification | Seasonal Leaderboards | Weekly, Monthly, Seasonal XP rankings | `type` (URL param) | Top 50 leaderboard with user rank | 400 on invalid type | `src/backend/routes/growth.ts:494` |
| 28 | Growth | 1200x630 Share Card Generator | Scalable high-res card with custom sigil & tier stats | `code` (URL param) | SVG XML / JSON / Interactive HTML | 404 on invalid code | `src/backend/routes/growth.ts:548` |
| 29 | Growth | Admin Boost Events | Time-limited global XP & commission multipliers | Admin auth, `{ name, xp_multiplier }` | `{ success: true, id }` | 400 missing fields | `src/backend/routes/growth.ts:945` |
| 30 | Viral Engine | K-Factor & Velocity Model | Computes viral coefficient $K = i \times c$ & surge state | Auth token | `{ kFactor, isViral, viralVelocity }` | Defaults to dormant | `src/backend/routes/viral.ts:116` |
| 31 | Security | JWT Session Authentication | Bearer token / Cookie validation middleware | HTTP request headers / cookies | `req.user` attached to request | 401 unauthenticated, 403 expired | `src/backend/middleware/auth.ts:11` |
| 32 | Security | Admin Authorization Guard | Enforces `role === 'admin'` check on privileged APIs | Authenticated request | Proceeds to next handler | 403 Access denied | `src/backend/middleware/auth.ts:43` |
| 33 | Security | Immutable Audit Logging | Logs critical actions to `audit_logs` | `actorId, action, entity, targetId, details` | SQLite log record | Non-blocking | `src/backend/db.ts:1233` |
| 34 | Studio | 5-Pulse Creator AI Studio | Cyan, Magenta, Gold, Infrared, White content generation | `{ actionType }` | `{ artifact, telemetry, xpAwarded }` | 404 user not found | `src/backend/routes/generate.ts:63` |
| 35 | Compliance | Part 255 Disclosure Standards | Documents FTC rules, #ad requirements, disclaimer | Web view | Rendered compliance policy UI | None | `src/frontend/pages/ComplianceSafetyPage.tsx:43` |

---

## 9. Edge Cases & Observed System Behaviors

| # | Feature | Input / Condition | Observed Behavior | System Resolution / Risk |
|---|---------|-------------------|-------------------|--------------------------|
| 1 | Promo Code | `FOUNDING50` submitted to `/api/billing/validate-promo` | Returns `404 Invalid promo code` because `FOUNDING50` is not in `promo_codes` table. | **Defect**: Must seed `FOUNDING50` in `promo_codes` table to allow preview validation. |
| 2 | Billing Subscribe | User selects `planId = 'pro'` with `FOUNDING50` | User tier is updated to `CREATOR` (`SET subscriptionTier = 'CREATOR'`) instead of `PRO`. | **Defect**: Update query should set `subscriptionTier` based on `effectivePlan`. |
| 3 | Transactions | User buys points via `/api/sigil/points/buy` | Runs `INSERT INTO transactions (id, userId, type, amount, description, createdAt)`. | **Defect**: Column names in `db.ts` are `user_id`, `account_id`, `amount_cents`, `date`, `created_at`. Fails schema integrity. |
| 4 | Referrals | User clicks own referral link and registers | System flags `SELF_REFERRAL` in `referral_fraud_log` and denies commission creation. | Working as intended. |
| 5 | Referrals | Client sends 6 clicks from same IP within 1 hour | First 5 clicks logged; 6th click logs `IP rate limit exceeded` in fraud log and skips click counter. | Working as intended. |
| 6 | Referrals | User registers with referral code from mobile app | 30-day attribution cookie parsed; referrer gets +350 XP and pending $10.00 commission entry. | Working as intended. |
| 7 | XP Conversion | User attempts 2 conversions within 15 seconds | Second request blocked with `429 Quantum Antigravity Cooldown active. Please wait 15s`. | Anti-cheat velocity protection verified. |
| 8 | XP Conversion | Tier 1 user tries to convert $3.00 (exceeding $2.00 limit) | Blocked with `403 Daily conversion limit exceeded for Neo-Emerald Seed`. | Working as intended. |
| 9 | Quests | User attempts to claim `task_emergency_fund` with $10 in savings | Blocked with `403 Quest not verified: You need at least $25.00 in a savings account`. | Server-side verification working as intended. |
| 10 | Quests | User attempts to claim daily quest twice in 24 hours | Blocked with `429 Daily quest cooldown: Xh remaining`. | Working as intended. |
| 11 | Daily Loot | User claims daily crate at hour 25 (within 48h grace) | Crate opens; streak increases from $N \to N+1$; multiplier increases by $+0.05\times$. | Working as intended. |
| 12 | Daily Loot | User claims daily crate after 50 hours ($>48\text{h}$ grace) | Crate opens; streak resets to Day 1; multiplier resets to $1.00\times$. | Grace period expiration working as intended. |
| 13 | Share Card | Direct `<img>` embed requests `/api/growth/share-card/CODE` | Header check returns raw SVG XML with `Content-Type: image/svg+xml`. | Working as intended. |
| 14 | Share Card | Browser address bar navigates to `/api/growth/share-card/CODE` | Returns full immersive HTML presentation with fullscreen controls and copy button. | Working as intended. |
| 15 | FTC Compliance | User copies Cyan pulse hook or downloads share card | Output lacks mandatory `#ad` or clear FTC Part 255 affiliate endorsement disclosure overlay. | **Defect**: Overlay banner required across share cards and AI generator pulses. |

---

## 10. Identified Defects & Implementation Gaps in R3 & R4

1. **Billing Tier Assignment Defect in `billing.ts:232`**:
   `UPDATE users SET subscriptionTier = 'CREATOR'` hardcodes `CREATOR` for any subscription plan, failing to assign `PRO` or `ENTERPRISE` when users purchase higher tiers.
2. **`FOUNDING50` Promo Code Missing from Table Seed**:
   `billing.ts` and `db.ts` create the `promo_codes` table, but `FOUNDING50` is hardcoded only in `/subscribe` and absent from `promo_codes`, causing `/validate-promo` to return `404`.
3. **Transaction Schema Column Mismatch in `sigil.ts:1659`**:
   `POST /api/sigil/points/buy` executes an insert using obsolete column names (`userId`, `amount`, `createdAt`) instead of canonical columns (`user_id`, `account_id`, `amount_cents`, `date`, `created_at`).
4. **FTC 16 CFR Part 255 Disclosure Overlay Gap on Share Cards & AI Pulses**:
   Neither the 1200×630 share card SVG (`growth.ts:607`) nor the 5-pulse copy generator (`generate.ts:130`) includes automated, clear, and conspicuous `#Ad` / `FTC 16 CFR Part 255 Affiliate Endorsement Disclosure` tags.
5. **Frontend TypeScript Incompatibilities in `SigilForgePage.tsx` and `ReferralHubPage.tsx`**:
   - `SigilForgePage.tsx:340, 437`: References `forgeAudio.playLaserPulse()` which is missing from `ForgeAudioEngine`.
   - `ReferralHubPage.tsx:814, 819, 841`: Erroneous props passed to `ReferralConstellationGraph` and `ReferralEarningsSlider`, plus string type property access on funnel steps.
6. **Global Rate-Limiting Middleware Absence**:
   While referral tracking has internal IP rate limits (5 clicks/hr), Express lacks general `express-rate-limit` middleware on critical auth routes (`/login`, `/register`).

---

## 11. Verification Checklist for Implementation

- [x] R3: 4-tier subscription billing logic and `FOUNDING50` discount rules fully surveyed and documented.
- [x] R3: ACID SQLite WAL schema, indexes, pragmas, and transaction handling documented.
- [x] R3: Deterministic SHA-256 SVG sigil generation math and 48-part visual customizer documented.
- [x] R3: 30-day attribution cookie tracking and referral revenue engine documented.
- [x] R3: XP economy, 6 Wealth Tiers, and leaderboard gamification formulas documented.
- [x] R4: Security architecture, session handling, environment isolation, input sanitization, and CORS analyzed.
- [x] R4: FTC 16 CFR Part 255 compliance mandates and disclosure overlay requirements documented.
- [x] All existing defects, schema discrepancies, and type errors cataloged for the implementation swarm.
