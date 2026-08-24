// Workers-safe Stripe catalog listing shared by stripe-catalog.ts and catalog-index.ts —
// must NOT import node:* modules (catalog-index runs in the Workers request path).
//
// Auto-paginates past Stripe's 100-per-page cap: without cursor-following, any product past #101
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

/** Lists every active product with default_price expanded, following cursors; unusable products skipped with a warning attributed to `source`. */
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
