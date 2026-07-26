/**
 * Post-build script: injects a per-page <meta http-equiv="Content-Security-Policy">
 * tag with hash-based script-src into pre-rendered HTML files.
 *
 * This replaces 'unsafe-inline' in script-src with sha256 hashes of each
 * inline <script> block's DOM text content.  The CSP is computed statically
 * at build time — no middleware, no per-request SSR, no runtime proxy.
 *
 * The hash is computed over the raw text content between <script> and </script>
 * (which IS the DOM text content — the HTML parser treats <script> element
 * content as raw text and does NOT decode HTML entities inside it).
 *
 * frame-ancestors is intentionally excluded: it is NOT supported in <meta>
 * CSP tags and stays in the HTTP header (next.config.ts).
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Glob } from "bun";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BUILD_DIR = resolve(".next/server/app");
const isProduction = process.env.VERCEL_ENV === "production";
const vercelLive = "https://vercel.live";
const vercelLiveWs = "wss://vercel.live";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // vercel.live scoped out of production so a compromised vercel.live origin
  // cannot execute code in the production origin.
  `script-src 'self' {HASHES} https://js.stripe.com${isProduction ? "" : ` ${vercelLive}`}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // vercel.live scoped out of production.
  `connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.com https://v3.stripe.com${isProduction ? "" : ` ${vercelLive} ${vercelLiveWs}`}`,
  // Stripe Radar (fraud detection) spawns web workers off blob: and
  // https://m.stripe.network to collect device fingerprint signals.
  "worker-src 'self' blob: https://m.stripe.network",
  // vercel.live added on non-production so the Live toolbar iframe renders.
  `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com${isProduction ? "" : ` ${vercelLive}`}`,
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

// Regex to find <script> blocks.  Capture group 1 = attributes (including
// the leading space if present), group 2 = inner text content.
const SCRIPT_RE = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a single CSP hash directive value: `'sha256-<base64>'`.
 * Hashes the raw text content (DOM text node) of an inline <script>.
 * Inside <script> elements the HTML parser treats content as raw text and
 * does NOT decode HTML entities, so we hash the bytes as-is.
 */
function hashScriptContent(content: string): string {
  const hash = createHash("sha256");
  hash.update(content, "utf-8");
  return `'sha256-${hash.digest("base64")}'`;
}

/**
 * Test whether a <script> tag has a `src` attribute (external script).
 * We match on ` src=` (with leading space) since the regex captures the
 * full attribute string — this avoids false-positives on e.g. `type=` or
 * `async` that happen to contain the substring "src=".
 */
function hasSrcAttribute(attrs: string | undefined): boolean {
  if (!attrs) return false;
  // Match either  src="..."  or  src='...'  or  src=...  (unquoted).
  return /\ssrc(=|>|\s)/.test(attrs);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // 1. Discover all HTML files
  const glob = new Glob("**/*.html");
  const htmlFiles: string[] = [];
  for (const match of glob.scanSync(BUILD_DIR)) {
    htmlFiles.push(join(BUILD_DIR, match));
  }

  if (htmlFiles.length === 0) {
    console.error(
      `[inject-csp-hashes] FATAL: No *.html files found in ${BUILD_DIR}. ` +
        "Did the build run? Has the output directory changed?",
    );
    process.exit(1);
  }

  // 2. Process each file
  let totalFilesWithScripts = 0;
  let totalFilesWithoutScripts = 0;
  const warnings: string[] = [];

  for (const filePath of htmlFiles.sort()) {
    let html: string;
    try {
      html = readFileSync(filePath, "utf-8");
    } catch (err) {
      console.error(`[inject-csp-hashes] ERROR: Cannot read ${filePath}:`, err);
      process.exit(1);
    }

    // 2a. Extract inline script hashes
    const hashes: string[] = [];
    let match: RegExpExecArray | null;

    // Reset lastIndex since we reuse the regex across files.
    SCRIPT_RE.lastIndex = 0;
    while ((match = SCRIPT_RE.exec(html)) !== null) {
      const attrs = match[1] ?? "";
      const body = match[2];
      if (!hasSrcAttribute(attrs)) {
        hashes.push(hashScriptContent(body));
      }
    }

    const route = filePath
      .replace(BUILD_DIR, "")
      .replace(/\.html$/, "")
      .replace(/\/index$/, "/")
      .replace(/^\//, "/");

    if (hashes.length === 0) {
      warnings.push(
        `[inject-csp-hashes] WARNING: No inline scripts found in ${filePath} ` +
          "(this may be normal for error pages with no JS).",
      );
      totalFilesWithoutScripts++;
    } else {
      totalFilesWithScripts++;
    }

    // 2b. Deduplicate and sort
    const uniqueHashes = [...new Set(hashes)].sort();
    const hashValues = uniqueHashes.join(" ");

    // 2c. Build CSP string
    const csp = CSP_DIRECTIVES.map((d) =>
      d.replace("{HASHES}", hashValues),
    ).join("; ");

    // 2d. Inject <meta> tag into <head>
    const metaTag = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, "&quot;")}">`;

    // Insert after <head> (prefer after the opening <head> tag itself, but
    // also handle the case where <head> has attributes or is <head >).
    const headMatch = html.match(/<head[^>]*>/i);
    if (!headMatch) {
      console.error(
        `[inject-csp-hashes] ERROR: No <head> tag found in ${filePath}.`,
      );
      process.exit(1);
    }

    const headEnd = headMatch.index! + headMatch[0].length;
    const modifiedHtml =
      html.slice(0, headEnd) + "\n" + metaTag + html.slice(headEnd);

    // 2e. Write back
    try {
      writeFileSync(filePath, modifiedHtml, "utf-8");
    } catch (err) {
      console.error(
        `[inject-csp-hashes] ERROR: Cannot write ${filePath}:`,
        err,
      );
      process.exit(1);
    }

    // 2f. Print summary
    const routeLabel = route === "/" ? " /" : ` ${route}`;
    console.log(
      `[inject-csp-hashes]${routeLabel}  ` +
        `${uniqueHashes.length} unique hash${uniqueHashes.length === 1 ? "" : "es"} ` +
        `from ${hashes.length} inline script${hashes.length === 1 ? "" : "s"}  ` +
        `CSP length: ${csp.length} chars  (${filePath})`,
    );

    // Print full CSP for root page
    if (route === "/") {
      console.log(`[inject-csp-hashes] Root CSP:\n${csp}\n`);
    }
  }

  // 3. Fail-safe: if ALL files had zero inline scripts, something is wrong.
  if (totalFilesWithScripts === 0 && totalFilesWithoutScripts > 0) {
    console.error(
      `[inject-csp-hashes] FATAL: Processed ${totalFilesWithoutScripts} HTML ` +
        "file(s) but found ZERO inline scripts across ALL files. " +
        "The build output format may have changed. Failing to avoid shipping " +
        "a permissive CSP with 'unsafe-inline'.",
    );
    process.exit(1);
  }

  // Print warnings for individual files with no scripts (non-fatal).
  for (const w of warnings) {
    console.warn(w);
  }

  console.log(
    `[inject-csp-hashes] Done: ${htmlFiles.length} file(s) processed ` +
      `(${totalFilesWithScripts} with scripts, ${totalFilesWithoutScripts} without).`,
  );
}

main();
