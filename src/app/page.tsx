import type { Metadata } from 'next';
import FeaturedBouquets from "@/components/home/FeaturedBouquets";
import WhyChooseUs from "@/components/home/WhyChooseUs";

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  return (
    <>
      <FeaturedBouquets />
      <WhyChooseUs />
    </>
  );
}
