import type { NextConfig } from "next";
import {
  evaluateFlowersEnabled,
  evaluateUnderConstruction,
} from "./src/lib/flagship-flag";
import { scanProductImages } from "./src/lib/product-image-manifest";

// Webpack's dev runtime needs `unsafe-eval` (HMR, source maps); production keeps a strict CSP.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.com https://v3.stripe.com`,
  "worker-src 'self' blob: https://m.stripe.network",
  `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Cross-Origin-Embedder-Policy",
    value: "credentialless",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

export default async function nextConfig(): Promise<NextConfig> {
  // Evaluated once per build in the main process; static-gen workers inherit the env vars.
  if (process.env.FLOWERS_ENABLED === undefined) {
    process.env.FLOWERS_ENABLED = String(await evaluateFlowersEnabled());
  }

  if (process.env.UNDER_CONSTRUCTION === undefined) {
    process.env.UNDER_CONSTRUCTION = String(await evaluateUnderConstruction());
  }

  if (process.env.PRODUCT_IMAGES === undefined) {
    process.env.PRODUCT_IMAGES = JSON.stringify(scanProductImages());
  }

  return {
    env: {
      UNDER_CONSTRUCTION: process.env.UNDER_CONSTRUCTION ?? "false",
      FLOWERS_ENABLED: process.env.FLOWERS_ENABLED ?? "false",
      PRODUCT_IMAGES: process.env.PRODUCT_IMAGES ?? "{}",
    },
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: securityHeaders,
        },
      ];
    },
    images: {
      loader: "custom",
      loaderFile: "./src/lib/image-loader.ts",
      deviceSizes: [320, 480, 640, 960, 1280, 1600], // must match VARIANT_WIDTHS in src/lib/image-variants.ts
      imageSizes: [],
      remotePatterns: [],
    },
    experimental: {
      inlineCss: true,
    },
  };
}

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();