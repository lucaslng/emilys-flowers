// render.mjs — rasterize og-src/opengraph.html into
// public/opengraph-image.png at exactly 1200x630 using Playwright chromium.
//
// Usage: bun run scripts/og/render.mjs [--open]

import { chromium } from "playwright";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "og-src", "opengraph.html");
const DEST = join(ROOT, "public", "opengraph-image.png");
const WIDTH = 1200;
const HEIGHT = 630;

const srcUrl = pathToFileURL(SRC).href;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
try {
  await page.goto(srcUrl, { waitUntil: "load" });
  // Ensure web fonts are ready before screenshotting.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: DEST, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
} finally {
  await browser.close();
}

const { size } = await stat(DEST);
console.log(`wrote ${DEST} (${WIDTH}x${HEIGHT}, ${size} bytes)`);

if (process.argv.includes("--open")) {
  const { spawn } = await import("node:child_process");
  spawn("open", [DEST]);
}
