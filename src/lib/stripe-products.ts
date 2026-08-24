// src/lib/stripe-products.ts
//
// Shared, Workers-safe Stripe catalog listing used by BOTH the build-time
// catalog (`src/lib/stripe-catalog.ts`) and the runtime checkout index
// (`src/lib/catalog-index.ts`). This module must NOT import node:* modules —
// catalog-index runs in the Cloudflare Workers request path, where node:fs is
// unavailable (image scanning stays in stripe-catalog.ts).
//
// Auto-paginates `products.list` via `starting_after`: Stripe caps a single
// page at 100 results, so without cursor-following any product past #101
// silently vanished from the storefront and became unpurchasable.

import Stripe from 'stripe';

const PAGE_LIMIT = 100;

/** A product whose expanded `default_price` is usable for pricing. */
export type PricedStripeProduct = Stripe.Product & {
  default_price: Stripe.Price & { id: string; unit_amount: number };
};

function hasUsableDefaultPrice(
  product: Stripe.Product
): product is PricedStripeProduct {
  const dp = product.default_price;
  return (
    typeof dp === 'object' && dp !== null && !!dp.id && dp.unit_amount != null
  );
}

/**
 * List every active Stripe product with its default price expanded, following
 * `has_more`/`starting_after` cursors until the catalog is exhausted. Products
 * without a usable default price are skipped with a warning attributed to
 * `source` (the calling module's name, so logs stay attributable).
 */
export async function listActiveProducts(
  stripe: Stripe,
  source: string
): Promise<PricedStripeProduct[]> {
  const priced: PricedStripeProduct[] = [];
  let startingAfter: string | undefined;
  do {
    const page = await stripe.products.list({
      limit: PAGE_LIMIT,
      expand: ['data.default_price'],
      active: true,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const product of page.data) {
      if (!hasUsableDefaultPrice(product)) {
        console.warn(
          `[${source}] Skipping "${product.name}" (${product.id}): no usable default price.`
        );
        continue;
      }
      priced.push(product);
    }
    startingAfter = page.has_more ? (page.data.at(-1)?.id ?? undefined) : undefined;
  } while (startingAfter);
  return priced;
}
