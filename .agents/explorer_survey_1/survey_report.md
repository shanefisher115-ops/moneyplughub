# Creator Money OS (MoneyPlugHub) — Full-Stack & Build Architecture Survey Report

**Author**: Survey Explorer 1 (Full-Stack & Build Architecture)  
**Date**: 2026-08-26  
**Workspace**: `C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub`  
**Integrity Mode**: Development / Read-Only Audit  

---

## 1. Executive Summary & Build Health Overview

Creator Money OS (**MoneyPlugHub**) is a comprehensive, production-grade financial operating system, referral automation platform, and multi-modal AI orchestrator designed for digital creators and financial networks.

### Build & Verification Metrics at a Glance

| Target Pipeline | Command | Status | Result / Findings |
|---|---|---|---|
| **Client Typecheck** | `npx tsc --noEmit` | ❌ FAILED | 513 errors (477 `TS6133` unused vars, 23 real type/prop/import mismatches) |
| **Server Typecheck** | `npx tsc -p tsconfig.server.json --noEmit` | ✅ PASSED | 0 errors across all backend services, routes, and shared types |
| **Client Production Build** | `npx vite build` | ✅ PASSED | Succeeded in 49.09s, generated `dist/client` (1.24 MB single JS bundle chunk) |
| **Backend Test Suite** | `npx tsx src/backend/test.ts` | ✅ PASSED | 8/8 core validation steps passed (12 AI modules, 6 model families, WAL DB) |
| **Gacha Loot Crate Engine** | `npx tsx src/backend/test-loot.ts` | ✅ PASSED | 1,000 roll Monte Carlo simulation verified drop probabilities |
| **Syndicate & Guild Wars** | `npx tsx test_syndicates.ts` | ✅ PASSED | Verified 4 top default syndicates & scoring engines |
| **Beta Seeding & Simulation** | `npx tsx src/backend/scripts/seed-and-test-beta.ts` | ✅ PASSED | E2E attribution, promo code `FOUNDING50`, K-factor calculation verified |

---

## 2. High-Level Architecture & Tech Stack

### Core Technology Layers
1. **Frontend**: React 18.3.1, TypeScript 5.7.3, TailwindCSS 3.4.17, Vite 6.1.0, Lucide React 0.475.0, Framer Motion 13.1.1.
2. **Backend**: Node.js 22+ native SQLite (`DatabaseSync` from `node:sqlite`), Express 4.21.2, JWT, bcryptjs, Zod 3.24.2, Cookie-Parser, CORS.
3. **Voice Subsystem**: Dual-engine audio pipeline with ElevenLabs Flash v2.5 low-latency streaming TTS (`@elevenlabs/elevenlabs-js`), Google Cloud Speech-to-Text with Web Speech API browser fallback, and programmatic Web Audio Solfeggio synthesizers.
4. **Database & Storage**: SQLite in WAL (`Write-Ahead Logging`) mode, `PRAGMA synchronous = NORMAL`, `PRAGMA foreign_keys = ON`, `PRAGMA busy_timeout = 5000`, with atomic transaction helper `runInTransaction`.
5. **Multi-Agent Orchestrator**: Multi-agent mesh (`AutomationAgent`, `BalanceAgent`, `EarningsAgent`, `InsightAgent`, `ReferralAgent`, `StarterOrchestrator`, and `MoneyOS` AI assistant).

---

## 3. Comprehensive Codebase Inventory & Catalog

### 3.1. Frontend Pages (`src/frontend/pages/` — 37 Pages)

