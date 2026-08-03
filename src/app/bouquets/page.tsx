import type { Metadata } from 'next';
import { getProductsByCategory } from '@/lib/stripe-catalog';
import JsonLd from '@/components/JsonLd';
import { itemListSchema, breadcrumbSchema } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import BouquetsPageClient from './bouquets-page-client';

export const metadata: Metadata = {
  title: 'Handcrafted Ribbon Bouquets',
  description:
    'Browse our collection of handcrafted ribbon bouquets — romantic, rustic, seasonal, and more. Forever-blooming arrangements handcrafted with love, ready to ship.',
  alternates: {
    canonical: '/bouquets',
  },
};

export default async function BouquetsPage() {
  const products = await getProductsByCategory('bouquet');
  return (
    <>
      <JsonLd data={itemListSchema(products, 'Handcrafted Ribbon Bouquets')} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: SITE_URL },
          { name: 'Bouquets', url: `${SITE_URL}/bouquets` },
        ])}
      />
      <BouquetsPageClient products={products} />
    </>
  );
}
