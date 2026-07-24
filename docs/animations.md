# Animations: GSAP, PetalBurst & Reduced Motion

> **Read this before writing any GSAP animation, scroll effect, or motion
> component.** The project has a strict import rule and a singleton pattern
> that exist for good reasons — violating them reintroduces real bugs.

## The import rule (non-negotiable)

**Always import GSAP from `@/lib/gsap`, never directly from `gsap` or
`@gsap/react`.**

```ts
// CORRECT
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap'

// WRONG — will cause duplicate plugin registration and a hydration warning
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
```

### Why

`src/lib/gsap.ts` does three things that break if you bypass it:

1. **Registers plugins once.** `gsap.registerPlugin(ScrollTrigger, useGSAP)` is
   called a single time. Importing directly in multiple files re-registers,
   which is harmless but wasteful — and worse, it can cause version mismatch
   warnings.
2. **Clears `body.style`.** ScrollTrigger writes to `body.style` during
   initialization, which triggers a Next.js hydration warning. The module
   clears that write. Bypassing it reintroduces the warning.
3. **Is client-only.** The module has `'use client'` and uses an isomorphic
   layout effect, so it's safe for SSR. Direct imports in a Server Component
   would crash.

## `useGSAP` — usage and automatic cleanup

`useGSAP` (from `@gsap/react` 2.1.2) is the React hook for GSAP. It wraps
animations in a GSAP Context and **automatically cleans up on unmount**:
`context.revert()` kills animations, removes ScrollTriggers, reverts DOM
modifications, and restores initial inline styles.

```tsx
'use client'
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

export function MyComponent() {
  const container = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.title', { opacity: 0, y: -20, duration: 0.8 })
    gsap.to('.box', { x: 100, duration: 1 })
  }, { scope: container })  // scope limits selector text to this container

  return <div ref={container}>…</div>
}
```

### Key points

- **`scope`**: pass a ref to limit selector text (`.title`) to within that
  container. Without `scope`, selectors are global — avoid that.
- **No manual cleanup needed.** Don't add `useEffect` returns that call
  `context.revert()`; `useGSAP` does it for you.
- **`contextSafe()`**: use for callbacks *outside* the main `useGSAP` callback
  (e.g., click handlers):
  ```ts
  const { contextSafe } = useGSAP(() => { /* initial animations */ }, { scope: container })
  const handleClick = contextSafe(() => { gsap.to('.box', { x: 200 }) })
  ```

### React Strict Mode is handled

React's Strict Mode double-invokes effects in development. `useGSAP` handles
this correctly: the first run's animations are reverted by the cleanup phase,
then fresh animations are created on the second run. **No double-animation
bug** if you let the hook's built-in cleanup do its job. Don't add manual
guards.

## Reduced motion — two layers, both required

The project handles reduced motion in **two places** that cover different
animation types:

### Layer 1: CSS guard (automatic, in `globals.css`)

A global `@media (prefers-reduced-motion: reduce)` block collapses all CSS
animations to `0.01ms` and hides decorative petals. This covers:
- CSS `@keyframes` animations (`.animate-sway`, `.animate-float`, `.petal`,
  `.page-enter`, etc.)
- `.reveal-init` elements are force-revealed (so GSAP-reveal content isn't
  stuck hidden)

**This does NOT affect JS-driven GSAP animations.** GSAP sets inline styles via
JS, which the CSS `animation` property collapse doesn't touch.

### Layer 2: `gsap.matchMedia()` (required for new GSAP animations)

For any new GSAP animation, use `gsap.matchMedia()` to gate it behind
`prefers-reduced-motion: no-preference`:

```tsx
useGSAP(() => {
  const mm = gsap.matchMedia()

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Full animation — only runs when user hasn't requested reduced motion
    gsap.from('.title', { opacity: 0, y: 20, duration: 0.8 })
  })

  // Optionally define minimal/no-animation behavior for reduced motion:
  mm.add('(prefers-reduced-motion: reduce)', () => {
    // Elements are already visible by default — nothing to do here usually.
    // Only add something if you need a specific reduced-motion state.
  })
}, { scope: container })
```