| # | Page File | Size (Bytes) | Primary Responsibility |
|---|---|---|---|
| 1 | `AchievementsPage.tsx` | 39,026 | 5-tier achievement unlocking, prestige score computation, and reward claiming. |
| 2 | `AdminAnalyticsPage.tsx` | 24,345 | Deep platform analytics, referral funnel visualizers, and conversion heatmaps. |
| 3 | `AdminPage.tsx` | 26,744 | Commission payouts management, user table moderation, and fraud logs. |
| 4 | `AffiliateDashboardPage.tsx` | 32,566 | Stan Store affiliate settings, weekly video quotas, and payout logs. |
| 5 | `BillingTermsPage.tsx` | 6,234 | Subscription terms, 7-day trial conditions, and refund policies. |
| 6 | `BudgetControlPage.tsx` | 8,775 | Monthly category budgeting, progress tracking, and spend monitoring. |
| 7 | `CashbackPackPage.tsx` | 11,879 | 5-app cash back starter pack (Rakuten, Upside, Fetch, Webull, Robinhood). |
| 8 | `ChangelogRoadmapPage.tsx` | 9,056 | Version release notes, upcoming feature roadmaps, and vote board. |
| 9 | `CommandCenterPage.tsx` | 45,584 | Primary daily command center hub with live widgets and financial metrics. |
| 10 | `ComplianceSafetyPage.tsx` | 7,882 | FTC disclosure guidelines, security rules, and user safety documentation. |
| 11 | `CryptoLedgerPage.tsx` | 13,171 | Multi-asset crypto wallet balances, on-chain transactions, and deposit addresses. |
| 12 | `CryptoProgramsPage.tsx` | 8,842 | Curated list of crypto exchange referral programs with bonus parameters. |
| 13 | `DashboardPage.tsx` | 11,363 | Lightweight high-level financial summary view. |
| 14 | `DebtEliminatorPage.tsx` | 10,643 | Debt payoff calculator supporting Snowball and Avalanche algorithms. |
| 15 | `FinanceOverviewPage.tsx` | 14,827 | Full-stack financial snapshot integrating multi-agent mesh widgets. |
| 16 | `GenerateDashboardPage.tsx` | 18,725 | 5-Pulse AI Studio for short-form video hooks, scripts, DM copy, and strategies. |
| 17 | `GoalsPage.tsx` | 7,212 | Savings, emergency fund, and investment milestones tracker. |
| 18 | `HelpCenterPage.tsx` | 12,571 | Interactive FAQ, video tutorials, and live customer support ticket submissions. |
| 19 | `HowItWorksPage.tsx` | 5,621 | Educational onboarding walkthrough explaining the $10 bounty referral model. |
| 20 | `LandingPage.tsx` | 44,417 | High-converting landing page with 3D hero visuals, live tickers, and CTAs. |
| 21 | `LeaderboardPage.tsx` | 8,594 | Global XP and referral ranking board with seasonal reset timers. |
| 22 | `LoginPage.tsx` | 5,309 | Email/password login with JWT session binding. |
| 23 | `MoneyOSPage.tsx` | 31,811 | Sovereign MoneyOS AI conversational agent interface with live context synthesis. |
| 24 | `PassportPage.tsx` | 24,457 | 3D holographic creator passport with 2048x2048 PNG & SVG vector exporters. |
| 25 | `PlugInOSv5DashboardPage.tsx` | 30,772 | Plug In OS v5 sellable AI orchestrator multi-agent management console. |
| 26 | `PricingPage.tsx` | 10,663 | 4-Tier subscription pricing cards with monthly/annual discount switchers. |
| 27 | `PrimordiaOSDashboardPage.tsx` | 27,880 | Cybernetic command deck linking telemetry, Niagara VFX, and AI engines. |
| 28 | `PrivacyPolicyPage.tsx` | 5,756 | GDPR/CCPA privacy policy and data retention disclosures. |
| 29 | `QuestsPage.tsx` | 9,361 | Daily quests, milestone tasks, and XP reward claiming interface. |
| 30 | `RecurringPage.tsx` | 3,917 | Subscription & recurring bills manager with monthly amortization. |
| 31 | `ReferralHubPage.tsx` | 52,176 | Canonical referral hub with constellation graph, earnings slider, and funnels. |
| 32 | `RegisterPage.tsx` | 8,359 | Account registration with referral code attribution validation. |
| 33 | `SecurityPolicyPage.tsx` | 10,204 | 11-section security architecture documentation and audit disclosure. |
| 34 | `SigilForgePage.tsx` | 64,588 | 48-item procedural cryptographic sigil customizer & marketplace. |
| 35 | `SyndicatesPage.tsx` | 55,304 | Creator syndicates, communal buffs, and weekly guild war battles. |
| 36 | `SystemStatusPage.tsx` | 5,528 | Live uptime, database latency, and API subsystem health monitors. |
| 37 | `WhatIsThisPage.tsx` | 6,640 | Comprehensive product explainer and FAQ. |

---

### 3.2. Frontend Components (`src/frontend/components/` — 45 Components)

