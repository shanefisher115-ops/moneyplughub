import assert from 'assert';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Keypair } from '@solana/web3.js';
import { db, initDb, runInTransaction, initializeUserFinancialProfile } from './db';
import cryptoRoutes from './routes/crypto';
import { config } from './config';

async function runSolanaCryptoTests() {
  console.log('🧪 Starting Solana Web3 Crypto Payment & Payout Integration Tests...\n');

  // 1. Initialize schema & DB
  initDb();

  // 2. Setup Express test server
  const app = express();
  app.use(express.json());
  app.use('/api/crypto', cryptoRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  // 3. Create test user & generate Auth token
  const testUserId = `usr_solana_creator_${Date.now()}`;
  const now = new Date().toISOString();
  const refCode = `SOL-CREATOR-${Date.now()}`;

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, ?, 'hash', 'Solana Creator', 'user', ?, NULL, 0, 100, 1, 3, 'Novice Plug', ?, ?)
    `).run(testUserId, `solana.${Date.now()}@moneyplughub.local`, refCode, now, now);

    initializeUserFinancialProfile(testUserId, `solana.${Date.now()}@moneyplughub.local`);
  });

  const authToken = jwt.sign({ userId: testUserId, email: `solana.${Date.now()}@moneyplughub.local` }, config.jwtSecret, { expiresIn: '1h' });
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  };

  // Test 1: Get Wallet Adapters Metadata
  console.log('► Test 1: GET /api/crypto/solana/adapters');
  const adaptersRes = await fetch(`${baseUrl}/api/crypto/solana/adapters`, { headers: authHeaders });
  const adaptersData = await adaptersRes.json();
  assert.strictEqual(adaptersRes.status, 200);
  assert.strictEqual(adaptersData.success, true);
  assert(adaptersData.data.adapters.some((a: any) => a.name === 'Phantom'));
  assert(adaptersData.data.adapters.some((a: any) => a.name === 'Solflare'));
  console.log('✓ Verified Phantom and Solflare wallet adapter metadata.');

  // Generate valid Solana public key using Keypair
  const testKeypair = Keypair.generate();
  const validSolanaAddress = testKeypair.publicKey.toBase58();

  // Test 2: Connect Phantom Wallet
  console.log('► Test 2: POST /api/crypto/solana/connect');
  const connectRes = await fetch(`${baseUrl}/api/crypto/solana/connect`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      wallet_address: validSolanaAddress,
      wallet_type: 'phantom',
    }),
  });
  const connectData = await connectRes.json();
  assert.strictEqual(connectRes.status, 200);
  assert.strictEqual(connectData.success, true);
  assert.strictEqual(connectData.data.wallet_address, validSolanaAddress);
  console.log(`✓ Phantom wallet connected: ${validSolanaAddress.substring(0, 8)}...`);

  // Test 3: Get Solana Status
  console.log('► Test 3: GET /api/crypto/solana/status');
  const statusRes = await fetch(`${baseUrl}/api/crypto/solana/status`, { headers: authHeaders });
  const statusData = await statusRes.json();
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusData.success, true);
  assert.strictEqual(statusData.data.connected, true);
  assert.strictEqual(statusData.data.wallet_address, validSolanaAddress);
  console.log('✓ Solana status returned connected creator wallet.');

  // Test 4: Execute Instant Creator USDC Payout Transfer
  console.log('► Test 4: POST /api/crypto/payout/usdc');
  const payoutRes = await fetch(`${baseUrl}/api/crypto/payout/usdc`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      amount: 50.0,
      recipient_address: validSolanaAddress,
      notes: 'Weekly Affiliate Earnings Payout',
    }),
  });
  const payoutData = await payoutRes.json();
  assert.strictEqual(payoutRes.status, 200);
  assert.strictEqual(payoutData.success, true);
  assert.strictEqual(payoutData.data.amount, 50.0);
  assert.strictEqual(payoutData.data.recipient_address, validSolanaAddress);
  assert(payoutData.data.tx_hash.startsWith('sol_'));
  console.log(`✓ Instant USDC payout executed: ${payoutData.data.tx_hash.substring(0, 20)}...`);

  // Test 5: Verify Transaction
  console.log('► Test 5: POST /api/crypto/solana/verify-tx');
  const verifyRes = await fetch(`${baseUrl}/api/crypto/solana/verify-tx`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tx_signature: payoutData.data.tx_hash,
    }),
  });
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyRes.status, 200);
  assert.strictEqual(verifyData.success, true);
  assert.strictEqual(verifyData.data.confirmed, true);
  console.log('✓ Verified transaction hash in crypto ledger & Solana engine.');

  // Test 6: Verify Wallets and Ledger List
  console.log('► Test 6: GET /api/crypto/wallets & /api/crypto/ledger');
  const walletsRes = await fetch(`${baseUrl}/api/crypto/wallets`, { headers: authHeaders });
  const walletsData = await walletsRes.json();
  assert.strictEqual(walletsRes.status, 200);
  const usdcWallet = walletsData.data.find((w: any) => w.currency === 'USDC');
  assert.strictEqual(usdcWallet.balance, 200.0); // 250 - 50 = 200

  const ledgerRes = await fetch(`${baseUrl}/api/crypto/ledger`, { headers: authHeaders });
  const ledgerData = await ledgerRes.json();
  assert.strictEqual(ledgerRes.status, 200);
  assert(ledgerData.data.length > 0);
  console.log('✓ Wallets & Ledger updated accurately in durable SQLite.');

  server.close();
  console.log('\n🎉 ALL SOLANA WEB3 CRYPTO PAYMENT & PAYOUT TESTS PASSED 100%!\n');
  process.exit(0);
}

runSolanaCryptoTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
