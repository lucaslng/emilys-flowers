import type { NextConfig } from "next";

// CSP is baked at build time per VERCEL_ENV (undefined in local dev). See AGENTS.md → Security.
const isProduction = process.env.VERCEL_ENV === "production";
// 'unsafe-eval' is dev-only (React debug stacks); preview builds are production builds.
const isDev = process.env.NODE_ENV === "development";

// Vercel Live toolbar — scoped out of production (#16).
const vercelLive = "https://vercel.live";
const vercelLiveConnect = "https://vercel.live wss://vercel.live";

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required for Next.js inline scripts; SRI doesn't cover inline. See docs/security-headers.md.
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${
    isProduction ? "" : ` ${vercelLive}`
  }${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.com https://v3.stripe.com${
    isProduction ? "" : ` ${vercelLiveConnect}`
  }`,
  // Stripe Radar workers need blob: + m.stripe.network (#14).
  "worker-src 'self' blob: https://m.stripe.network",
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
      "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  // COEP report-only — enforcing breaks Stripe checkout (#15).
  {
    key: "Cross-Origin-Embedder-Policy-Report-Only",
    value: "credentialless",
  },
  // CORP — safe to enforce; governs how others embed us (#15).
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    sri: {
      algorithm: 'sha256',
    },
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;