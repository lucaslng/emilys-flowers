// next.config.ts

import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.com https://v3.stripe.com`,
  // Stripe Radar (fraud detection) spawns web workers off blob: and https://m.stripe.network to
  // collect device fingerprint signals. Without worker-src, browsers fall back to default-src
  // 'self', blocking the worker and silently disabling fraud signals. See issue #14.
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
  // COEP: Stripe does not support cross-origin isolation — checkout.stripe.com iframes do not send
  // the COEP/CORP headers required to be embedded under an enforcing COEP, so `credentialless` OR
  // `require-corp` would break checkout (https://docs.stripe.com/security/guide#cross-origin-isolation-support).
  // Ship report-only first to surface would-be violations without blocking anything; promote to
  // enforcing once Stripe supports it. A `report-to` endpoint can be wired up later via the
  // Reporting API. See issue #15.
  {
    key: "Cross-Origin-Embedder-Policy-Report-Only",
    value: "credentialless",
  },
  // CORP: restricts which cross-origin documents can embed OUR resources. Safe to enforce — it
  // governs how others load us, not how we load Stripe. See issue #15.
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Access-Control-Allow-Origin",
    value: process.env.NEXT_PUBLIC_BASE_URL || "*",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  experimental: {
    inlineCss: true, // Inlines critical CSS into the HTML payload
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
