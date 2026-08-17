// layout.tsx

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Martian_Mono, Reenie_Beanie } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import { PetalBurstProvider } from "@/lib/petal-burst";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { isUnderConstruction } from "@/lib/under-construction";
import { isFlowersEnabled } from "@/lib/flowers-flag";
import UnderConstruction from "@/components/under-construction";
import JsonLd from "@/components/JsonLd";
import { organizationSchema, webSiteSchema } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Martian Mono = the geometric/grid voice (structure, labels, UI).
// Variable font, all weights available.
const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin"],
});

// Reenie Beanie = the hand-drawn/chalk voice (accents, callouts,
// annotations). Single weight (400) — deliberately NOT used for long copy
// because of its small x-height.
const reenie = Reenie_Beanie({
  weight: "400",
  variable: "--font-reenie",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Emily's Flowers: Handcrafted Ribbon Flowers & Bouquets",
    template: "%s | Emily's Flowers",
  },
  description:
    "Exquisite handcrafted ribbon flowers and bouquets made with love. Shop our collection of forever-blooming ribbon roses, peonies, dahlias, and more.",
  keywords: [
    "ribbon flowers",
    "handcrafted bouquets",
    "fabric flowers",
    "ribbon roses",
    "forever flowers",
    "gift for her",
    "home decor",
  ],
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Emily's Flowers: Handcrafted Ribbon Flowers & Bouquets",
    description:
      "Exquisite handcrafted ribbon flowers and bouquets made with love. Forever-blooming beauty for your home.",
    type: "website",
    url: "/",
    siteName: "Emily's Flowers",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Handcrafted pink ribbon rose bouquet — Emily's Flowers, forever blooming",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Emily's Flowers: Handcrafted Ribbon Flowers & Bouquets",
    description:
      "Exquisite handcrafted ribbon flowers and bouquets made with love. Forever-blooming beauty for your home.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const fontClasses = `${martian.variable} ${reenie.variable}`;
  if (isUnderConstruction()) {
    return (
      <html lang="en" className={`${fontClasses} h-full antialiased`}>
        <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
          <UnderConstruction />
        </body>
      </html>
    );
  }
  const showFlowers = isFlowersEnabled();
  return (
    <html lang="en" className={`${fontClasses} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <CartProvider>
          <a href="#main" className="skip-link">Skip to content</a>
          <PetalBurstProvider />
          <Navbar showFlowers={showFlowers} />
          <main id="main" className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={webSiteSchema()} />
      </body>
    </html>
  );
}