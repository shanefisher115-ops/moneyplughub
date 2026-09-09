import crypto from 'crypto';
import { db, runInTransaction, recordAuditLog } from '../db';

// Smart Dunning Schedule Config (in hours relative to payment failure)
// Retry 1: +24h (Day 1)
// Retry 2: +72h (Day 3)
// Retry 3: +120h (Day 5)
// Retry 4: +168h (Day 7)
export const RETRY_INTERVALS_HOURS = [24, 72, 120, 168];
export const DEFAULT_GRACE_PERIOD_DAYS = 7;
export const DEFAULT_RETENTION_DISCOUNT_PERCENT = 20.0;

export interface DunningEvent {
  id: string;
  subscription_id: string;
  invoice_id: string;
  user_id: string;
  status: 'active' | 'retrying' | 'recovered' | 'exhausted' | 'canceled';
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_attempt_at: string | null;
  grace_period_end: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DunningOffer {
  id: string;
  dunning_event_id: string;
  subscription_id: string;
  user_id: string;
  offer_code: string;
  discount_percent: number;
  channel: 'email' | 'sms' | 'in_app' | 'all';
  status: 'pending' | 'sent' | 'accepted' | 'declined' | 'expired';
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export class DunningEngine {
  /**
   * Initializes a dunning workflow when a subscription invoice payment fails.
   */
  static handlePaymentFailure(
    subscriptionId: string,
    invoiceId: string,
    userId: string,
    errorReason: string = 'Card declined / insufficient funds'
  ): DunningEvent {
    const now = new Date();
    const nowIso = now.toISOString();

    // Calculate Grace Period (7 days from first failure)
    const graceEnd = new Date(now.getTime() + DEFAULT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // First retry scheduled in 24h
    const firstRetry = new Date(now.getTime() + RETRY_INTERVALS_HOURS[0] * 60 * 60 * 1000).toISOString();

    // Check if there is already an active dunning event
    const existing: any = db.prepare(
      `SELECT * FROM dunning_events WHERE subscription_id = ? AND status IN ('active', 'retrying') ORDER BY created_at DESC LIMIT 1`
    ).get(subscriptionId);

    if (existing) {
      return existing;
    }

    const eventId = `dun_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    runInTransaction(() => {
      // Mark subscription as past_due
      db.prepare(`UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE id = ?`)
        .run(nowIso, subscriptionId);

      // Create dunning event
      db.prepare(`
        INSERT INTO dunning_events (
          id, subscription_id, invoice_id, user_id, status, attempt_count, max_attempts,
          next_retry_at, last_attempt_at, grace_period_end, last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'retrying', 0, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        subscriptionId,
        invoiceId,
        userId,
        RETRY_INTERVALS_HOURS.length,
        firstRetry,
        nowIso,
        graceEnd,
        errorReason,
        nowIso,
        nowIso
      );

      // Log initial dunning event
      this.logDunningAction(
        eventId,
        'payment_failed',
        'system',
        `Credit card payment failed for invoice ${invoiceId}: ${errorReason}`,
        { invoiceId, subscriptionId, userId }
      );

      this.logDunningAction(
        eventId,
        'retry_scheduled',
        'system',
        `Automated Retry #1 scheduled for ${firstRetry}`,
        { retryNumber: 1, scheduledFor: firstRetry }
      );
    });

    // Automatically dispatch targeted discount retention offer (email/sms/in-app)
    this.createAndDispatchTargetedOffer(eventId, subscriptionId, userId, DEFAULT_RETENTION_DISCOUNT_PERCENT, 'all');

    recordAuditLog(userId, 'DUNNING_WORKFLOW_STARTED', 'dunning_events', eventId, {
      subscriptionId,
      invoiceId,
      graceEnd,
      firstRetry,
    });

    return db.prepare('SELECT * FROM dunning_events WHERE id = ?').get(eventId) as DunningEvent;
  }

  /**
   * Creates and dispatches a targeted discount offer to prevent churn.
   */
  static createAndDispatchTargetedOffer(
    dunningEventId: string,
    subscriptionId: string,
    userId: string,
    discountPercent: number = DEFAULT_RETENTION_DISCOUNT_PERCENT,
    channel: 'email' | 'sms' | 'in_app' | 'all' = 'all'
  ): DunningOffer {
    const now = new Date();
    const nowIso = now.toISOString();

    // Offer expires when grace period ends (or in 7 days)
    const expiresAt = new Date(now.getTime() + DEFAULT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const offerId = `doff_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const offerCode = `KEEP${Math.round(discountPercent)}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Get user details for simulated dispatch
    const user: any = db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(userId);

    runInTransaction(() => {
      // Create promo_code record so foreign key references on subscriptions table remain valid
      db.prepare(`
        INSERT OR IGNORE INTO promo_codes (
          id, code, discount_type, discount_value, max_uses, current_uses, valid_until, is_active, created_at
        ) VALUES (?, ?, 'percent', ?, 1, 0, ?, 1, ?)
      `).run(offerCode, offerCode, discountPercent, expiresAt, nowIso);

      db.prepare(`
        INSERT INTO dunning_offers (
          id, dunning_event_id, subscription_id, user_id, offer_code, discount_percent,
          channel, status, sent_at, accepted_at, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?, NULL, ?, ?)
      `).run(
        offerId,
        dunningEventId,
        subscriptionId,
        userId,
        offerCode,
        discountPercent,
        channel,
        nowIso,
        expiresAt,
        nowIso
      );
    });

    const dispatchSummary = `Targeted offer sent via ${channel.toUpperCase()}: ${discountPercent}% off next billing cycle with code ${offerCode}`;

    this.logDunningAction(
      dunningEventId,
      'offer_sent',
      channel,
      dispatchSummary,
      { offerId, offerCode, discountPercent, email: user?.email }
    );

    return db.prepare('SELECT * FROM dunning_offers WHERE id = ?').get(offerId) as DunningOffer;
  }

  /**
   * Accepts a targeted retention offer, updating subscription discount and recovering the dunning status if payment is retried.
   */
  static acceptRetentionOffer(offerId: string, userId: string): { success: boolean; message: string; discountPercent: number; code: string } {
    const nowIso = new Date().toISOString();

    const offer: any = db.prepare(`SELECT * FROM dunning_offers WHERE id = ? AND user_id = ?`).get(offerId, userId);

    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.status === 'accepted') {
      return { success: true, message: 'Offer already applied to subscription', discountPercent: offer.discount_percent, code: offer.offer_code };
    }

    if (new Date(offer.expires_at) < new Date()) {
      db.prepare(`UPDATE dunning_offers SET status = 'expired' WHERE id = ?`).run(offerId);
      throw new Error('Offer has expired');
    }

    runInTransaction(() => {
      // Mark offer accepted
      db.prepare(`UPDATE dunning_offers SET status = 'accepted', accepted_at = ? WHERE id = ?`)
        .run(nowIso, offerId);

      // Update promo code on subscription or invoice
      db.prepare(`UPDATE subscriptions SET promo_code_id = ?, updated_at = ? WHERE id = ?`)
        .run(offer.offer_code, nowIso, offer.subscription_id);

      db.prepare(`UPDATE promo_codes SET current_uses = current_uses + 1 WHERE code = ?`).run(offer.offer_code);

      this.logDunningAction(
        offer.dunning_event_id,
        'offer_accepted',
        'in_app',
        `User accepted ${offer.discount_percent}% churn retention discount code ${offer.offer_code}`,
        { offerId, offerCode: offer.offer_code }
      );
    });

    recordAuditLog(userId, 'DUNNING_OFFER_ACCEPTED', 'dunning_offers', offerId, {
      offerCode: offer.offer_code,
      discountPercent: offer.discount_percent,
    });

    return {
      success: true,
      message: `Successfully applied ${offer.discount_percent}% retention discount!`,
      discountPercent: offer.discount_percent,
      code: offer.offer_code,
    };
  }

  /**
   * Attempts to retry charging an invoice in dunning status.
   * In production, this invokes Stripe payment intent confirmation / charge retry.
   * If retry parameter simulateSuccess is true or if charge passes, recovers the subscription.
   */
  static retryInvoicePayment(
    dunningEventId: string,
    simulateSuccess: boolean = false
  ): { success: boolean; recovered: boolean; message: string } {
    const now = new Date();
    const nowIso = now.toISOString();

    const dunning: any = db.prepare('SELECT * FROM dunning_events WHERE id = ?').get(dunningEventId);

    if (!dunning) {
      throw new Error('Dunning event not found');
    }

    if (dunning.status === 'recovered') {
      return { success: true, recovered: true, message: 'Subscription already recovered' };
    }

    const newAttemptCount = dunning.attempt_count + 1;

    if (simulateSuccess) {
      // Recovery successful
      runInTransaction(() => {
        // Mark invoice paid
        db.prepare(
          `UPDATE invoices SET status = 'paid', paid_at = ?, payment_method = 'auto_retry', updated_at = ? WHERE id = ?`
        ).run(nowIso, nowIso, dunning.invoice_id);

        // Mark subscription active
        db.prepare(
          `UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?`
        ).run(nowIso, dunning.subscription_id);

        // Mark dunning event recovered
        db.prepare(
          `UPDATE dunning_events SET status = 'recovered', attempt_count = ?, last_attempt_at = ?, next_retry_at = NULL, updated_at = ? WHERE id = ?`
        ).run(newAttemptCount, nowIso, nowIso, dunningEventId);

        this.logDunningAction(
          dunningEventId,
          'retry_succeeded',
          'system',
          `Payment retry #${newAttemptCount} succeeded! Invoice ${dunning.invoice_id} paid. Subscription reactivated.`,
          { attemptCount: newAttemptCount }
        );
      });

      recordAuditLog(dunning.user_id, 'DUNNING_SUBSCRIPTION_RECOVERED', 'dunning_events', dunningEventId, {
        attemptCount: newAttemptCount,
        invoiceId: dunning.invoice_id,
      });

      return { success: true, recovered: true, message: 'Payment successfully processed! Subscription is active.' };
    } else {
      // Retry failed
      const isExhausted = newAttemptCount >= dunning.max_attempts;
      const nextIntervalIndex = Math.min(newAttemptCount, RETRY_INTERVALS_HOURS.length - 1);
      const nextRetry = isExhausted
        ? null
        : new Date(now.getTime() + RETRY_INTERVALS_HOURS[nextIntervalIndex] * 60 * 60 * 1000).toISOString();

      const newStatus = isExhausted ? 'exhausted' : 'retrying';

      runInTransaction(() => {
        db.prepare(`
          UPDATE dunning_events
          SET status = ?, attempt_count = ?, last_attempt_at = ?, next_retry_at = ?, last_error = ?, updated_at = ?
          WHERE id = ?
        `).run(
          newStatus,
          newAttemptCount,
          nowIso,
          nextRetry,
          'Card charge failed on automated retry',
          nowIso,
          dunningEventId
        );

        if (isExhausted) {
          // Grace period check or cancel subscription
          db.prepare(`UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`)
            .run(nowIso, dunning.subscription_id);

          this.logDunningAction(
            dunningEventId,
            'subscription_expired',
            'system',
            `Dunning retries exhausted (${newAttemptCount}/${dunning.max_attempts}). Subscription expired.`,
            { attemptCount: newAttemptCount }
          );
        } else {
          this.logDunningAction(
            dunningEventId,
            'retry_failed',
            'system',
            `Retry #${newAttemptCount} failed. Next retry scheduled for ${nextRetry}`,
            { attemptCount: newAttemptCount, nextRetry }
          );
        }
      });

      return {
        success: false,
        recovered: false,
        message: isExhausted
          ? 'Maximum retry attempts reached. Subscription has expired.'
          : `Payment retry failed. Scheduled next attempt for ${nextRetry}`,
      };
    }
  }

  /**
   * Cron / Worker job to process all due retries & grace period expirations.
   */
  static processScheduledDunningJobs(): { processed: number; recovered: number; expired: number } {
    const nowIso = new Date().toISOString();

    // 1. Find all retrying dunning events whose next_retry_at is in the past
    const dueEvents = db.prepare(`
      SELECT * FROM dunning_events
      WHERE status = 'retrying' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
    `).all(nowIso) as any[];

    let recovered = 0;
    let expired = 0;

    for (const ev of dueEvents) {
      // In automated execution, attempt recovery simulation or real Stripe call
      const res = this.retryInvoicePayment(ev.id, false);
      if (res.recovered) recovered++;
      else if (!res.success && ev.attempt_count + 1 >= ev.max_attempts) expired++;
    }

    // 2. Check for subscriptions past grace period end date
    const graceExpiredEvents = db.prepare(`
      SELECT * FROM dunning_events
      WHERE status = 'retrying' AND grace_period_end <= ?
    `).all(nowIso) as any[];

    for (const gev of graceExpiredEvents) {
      runInTransaction(() => {
        db.prepare(`UPDATE dunning_events SET status = 'exhausted', updated_at = ? WHERE id = ?`).run(nowIso, gev.id);
        db.prepare(`UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`).run(nowIso, gev.subscription_id);

        this.logDunningAction(
          gev.id,
          'subscription_expired',
          'system',
          `Grace period expired (${gev.grace_period_end}). Subscription canceled.`,
          { gracePeriodEnd: gev.grace_period_end }
        );
      });
      expired++;
    }

    return { processed: dueEvents.length + graceExpiredEvents.length, recovered, expired };
  }

  /**
   * Get active dunning status and active retention offers for a specific user.
   */
  static getDunningStatusForUser(userId: string) {
    const activeDunning: any = db.prepare(`
      SELECT d.*, s.plan_id, p.name as plan_name, i.amount_cents, i.total_cents
      FROM dunning_events d
      JOIN subscriptions s ON s.id = d.subscription_id
      JOIN billing_plans p ON p.id = s.plan_id
      JOIN invoices i ON i.id = d.invoice_id
      WHERE d.user_id = ? AND d.status IN ('active', 'retrying')
      ORDER BY d.created_at DESC LIMIT 1
    `).get(userId);

    if (!activeDunning) {
      return { hasActiveDunning: false, dunningEvent: null, offers: [], logs: [] };
    }

    const offers = db.prepare(`
      SELECT * FROM dunning_offers
      WHERE user_id = ? AND dunning_event_id = ? AND status = 'sent' AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `).all(userId, activeDunning.id);

    const logs = db.prepare(`
      SELECT * FROM dunning_logs
      WHERE dunning_event_id = ?
      ORDER BY created_at DESC LIMIT 20
    `).all(activeDunning.id);

    const nowTime = Date.now();
    const graceEndTime = new Date(activeDunning.grace_period_end).getTime();
    const hoursLeftInGrace = Math.max(0, Math.round((graceEndTime - nowTime) / (1000 * 60 * 60)));

    return {
      hasActiveDunning: true,
      dunningEvent: {
        ...activeDunning,
        hoursLeftInGrace,
        amount_formatted: `$${(activeDunning.total_cents / 100).toFixed(2)}`,
      },
      offers,
      logs,
    };
  }

  /**
   * Admin analytics & metrics for dunning conversion and churn prevention.
   */
  static getDunningMetrics() {
    const totalEvents = (db.prepare(`SELECT COUNT(*) as c FROM dunning_events`).get() as any)?.c || 0;
    const activeEvents = (db.prepare(`SELECT COUNT(*) as c FROM dunning_events WHERE status = 'retrying'`).get() as any)?.c || 0;
    const recoveredEvents = (db.prepare(`SELECT COUNT(*) as c FROM dunning_events WHERE status = 'recovered'`).get() as any)?.c || 0;
    const exhaustedEvents = (db.prepare(`SELECT COUNT(*) as c FROM dunning_events WHERE status IN ('exhausted', 'canceled')`).get() as any)?.c || 0;

    const recoveryRatePct = totalEvents > 0 ? ((recoveredEvents / totalEvents) * 100).toFixed(1) : '0.0';

    const offersSent = (db.prepare(`SELECT COUNT(*) as c FROM dunning_offers`).get() as any)?.c || 0;
    const offersAccepted = (db.prepare(`SELECT COUNT(*) as c FROM dunning_offers WHERE status = 'accepted'`).get() as any)?.c || 0;
    const offerConversionPct = offersSent > 0 ? ((offersAccepted / offersSent) * 100).toFixed(1) : '0.0';

    const recentLogs = db.prepare(`
      SELECT l.*, d.user_id, u.email
      FROM dunning_logs l
      JOIN dunning_events d ON d.id = l.dunning_event_id
      JOIN users u ON u.id = d.user_id
      ORDER BY l.created_at DESC LIMIT 25
    `).all();

    return {
      totalEvents,
      activeEvents,
      recoveredEvents,
      exhaustedEvents,
      recoveryRatePct: `${recoveryRatePct}%`,
      offersSent,
      offersAccepted,
      offerConversionPct: `${offerConversionPct}%`,
      recentLogs,
    };
  }

  private static logDunningAction(
    dunningEventId: string,
    action: string,
    channel: string,
    message: string,
    details: Record<string, any> = {}
  ) {
    const logId = `dlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.prepare(`
      INSERT INTO dunning_logs (id, dunning_event_id, action, channel, message, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(logId, dunningEventId, action, channel, message, JSON.stringify(details), new Date().toISOString());
  }
}
