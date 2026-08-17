# OpenGraph Image — Editing Guide

> **Read this before editing the social share image.** The OG image is a
> hand-tuned brand artifact, not a generated asset — it has a reproducible
> source pipeline, but the composition carries deliberate design constraints
> (safe zones, brand tokens, type rules) that a naive edit will silently break.

## What it is

`public/opengraph-image.png` — a static **1200×630 flattened PNG** (1.91:1,
`summary_large_image` size) used for social previews on X/Twitter, iMessage,
WhatsApp, Slack, and Discord. It is referenced from the root layout's metadata
(see [Wiring](#wiring) below).

The design is the site's signature gift-tag card blown up to billboard scale:
warm cream ground with the wrapping-grid and blush vignette, a sharp-cornered
card with hairline + dashed stitch borders, a washi-tape corner, a real product
photo (pink-evangeline bouquet), and the brand's Martian Mono + Reenie Beanie
type treatment.

## Why a static asset (not `ImageResponse`)

This is **one static brand image** on a single-page site — there is nothing to
vary per route, so `ImageResponse`'s dynamic-generation complexity buys nothing.
The composition is photo-compositing with layered textures (grid, vignette,
stitch, washi), which is fiddly in ImageResponse's limited CSS surface, and it
would require bundling the font TTFs at build time. A static asset can be tuned
by eye and reviewed like any other brand artifact.

Revisit `ImageResponse` only if per-product OG cards for `/products/[slug]` are
ever wanted — the photo-crop and font-bundling problems are solved by then.

## The pipeline

```
og-src/opengraph.html   ← the composition source (edit this)
og-src/fonts/*.woff2    ← brand fonts (Martian Mono 400/700, Reenie Beanie 400)
scripts/og/fetch-fonts.mjs ← re-downloads fonts from Google Fonts (idempotent)
scripts/og/render.mjs   ← Playwright rasterizer → public/opengraph-image.png
```

The HTML is **self-contained**: zero external URLs, no scripts, no animations.
Fonts load via relative `@font-face` URLs (`fonts/…woff2`), and the photo via a
relative path (`../public/products/pink-evangeline/01-main.jpg`). The render
script loads it through `file://`, waits for `document.fonts.ready`, and
screenshots a 1200×630 clip at `deviceScaleFactor: 1`.

## Editing workflow

1. **Edit `og-src/opengraph.html`** — text, colors, layout, photo crop.
2. **Re-render**:
   ```bash
   bun run scripts/og/render.mjs        # writes public/opengraph-image.png
   bun run scripts/og/render.mjs --open # also opens the result for review
   ```
3. **Visually verify** the PNG (the HTML is not what ships — the PNG is).
   Check the safe zones below, especially after any text or layout change.
4. **Commit both** `og-src/opengraph.html` *and* `public/opengraph-image.png`
   — they must stay in sync; the PNG is the shipped artifact.

Fonts are already committed; re-run `fetch-fonts.mjs` only if you need to
refresh them (it is idempotent and downloads the latin `woff2` blocks).

## Design constraints (do not break these)

### Safe zones

- Canvas is **1200×630**. Keep all critical content inside the central
  **~1040×510 zone** (≈80px left/right, ≈60px top/bottom).
- The **bottom ~80px is dead** — X/Twitter's summary-large card crops it. No
  text there.
- The composition must **survive a centered 630×630 crop** (x285–915) —
  iMessage/WhatsApp and some aggregators crop OG images to square. The title
  and the flower must stay visible in that band.
- **No baked-in URLs or "shop now"** — platforms add their own chrome.

### Brand tokens (match `globals.css`)

| Element | Value |
|---|---|
| Page ground | `#FEFAF5` warm cream |
| Card ground | `#FCF5EF` |
| Card border | 1px `#EDE0D4` hairline, radius 0, no shadow |
| Stitch | 1px dashed `#E4C9B8`, inset ~14px |
| Wrapping grid | 26px cells, `rgba(177,110,110,0.055)` |
| Blush vignette | `rgba(249,228,228,0.55)` radial ellipse |
| Washi tape | `rgba(249,228,228,0.78)`, slightly rotated |
| Text colors | `#4A3B3B` (title), `#9E5E5E` (kicker/accent), `#7A6868` (caption) |

All text colors are specced for **4.5:1 contrast on cream** — keep text on the
cream card ground, never over the photo, and never add a scrim.

### Type treatment

| Element | Font | Size | Notes |
|---|---|---|---|
| Kicker | Martian Mono 400, uppercase | ~17px, +0.15em | `HANDCRAFTED RIBBON FLOWERS` |
| Title | Martian Mono 700, uppercase | ~60px, +0.02em | `EMILY'S` / `FLOWERS`, two lines |
| Accent | Reenie Beanie 400 | ~54px | `forever blooming` — 2–3 words max |
| Caption | Martian Mono 400, uppercase | ~15px, +0.1em | `RIBBON BOUQUETS · FLOWERS` |

- **Reenie Beanie is single-weight with a small x-height** — use it for 2–3
  words max, oversized, and never for the title. The title carries the
  information at feed sizes.
- The title + accent are load-bearing; the kicker is close behind; the caption
  is decorative — cut it first if anything fights for space.

### Photo

- Source: `public/products/pink-evangeline/01-main.jpg` (pink is the brand's
  only chromatic accent — the pink ribbon rose is the hero; a creamy-white
  flower would vanish into the cream palette).
- Crop: `object-position: 52% 40%` — tuned to center the bloom cluster and
  minimize the source photo's dark top-left void. The photo window is the
  right ~55% of the card; text never overlaps it.

## Wiring

`src/app/layout.tsx` metadata block:

- `openGraph.images`: `[{ url: "/opengraph-image.png", width: 1200, height: 630,
  alt: "Handcrafted pink ribbon rose bouquet — Emily's Flowers, forever
  blooming" }]`
- `twitter`: `{ card: "summary_large_image", title, description, images:
  ["/opengraph-image.png"] }`

`metadataBase` is already set to `SITE_URL`, so the relative paths resolve to
absolute URLs automatically. If you change the image's dimensions or alt text,
update these fields to match.