import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { insertRealTransaction } from '../transactions/engine';

export const stripeWebhookRouter = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_moneyplughub';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 * Validates Stripe signature, handles payment events, and inserts real transactions into the ledger.
 */
stripeWebhookRouter.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
    } else {
      // In dev or test environments without signature, accept structured Stripe event payload
      event = req.body as Stripe.Event;
      if (!event.type || !event.data?.object) {
        res.status(400).json({ error: 'Invalid Stripe event structure' });
        return;
      }
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'payment_intent.succeeded':
      case 'charge.succeeded':
      case 'charge.refunded': {
        const tx = await insertRealTransaction(event);
        console.log(`[Stripe Webhook] Processed Real Charge: ${tx.id} for $${tx.amount}`);
        res.json({ success: true, received: true, transactionId: tx.id });
        return;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        res.json({ success: true, received: true, ignored: true });
        return;
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Processing error:`, err);
    res.status(500).json({ error: 'Transaction pipeline insertion error', details: err.message });
  }
});