| Component File | Size (Bytes) | Functionality |
|---|---|---|
| `AntigravityConversionModal.tsx` | 24,387 | Conversion modal with Solfeggio sound effects and checkout. |
| `AntigravityParticleRitual.tsx` | 6,144 | Particle animation ritual triggered upon rank ascension. |
| `ApiKeyManagerModal.tsx` | 9,348 | Modal for setting ElevenLabs and Google Cloud API credentials in memory. |
| `AscensionCeremonyModal.tsx` | 4,926 | Fullscreen cinematic celebration when unlocking a new wealth tier. |
| `AutomationAgentWidget.tsx` | 12,321 | Toggle and monitor scheduled background Make/Zapier automations. |
| `BalanceAgentWidget.tsx` | 8,938 | Live Plaid/bank snapshot widget with manual re-sync button. |
| `BootScreen.tsx` | 3,726 | High-tech boot loader with initialization progress bar. |
| `BudgetControlCard.tsx` | 2,648 | Compact budget utilization progress card. |
| `ChamberProgressionGate.tsx` | 8,227 | Level-gated chamber lock modal with XP requirements. |
| `CommissionTable.tsx` | 7,325 | Filterable ledger table of pending, approved, and paid commissions. |
| `CosmicDynamicBackground.tsx` | 12,811 | HTML5 Canvas particle background matching active theme. |
| `DailyMysteryLootCrateModal.tsx` | 27,249 | 3D animated gacha crate opener with probability drop engine. |
| `DailyWealthBriefingModal.tsx` | 9,983 | Audio-enabled daily financial morning briefing modal. |
| `DebtEliminatorCard.tsx` | 2,396 | Compact debt payoff summary and avalanche target card. |
| `DynamicMoneyBackground.tsx` | 27,637 | Living canvas particle system with gravity physics. |
| `EarningsAgentWidget.tsx` | 7,869 | Gross/net earnings snapshot widget for daily/weekly/monthly periods. |
| `EmergencyFundCard.tsx` | 2,568 | Emergency savings runway indicator card. |
| `FloatingMoneyOSWindow.tsx` | 60,715 | Draggable, floating MoneyOS AI copilot window with voice streaming. |
| `FloatingXpContainer.tsx` | 6,987 | Floating HUD displaying animated XP gain toasts and level progress. |
| `Footer.tsx` | 6,597 | Platform footer with navigation links and legal disclaimers. |
| `GamificationHUD.tsx` | 3,787 | Sticky header HUD displaying current level, XP bar, and streak badge. |
| `GenerativeDesignSwitcher.tsx` | 10,408 | Visual theme and color palette switcher. |
| `InsightAgentWidget.tsx` | 8,559 | AI-generated financial insights and daily suggestions widget. |
| `LiveCompoundingTicker.tsx` | 2,975 | Real-time ticking passive earnings and yield simulator. |
| `LivingVaultBackground.tsx` | 22,284 | 6-tier interactive physics background (bills, coins, bullions, diamonds). |
| `LivingVaultInteractiveWidget.tsx`| 10,748 | Interactive widget for triggering shockwaves and tuning vault frequencies. |
| `Modal.tsx` | 1,542 | Generic accessible modal dialog wrapper. |
| `Navbar.tsx` | 19,840 | Responsive top navigation bar with tab switching and chamber lock badges. |
| `NetWorthCard.tsx` | 2,389 | Asset vs liability balance sheet breakdown card. |
| `NeuralCalibrationModal.tsx` | 16,599 | User behavior profiling modal (Sprinter vs Slow Builder). |
| `NiagaraParticleCanvas.tsx` | 8,901 | High-performance orbital particle canvas with supernova shockwaves. |
| `OnboardingWizardModal.tsx` | 19,529 | 4-step new user onboarding walkthrough. |
| `OrchestratorWidget.tsx` | 13,505 | StarterOrchestrator control panel for executing the daily agent loop. |
| `PointPackButton.tsx` | 7,687 | XP point pack purchase modal integration. |
| `ProgressionMilestoneBar.tsx` | 6,008 | Visual milestone progress bar with reward previews. |
| `ReferralAgentWidget.tsx` | 13,721 | Content script generator and referral suggestions widget. |
| `ReferralConstellationGraph.tsx`| 7,494 | Interactive SVG graph representing referral networks and energy nodes. |
| `ReferralEarningsSlider.tsx` | 24,667 | Interactive earnings projection calculator with dividend/HYSA equivalents. |
| `ReferralLink.tsx` | 6,840 | One-click copyable referral link card with QR code generator. |
| `ReferralStats.tsx` | 2,761 | High-level referral count and earned commissions cards. |
| `SigilPassportModal.tsx` | 18,811 | Quick modal view of holographic creator sigil passport. |
| `StatusBadge.tsx` | 1,537 | Visual status indicator tag (active, pending, approved, locked). |
| `TierAscensionModal.tsx` | 4,238 | Modal prompting subscription tier upgrades with feature lists. |
| `ViralEngineWidget.tsx` | 21,424 | Real-time K-Factor, viral surge velocity, and squad quests control panel. |
| `WhyUpgradeNowCard.tsx` | 8,124 | Promotional conversion card highlighting premium creator features. |

