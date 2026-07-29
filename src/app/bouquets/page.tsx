import type { Metadata } from 'next';
import BouquetsPageClient from './bouquets-page-client';

export const metadata: Metadata = {
  title: 'Ribbon Flower Bouquets',
  description:
    'Explore our curated collections of handcrafted ribbon flower bouquets for weddings, home decor, and gifts. Forever-blooming arrangements made with love and care.',
  alternates: {
    canonical: '/bouquets',
  },
};

export default function BouquetsPage() {
  return <BouquetsPageClient />;
}
