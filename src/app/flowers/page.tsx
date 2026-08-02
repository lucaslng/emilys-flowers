import type { Metadata } from 'next';
import { getProductsByCategory } from '@/lib/stripe-catalog';
import JsonLd from '@/components/JsonLd';
import { itemListSchema, breadcrumbSchema, SITE_URL } from '@/lib/json-ld';
import FlowersPageClient from './flowers-page-client';

export const metadata: Metadata = {
  title: 'Handcrafted Ribbon Flowers',
  description:
    'Browse our collection of handcrafted single-stem ribbon flowers — roses, peonies, dahlias, and more. Forever-blooming blooms handcrafted with love, ready to ship.',
  alternates: {
    canonical: '/flowers',
  },
};

export default async function FlowersPage() {
  const products = await getProductsByCategory('flower');
  return (
    <>
      <JsonLd data={itemListSchema(products, 'Handcrafted Ribbon Flowers')} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: SITE_URL },
          { name: 'Flowers', url: `${SITE_URL}/flowers` },
        ])}
      />
      <FlowersPageClient products={products} />
    </>
  );
}
