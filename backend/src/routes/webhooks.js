import express from 'express';
import stripe, { isStripeConfigured } from '../lib/stripe.js';
import prisma from '../lib/prisma.js';
import { fulfillOrder, abandonOrder } from '../lib/fulfillment.js';
import { markOrderRefunded } from '../lib/refunds.js';

const router = express.Router();

/**
 * @route POST /api/webhooks/stripe
 * @access Public, but signature-verified (Stripe, not a browser, calls this)
 * @description Receives all Stripe Checkout/Charge events. Fulfilment lives
 *   here, not on the success redirect, so a customer who closes the tab
 *   after paying still receives their keys.
 *
 *   This route is mounted with express.raw() ABOVE the global express.json()
 *   in app.js. Signature verification hashes the exact bytes Stripe sent, so
 *   if a JSON parser reaches the body first every request fails with
 *   "No signatures found matching the expected signature" even with a
 *   correct secret. That mounting order is load-bearing - do not move it.
 *
 *   Stripe guarantees at-least-once delivery and retries on any non-2xx
 *   response, so every branch here must be idempotent (fulfillOrder,
 *   abandonOrder, and markOrderRefunded all are - see lib/fulfillment.js and
 *   lib/refunds.js) and a transient failure must return 500 to ask for a
 *   retry rather than silently swallowing the event with a 200.
 * @param {Buffer} req.body - Raw (unparsed) request body, required for
 *   `stripe.webhooks.constructEvent` to verify the signature.
 * @param {string} req.headers.stripe-signature - Stripe's signature header.
 * @returns {200} `{ received: true }` - event handled (including a no-op for
 *   an event type not handled below, or a duplicate/already-processed one).
 * @returns {400} Signature verification failed - Stripe will not retry a 4xx.
 * @returns {500} An error occurred while processing a verified event - asks
 *   Stripe to retry, safe because every handler below is idempotent.
 * @returns {503} Stripe or the webhook secret is not configured.
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

      // A refund can start in the Stripe dashboard rather than in our admin
      // area - a support agent handling a chargeback, say. Without this case
      // the money would go back and our database would still show the order
      // COMPLETED with working keys. It is also the reconciliation path for a
      // refund that succeeded at Stripe but failed to record here.
      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId =
          typeof charge.payment_intent === 'string' ? charge.payment_intent : null;

        if (!paymentIntentId) {
          console.error('charge.refunded with no payment_intent', charge.id);
          break;
        }

        const order = await prisma.order.findFirst({
          where: { paymentIntent: paymentIntentId },
          select: { id: true }
        });

        if (!order) {
          // Not necessarily an error: the charge may belong to another system
          // sharing this Stripe account.
          console.warn(`charge.refunded for unknown payment intent ${paymentIntentId}`);
          break;
        }

        const result = await markOrderRefunded(order.id, { refundId: charge.id });
        console.log(
          result.alreadyRefunded
            ? `Order ${order.id} already refunded - duplicate delivery ignored`
            : `Order ${order.id} refunded, ${result.revokedKeys} keys revoked`
        );
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
