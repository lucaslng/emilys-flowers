// layout.tsx

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import { PetalBurstProvider } from "@/lib/petal-burst";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { isUnderConstruction } from "@/lib/under-construction";
import UnderConstruction from "@/components/under-construction";
import JsonLd from "@/components/JsonLd";
import { organizationSchema, webSiteSchema } from "@/lib/json-ld";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
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
  metadataBase: new URL('https://emilysflowers.ca'),
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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  if (isUnderConstruction()) {
    return (
      <html
        lang="en"
        className={`${inter.variable} ${playfair.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col bg-[#FFFAFA] font-sans text-[#4A3B3B]">
          <UnderConstruction />
        </body>
      </html>
    );
  }
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#FFFAFA] font-sans text-[#4A3B3B]">
        <CartProvider>
          <PetalBurstProvider />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={webSiteSchema()} />
      </body>
    </html>
  );
}
