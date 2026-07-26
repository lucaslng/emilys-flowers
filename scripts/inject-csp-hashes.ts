/**
 * Post-build script: injects a per-page <meta http-equiv="Content-Security-Policy">
 * tag with hash-based script-src and style-src into pre-rendered HTML files.
 *
 * This replaces 'unsafe-inline' in script-src and style-src with sha256 hashes
 * of inline <script> blocks, <style> blocks, AND style="..." attribute values.
 * The CSP is computed statically at build time — no middleware, no per-request
 * SSR, no runtime proxy.
 *
 * Hash computation differs by element type:
 *   - <script> and <style> content: RAWTEXT / script-data state — NO HTML
 *     entity decoding. Hash the raw bytes between opening and closing tags.
 *   - style="..." attribute values: the HTML parser DOES decode HTML entities
 *     in attribute values, so entities must be decoded before hashing.
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
  "style-src 'self'{STYLE_BLOCK_HASHES}{STYLE_ATTR_HASHES}",
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

// Regex to find <style> blocks. Same structure as SCRIPT_RE; style elements
// cannot have a src attribute so we don't filter on it, but we keep the same
// capture groups for consistency.
const STYLE_RE = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi;

// Regex to find style="..." attribute values. Capture group 1 is the raw
// attribute value (with HTML entities still encoded, e.g. &quot;).
// This is applied against the full HTML; false positives inside <script>
// content are avoided because script strings use \" not raw " for quoting.
const STYLE_ATTR_RE = /\sstyle="([^"]*)"/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a single CSP hash directive value: `'sha256-<base64>'`.
 * Hashes the raw text content (DOM text node) of an inline <script> or
 * <style> element. Both element types are in the HTML parser's RAWTEXT or
 * script-data state, which does NOT decode HTML entities, so we hash the
 * raw bytes as-is.
 */
