// fetch-fonts.mjs — download the brand's Google Fonts woff2 files (latin
// subset) into og-src/fonts/ for the OG image render. Idempotent: skips
// files that already exist with the right size.
//
// Usage: bun run scripts/og/fetch-fonts.mjs

import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "og-src", "fonts");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// (css family, weight, target filename)
const FONT_SLOTS = [
  ["Martian Mono", "400", "martian-mono-400.woff2"],
  ["Martian Mono", "700", "martian-mono-700.woff2"],
  ["Reenie Beanie", "400", "reenie-beanie-400.woff2"],
];

const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400;700&family=Reenie+Beanie&display=swap";

const css = await fetch(CSS_URL, { headers: { "User-Agent": UA } }).then((r) => {
  if (!r.ok) throw new Error(`Google Fonts css2 returned ${r.status}`);
  return r.text();
});

// Split into @font-face blocks, keep only latin subset blocks. The subset
// comment (`/* latin */`) precedes each block outside the matched text, so
// identify the latin block by its unicode-range starting at U+0000-00FF.
const blocks = css.match(/@font-face\s*{[^}]+}/g) ?? [];
const latin = blocks.filter((b) => b.includes("U+0000-00FF"));

if (latin.length === 0) {
  throw new Error("No latin @font-face blocks parsed from Google Fonts css2");
}

const urlFor = (family, weight) => {
  const block = latin.find(
    (b) =>
      b.includes(`font-family: '${family}'`) && b.includes(`font-weight: ${weight}`),
  );
  if (!block) {
    throw new Error(`No latin block for ${family} ${weight}`);
  }
  const m = block.match(/url\((https:[^)]+\.woff2)\)/);
  if (!m) throw new Error(`No woff2 URL for ${family} ${weight}`);
  return m[1];
};

await mkdir(OUT, { recursive: true });

for (const [family, weight, filename] of FONT_SLOTS) {
  const dest = join(OUT, filename);
  try {
    const { size } = await stat(dest);
    console.log(`skip ${filename} (${size} bytes already present)`);
    continue;
  } catch {
    // not present — download
  }
  const url = urlFor(family, weight);
  const buf = await fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(`font download ${r.status} for ${filename}`);
    return Buffer.from(await r.arrayBuffer());
  });
  await writeFile(dest, buf);
  console.log(`wrote ${filename} (${buf.length} bytes)`);
}

console.log("done");
