import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

/**
 * Whether STRIPE_SECRET_KEY is set.
 *
 * Stripe is optional at boot. Without a key the server still starts and every
 * non-payment route keeps working - the checkout endpoints return 503 instead.
 * This means deploying the payment code before the key is configured cannot
 * take the store down. Routes and lib/refunds.js check this flag before
 * calling the Stripe SDK.
 *
 * @type {boolean}
 */
export const isStripeConfigured = Boolean(secretKey);

if (!isStripeConfigured) {
  console.warn('STRIPE_SECRET_KEY is not set - checkout will return 503 until it is.');
}

/**
 * The configured Stripe SDK client, or `null` if STRIPE_SECRET_KEY is unset.
 * Callers must check `isStripeConfigured` (or handle a null client) before use.
 * @type {import('stripe').Stripe | null}
 */
const stripe = isStripeConfigured ? new Stripe(secretKey) : null;

export default stripe;
