import type { Metadata } from 'next';
import CheckoutPageClient from './checkout-page-client';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutPageClient />;
}
