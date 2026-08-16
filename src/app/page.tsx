import type { Metadata } from 'next';
import Hero from "@/components/home/Hero";
import FeaturedBouquets from "@/components/home/FeaturedBouquets";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import { isFlowersEnabled } from "@/lib/flowers-flag";

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default async function HomePage() {
  const showFlowers = await isFlowersEnabled();
  return (
    <>
      <Hero showFlowers={showFlowers} />
      <FeaturedBouquets />
      <WhyChooseUs />
    </>
  );
}