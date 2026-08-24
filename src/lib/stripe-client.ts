// Single memoized Stripe client shared by every surface (checkout, receipt, webhook, admin, catalog), module-scope like catalog-index.ts.
//
// Missing-key handling is deliberately NOT centralized here: each caller keeps its own response copy when
// getStripeClient() returns null — the status codes and messages intentionally differ across surfaces.

import Stripe from 'stripe';

interface CachedClient {
  ctor: typeof Stripe;
  key: string;
  client: Stripe;
}

let cached: CachedClient | null = null;

/** Memoized client, or null when STRIPE_SECRET_KEY is unset (null never cached). Memo keyed on the Stripe ctor too — bun's mock.module swaps it between test files. */
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
