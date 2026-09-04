import assert from 'assert';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import { db, initDb, runInTransaction } from './db';
import { config } from './config';
import cryptoRouter from './routes/crypto';

const app = express();
app.use(express.json());
app.use('/api/crypto', cryptoRouter);

async function runSolanaCryptoTests() {
  console.log('🧪 Starting Solana Web3 Crypto & Instant USDC Payout Test Suite...\n');

  // 1. Initialize DB & User
  initDb();

  const userId = `test_solana_user_${Date.now()}`;
  const referredUserId = `test_referred_user_${Date.now()}`;
  const now = new Date().toISOString();

  // Insert primary user
  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, display_name, role, referral_code,
      referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
    ) VALUES (?, ?, 'hash', 'Solana Creator', 'user', ?, NULL, 0, 100, 1, 3, 'Novice Plug', ?, ?)
  `).run(userId, `solana_creator_${Date.now()}@test.moneyplughub.local`, `SOL-${Date.now()}`, now, now);

  // Insert referred user
  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, display_name, role, referral_code,
      referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
    ) VALUES (?, ?, 'hash', 'Referred User', 'user', ?, ?, 0, 10, 1, 1, 'Novice Plug', ?, ?)
  `).run(referredUserId, `referred_user_${Date.now()}@test.moneyplughub.local`, `REF-${Date.now()}`, userId, now, now);

  // Insert approved commission for testing instant payout
  db.prepare(`
    INSERT INTO commission_ledger (
      id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, 5000, 'USD', 'approved', 'Test approved commission for instant USDC payout', ?, ?)
  `).run(`comm_${Date.now()}`, userId, referredUserId, now, now);

  const authToken = jwt.sign({ userId: userId, email: 'solana_creator@test.moneyplughub.local', role: 'user' }, config.jwtSecret);
  const authHeaders = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 2. Generate Solana Keypair for Phantom Wallet simulation
    const phantomKeypair = Keypair.generate();
    const phantomPubKey = phantomKeypair.publicKey.toBase58();

    // Create message and sign with secret key
    const connectMsg = `MoneyPlugHub Solana Wallet Verification: ${userId}`;
    const msgBytes = new TextEncoder().encode(connectMsg);
    const signatureBytes = nacl.sign.detached(msgBytes, phantomKeypair.secretKey);
    const signatureBase58 = bs58.encode(signatureBytes);

    // 3. Test POST /api/crypto/solana/connect with signature
    console.log('➡️ Testing Phantom Wallet Connection & Cryptographic Signature Verification...');
    const connectRes = await fetch(`${baseUrl}/api/crypto/solana/connect`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        address: phantomPubKey,
        wallet_provider: 'phantom',
        signature: signatureBase58,
        message: connectMsg,
        set_preferred: true,
      }),
    });

    const connectData = await connectRes.json();
    assert.strictEqual(connectRes.status, 200, `Expected status 200, got ${connectRes.status}: ${JSON.stringify(connectData)}`);
    assert.strictEqual(connectData.success, true);
    assert.strictEqual(connectData.data.public_key, phantomPubKey);
    assert.strictEqual(connectData.data.wallet_provider, 'phantom');
    assert.strictEqual(connectData.data.is_verified, true);
    console.log('✓ Step 1: Phantom wallet successfully connected and signature verified.');

    // 4. Test GET /api/crypto/solana/status
    console.log('➡️ Testing GET /api/crypto/solana/status...');
    const statusRes = await fetch(`${baseUrl}/api/crypto/solana/status`, {
      headers: authHeaders,
    });
    const statusData = await statusRes.json();
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusData.success, true);
    assert.strictEqual(statusData.data.connected, true);
    assert.strictEqual(statusData.data.public_key, phantomPubKey);
    assert.strictEqual(statusData.data.wallet_provider, 'phantom');
    console.log('✓ Step 2: Solana status endpoint returned connected Phantom wallet details.');

    // 5. Test GET /api/crypto/payouts/overview (Multi-rail Stripe vs Solana)
    console.log('➡️ Testing Multi-Rail Payout Overview...');
    const overviewRes = await fetch(`${baseUrl}/api/crypto/payouts/overview`, {
      headers: authHeaders,
    });
    const overviewData = await overviewRes.json();
    assert.strictEqual(overviewRes.status, 200);
    assert.strictEqual(overviewData.success, true);
    assert.strictEqual(overviewData.data.available_payout_cents, 5000);
    assert.strictEqual(overviewData.data.available_payout_usd, '50.00');
    assert.strictEqual(overviewData.data.methods.length, 2);
    assert(overviewData.data.methods.some((m: any) => m.id === 'solana_usdc'));
    assert(overviewData.data.methods.some((m: any) => m.id === 'stripe'));
    console.log('✓ Step 3: Multi-rail payout comparison verified (Stripe & Solana USDC).');

    // 6. Test POST /api/crypto/solana/payout (Instant USDC payout transfer)
    console.log('➡️ Testing Instant Solana USDC Payout Transfer...');
    const userBefore = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId) as any;
    const initialXp = Number(userBefore.xp);

    const payoutRes = await fetch(`${baseUrl}/api/crypto/solana/payout`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amount: 50.0,
        payout_type: 'creator_payout',
        notes: 'Creator weekly payout via Solana USDC',
      }),
    });
    const payoutData = await payoutRes.json();
    assert.strictEqual(payoutRes.status, 200, `Payout failed: ${JSON.stringify(payoutData)}`);
    assert.strictEqual(payoutData.success, true);
    assert.strictEqual(payoutData.data.amount, 50.0);
    assert.strictEqual(payoutData.data.currency, 'USDC');
    assert.strictEqual(payoutData.data.recipient_address, phantomPubKey);
    assert.strictEqual(payoutData.data.status, 'confirmed');
    assert(payoutData.data.explorer_url.includes('explorer.solana.com'));

    // Check user XP reward (+50 XP)
    const userAfter = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId) as any;
    assert.strictEqual(Number(userAfter.xp), initialXp + 50);

    // Check ledger entry
    const ledgerTx = db.prepare('SELECT * FROM crypto_ledger WHERE id = ?').get(payoutData.data.payout_id) as any;
    assert.strictEqual(ledgerTx.currency, 'USDC');
    assert.strictEqual(ledgerTx.amount, 50.0);
    console.log('✓ Step 4: Instant Solana USDC payout executed, ledger updated, and +50 XP awarded.');

    // 7. Test POST /api/crypto/solana/build-payout-tx
    console.log('➡️ Testing Solana Web3 Client Transaction Builder...');
    const buildTxRes = await fetch(`${baseUrl}/api/crypto/solana/build-payout-tx`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amount: 25.0,
        recipient_address: phantomPubKey,
      }),
    });
    const buildTxData = await buildTxRes.json();
    assert.strictEqual(buildTxRes.status, 200);
    assert.strictEqual(buildTxData.success, true);
    assert(typeof buildTxData.data.tx_base64 === 'string');
    assert.strictEqual(buildTxData.data.recipient, phantomPubKey);
    console.log('✓ Step 5: Serialized Solana Web3 transaction constructed successfully.');

    // 8. Test POST /api/crypto/solana/verify-tx
    console.log('➡️ Testing Solana Transaction Verification...');
    const verifyRes = await fetch(`${baseUrl}/api/crypto/solana/verify-tx`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tx_hash: payoutData.data.tx_hash,
      }),
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyData.success, true);
    assert.strictEqual(verifyData.data.verified, true);
    console.log('✓ Step 6: Solana transaction signature verified on cluster.');

    // 9. Test POST /api/crypto/solana/prefer-payout
    console.log('➡️ Testing Updating Preferred Payout Rail...');
    const preferRes = await fetch(`${baseUrl}/api/crypto/solana/prefer-payout`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        method: 'stripe',
      }),
    });
    const preferData = await preferRes.json();
    assert.strictEqual(preferRes.status, 200);
    assert.strictEqual(preferData.data.preferred_method, 'stripe');
    console.log('✓ Step 7: Preferred payout rail toggle verified.');

    // 10. Test Existing Endpoints (/wallets, /ledger)
    console.log('➡️ Testing Existing Crypto Endpoints...');
    const walletsRes = await fetch(`${baseUrl}/api/crypto/wallets`, { headers: authHeaders });
    const walletsData = await walletsRes.json();
    assert.strictEqual(walletsRes.status, 200);
    assert(Array.isArray(walletsData.data));

    const ledgerRes = await fetch(`${baseUrl}/api/crypto/ledger`, { headers: authHeaders });
    const ledgerData = await ledgerRes.json();
    assert.strictEqual(ledgerRes.status, 200);
    assert(Array.isArray(ledgerData.data));
    console.log('✓ Step 8: Preserved full backward compatibility for existing crypto routes.');

    console.log('\n🎉 ALL SOLANA WEB3 CRYPTO & INSTANT USDC PAYOUT TESTS PASSED WITH 100% SUCCESS!\n');
  } finally {
    server.close();
  }
}

runSolanaCryptoTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Solana Crypto Test failed:', err);
  process.exit(1);
});
