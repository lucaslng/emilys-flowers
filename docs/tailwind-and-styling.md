# Tailwind v4 & Styling Conventions

> **Read this before editing styles, theme tokens, `globals.css`, or adding
> visual components.** Tailwind v4 dropped `tailwind.config.js` — an agent
> trained on v3 will look for config that doesn't exist.

## Tailwind v4 — CSS-first configuration

There is **no `tailwind.config.js`**. All configuration lives in CSS via
`@theme` / `@theme inline` in `src/app/globals.css`. The PostCSS plugin
(`@tailwindcss/postcss`, configured in `postcss.config.mjs`) picks it up.

### Entry point

```css
@import "tailwindcss";
```

This single import replaces the v3 `@tailwind base / components / utilities`
directives.

### `@theme` vs `@theme inline`

- **`@theme`** — defines design tokens; generated utilities reference the CSS
  variable (`background: var(--color-blush)`).
- **`@theme inline`** — inlines the resolved *value* directly
  (`background: #F9E4E4`). Use this when your token is itself a `var()` reference
  to a `:root` variable.

**This project uses `@theme inline`** because its color tokens reference `:root`
CSS variables. This prevents resolution issues when the defining element is
higher in the DOM tree. Keep using `@theme inline` for new tokens that reference
`:root` vars.

### Token → utility mapping

Declaring a theme variable auto-generates utilities:

| Theme variable | Utilities generated |
|---|---|
| `--color-blush` | `bg-blush`, `text-blush`, `border-blush`, `fill-blush`, etc. |
| `--color-rose` | `bg-rose`, `text-rose`, `border-rose`, … |
| `--font-sans` | `font-sans` |
| `--font-serif` | `font-serif` |
| `--breakpoint-3xl` | `3xl:` variant |

### This project's tokens

Defined in `src/app/globals.css`:

**Colors** (CSS vars in `:root`, mapped via `@theme inline`):
`--background`, `--foreground`, `--surface`, `--blush`, `--lavender`, `--rose`,
`--border`, `--muted`.

**Fonts** (set by `next/font` in `layout.tsx`, mapped via `@theme inline`):
- `--font-sans` → Inter (variable)
- `--font-serif` → Playfair Display (variable)

### Adding a new color token

1. Add the CSS variable in `:root` in `globals.css`:
   ```css
   :root {
     --sage: #B7C4A7;
   }
   ```
2. Map it in `@theme inline`:
   ```css
   @theme inline {
     --color-sage: var(--sage);
   }
   ```
3. Use it: `<div className="bg-sage text-foreground">…</div>`

### Adding a custom font

1. Load the font with `next/font` in `src/app/layout.tsx` (this gives you a CSS
   variable like `--font-myfont`).
2. Map it in `@theme inline`:
   ```css
   @theme inline {
     --font-myfont: var(--font-myfont), ui-sans-serif, system-ui, sans-serif;
   }
   ```
3. Use it: `className="font-myfont"`.

## Breaking changes from Tailwind v3

If your training data is v3, note:

| v3 → v4 | Detail |
|---|---|
| No `tailwind.config.js` | Config moves to `@theme` in CSS |
| No built-in `container` plugin | Use `max-width` + `mx-auto` (this project's `Container` component does this) |
| `bg-opacity-*` removed | Use the slash syntax: `bg-black/50` (still works) |
| `@tailwind base/components/utilities` gone | Use `@import "tailwindcss"` |
| Default colors use OKLCH | Modern color space; no action needed |
| `@apply` still works | But less needed with CSS-first config |

## The museum-plaque card language

Product-facing cards use a **"museum-plaque"** style defined by `.plaque-card`
in `globals.css`. This is an intentional design language — **match it for new
product-facing cards** rather than introducing generic rounded/shadowed cards.

### `.plaque-card` properties

- **Sharp corners** (no `border-radius`)
- **1px hairline border** (`#F0E0E0`)
- **No shadow** by default
- **Hover**: draws a rose underline under the name (via `.plaque-name::after`,
  a 2px rose bar that grows from 0 → 100% width on `.group:hover`)
- **`.is-emphasized`** variant: adds rose border + shadow (used by the center
  card in the featured triptych)
- **`.plaque-divider`**: hairline top-border separator

### When to use `.plaque-card`

- Product cards (`ProductCard` uses it)
- Any new card that presents a product or product-like entity

### When NOT to use it

- UI chrome (buttons, nav, cart line items) — use the standard `Button` /
  layout components instead.

## Reduced motion — the global CSS guard

`globals.css` includes a global `@media (prefers-reduced-motion: reduce)` block
that:

1. Collapses **all CSS animations** to `0.01ms` (effectively instant).
2. Force-reveals `.reveal-init` and `.page-enter` elements (so content is
   visible immediately, not stuck in a pre-animation state).
3. Hides decorative petals (`.petal`, `.petal-nav`).

**This guard covers CSS animations only.** It does **not** stop JS-driven GSAP
animations — those need separate handling via `gsap.matchMedia()`. See
[animations.md](./animations.md).

### When adding new CSS animations

Any new `@keyframes` or animation utility you add to `globals.css` will be
automatically collapsed by the reduced-motion guard (because it targets all
`animation` properties). You don't need to add per-animation guards — but you
*do* need to make sure the element's final/visible state is the no-animation
default, so that collapsing the animation doesn't leave it hidden.

## Keyframes and utility classes in `globals.css`

Existing keyframes: `fade-up`, `sway`, `float`, `petal-fall`, `petal-drift`,
`bloom-glow`, `spin-bloom`, `draw-stroke`, `page-enter`.

Existing utility classes: `.reveal-init` (hidden, for GSAP reveal),
`.page-enter` (300ms ease-out page transition), `.animate-sway`,
`.animate-float`, `.petal` (falling petal), `.petal-nav` (drifting navbar
petal).

When adding new keyframes, follow the naming pattern (`kebab-case`) and add a
matching `.animate-*` utility if it's reused.