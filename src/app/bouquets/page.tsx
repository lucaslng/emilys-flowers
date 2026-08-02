import type { Metadata } from 'next';
import { getProductsByCategory } from '@/lib/stripe-catalog';
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
  return <BouquetsPageClient products={products} />;
}