`gsap.matchMedia()` automatically cleans up when the match state changes or the
component unmounts. This is the canonical GSAP pattern.

### Existing components that follow this pattern

- `Reveal` — scroll-triggered fade-up, respects reduced motion
- `BloomSpinner` — blooming flower loader, respects reduced motion
- `StemGrowth` — scroll-scrubbed stem drawing, respects reduced motion
- `SquiggleUnderline` — self-drawing underline, respects reduced motion
- `PetalBurst` — no-ops under reduced motion

**When adding a new animation component, follow the `Reveal` pattern** (scope +
matchMedia + reduced-motion guard). Copy its structure rather than starting
from scratch.

## ScrollTrigger

`ScrollTrigger` is registered in `@/lib/gsap` and re-exported. Use it for
scroll-driven animations:

```tsx
useGSAP(() => {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    gsap.to('.stem', {
      drawSVG: '100%',
      scrollTrigger: {
        trigger: container.current,
        start: 'top center',
        end: 'bottom center',
        scrub: true,
      },
    })
  })
}, { scope: container })
```

ScrollTriggers created inside `useGSAP` are automatically cleaned up on unmount
(via `context.revert()`). Don't create ScrollTriggers outside `useGSAP`.

## PetalBurst — the singleton pattern

`PetalBurst` is a global delight interaction: when a user adds a product to
cart, petals fly from the product card toward the cart icon. It's implemented
as a **singleton** so any component can trigger it without prop drilling.

### Architecture

- `src/lib/petal-burst.tsx` exports `PetalBurstProvider` (mount once) and
  `firePetalBurst(from, to)` (call from anywhere).
- `PetalBurstProvider` is mounted in the root `layout.tsx`, so it's available
  on every page.
- `firePetalBurst(from, to)` takes viewport coordinates and calls the
  provider's ref. It's a module-level function — no hook needed.
- Under `prefers-reduced-motion: reduce`, it no-ops.

### Usage

```tsx
'use client'
import { firePetalBurst } from '@/lib/petal-burst'

function handleAddToCart(e: React.MouseEvent) {
  const cartIcon = document.querySelector('[data-cart-icon]')
  const cartRect = cartIcon?.getBoundingClientRect()
  if (cartRect) {
    firePetalBurst(
      { x: e.clientX, y: e.clientY },
      { x: cartRect.left + cartRect.width / 2, y: cartRect.top + cartRect.height / 2 }
    )
  }
  // ... add to cart
}
```

### Rules

- **Mount `PetalBurstProvider` exactly once**, in the root layout. It's
  already there — don't add another.
- **Call `firePetalBurst` from any client component.** No need to pass it via
  props or context.
- **Pass viewport coordinates** (clientX/clientY, getBoundingClientRect), not
  element refs.

## Existing animation components

| Component | File | What it does |
|---|---|---|
| `Reveal` | `src/components/ui/Reveal.tsx` | Scroll-triggered fade-up with optional stagger. The canonical pattern to copy for new scroll animations. |
| `BloomSpinner` | `src/components/ui/BloomSpinner.tsx` | 6-petal SVG flower that blooms + rotates. Loading indicator. |
| `StemGrowth` | `src/components/ui/StemGrowth.tsx` | SVG stem that "grows" on scroll via ScrollTrigger scrub. |
| `SquiggleUnderline` | `src/components/ui/SquiggleUnderline.tsx` | Hand-drawn squiggle SVG that draws in on mount. |
| `PetalBurst` | `src/components/ui/PetalBurst.tsx` | Fixed overlay animating petals from→to. Used by the singleton. |

### `Reveal` props

`Reveal` is the most reusable animation component. It accepts: `stagger`,
`delay`, `y`, `duration`, `once`. Wrap content in `<Reveal>` for scroll-triggered
entrance animations rather than writing custom GSAP for each case.