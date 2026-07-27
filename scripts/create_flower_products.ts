// create_flower_products.ts

import { Stripe } from 'stripe';

const stripe =  new Stripe('sk_test_51TvqVqAOFHl3whPFxx52hn62SDFF2se9S0JjFr7XXW1XR6AO23naE7aXNWrLoc88v6Da5fS6Sfxb5MMJxzQE7GAP00LO4NpHGG');

const FLOWERS = {
	'Rose': 4.99,
	'Plumeria': 3.99,
	'Dahlia': 6.49,
	'Carnation': 6.49,
	'Sunflower': 4.99,
	'Tulip': 3.99,
}

const COLORS = [
	'Cream White',
	'Cyan',
	'Yellow',
	'Green',
	'Blue',
	'Pink',
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createProductWithRetry(
  stripe: Stripe,
  params: Stripe.ProductCreateParams,
  maxRetries = 5
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await stripe.products.create(params);
    } catch (err) {
      if (
        err instanceof Stripe.errors.StripeRateLimitError &&
        attempt < maxRetries
      ) {
        const delay = 1000 * 2 ** attempt; // 1s, 2s, 4s, 8s, 16s
        console.warn(`Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }
}

for (const [flower, price] of Object.entries(FLOWERS)) {
  for (const color of COLORS) {
    await createProductWithRetry(stripe, {
      name: `${color} ${flower}`,
      default_price_data: {
        currency: 'CAD',
        unit_amount: price * 100,
      },
      metadata: {
        category: 'flower',
        flower_type: flower.toLowerCase(),
        color: color.toLowerCase().replaceAll(' ', '_'),
      },
      tax_code: 'txcd_99999999',
    });
  }
}

export { };