function hashContent(content: string): string {
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

/**
 * Decode HTML entities in a style="..." attribute value to match the DOM
 * attribute value that the browser hashes. Inside HTML attribute values the
 * parser DOES decode character references (unlike <script>/<style> content).
 *
 * Order matters: decode &amp; LAST to avoid double-decoding
 * (e.g. &amp;quot; → &quot; → ", not &amp;quot; → ").
 */
function decodeStyleAttrValue(raw: string): string {
  // Named entities that commonly appear in inline styles
  let s = raw;
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&#x27;/gi, "'");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&nbsp;/g, "\u00A0");
  // Decode numeric entities (decimal and hex) — these can appear anywhere
  // but we handle the common ones explicitly above; this catch-all is for
  // completeness.
  s = s.replace(/&#(\d+);/g, (_m: string, code: string) =>
    String.fromCodePoint(Number(code)),
  );
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_m: string, code: string) =>
    String.fromCodePoint(Number.parseInt(code, 16)),
  );
  // Decode &amp; LAST to avoid double-decoding.
  s = s.replace(/&amp;/g, "&");
  return s;
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
  const scriptWarnings: string[] = [];
  let totalFilesWithStyles = 0;

  for (const filePath of htmlFiles.sort()) {
    let html: string;
    try {
      html = readFileSync(filePath, "utf-8");
    } catch (err) {
      console.error(`[inject-csp-hashes] ERROR: Cannot read ${filePath}:`, err);
      process.exit(1);
    }

    // 2a. Extract inline script hashes
    const scriptHashes: string[] = [];
    let match: RegExpExecArray | null;

    SCRIPT_RE.lastIndex = 0;
    while ((match = SCRIPT_RE.exec(html)) !== null) {
      const attrs = match[1] ?? "";
      const body = match[2];
      if (!hasSrcAttribute(attrs)) {
        scriptHashes.push(hashContent(body));
      }
    }

    // 2b. Extract inline <style> block hashes
    const styleBlockHashes: string[] = [];
    STYLE_RE.lastIndex = 0;
    while ((match = STYLE_RE.exec(html)) !== null) {
      const body = match[2];
      styleBlockHashes.push(hashContent(body));
    }

    // 2c. Extract style="..." attribute hashes (decode entities first)
    const styleAttrHashes: string[] = [];
    STYLE_ATTR_RE.lastIndex = 0;
    while ((match = STYLE_ATTR_RE.exec(html)) !== null) {
      const rawValue = match[1];
      const decodedValue = decodeStyleAttrValue(rawValue);
      styleAttrHashes.push(hashContent(decodedValue));
    }

    const route = filePath
      .replace(BUILD_DIR, "")
      .replace(/\.html$/, "")
      .replace(/\/index$/, "/")
      .replace(/^\//, "/");

    if (scriptHashes.length === 0) {
      scriptWarnings.push(
        `[inject-csp-hashes] WARNING: No inline scripts found in ${filePath} ` +
          "(this may be normal for error pages with no JS).",
      );
      totalFilesWithoutScripts++;
    } else {
      totalFilesWithScripts++;
    }

    if (styleBlockHashes.length > 0) {
      totalFilesWithStyles++;
    }

    // 2d. Deduplicate and sort
    const uniqueScriptHashes = [...new Set(scriptHashes)].sort();
    const uniqueStyleBlockHashes = [...new Set(styleBlockHashes)].sort();
    const uniqueStyleAttrHashes = [...new Set(styleAttrHashes)].sort();
    const scriptHashValues = uniqueScriptHashes.join(" ");
    const styleBlockHashValues = uniqueStyleBlockHashes.length > 0 ? " " + uniqueStyleBlockHashes.join(" ") : "";
    const styleAttrHashValues = uniqueStyleAttrHashes.length > 0 ? " " + uniqueStyleAttrHashes.join(" ") : "";

    // 2e. Build CSP string
    const csp = CSP_DIRECTIVES.map((d) =>
      d
        .replace("{HASHES}", scriptHashValues)
        .replace("{STYLE_BLOCK_HASHES}", styleBlockHashValues)
        .replace("{STYLE_ATTR_HASHES}", styleAttrHashValues),
    ).join("; ");

    // 2e. Inject <meta> tag into <head>
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

    // 2f. Write back
    try {
      writeFileSync(filePath, modifiedHtml, "utf-8");
    } catch (err) {
      console.error(
        `[inject-csp-hashes] ERROR: Cannot write ${filePath}:`,
        err,
      );
      process.exit(1);
    }

    // 2h. Print summary
    const routeLabel = route === "/" ? " /" : ` ${route}`;
    const scriptSummary = `${uniqueScriptHashes.length} script hash${uniqueScriptHashes.length === 1 ? "" : "es"}`;
    const styleBlockSummary = uniqueStyleBlockHashes.length > 0
      ? `,  ${uniqueStyleBlockHashes.length} style-block hash${uniqueStyleBlockHashes.length === 1 ? "" : "es"}`
      : "";
    const styleAttrSummary = uniqueStyleAttrHashes.length > 0
      ? `,  ${uniqueStyleAttrHashes.length} style-attr hash${uniqueStyleAttrHashes.length === 1 ? "" : "es"}`
      : "";
    console.log(
      `[inject-csp-hashes]${routeLabel}  ` +
        `${scriptSummary} from ${scriptHashes.length} script${scriptHashes.length === 1 ? "" : "s"}` +
        `${styleBlockSummary}` +
        `${styleAttrSummary}` +
        `  CSP: ${csp.length} chars  (${filePath})`,
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
  for (const w of scriptWarnings) {
    console.warn(w);
  }

  console.log(
    `[inject-csp-hashes] Done: ${htmlFiles.length} file(s) processed ` +
      `(${totalFilesWithScripts} with scripts, ${totalFilesWithoutScripts} without scripts, ` +
      `${totalFilesWithStyles} with style tags).`,
  );
}

main();
