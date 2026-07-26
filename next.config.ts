import type { NextConfig } from "next";

// VERCEL_ENV is injected by Vercel at build time as "production" | "preview" | "development"
// (https://vercel.com/docs/environment-variables/system-environment-variables). It is undefined
// in local dev. We treat anything other than "production" as preview so the Vercel Live toolbar
// keeps working on previews and locally; production is the strict opt-in. Because next.config.ts
// is evaluated at build time, the CSP below is baked per deployment. See issue #16.
const isProduction = process.env.VERCEL_ENV === "production";

// Vercel Live (https://vercel.live) is the preview/collaboration toolbar. It needs script,
// connect (WebSocket), and frame access to render its iframe. Scoped to non-production below so
// a compromised vercel.live origin cannot execute code in the production checkout origin. See #16.
const vercelLive = "https://vercel.live";
const vercelLiveConnect = "https://vercel.live wss://vercel.live";

const csp = [
  "default-src 'self'",
  // vercel.live scoped out of production (#16).
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isProduction ? "" : ` ${vercelLive}`}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // vercel.live scoped out of production (#16).
  `connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.com https://v3.stripe.com${
    isProduction ? "" : ` ${vercelLiveConnect}`
  }`,
  // Stripe Radar (fraud detection) spawns web workers off blob: and https://m.stripe.network to
  // collect device fingerprint signals. Without worker-src, browsers fall back to default-src
  // 'self', blocking the worker and silently disabling fraud signals. See issue #14.
  "worker-src 'self' blob: https://m.stripe.network",
  // vercel.live added on non-production so the Live toolbar iframe renders (#16). Previously the
  // toolbar's script+connect were allowed but its iframe was blocked by frame-src, producing a
  // CSP violation and a broken toolbar on preview.
  `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com${
    isProduction ? "" : ` ${vercelLive}`
  }`,
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
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
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
