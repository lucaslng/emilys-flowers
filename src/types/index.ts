export interface Product {
  id: string;
  /** URL slug derived from the product name (e.g. "cream-white-rose"). */
  slug: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: 'flower' | 'bouquet';
  tags: string[];
  featured?: boolean;
  /** Numeric featured rank from Stripe metadata (1, 2, 3…) used to order the home triptych. */
  featuredOrder?: number;
  inStock: boolean;
  /** Stripe metadata `flower_type` (flowers only, e.g. "rose"). */
  flowerType?: string;
  /** Stripe metadata `color` (flowers only, e.g. "cream_white"). */
  color?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
