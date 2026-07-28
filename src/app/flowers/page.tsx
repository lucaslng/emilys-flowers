import type { Metadata } from 'next';
import FlowersPageClient from './flowers-page-client';

export const metadata: Metadata = {
  title: 'Handcrafted Ribbon Flowers',
  description:
    'Browse our collection of handcrafted single-stem ribbon flowers — roses, peonies, dahlias, and more. Forever-blooming blooms handcrafted with love, ready to ship.',
};

export default function FlowersPage() {
  return <FlowersPageClient />;
}
