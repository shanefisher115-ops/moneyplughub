/**
 * Central E2E Test Suite Runner for Creator Money OS (MoneyPlugHub)
 * Executes all 4 coverage tiers, logs structured results, and exits with 0 on pass or 1 on fail.
 * Location: tests/e2e/runner.ts
 */

import { TestSuite } from './test-utils';
import { runTier1Tests } from './tier1-features.test';
import { runTier2Tests } from './tier2-boundary.test';
import { runTier3Tests } from './tier3-cross-feature.test';
import { runTier4Tests } from './tier4-scenarios.test';

async function main() {
  const startTime = performance.now();
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                CREATOR MONEY OS (MONEYPLUGHUB) E2E RUNNER                  ║
║                  4-Tier Opaque-Box Production Test Suite                   ║
╚════════════════════════════════════════════════════════════════════════════╝
Timestamp: ${new Date().toISOString()}
Target: Creator Money OS (Full-Stack Engine, SQLite WAL, Sigils, Voice, FTC)
`);

  const suite = new TestSuite();

  try {
    // ── Tier 1: Feature Coverage ──────────────────────────────────────────
    console.log('\n[1/4] 🚀 Executing Tier 1: Feature Coverage (Isolated Functionality)...');
    const t1Start = performance.now();
    await runTier1Tests(suite);
    const t1Duration = Math.round(performance.now() - t1Start);
    const t1Results = suite.results.filter(r => r.tier.includes('Tier 1'));
    const t1Passed = t1Results.filter(r => r.passed).length;
    console.log(`✓ Tier 1 Complete: ${t1Passed}/${t1Results.length} tests passed (${t1Duration}ms)`);

    // ── Tier 2: Boundary & Corner Cases ───────────────────────────────────
    console.log('\n[2/4] 🛡️  Executing Tier 2: Boundary & Corner Cases (Stress & Limits)...');
    const t2Start = performance.now();
    await runTier2Tests(suite);
    const t2Duration = Math.round(performance.now() - t2Start);
    const t2Results = suite.results.filter(r => r.tier.includes('Tier 2'));
    const t2Passed = t2Results.filter(r => r.passed).length;
    console.log(`✓ Tier 2 Complete: ${t2Passed}/${t2Results.length} tests passed (${t2Duration}ms)`);

    // ── Tier 3: Cross-Feature Pairwise Interactions ───────────────────────
    console.log('\n[3/4] ⚡ Executing Tier 3: Cross-Feature Pairwise Interactions...');
    const t3Start = performance.now();
    await runTier3Tests(suite);
    const t3Duration = Math.round(performance.now() - t3Start);
    const t3Results = suite.results.filter(r => r.tier.includes('Tier 3'));
    const t3Passed = t3Results.filter(r => r.passed).length;
    console.log(`✓ Tier 3 Complete: ${t3Passed}/${t3Results.length} tests passed (${t3Duration}ms)`);

    // ── Tier 4: Real-World Creator Lifecycle Scenarios ───────────────────
    console.log('\n[4/4] 🪐 Executing Tier 4: Real-World Creator Lifecycle Scenarios...');
    const t4Start = performance.now();
    await runTier4Tests(suite);
    const t4Duration = Math.round(performance.now() - t4Start);
    const t4Results = suite.results.filter(r => r.tier.includes('Tier 4'));
    const t4Passed = t4Results.filter(r => r.passed).length;
    console.log(`✓ Tier 4 Complete: ${t4Passed}/${t4Results.length} scenarios passed (${t4Duration}ms)`);

    // ── Test Summary & Report ─────────────────────────────────────────────
    const totalDuration = Math.round(performance.now() - startTime);
    const summary = suite.getSummary();

    console.log('\n' + '═'.repeat(78));
    console.log('                        FINAL E2E EXECUTION REPORT');
    console.log('═'.repeat(78));

    // Breakdown Table
    console.log('\n📊 Tier Breakdown:');
    console.log(`   • Tier 1 (Feature Coverage):     ${t1Passed.toString().padStart(3)} / ${t1Results.length.toString().padEnd(3)} (${t1Duration}ms)`);
    console.log(`   • Tier 2 (Boundary & Limits):    ${t2Passed.toString().padStart(3)} / ${t2Results.length.toString().padEnd(3)} (${t2Duration}ms)`);
    console.log(`   • Tier 3 (Cross-Feature Flow):   ${t3Passed.toString().padStart(3)} / ${t3Results.length.toString().padEnd(3)} (${t3Duration}ms)`);
    console.log(`   • Tier 4 (Real-World Scenarios): ${t4Passed.toString().padStart(3)} / ${t4Results.length.toString().padEnd(3)} (${t4Duration}ms)`);

    console.log('\n📈 Totals:');
    console.log(`   • Total Tests Executed: ${summary.total}`);
    console.log(`   • Passed:               ${summary.passed} (${Math.round((summary.passed / summary.total) * 100)}%)`);
    console.log(`   • Failed:               ${summary.failed}`);
    console.log(`   • Total Duration:       ${totalDuration}ms`);

    if (summary.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      suite.results.filter(r => !r.passed).forEach(f => {
        console.error(`   - [${f.tier}] ${f.name}`);
        if (f.error) {
          console.error(`     Error: ${f.error instanceof Error ? f.error.stack || f.error.message : f.error}`);
        }
      });
      console.log('\n💥 Result: FAILED (Exit code 1)\n');
      process.exit(1);
    } else {
      console.log('\n🎉 Result: 100% PASS — ALL TIERS VERIFIED (Exit code 0)\n');
      process.exit(0);
    }
  } catch (fatalErr: any) {
    console.error('\n💥 FATAL RUNNER EXCEPTION:', fatalErr);
    process.exit(1);
  }
}

main();