---

### 3.3. Frontend Context Providers (`src/frontend/context/` — 7 Contexts)

1. `AdaptiveProfileContext.tsx`: Manages behavior-aware profile preferences (Sprinter, Slow Builder, Minimal Friction).
2. `AuthContext.tsx`: Manages user JWT authentication, local storage caching, login, register, and refresh calls.
3. `ClerkAuthWrapper.tsx`: Dual-mode auth provider supporting live Clerk keys with seamless local fallback.
4. `GamificationXpContext.tsx`: Handles real-time XP accumulation, level ups, streak tracking, and sound triggers.
5. `GenerativeDesignContext.tsx`: Manages theme switching, primary accents, background ambient styles, and Solfeggio frequencies.
6. `LivingRealmContext.tsx`: Controls 4 realm access states (`Creator`, `Money`, `Content`, `Primordia`).
7. `LivingVaultContext.tsx`: Manages the 6 wealth tiers (`Neo-Emerald`, `Cyan Cashflow`, `Amethyst Quantum`, `24K Imperial`, `Sovereign Diamond`, `Celestial Osmium`) and real-time net worth binding.

---

### 3.4. Backend API Routes (`src/backend/routes/` — 34 Routes)

| Route Path | File | Purpose |
|---|---|---|
| `/api/auth` | `auth.ts` | Registration, login, JWT issuance, referral validation, password hashing. |
| `/api/referrals` | `referrals.ts` | 30-day cookie click tracking (`/track/:code`), attribution, fraud checks. |
| `/api/billing` | `billing.ts` | 4-Tier plans (`Free`, `Creator`, `Pro`, `Enterprise`), promo codes (`FOUNDING50`), subscriptions. |
| `/api/sigil` | `sigil.ts` | Deterministic SHA-256 SVG generation, 48-item visual catalog, marketplace equipment. |
| `/api/growth` | `growth.ts` | Milestones, referral streaks, boost events, fullscreen 4K share-card generation. |
| `/api/viral` | `viral.ts` | K-Factor algorithm, PulseWave velocity score, viral surge events, squad quests. |
| `/api/achievements`| `achievements.ts`| 5-Tier achievement tracking, milestone checks, prestige score calculations. |
| `/api/syndicates` | `syndicates.ts` | Creator syndicates, communal buffs, weekly guild wars leaderboard. |
| `/api/loot` | `loot.ts` | Daily Mystery Loot Crate gacha rolls, drop probability validation, claim persistence. |
| `/api/xp-economy` | `xpEconomy.ts` | XP point pack purchases, instant level-up boosts, transactional ledger. |
| `/api/moneyos` | `moneyos.ts` | MoneyOS conversational AI with live wallet context synthesis & tools. |
| `/api/voice` | `voice/router.ts`| ElevenLabs TTS streaming, Google Cloud STT, dual-pipeline benchmarking. |
| `/api/generate` | `generate.ts` | 5-Pulse AI Studio (Cyan, Magenta, Gold, Infrared, White creative engines). |
| `/api/v5` | `aiOrchestrator.ts`| Plug In OS v5 sellable AI orchestrator (12 modules, 6 model families). |
| `/api/finance` | `finance.ts` | Financial overview, account balance calculations, budget tracking. |
| `/api/gamification`| `gamification.ts`| User level progression, daily quest status, streak tracking. |
| `/api/crypto` | `crypto.ts` | Multi-asset crypto wallet balance management and ledger transfers. |
| `/api/affiliate` | `affiliate.ts` | Stan Store affiliate settings, weekly video tracking, payout logs. |
| `/api/command-center`| `commandCenter.ts`| Daily command center aggregated snapshot endpoint. |
| `/api/programs` | `programs.ts` | Crypto referral program listings and destination lookups. |
| `/api/cashback-pack`| `cashback.ts`| Curated 5-app cash back starter pack programs. |
| `/api/referral-hub`| `referralHub.ts`| Canonical referral hub programs, funnel templates, and click streams. |
| `/api/agents/*` | `agents/*.ts` | Endpoints for Balance, Earnings, Referral, Automation, and Insight agents. |
| `/api/orchestrator`| `orchestrator.ts`| StarterOrchestrator execution loop and state endpoints. |
| `/api/paywall` | `paywall.ts` | Access gating and feature tier checks. |
| `/api/profile` | `adaptiveProfile.ts`| User behavior profiling (Sprinter vs Slow Builder) and habit patterns. |
| `/api/primordia` | `primordia.ts` | Primordia OS ecosystem status, module registry, and cosmic telemetry. |
| `/api/support` | `support.ts` | Help center ticket creation and FAQ retrieval. |
| `/api/tts` | `tts.ts` | Direct text-to-speech generation utility. |
| `/go/:slug` | `routing.ts` | Single-click public smart redirect engine with instant click analytics. |

