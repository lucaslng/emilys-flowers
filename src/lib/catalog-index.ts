// src/lib/catalog-index.ts
//
// Server-only: a minimal, runtime-safe Stripe catalog index for the checkout
// boundary — product id → { priceId, name, unitAmount }.
//
// This is deliberately SEPARATE from `src/lib/stripe-catalog.ts`: that module
// scans `public/products/<slug>/` with `node:fs` to attach build-time images,
// which cannot run in the Cloudflare Workers request path. This module calls
// the Stripe API directly and imports nothing Node-specific, so it is safe to
// pull into a Worker route handler.
//
// Memoization is at MODULE scope (a single module-level promise), not React
// `cache()` — `cache()` is per-request, while a module-level promise persists
// for the lifetime of the cold isolate, so the whole isolate makes ONE
// products.list call no matter how many checkouts it serves. A failed fetch
// clears the memo so a transient Stripe error doesn't poison the isolate.

import { listActiveProducts } from '@/lib/stripe-products';
import { getStripeClient } from '@/lib/stripe-client';

export interface CatalogIndexEntry {
  /** The active Stripe Price id to pass as `line_items[].price`. */
  priceId: string;
  /** The Stripe product display name (used for ChitChats package contents). */
  name: string;
  /** Unit price in integer cents (Stripe convention). */
  unitAmount: number;
}

export type CatalogIndex = ReadonlyMap<string, CatalogIndexEntry>;

let indexPromise: Promise<CatalogIndex> | null = null;

async function fetchCatalogIndex(): Promise<CatalogIndex> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error(
      'STRIPE_SECRET_KEY is required to resolve cart items against the Stripe catalog.'
    );
  }

  // Same listing shape as the build-time catalog (active products with their
  // default price expanded, auto-paginated) so checkout always charges what
  // the storefront displayed.
  const listed = await listActiveProducts(stripe, 'catalog-index');

  const index = new Map<string, CatalogIndexEntry>();
  for (const p of listed) {
    index.set(p.id, {
      priceId: p.default_price.id,
      name: p.name,
      unitAmount: p.default_price.unit_amount,
    });
  }
  return index;
}

/**
 * The memoized catalog index. One Stripe `products.list` call per cold
 * isolate; concurrent callers share the in-flight promise.
 */
export function getCatalogIndex(): Promise<CatalogIndex> {
  if (!indexPromise) {
    indexPromise = fetchCatalogIndex().catch((error) => {
      // Don't cache failures — let the next request retry.
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
}
