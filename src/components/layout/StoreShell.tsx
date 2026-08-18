// StoreShell.tsx

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import { PetalBurstProvider } from "@/lib/petal-burst";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import JsonLd from "@/components/JsonLd";
import { organizationSchema, webSiteSchema } from "@/lib/json-ld";
import { isFlowersEnabled } from "@/lib/flowers-flag";

export default function StoreShell({ children }: { children: ReactNode }) {
  const showFlowers = isFlowersEnabled();
  return (
    <>
      <CartProvider>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <PetalBurstProvider />
        <Navbar showFlowers={showFlowers} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </CartProvider>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={webSiteSchema()} />
    </>
  );
}