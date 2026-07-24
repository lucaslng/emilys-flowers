export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: 'flower' | 'bouquet';
  tags: string[];
  featured?: boolean;
  inStock: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
