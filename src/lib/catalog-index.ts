// Runtime-safe Stripe catalog index for the checkout boundary — deliberately separate from stripe-catalog.ts,
// whose node:fs image scanning can't run in the Workers request path.
//
// Memoization is at MODULE scope (a single module-level promise), not React cache() which is per-request, so the whole
// cold isolate makes ONE products.list call. A failed fetch clears the memo so a transient Stripe error doesn't poison the isolate.

import { listActiveProducts } from '@/lib/stripe-products';
import { getStripeClient } from '@/lib/stripe-client';

export interface CatalogIndexEntry {
  priceId: string;
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

  // Same listing shape as the build-time catalog so checkout always charges what the storefront displayed.
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
