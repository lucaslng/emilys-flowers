import type { Product } from '@/types';
import { SITE_URL } from '@/lib/site';
import { formatPrice } from '@/lib/format';

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'Store'],
    name: "Emily's Flowers",
    url: SITE_URL,
    logo: `${SITE_URL}/apple-touch-icon.png`,
    priceRange: '$$',
  };
}

export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: "Emily's Flowers",
    url: SITE_URL,
  };
}

export function itemListSchema(products: Product[], name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: `${SITE_URL}/products/${product.slug}`,
    })),
  };
}

export function productSchema(product: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: `${SITE_URL}${product.images[0]}`,
    brand: {
      '@type': 'Brand',
      name: "Emily's Flowers",
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CAD',
      price: formatPrice(product.price),
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/products/${product.slug}`,
    },
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}