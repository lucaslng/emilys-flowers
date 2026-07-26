import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Content-Security-Policy
//
// The bulk of the CSP (script-src with hashes, style-src, img-src, etc.) is
// injected per-page via a <meta http-equiv="Content-Security-Policy"> tag by
// scripts/inject-csp-hashes.ts after every build.  Only directives NOT
// supported in <meta> tags live here in the HTTP header.
//
//   frame-ancestors — NOT supported in <meta> CSP; stays in the HTTP header.
//   upgrade-insecure-requests — supported in <meta> but duplicated here as
//     defense-in-depth against meta-tag stripping.
//
// All other CSP directives (script-src, style-src, etc.) are handled by the
// post-build script which computes sha256 hashes of every inline <script>
// block, removing the need for 'unsafe-inline'.
//
// VERCEL_ENV production/preview scoping for vercel.live is handled in the
// post-build script, not here. See scripts/inject-csp-hashes.ts.
// ---------------------------------------------------------------------------

const csp = "frame-ancestors 'none'; upgrade-insecure-requests";

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
};

export default nextConfig;
