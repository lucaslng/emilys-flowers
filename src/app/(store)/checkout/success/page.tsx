import type { Metadata } from 'next';
import SuccessPageClient from './success-page-client';

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function CheckoutSuccessPage() {
  return <SuccessPageClient />;
}