---

### 3.5. Database Architecture (`src/backend/db.ts`)

The SQLite database (`data/moneyplughub.db`) is configured with WAL mode (`PRAGMA journal_mode = WAL;`) and full ACID guarantees via `runInTransaction`.

#### Master Table Catalog
1. `users`: Core account, hashed password, referral code, referrer FK, XP, level, streak, tier title, subscription status.
2. `commission_ledger`: Unique `(referrer_user_id, referred_user_id)` pairs, amount in cents, status (`pending`, `approved`, `paid`).
3. `accounts`: Bank, crypto, credit card, liability accounts with balance tracking.
4. `transactions`: Expense, income, transfer, debt payment, and reward transactions.
5. `financial_goals`: Savings, emergency fund, and investment targets with progress.
6. `debts`: Debt balance, APR, minimum payments, and payoff strategy (`snowball` vs `avalanche`).
7. `budgets`: Category spending limits per month.
8. `recurring_bills`: Subscriptions and bills with frequency and due dates.
9. `tasks` & `user_tasks`: Quest tasks, rewards in cents/XP, and completion states.
10. `crypto_wallets` & `crypto_ledger`: Multi-currency wallet addresses and ledger entries.
11. `crypto_referral_programs`: Curated directory of 31 referral partner programs.
12. `user_profile_os`: Adaptive behavior profile (`Sprinter`, `Slow Builder`, `Minimal Friction`), energy patterns.
13. `xp_actions`: Micro-tasks categorized by difficulty (`XS` to `XL`) and XP value.
14. `program_tracker`: Daily platform clicks, signups, and conversions per program.
15. `content_queue`: Short-form video scripts, hooks, platform targets, and performance metrics.
16. `automations_map`: Make.com & Zapier workflow definitions and execution status.
17. `self_understanding_patterns`: AI behavior pattern insights and suggested adjustments.
18. `scratchpad_notes`: User markdown scratchpad.
19. `program_clicks`: Detailed click analytics with IP, source, and campaign.
20. `funnel_templates`: Pre-built 3-step referral conversion funnels.
21. `affiliate_settings` & `affiliate_payout_logs`: Stan Store affiliate configuration and weekly logs.
22. `connected_providers`: Financial provider sync status (`Plaid`, `Ally`, `Coinbase`, `Chase`).
23. `balance_snapshots` & `balance_events`: Balance history and sync telemetry.
24. `earnings_snapshots` & `earnings_events`: Time-windowed earnings computations.
25. `referral_suggestions` & `content_engine_scripts`: Content recommendations.
26. `automation_toggles` & `automation_runs`: Background job scheduler state.
27. `daily_insights`: Daily AI-generated financial summaries and action plans.
28. `orchestrator_state` & `orchestrator_events`: Multi-agent mesh operational status.
29. `audit_logs`: Append-only security audit log.
30. `wealth_tiers`: 6 Sovereign Vault Tiers configuration (`Neo-Emerald` to `Celestial Osmium`).
31. `ai_modules`: 12 AI subsystems (`VisionCore`, `SignalCore`, `PulseWave`, `Osmium`, etc.).
32. `ai_models`: 6 Connected AI model families (`OpenAI`, `Claude`, `Gemini`, `Perplexity`, `Llama`, `Mistral`).
33. `ai_orchestrator_tasks`: Prompt routing, model assignments, token counts, latency, and feedback.
34. `pulse_engine_telemetry`: Real-time system health and RPM throughput.
35. `moneyos_conversations`: Multi-turn conversational message history.
36. `daily_loot_claims`: Gacha loot box claim records and streak verification.
37. `billing_plans`, `subscriptions`, `invoices`, `promo_codes`, `promo_redemptions`, `payment_methods`: Self-hosted billing subsystem.
38. `referral_clicks`, `referral_fraud_log`, `commission_tiers`: Referral attribution engine.
39. `sigil_market_items`, `user_sigil_inventory`, `user_sigil_config`: Sigil Forge marketplace.
40. `viral_surge_events`, `viral_squads`, `viral_squad_members`, `viral_hook_metrics`: Viral engine.
41. `syndicates`, `syndicate_members`: Guild wars and syndicates.
42. `achievements`, `user_achievements`: 5-Tier achievement system.

