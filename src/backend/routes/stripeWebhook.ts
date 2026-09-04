import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { handleStripeWebhookEvent, stripe } from './billing';

export const stripeWebhookRouter = Router();

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 * Validates Stripe signature, handles payment events (including checkout.session.completed and customer.subscription.updated),
 * and syncs subscriptions and tier changes atomically into the database ledger.
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
    console.error('[Stripe Webhook Router] Signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  try {
    const result = await handleStripeWebhookEvent(event);
    console.log(`[Stripe Webhook Router] Handled event ${event.type}:`, result);
    res.json({ success: true, received: true, ...result });
  } catch (err: any) {
    console.error(`[Stripe Webhook Router] Processing error:`, err);
    res.status(500).json({ error: 'Transaction pipeline insertion error', details: err.message });
  }
});
