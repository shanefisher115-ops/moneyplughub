## 2026-08-26T12:46:12Z
You are the E2E Test Writer for Creator Money OS (MoneyPlugHub).

Your working directory is: C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\test_writer_e2e
The project workspace is: C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub
Authoritative requirements: C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\ORIGINAL_REQUEST.md
Test Infrastructure Plan: C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\TEST_INFRA.md
Project Blueprint: C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\PROJECT.md

Instructions:
1. Read ORIGINAL_REQUEST.md, TEST_INFRA.md, and PROJECT.md.
2. Design and implement the full 4-tier opaque-box E2E test suite in `tests/e2e/`:
   - `tests/e2e/tier1-features.test.ts`: ≥55 tests across all 11 features (isolated functionality).
   - `tests/e2e/tier2-boundary.test.ts`: ≥55 tests across boundary values, edge conditions, invalid inputs.
   - `tests/e2e/tier3-cross-feature.test.ts`: ≥11 pairwise cross-feature tests (e.g. promo code + referral attribution + billing upgrade + sigil generation).
   - `tests/e2e/tier4-scenarios.test.ts`: ≥6 real-world complete creator lifecycle workloads.
   - `tests/e2e/runner.ts`: Central test runner executing all tiers, logging progress, and exiting with 0 on pass or 1 on fail.
3. Test runner must test the backend routes, database transactions, sigil crypto math, promo validation, referral attribution, XP conversions, security headers/sanitization, and FTC disclosure compliance.
4. When the test suite files are created and the runner is ready, execute `npx tsx tests/e2e/runner.ts` to verify the runner logic, and publish `C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\TEST_READY.md`.
5. Write your handoff report to `C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\test_writer_e2e\handoff.md` and notify the parent orchestrator via send_message.