---

## 4. Comprehensive Defect & Type Mismatch Inventory

Below is the exhaustive catalog of compilation errors, type mismatches, and runtime bugs discovered during the survey.

### 4.1. Real Type Errors & Interface Inconsistencies (23 Errors)

#### Defect 1: `SigilForgePage.tsx` Constructor Shadowing (`new Image()`)
- **File**: `src/frontend/pages/SigilForgePage.tsx`, Line 445
- **Error**: `TS2554: Expected 1 arguments, but got 0.` & `TS7009: 'new' expression, whose target lacks a construct signature, implicitly has an 'any' type.`
- **Root Cause**: `Image` was imported from `lucide-react` at line 14, shadowing the native browser `Image` constructor (`window.Image`).
- **Fix**: Rename the Lucide icon import (e.g. `ImageIcon as LucideImage`) or instantiate `new window.Image()`.

#### Defect 2: Missing `playLaserPulse` & `setMuted` on `ForgeAudioEngine`
- **Files**:
  - `src/frontend/components/AntigravityConversionModal.tsx`, Line 121
  - `src/frontend/pages/PassportPage.tsx`, Lines 191 & 249
  - `src/frontend/pages/SigilForgePage.tsx`, Lines 340 & 437
  - `src/frontend/utils/forgeAudio.ts`, Lines 6–158
- **Error**: `TS2339: Property 'playLaserPulse' does not exist on type 'ForgeAudioEngine'` and `TS2551: Property 'setMuted' does not exist on type 'ForgeAudioEngine'. Did you mean 'getMuted'?`
- **Root Cause**: `ForgeAudioEngine` only defines `toggleMute()` and `getMuted()`, but lacks `setMuted(muted: boolean)` and `playLaserPulse()`.
- **Fix**: Add `setMuted(muted: boolean)` and `playLaserPulse()` methods to `ForgeAudioEngine` in `src/frontend/utils/forgeAudio.ts`.

#### Defect 3: `LivingVaultBackground.tsx` Missing `vx`/`vy` on `CosmicWave`
- **File**: `src/frontend/components/LivingVaultBackground.tsx`, Lines 432, 433, 443, 444, 448, 449, 451, 452
- **Error**: `TS2339: Property 'vx'/'vy' does not exist on type 'VaultEntity'` / `'CosmicWave'`.
- **Root Cause**: `CosmicWave` is part of `VaultEntity` union type, but does not define `vx` and `vy` velocity fields, causing TypeScript to fail when iterating over `entities`.
- **Fix**: Guard the physics loop with `if (ent.type !== 'wave')` or add optional/default `vx: 0, vy: 0` to `CosmicWave`.

#### Defect 4: Missing Props on `ReferralConstellationGraph` & `ReferralEarningsSlider`
- **Files**:
  - `src/frontend/pages/ReferralHubPage.tsx`, Lines 814 & 819
  - `src/frontend/components/ReferralConstellationGraph.tsx`, Line 15
  - `src/frontend/components/ReferralEarningsSlider.tsx`, Line 8
