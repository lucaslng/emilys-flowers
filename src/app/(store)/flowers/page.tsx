import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductsByCategory } from '@/lib/stripe-catalog';
import { isFlowersEnabled } from '@/lib/flagship-flag';
import JsonLd from '@/components/JsonLd';
import { itemListSchema, breadcrumbSchema } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import FlowersPageClient from './flowers-page-client';

export const metadata: Metadata = {
  title: 'Handcrafted Ribbon Flowers',
  description:
    'Browse our collection of handcrafted single-stem ribbon flowers — roses, peonies, dahlias, and more. Forever-blooming blooms handcrafted with love, ready to ship.',
  alternates: {
    canonical: '/flowers',
  },
  openGraph: {
    title: 'Handcrafted Ribbon Flowers',
    description:
      'Browse our collection of handcrafted single-stem ribbon flowers — roses, peonies, dahlias, and more. Forever-blooming blooms handcrafted with love, ready to ship.',
    url: '/flowers',
    type: 'website',
    siteName: "Emily's Flowers",
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: "Handcrafted pink ribbon rose bouquet — Emily's Flowers, forever blooming",
      },
    ],
  },
};

export default async function FlowersPage() {
  if (!isFlowersEnabled()) notFound();
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
