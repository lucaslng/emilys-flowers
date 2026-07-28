import { Product } from '@/types';

export const products: Product[] = [
  // =====================
  // INDIVIDUAL FLOWERS (5)
  // =====================
  {
    id: 'ribbon-rose',
    name: 'Ribbon Rose',
    description:
      'A single handcrafted ribbon rose with delicate layered petals. Each rose is meticulously shaped from premium satin ribbon to create a lifelike bloom that never wilts.',
    price: 2499,
    images: ['/placeholders/flower.svg'],
    category: 'flower',
    tags: ['rose', 'classic', 'romantic'],
    inStock: true,
  },
  {
    id: 'ribbon-peony',
    name: 'Ribbon Peony',
    description:
      'Lush and romantic ribbon peony with voluminous petals. This stunning bloom captures the soft, ruffled beauty of a garden peony in full splendor.',
    price: 2999,
    images: ['/placeholders/flower.svg'],
    category: 'flower',
    tags: ['peony', 'romantic', 'garden'],
    inStock: true,
  },
  {
    id: 'ribbon-dahlia',
    name: 'Ribbon Dahlia',
    description:
      'Geometric ribbon dahlia with precisely folded petals. Each layer is carefully arranged to create the distinctive spiral pattern dahlias are known for.',
    price: 2799,
    images: ['/placeholders/flower.svg'],
    category: 'flower',
    tags: ['dahlia', 'geometric', 'bold'],
    inStock: true,
  },
  {
    id: 'ribbon-ranunculus',
    name: 'Ribbon Ranunculus',
    description:
      'Delicate ribbon ranunculus with paper-thin layered petals. This charming flower features the tightly packed, multi-layered blooms that make ranunculus so beloved.',
    price: 2699,
    images: ['/placeholders/flower.svg'],
    category: 'flower',
    tags: ['ranunculus', 'delicate', 'layered'],
    inStock: true,
  },
  {
    id: 'ribbon-wildflower',
    name: 'Ribbon Wildflower Mix',
    description:
      'A charming single stem featuring a mix of miniature ribbon wildflowers. Perfect as a delicate accent or combined with other stems for a custom arrangement.',
    price: 2199,
    images: ['/placeholders/flower.svg'],
    category: 'flower',
    tags: ['wildflower', 'mixed', 'rustic'],
    inStock: true,
  },

  // =====================
  // BOUQUETS (10)
  // =====================

  // --- Featured (3) ---
  {
    id: 'blush-romance',
    name: 'Blush Romance Bouquet',
    description:
      'A romantic arrangement of pink and white ribbon roses, accented with delicate lavender ribbon and soft pearl embellishments. Perfect for weddings or anniversaries.',
    price: 8999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['roses', 'pink', 'white', 'romantic'],
    featured: true,
    inStock: true,
  },
  {
    id: 'lavender-dreams',
    name: 'Lavender Dreams Bouquet',
    description:
      'An enchanting bouquet featuring purple and lilac ribbon flowers with subtle silver ribbon accents. A dreamy arrangement that evokes peaceful lavender fields.',
    price: 7999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['lavender', 'purple', 'dreamy'],
    featured: true,
    inStock: true,
  },
  {
    id: 'spring-meadow',
    name: 'Spring Meadow Bouquet',
    description:
      'A joyful mix of pastel ribbon wildflowers in pink, yellow, and soft blue hues. This cheerful arrangement brings the freshness of a spring meadow indoors.',
    price: 9999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['wildflower', 'pastel', 'spring', 'mixed'],
    featured: true,
    inStock: true,
  },

  // --- Wedding ---
  {
    id: 'bridal-elegance',
    name: 'Bridal Elegance Bouquet',
    description:
      'An exquisite cascade of white ribbon roses and peonies with crystal bead accents. Designed as the perfect bridal bouquet for your special day.',
    price: 14999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['wedding', 'bridal', 'white', 'elegant'],
    inStock: true,
  },
  {
    id: 'rustic-charm',
    name: 'Rustic Charm Bouquet',
    description:
      'A countryside-inspired bouquet with warm-toned ribbon flowers, burlap wrappings, and delicate baby\'s breath accents. Perfect for rustic or barn weddings.',
    price: 9999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['wedding', 'rustic', 'warm', 'boho'],
    inStock: true,
  },

  // --- Home Decor ---
  {
    id: 'sunrise-window',
    name: 'Sunrise Window Arrangement',
    description:
      'A warm and inviting arrangement in sunset hues of orange, gold, and coral. Designed to brighten any room and bring a touch of sunshine to your home.',
    price: 6999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['home', 'warm', 'sunrise', 'decor'],
    inStock: true,
  },
  {
    id: 'calm-waters',
    name: 'Calm Waters Centerpiece',
    description:
      'A serene blue and white ribbon flower arrangement inspired by tranquil waters. Perfect as a dining table centerpiece or bathroom accent.',
    price: 7499,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['home', 'blue', 'white', 'centerpiece'],
    inStock: true,
  },

  // --- Gift ---
  {
    id: 'thank-you-bloom',
    name: 'Thank You Bloom',
    description:
      'A thoughtful gift bouquet of cheerful ribbon flowers in bright, uplifting colors. The perfect way to show gratitude and brighten someone\'s day.',
    price: 5999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['gift', 'cheerful', 'bright', 'thank-you'],
    inStock: true,
  },
  {
    id: 'sympathy-tribute',
    name: 'Sympathy Tribute',
    description:
      'A gentle, understated arrangement in soft whites and creams with subtle lavender accents. Created with care to express condolences and honor a loved one.',
    price: 8499,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['gift', 'sympathy', 'white', 'gentle'],
    inStock: true,
  },

  // --- Seasonal ---
  {
    id: 'autumn-harvest',
    name: 'Autumn Harvest Bouquet',
    description:
      'A rich and warm seasonal arrangement featuring ribbon flowers in deep burgundy, burnt orange, and gold. Captures the cozy essence of fall.',
    price: 7999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['seasonal', 'autumn', 'warm', 'harvest'],
    featured: false,
    inStock: true,
  },
  {
    id: 'winter-wonderland',
    name: 'Winter Wonderland Bouquet',
    description:
      'A sparkling winter arrangement of white and silver ribbon flowers with frosted accents. Brings the magic of a snowy winter landscape indoors.',
    price: 8999,
    images: ['/placeholders/bouquet.svg'],
    category: 'bouquet',
    tags: ['seasonal', 'winter', 'white', 'silver'],
    inStock: true,
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.featured);
}

export function getProductsByCategory(category: 'flower' | 'bouquet'): Product[] {
  return products.filter((p) => p.category === category);
}

export function getPriceRange(products: Product[]): [number, number] {
  const prices = products.map((p) => p.price);
  return [Math.min(...prices), Math.max(...prices)];
}