- **Error**: `TS2322: Property 'onNavigate' does not exist on type 'ReferralConstellationGraphProps'` and `Property 'onGetStarted' does not exist on type 'IntrinsicAttributes'`.
- **Root Cause**: `ReferralConstellationGraphProps` omitted `onNavigate?: (tab: string) => void`, and `ReferralEarningsSlider` was declared without a props interface.
- **Fix**: Add `onNavigate?: (tab: string) => void` to `ReferralConstellationGraphProps` and define `interface ReferralEarningsSliderProps { onGetStarted?: () => void; }` for `ReferralEarningsSlider`.

#### Defect 5: `ReferralHubPage.tsx` Step Object Property Access on String Array
- **File**: `src/frontend/pages/ReferralHubPage.tsx`, Lines 841–842
- **Error**: `TS2339: Property 'title' does not exist on type 'string'` & `Property 'text' does not exist on type 'string'`.
- **Root Cause**: `CanonicalFunnelTemplate` defines `steps: string[]`, but JSX attempts to read `step.title` and `step.text`.
- **Fix**: Render `step` directly as a string or parse structured step objects if serialized.

#### Defect 6: Missing `onNavigate` Prop on `FinanceOverviewPage` & `onSyncComplete` on `BalanceAgentWidget`
- **Files**:
  - `src/frontend/App.tsx`, Line 286
  - `src/frontend/pages/FinanceOverviewPage.tsx`, Line 15 & 191
  - `src/frontend/components/BalanceAgentWidget.tsx`, Line 9
- **Error**: `TS2322: Type '{ onNavigate: (tab: string) => void; }' is not assignable to type 'IntrinsicAttributes'` and `Type '{ onSyncComplete: () => Promise<void>; }' is not assignable`.
- **Root Cause**: `FinanceOverviewPage` and `BalanceAgentWidget` were typed as `React.FC` without props interfaces.
- **Fix**: Add `interface FinanceOverviewPageProps { onNavigate?: (tab: string) => void; }` and `interface BalanceAgentWidgetProps { onSyncComplete?: () => void | Promise<void>; }`.

#### Defect 7: `PassportPage.tsx` Prop Mismatch on `NiagaraParticleCanvas`
- **File**: `src/frontend/pages/PassportPage.tsx`, Line 155
- **Error**: `TS2322: Type '{ tier: number; accentColor: string; particleCount: number; speed: number; interactive: boolean; }' is not assignable to type 'NiagaraParticleCanvasProps'.`
- **Root Cause**: `NiagaraParticleCanvasProps` only accepted `{ glowColor?: string; triggerBurst?: boolean; intensity?: string; }`.
- **Fix**: Extend `NiagaraParticleCanvasProps` to support `tier`, `accentColor`, `particleCount`, `speed`, and `interactive`.

#### Defect 8: Unused Import Declaration in `ClerkAuthWrapper.tsx`
- **File**: `src/frontend/context/ClerkAuthWrapper.tsx`, Line 4
- **Error**: `TS6192: All imports in import declaration are unused.`
- **Root Cause**: Line 4 imports `{ Shield, Key, Lock, Sparkles, X, Check, Copy } from 'lucide-react'` but none of them are referenced in the file.
- **Fix**: Remove unused import line.

---

### 4.2. Runtime Database Query Bugs in `moneyos.ts`
- **File**: `src/backend/routes/moneyos.ts`, Lines 88–89
- **Observation**:
  ```ts
  referrals = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_user_id = ?').get(targetId) as any || { count: 0 };
  commissions = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger WHERE user_id = ?').get(targetId) as any || { total: 0 };
  ```
- **Root Cause**:
  1. The table name is `commission_ledger` or `referral_clicks`, not `referrals`.
  2. The column in `commission_ledger` is `referrer_user_id`, not `user_id`.
- **Impact**: Because the query failed and was wrapped in a `try {} catch {}` block, MoneyOS AI conversations silently fell back to 0 referrals and $0.00 earned commissions for all logged-in users.
- **Fix**: Update query to:
  ```ts
  referrals = db.prepare('SELECT COUNT(*) as count FROM commission_ledger WHERE referrer_user_id = ?').get(targetId) as any || { count: 0 };
  commissions = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger WHERE referrer_user_id = ?').get(targetId) as any || { total: 0 };
  ```

---

