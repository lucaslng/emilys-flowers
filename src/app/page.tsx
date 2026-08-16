import type { Metadata } from 'next';
import Hero from "@/components/home/Hero";
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
      <Hero />
      <FeaturedBouquets />
      <WhyChooseUs />
    </>
  );
}