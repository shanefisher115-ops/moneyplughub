import { db } from '../db';
import crypto from 'crypto';
import { validateTransactionPayload } from './validation';
/**
 * ? Reusable Deduplication Engine
 * Returns existing transaction if user_id, amount, and timestamp match within a 1-second window.
 */
export async function dedupeTransaction(userId, amount, timestamp) {
    const targetTime = new Date(timestamp);
    const startTime = new Date(targetTime.getTime() - 1000).toISOString();
    const endTime = new Date(targetTime.getTime() + 1000).toISOString();
    // 1. Query SQLite local financial_transactions
    const row = db.prepare(`
    SELECT * FROM financial_transactions 
    WHERE user_id = ? 
      AND ABS(amount - ?) < 0.001 
      AND timestamp >= ? 
      AND timestamp <= ?
    LIMIT 1
  `).get(userId, amount, startTime, endTime);
    if (row) {
        return {
            id: row.id,
            user_id: row.user_id,
            amount: row.amount,
            type: row.type,
            source: row.source,
            timestamp: row.timestamp,
            is_real: Boolean(row.is_real),
            processor_id: row.processor_id,
            metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {}),
            created_at: row.created_at,
        };
    }
    return null;
}
/**
 * Persists transaction into the ledger.
 */
function persistTransactionRecord(payload) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `tx_${crypto.randomBytes(16).toString('hex')}`;
    const now = new Date().toISOString();
    db.prepare(`
    INSERT INTO financial_transactions (id, user_id, amount, type, source, timestamp, is_real, processor_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, payload.user_id, payload.amount, payload.type, payload.source, new Date(payload.timestamp || now).toISOString(), payload.is_real ? 1 : 0, payload.processor_id || null, JSON.stringify(payload.metadata || {}), now);
    return {
        id,
        user_id: payload.user_id,
        amount: payload.amount,
        type: payload.type,
        source: payload.source,
        timestamp: new Date(payload.timestamp || now).toISOString(),
        is_real: payload.is_real,
        processor_id: payload.processor_id || null,
        metadata: payload.metadata,
        created_at: now,
    };
}
/**
 * 1. Insert Real Financial Transaction (Stripe-Ready)
 */
export async function insertRealTransaction(stripeEvent, userIdOverride) {
    const eventObject = stripeEvent.data.object;
    const processorId = eventObject.id || stripeEvent.id;
    // Check processor_id idempotency
    const existingByProcessor = db.prepare(`
    SELECT * FROM financial_transactions WHERE processor_id = ? LIMIT 1
  `).get(processorId);
    if (existingByProcessor) {
        return {
            id: existingByProcessor.id,
            user_id: existingByProcessor.user_id,
            amount: existingByProcessor.amount,
            type: existingByProcessor.type,
            source: existingByProcessor.source,
            timestamp: existingByProcessor.timestamp,
            is_real: true,
            processor_id: existingByProcessor.processor_id,
            metadata: JSON.parse(existingByProcessor.metadata || '{}'),
            created_at: existingByProcessor.created_at,
        };
    }
    const userId = userIdOverride ||
        eventObject.metadata?.user_id ||
        eventObject.client_reference_id ||
        eventObject.customer ||
        'u_system_stripe';
    const rawAmount = eventObject.amount_total ?? eventObject.amount ?? 0;
    const amountDollars = Number((rawAmount / 100).toFixed(2));
    const timestamp = new Date(stripeEvent.created * 1000).toISOString();
    const metadata = {
        stripe_event_id: stripeEvent.id,
        stripe_payment_intent_id: eventObject.payment_intent || eventObject.id,
        stripe_customer_id: eventObject.customer,
        stripe_checkout_session_id: eventObject.object === 'checkout.session' ? eventObject.id : undefined,
        currency: eventObject.currency?.toUpperCase() || 'USD',
        payment_method_type: eventObject.payment_method_types?.[0] || 'card',
        livemode: stripeEvent.livemode,
        receipt_url: eventObject.charges?.data?.[0]?.receipt_url || undefined,
        ...eventObject.metadata,
    };
    const payload = {
        user_id: userId,
        amount: amountDollars,
        type: stripeEvent.type.includes('refund') ? 'refund' : 'charge',
        source: 'stripe',
        timestamp,
        is_real: true,
        processor_id: processorId,
        metadata,
    };
    validateTransactionPayload(payload);
    const duplicate = await dedupeTransaction(payload.user_id, payload.amount, payload.timestamp);
    if (duplicate) {
        return duplicate;
    }
    return persistTransactionRecord(payload);
}
/**
 * 2. Insert Synthetic XP Purchase Transaction
 */
export async function insertXPTransaction(userId, itemId, amount, xpAwarded = 100, customMetadata = {}) {
    const timestamp = new Date().toISOString();
    const payload = {
        user_id: userId,
        amount: Number(amount.toFixed(2)),
        type: 'xp_award',
        source: 'xp_purchase',
        timestamp,
        is_real: false,
        processor_id: null,
        metadata: {
            xp_awarded: xpAwarded,
            item: itemId,
            ...customMetadata,
        },
    };
    validateTransactionPayload(payload);
    const duplicate = await dedupeTransaction(payload.user_id, payload.amount, timestamp);
    if (duplicate) {
        return duplicate;
    }
    return persistTransactionRecord(payload);
}
/**
 * 3. Insert Affiliate / Creator Commission Transaction
 */
export async function insertCommission(userId, amount, reason, referralUserId, customMetadata = {}) {
    const timestamp = new Date().toISOString();
    const payload = {
        user_id: userId,
        amount: Number(amount.toFixed(2)),
        type: 'commission',
        source: 'commission',
        timestamp,
        is_real: false,
        processor_id: null,
        metadata: {
            reason,
            referral_user_id: referralUserId,
            ...customMetadata,
        },
    };
    validateTransactionPayload(payload);
    const duplicate = await dedupeTransaction(payload.user_id, payload.amount, timestamp);
    if (duplicate) {
        return duplicate;
    }
    return persistTransactionRecord(payload);
}
/**
 * Queries user transactions with sorting, filtering, and sanitization.
 */
export function getUserTransactions(userId) {
    const rows = db.prepare(`
    SELECT * FROM financial_transactions 
    WHERE user_id = ? 
    ORDER BY timestamp DESC
  `).all(userId);
    return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        amount: r.amount,
        type: r.type,
        source: r.source,
        timestamp: r.timestamp,
        is_real: Boolean(r.is_real),
        processor_id: r.processor_id,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : (r.metadata || {}),
        created_at: r.created_at,
    }));
}
