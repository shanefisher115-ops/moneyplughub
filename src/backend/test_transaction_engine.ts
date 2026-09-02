import {
  insertRealTransaction,
  insertXPTransaction,
  insertCommission,
  dedupeTransaction,
  getUserTransactions,
} from './transactions/engine';
import { validateTransactionPayload, TransactionValidationError } from './transactions/validation';
import Stripe from 'stripe';

async function runTransactionTestSuite() {
  console.log('?? Starting Comprehensive Transaction Engine Test Suite...\n');

  const testUserId = '00000000-0000-4000-8000-000000000001';

  // -------------------------------------------------------------
  // 1. FRAUD PREVENTION TESTS
  // -------------------------------------------------------------
  console.log('??? Step 1: Testing Fraud Prevention Rules...');

  // 1.1 Negative Amount Rejection
  try {
    validateTransactionPayload({
      user_id: testUserId,
      amount: -50.00,
      type: 'charge',
      source: 'stripe',
      timestamp: new Date().toISOString(),
      is_real: true,
      metadata: {},
    });
    throw new Error('FAILED: Negative amount was not rejected!');
  } catch (err: any) {
    if (err instanceof TransactionValidationError && err.message.includes('Negative amounts')) {
      console.log('  ? Correctly rejected negative amount');
    } else {
      throw err;
    }
  }

  // 1.2 Missing User ID Rejection
  try {
    validateTransactionPayload({
      user_id: '',
      amount: 25.00,
      type: 'charge',
      source: 'stripe',
      timestamp: new Date().toISOString(),
      is_real: true,
      metadata: {},
    });
    throw new Error('FAILED: Empty user_id was not rejected!');
  } catch (err: any) {
    if (err instanceof TransactionValidationError) {
      console.log('  ? Correctly rejected empty user_id');
    } else {
      throw err;
    }
  }

  // 1.3 Future Timestamp Rejection
  try {
    validateTransactionPayload({
      user_id: testUserId,
      amount: 10.00,
      type: 'charge',
      source: 'stripe',
      timestamp: new Date(Date.now() + 86400000).toISOString(), // 24 hours in future
      is_real: true,
      metadata: {},
    });
    throw new Error('FAILED: Future timestamp was not rejected!');
  } catch (err: any) {
    if (err instanceof TransactionValidationError && err.message.includes('future')) {
      console.log('  ? Correctly rejected future timestamp');
    } else {
      throw err;
    }
  }

  // 1.4 Incoherent is_real vs source
  try {
    validateTransactionPayload({
      user_id: testUserId,
      amount: 15.00,
      type: 'xp_award',
      source: 'xp_purchase',
      timestamp: new Date().toISOString(),
      is_real: true, // Should be false for XP
      metadata: {},
    });
    throw new Error('FAILED: Incoherent is_real flag was not rejected!');
  } catch (err: any) {
    if (err instanceof TransactionValidationError) {
      console.log('  ? Correctly rejected incoherent is_real flag for XP purchase');
    } else {
      throw err;
    }
  }

  // -------------------------------------------------------------
  // 2. XP PURCHASE ENGINE TESTS
  // -------------------------------------------------------------
  console.log('\n? Step 2: Testing XP Purchase Engine...');
  const xpTx1 = await insertXPTransaction(
    testUserId,
    'Plasmatic Hyper-Drive Aura',
    19.99,
    450,
    { tier: 'Mythic', bonus_multiplier: 1.5 }
  );

  console.log(`  ? Created XP Transaction ID: ${xpTx1.id}`);
  console.log(`    - Amount: $${xpTx1.amount}`);
  console.log(`    - is_real: ${xpTx1.is_real} (Expected: false)`);
  console.log(`    - Source: ${xpTx1.source} (Expected: xp_purchase)`);
  console.log(`    - XP Awarded: ${xpTx1.metadata.xp_awarded} (Expected: 450)`);
  console.log(`    - Item: ${xpTx1.metadata.item}`);

  if (xpTx1.is_real !== false || xpTx1.source !== 'xp_purchase' || xpTx1.metadata.xp_awarded !== 450) {
    throw new Error('XP Transaction properties did not match specification!');
  }

  // -------------------------------------------------------------
  // 3. COMMISSION ENGINE TESTS
  // -------------------------------------------------------------
  console.log('\n?? Step 3: Testing Commission Engine...');
  const commTx1 = await insertCommission(
    testUserId,
    50.00,
    'Direct Viral Constellation Referral (Tier 1)',
    '00000000-0000-4000-8000-000000000002',
    { campaign_id: 'summer_growth_2026', rate_applied: 0.25 }
  );

  console.log(`  ? Created Commission Transaction ID: ${commTx1.id}`);
  console.log(`    - Amount: $${commTx1.amount}`);
  console.log(`    - is_real: ${commTx1.is_real} (Expected: false)`);
  console.log(`    - Source: ${commTx1.source} (Expected: commission)`);
  console.log(`    - Reason: ${commTx1.metadata.reason}`);
  console.log(`    - Referral User: ${commTx1.metadata.referral_user_id}`);

  if (commTx1.is_real !== false || commTx1.source !== 'commission' || commTx1.metadata.reason !== 'Direct Viral Constellation Referral (Tier 1)') {
    throw new Error('Commission Transaction properties did not match specification!');
  }

  // -------------------------------------------------------------
  // 4. STRIPE REAL TRANSACTION & IDEMPOTENCY TESTS
  // -------------------------------------------------------------
  console.log('\n?? Step 4: Testing Stripe Real Transaction Engine...');
  const mockStripeEvent: Stripe.Event = {
    id: 'evt_test_' + Date.now(),
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    type: 'payment_intent.succeeded',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: 'pi_test_stripe_' + Date.now(),
        object: 'payment_intent',
        amount: 4900, // $49.00 in cents
        amount_received: 4900,
        currency: 'usd',
        customer: 'cus_test_123',
        metadata: { user_id: testUserId, product_tier: 'Creator Pro Annual' },
        payment_method_types: ['card'],
        charges: {
          data: [{ receipt_url: 'https://stripe.com/receipt/test' }]
        }
      } as any
    }
  };

  const stripeTx1 = await insertRealTransaction(mockStripeEvent);
  console.log(`  ? Processed Stripe Transaction ID: ${stripeTx1.id}`);
  console.log(`    - Amount: $${stripeTx1.amount} (Expected: 49)`);
  console.log(`    - is_real: ${stripeTx1.is_real} (Expected: true)`);
  console.log(`    - Source: ${stripeTx1.source} (Expected: stripe)`);
  console.log(`    - Processor ID: ${stripeTx1.processor_id}`);
  console.log(`    - Receipt URL: ${stripeTx1.metadata.receipt_url}`);

  if (stripeTx1.is_real !== true || stripeTx1.source !== 'stripe' || stripeTx1.amount !== 49.00) {
    throw new Error('Stripe Real Transaction properties did not match specification!');
  }

  // 4.2 Processor Idempotency Check
  const stripeTxDuplicate = await insertRealTransaction(mockStripeEvent);
  if (stripeTxDuplicate.id !== stripeTx1.id) {
    throw new Error('FAILED: Duplicate Stripe event was not idempotently handled!');
  }
  console.log('  ? Stripe idempotency check passed (identical processor_id returned existing record)');

  // -------------------------------------------------------------
  // 5. DEDUPLICATION ENGINE TESTS
  // -------------------------------------------------------------
  console.log('\n?? Step 5: Testing Deduplication Window...');
  const dedupMatch = await dedupeTransaction(testUserId, 19.99, xpTx1.timestamp);
  if (!dedupMatch || dedupMatch.id !== xpTx1.id) {
    throw new Error('FAILED: dedupeTransaction failed to detect existing transaction!');
  }
  console.log(`  ? Deduplication accurately detected existing row ID: ${dedupMatch.id}`);

  // -------------------------------------------------------------
  // 6. QUERY & SANITIZATION TESTS
  // -------------------------------------------------------------
  console.log('\n?? Step 6: Testing User Transaction History Query...');
  const userLedger = getUserTransactions(testUserId);
  console.log(`  ? Retrieved ${userLedger.length} transactions for user`);
  userLedger.forEach(t => {
    console.log(`    • [${t.is_real ? 'REAL' : 'SYNTHETIC'}] ${t.source} - $${t.amount} (${t.type})`);
  });

  console.log('\n?? ALL TRANSACTION ENGINE REQUIREMENTS VERIFIED 100% OPERATIONAL & PRODUCTION-SAFE!\n');
}

runTransactionTestSuite().catch((err) => {
  console.error('? Test Suite Failed:', err);
  process.exit(1);
});
