// src/lib/stripe-client.ts
//
// Server-only: the single Stripe client for the whole app. Every surface
// (checkout, receipt, webhook, admin, catalog) shares one memoized instance
// per cold isolate instead of constructing its own. Memoization is at MODULE
// scope (same pattern as catalog-index.ts) so a warm isolate never pays the
// constructor again.
//
// Missing-key handling is deliberately NOT centralized here: each caller
// keeps its own response copy when `getStripeClient()` returns `null` (the
// status codes and messages intentionally differ across surfaces).

import Stripe from 'stripe';

interface CachedClient {
  ctor: typeof Stripe;
  key: string;
  client: Stripe;
}

let cached: CachedClient | null = null;

/**
 * The memoized Stripe client, or `null` when `STRIPE_SECRET_KEY` is unset.
 * A `null` result is never cached (a key that appears later still works).
 * The memo is keyed on the live `Stripe` constructor binding too — bun's
 * process-global `mock.module` swaps that binding between test files, and a
 * stale instance built from another file's mock would be missing methods.
 */
export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!cached || cached.key !== secretKey || cached.ctor !== Stripe) {
    cached = {
      ctor: Stripe,
      key: secretKey,
      client: new Stripe(secretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      }),
    };
  }
  return cached.client;
}
