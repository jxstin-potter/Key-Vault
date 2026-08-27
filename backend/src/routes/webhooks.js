import express from 'express';
import stripe, { isStripeConfigured } from '../lib/stripe.js';
import { fulfillOrder, abandonOrder } from '../lib/fulfillment.js';

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 *
 * Fulfilment lives here, not on the success redirect, so a customer who closes
 * the tab after paying still receives their keys.
 *
 * This route is mounted with express.raw() ABOVE the global express.json() in
 * server.js. Signature verification hashes the exact bytes Stripe sent, so if
 * a JSON parser reaches the body first every request fails with
 * "No signatures found matching the expected signature" even with a correct
 * secret. That mounting order is load-bearing - do not move it.
 */
router.post('/', async (req, res) => {
  if (!isStripeConfigured || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Webhooks are not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    // Only a bad signature earns a 4xx. Anything else must return 2xx or
    // Stripe retries the delivery indefinitely.
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).json({ message: `Webhook Error: ${error.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId || session.client_reference_id;

        if (!orderId) {
          console.error('checkout.session.completed with no orderId', session.id);
          break;
        }

        // Asynchronous methods can complete later; only fulfil once paid.
        if (session.payment_status !== 'paid') {
          console.log(`Session ${session.id} completed but unpaid - awaiting payment`);
          break;
        }

        const result = await fulfillOrder(orderId, {
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined
        });

        console.log(
          result.alreadyFulfilled
            ? `Order ${orderId} already fulfilled - duplicate delivery ignored`
            : `Order ${orderId} fulfilled with ${result.keyCount} keys`
        );
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId || session.client_reference_id;
        if (orderId) await fulfillOrder(orderId);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId || session.client_reference_id;
        if (orderId) {
          const result = await abandonOrder(orderId, 'CANCELLED');
          console.log(`Order ${orderId} expired - released ${result.released ?? 0} keys`);
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId || session.client_reference_id;
        if (orderId) await abandonOrder(orderId, 'FAILED');
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    // Returning 500 asks Stripe to retry, which is what we want for a
    // transient database failure - fulfillOrder is idempotent.
    console.error(`Failed handling ${event.type}:`, error.message);
    res.status(500).json({ message: 'Webhook handler failed' });
  }
});

export default router;
