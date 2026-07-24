import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import { PetalBurstProvider } from "@/lib/petal-burst";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
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
    default: "Emily's Flowers — Handcrafted Ribbon Flowers & Bouquets",
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
  openGraph: {
    title: "Emily's Flowers — Handcrafted Ribbon Flowers & Bouquets",
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
      </body>
    </html>
  );
}
