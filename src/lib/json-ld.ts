import type { Product } from '@/types';
import { SITE_URL } from '@/lib/site';
import { formatPrice } from '@/lib/format';

/** Escapes < and U+2028/9 as \uXXXX so a value containing </script> can't terminate the script tag; the escapes parse back to identical characters. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@id': `${SITE_URL}#organization`,
    '@type': ['Organization', 'Store'],
    name: "Emily's Flowers",
    url: SITE_URL,
    logo: `${SITE_URL}/apple-touch-icon.png`,
    priceRange: '$$',
    sameAs: ['https://instagram.com/emilysflowers_'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'hello@emilysflowers.ca',
    },
  };
}

export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: "Emily's Flowers",
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}#organization` },
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
    image: product.images.map((i) => `${SITE_URL}${i}`),
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