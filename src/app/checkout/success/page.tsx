import type { Metadata } from 'next';
import SuccessPageClient from './success-page-client';

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/checkout/success' },
};

export default function CheckoutSuccessPage() {
  return <SuccessPageClient />;
}
