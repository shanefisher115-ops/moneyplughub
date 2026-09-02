# E2E Test Infra: Creator Money OS (MoneyPlugHub)

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md`. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Real-World) |
|---|---------|---------------------|:-----------------:|:-----------------:|:-----------------:|:-------------------:|
| 1 | Full-Stack Type Integrity | R1 | 5 | 5 | ✓ | ✓ |
| 2 | Component & Web Audio DSP | R1, R2 | 5 | 5 | ✓ | ✓ |
| 3 | Voice Engine & WS Pipeline | R2 | 5 | 5 | ✓ | ✓ |
| 4 | 4-Tier Billing & FOUNDING50 | R3 | 5 | 5 | ✓ | ✓ |
| 5 | SQLite WAL Transaction Durability | R3 | 5 | 5 | ✓ | ✓ |
| 6 | SHA-256 SVG Sigil Math | R3 | 5 | 5 | ✓ | ✓ |
| 7 | 30-Day Attribution Tracking | R3 | 5 | 5 | ✓ | ✓ |
| 8 | XP Gamification & Wealth Tiers | R3 | 5 | 5 | ✓ | ✓ |
| 9 | Security, Auth & Sanitization | R4 | 5 | 5 | ✓ | ✓ |
| 10 | FTC 16 CFR Part 255 Overlays | R4 | 5 | 5 | ✓ | ✓ |
| 11 | Production Build & Boot Verification | R5 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Location**: `tests/e2e/`
- **Runner**: Node / `tsx` script (`tests/e2e/runner.ts`)
- **Execution Command**: `npx tsx tests/e2e/runner.ts`
- **Pass/Fail Semantics**: Process exit code 0 on 100% pass, non-zero on any failure.
- **Coverage Tiers**:
  - Tier 1: Feature Coverage (≥55 tests across 11 features)
  - Tier 2: Boundary & Corner Cases (≥55 tests across limits, invalid inputs, edge cases)
  - Tier 3: Cross-Feature Interactions (≥11 tests across coupled state flows)
  - Tier 4: Real-World Workload Scenarios (≥6 end-to-end user journey tests)
  - Tier 5: Adversarial Stress & Chaos Hardening (executed during Final Milestone)
