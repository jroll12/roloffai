import { Stripe } from 'stripe';

export const API_VERSION = '2026-10-28.endive';

export function createStripeClient(key = process.env.STRIPE_SECRET_KEY) {
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) {
    throw new Error('STRIPE_SECRET_KEY is missing or not an sk_/rk_ key');
  }
  if (key.startsWith('sk_live_')) {
    console.warn('Using an unrestricted live secret key. Switch to a restricted key (rk_live_...).');
  }
  // Always an instance; never the deprecated global key pattern.
  return new Stripe(key, { apiVersion: API_VERSION });
}

export function isLiveKey(key = process.env.STRIPE_SECRET_KEY) {
  return /^(sk|rk)_live_/.test(key ?? '');
}
