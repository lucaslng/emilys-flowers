import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Martian_Mono, Reenie_Beanie } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Martian Mono = the geometric/grid voice (structure, labels, UI).
const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin"],
});

// Reenie Beanie = the hand-drawn/chalk voice (accents, callouts) — never long
// copy, its small x-height hurts readability.
const reenie = Reenie_Beanie({
  weight: "400",
  variable: "--font-reenie",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: {
    default: "Emily's Flowers: Handcrafted Ribbon Flowers & Bouquets",
    template: "%s | Emily's Flowers",
  },
  description:
    "Exquisite handcrafted ribbon flowers and bouquets made with love. Shop our collection of forever-blooming ribbon roses, peonies, dahlias, and more.",
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
  return (
    <html lang="en" className={`${fontClasses} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}