// seed_payload.ts — Payload seed (36/3 contract)
//
// Seeds the Payload `products` collection with 36 flowers (6 flower types x 6 colors)
// and 3 provisional bouquets, mirroring the data the old Stripe seed
// (scripts/create_flower_products.ts) created.
//
// E2E count assertions depend on this contract:
//   - e2e/flowers.spec.ts  asserts 36 flowers
//   - e2e/bouquets.spec.ts asserts 3 bouquets
//
// Idempotent (upserts by slug) — safe to re-run.
//
// Runs via (requires a D1 database with migrations applied):
//   PAYLOAD_CONFIG_PATH=src/payload.config.ts bunx payload run scripts/seed_payload.ts
//
// Not run in Phase 1 — a later phase applies migrations and executes the seed.

import configPromise from '@payload-config'
import { getPayload } from 'payload'

/** Prices in integer cents (Stripe convention): 499 = $4.99. */
const FLOWERS: Record<string, number> = {
  Rose: 499,
  Plumeria: 399,
  Dahlia: 649,
  Carnation: 649,
  Sunflower: 499,
  Tulip: 399,
}

const COLORS = ['Cream White', 'Cyan', 'Yellow', 'Green', 'Blue', 'Pink']

/** Mirrors the repo's PLACEHOLDER_DESCRIPTION (src/lib/payload-catalog.ts). */
const PLACEHOLDER_DESCRIPTION =
  'A handcrafted ribbon flower, made to order from premium satin ribbon. Each bloom is shaped petal by petal, so no two are ever quite alike.'

/** Same rules as src/lib/payload-catalog.ts slugify: lowercase, trim, non-alphanumerics → '-'. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type ProductSeed = {
  name: string
  slug: string
  description: string
  price: number
  category: 'flower' | 'bouquet'
  tags?: { tag: string }[]
  featured?: boolean
  featuredOrder?: number
  inStock?: boolean
  flowerType?: string
  color?: string
}

const payload = await getPayload({ config: configPromise })

let created = 0
let updated = 0

async function upsertProduct(data: ProductSeed): Promise<void> {
  const existing = await payload.find({
    collection: 'products',
    where: { slug: { equals: data.slug } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.update({ collection: 'products', id: existing.docs[0].id, data })
    updated++
  } else {
    await payload.create({ collection: 'products', data })
    created++
  }
}

let productIndex = 0

for (const [flower, price] of Object.entries(FLOWERS)) {
  for (const color of COLORS) {
    const flowerType = flower.toLowerCase()
    const colorKey = color.toLowerCase().replaceAll(' ', '_')
    // First 3 products (in iteration order) are featured: Cream White Rose, Cyan Rose, Yellow Rose.
    const featured = productIndex < 3

    await upsertProduct({
      name: `${color} ${flower}`,
      slug: slugify(`${color} ${flower}`),
      description: PLACEHOLDER_DESCRIPTION,
      price,
      category: 'flower',
      tags: [{ tag: flowerType }, { tag: colorKey }],
      featured,
      ...(featured ? { featuredOrder: productIndex + 1 } : {}),
      inStock: true,
      flowerType,
      color: colorKey,
    })

    productIndex++
  }
}

const BOUQUETS: ProductSeed[] = [
  {
    name: 'Classic Rose Bouquet',
    slug: 'classic-rose-bouquet',
    description: PLACEHOLDER_DESCRIPTION,
    price: 4999,
    category: 'bouquet',
    featured: false,
  },
  {
    name: 'Lavender Dream Bouquet',
    slug: 'lavender-dream-bouquet',
    description: PLACEHOLDER_DESCRIPTION,
    price: 5999,
    category: 'bouquet',
    featured: false,
  },
  {
    name: 'Rustic Charm Bouquet',
    slug: 'rustic-charm-bouquet',
    description: PLACEHOLDER_DESCRIPTION,
    price: 4499,
    category: 'bouquet',
    featured: false,
  },
]

for (const bouquet of BOUQUETS) {
  await upsertProduct(bouquet)
}

console.log(
  `Seed complete: ${created} created, ${updated} updated (36 flowers + 3 bouquets contract).`,
)
