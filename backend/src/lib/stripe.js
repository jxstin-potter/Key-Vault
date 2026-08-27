import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

// Stripe is optional at boot. Without a key the server still starts and every
// non-payment route keeps working - the checkout endpoints return 503 instead.
// This means deploying the payment code before the key is configured cannot
// take the store down.
export const isStripeConfigured = Boolean(secretKey);

if (!isStripeConfigured) {
  console.warn('STRIPE_SECRET_KEY is not set - checkout will return 503 until it is.');
}

const stripe = isStripeConfigured ? new Stripe(secretKey) : null;

export default stripe;