### 4.3. Unused Variables & Parameters (`TS6133` — 477 Errors)
Under `tsconfig.json` compiler options:
```json
"noUnusedLocals": true,
"noUnusedParameters": true
```
477 warnings/errors are emitted across 37 files because unused Lucide icons, destructured variables, or callback arguments remain declared.
- **Remediation**:
  - Remove unused icon imports across pages and components.
  - Prefix intentional unused callback parameters with `_` (e.g. `_req`, `_idx`, `_val`).
  - Clean up unused private class members in `VoiceEngineKernel.ts` (`audioContext`, `mediaRecorder`, `audioChunks`) and `forgeAudio.ts` (`ambientGain`).

---

## 5. Security, Environment Hardening & FTC Compliance

### 5.1. Authentication & Session Security
- **JWT Signing**: Uses `jwt.sign` with `config.jwtSecret` and 7-day expiration.
- **Secret Fallback Notice**: In `src/backend/config.ts`, `jwtSecret` falls back to `'moneyplughub-cosmic-secure-jwt-2026-secret-key'`. In production mode (`isProd`), an explicit check should enforce that `process.env.JWT_SECRET` is set and not using the default development string.
- **Password Security**: Passwords hashed with `bcrypt.hash(password, 10)`.
- **Rate Limiting / Fraud Guard**: `referrals.ts` enforces a strict 5 clicks/hour per IP rate limit and logs fraud attempts to `referral_fraud_log`.

### 5.2. FTC 16 CFR Part 255 Compliance
- **Requirement**: Any creator referral link or promotional share card that pays real cash bounties ($10 per activation) must display a clear and conspicuous affiliate disclosure.
- **Current State**: `ComplianceSafetyPage.tsx` documents FTC guidelines, but the direct SVG render and HTML view in `src/backend/routes/growth.ts` (`/api/growth/share-card/:code`) and AI generation templates in `src/backend/routes/generate.ts` should explicitly include the standardized disclosure overlay:
  > *"AD / REFERRAL DISCLOSURE: Creator may earn a commission from qualified subscriptions or partner activations. See terms at /terms."*

---

## 6. Build Optimization, Chunking & Container Verification

### 6.1. Vite Build Output Analysis
- Production build succeeds with 0 errors.
- Bundle output:
  - `dist/client/index.html` (1.47 kB)
  - `dist/client/assets/index-BkjgA_Da.css` (112.75 kB)
  - `dist/client/assets/index-BTV-S1rX.js` (1,243.41 kB / gzip: 297.61 kB)
- **Chunk Warning**: Single JS bundle chunk > 1.2 MB.
- **Optimization Strategy**: Configure `vite.config.ts` with `build.rollupOptions.output.manualChunks` to split vendor dependencies:
  - `vendor-react`: `react`, `react-dom`
  - `vendor-motion`: `framer-motion`
  - `vendor-icons`: `lucide-react`
  - `vendor-clerk`: `@clerk/clerk-react`

### 6.2. PostCSS Module Type Warning
- `postcss.config.js` detected as ES module without `"type": "module"` in `package.json`.
- **Remediation**: Rename to `postcss.config.cjs` or ensure CommonJS syntax `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };`.

---

## 7. Actionable Recommendations for Swarm Agents

1. **Subagent 1 (Client Typecheck & Defect Fix)**:
   - Fix all 8 core type error groups (Defs 1–8).
   - Clean up unused imports and parameters across all frontend files to achieve clean `tsc --noEmit` exit code 0.
2. **Subagent 2 (Voice Engine & Audio Pipeline)**:
   - Implement missing methods (`playLaserPulse`, `setMuted`) in `forgeAudio.ts`.
   - Remove unused private properties in `VoiceEngineKernel.ts`.
   - Test ElevenLabs / Web Speech fallback under simulated network drops.
3. **Subagent 3 (Database & MoneyOS AI Engine)**:
   - Fix invalid SQL queries in `src/backend/routes/moneyos.ts` (`WHERE referrer_user_id = ?`).
   - Validate referral attribution, promo code `FOUNDING50`, and ACID WAL transaction safety.
4. **Subagent 4 (FTC Compliance & Security Hardening)**:
   - Add standardized FTC 16 CFR Part 255 disclosure overlays to `growth.ts` share cards and `generate.ts` outputs.
   - Enforce production JWT secret validation in `config.ts`.
5. **Subagent 5 (Build & Chunk Optimization)**:
   - Update `vite.config.ts` with `manualChunks` to eliminate the >500kB single bundle warning.
   - Fix PostCSS module type warning.
   - Re-run `npm run build` and verify container boot scripts.

---
*Report generated and validated autonomously by Survey Explorer 1.*
