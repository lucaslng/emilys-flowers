# Next.js 16 + React 19 Conventions

> **Read this before touching routes, layouts, data fetching, metadata, route
> handlers, or React hooks.** Next.js 16 and React 19 have breaking changes
> that an agent trained on Next.js 13–15 / React 17–18 will get wrong.

## Next.js 16 — what changed

### Async request APIs (required, not optional)

In Next.js 16, `params`, `searchParams`, `cookies()`, `headers()`, and
`draftMode()` are **async-only**. Sync access was fully removed in v15 and stays
removed. You must `await` them:

```ts
// CORRECT — Next.js 16
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  // ...
}

// WRONG — will not compile / throws
export function generateMetadata({ params }: { params: { id: string } }) {
  const { id } = params // ❌ params is a Promise, not an object
}
```

This project's pages are mostly static (hardcoded products), so `params`/
`searchParams` rarely appear — but if you add a dynamic route, `await` them.

### `middleware.ts` → `proxy.ts`

The file was renamed and the named export changed from `middleware` to `proxy`.
Edge runtime is **not** supported in `proxy.ts`. This project has neither file
today; if you add one, name it `proxy.ts`.

### Turbopack is the default bundler

`bun run dev` and `bun run build` both use Turbopack by default in v16. Custom
webpack config (if ever added) may need revalidation. The project currently has
no custom bundler config.

### `fetch()` is not cached by default

Since Next.js 15, `fetch()` requests are **not cached** unless you opt in. This
is a breaking change from v14. To cache:

```ts
// Opt into caching
await fetch(url, { cache: 'force-cache' })

// ISR-style revalidation
await fetch(url, { next: { revalidate: 60 } })
```

Next.js 16 also introduces the `'use cache'` directive as the new canonical
caching model (replaces `unstable_cache`). This project has no data fetching
(products are hardcoded), so neither pattern is used today — but if you add a
remote data source, pick one of these two approaches.

### `next/legacy/image` is deprecated

Use `next/image` only. The project already does this correctly.

## App Router file conventions (as used in this project)

| File | This project | Notes |
|---|---|---|
| `layout.tsx` | `src/app/layout.tsx` (root) | Server component. Wraps tree in `CartProvider` + `PetalBurstProvider`, renders `Navbar`/`Footer`. **Does not remount** on navigation. |
| `template.tsx` | `src/app/template.tsx` | Client component. **Remounts on every segment navigation** — `useEffect` re-runs per route. Used for the `.page-enter` animation. Do not put state here that must persist across navigations. |
| `page.tsx` | `src/app/page.tsx` + route folders | The unique UI for a URL. Some are Server (home), some are Client (`/flowers`, `/bouquets`, `/cart`, `/checkout`). |
| `loading.tsx` | `src/app/loading.tsx` | Suspense fallback — renders `BloomSpinner` + "Blooming…". |
| `route.ts` | `src/app/api/checkout/route.ts` | API Route Handler. Exports `POST`. |

### `template.tsx` vs `layout.tsx` — the key distinction

- **`layout.tsx`** persists across navigations. State, providers, and effects
  survive. The root layout mounts `CartProvider` and `PetalBurstProvider` here
  precisely so cart state and the petal-burst singleton survive route changes.
- **`template.tsx`** remounts on every segment navigation. `useEffect` re-runs.
  This is why the page-enter animation lives here — it should fire on each
  navigation, not just once.

If you need a per-route effect that fires on every navigation, put it in
`template.tsx` (or a component rendered by it). If you need state that survives
navigation, put it in `layout.tsx` (or a provider mounted there).

## Server vs Client Components

**Default:** everything in `src/app/` is a Server Component. Add `'use client'`
at the top of a file to opt into Client Component behavior.

### When to use `'use client'` in this project

A file must be a Client Component if it uses:
- React hooks (`useState`, `useEffect`, `useRef`, `useReducer`, `useContext`,
  `useCallback`, `useMemo`)
- Event handlers (`onClick`, `onChange`, etc.)
- Browser APIs (`window`, `localStorage`, `document`)
- GSAP (the `@/lib/gsap` module is client-only)

### Current split

| Client (`'use client'`) | Server (no directive) |
|---|---|
| `template.tsx`, `flowers/page.tsx`, `bouquets/page.tsx`, `cart/page.tsx`, `checkout/page.tsx` | `layout.tsx`, `page.tsx` (home), `loading.tsx` |
| `Navbar`, `ProductCard`, `FilterBar`, `CartItem`, `CartSummary` | `Footer`, `ProductGrid`, `FeaturedBouquets`, `WhyChooseUs` |
| `Reveal`, `BloomSpinner`, `StemGrowth`, `SquiggleUnderline`, `PetalBurst` | `Button`, `Container` |
| `cart-context.tsx`, `gsap.ts`, `petal-burst.tsx` | `products.ts`, `types/index.ts` |

**Note:** `src/lib/stripe.ts` has no `'use client'` directive but runs
client-side (it calls `loadStripe`). It's imported only by client code. This is
fine — the directive gates whether the file *can* use client APIs, not where it
runs.

## Route Handlers

The project has one: `src/app/api/checkout/route.ts`. Pattern:

```ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()  // body parsing is built-in, no middleware needed
  // ...
  return NextResponse.json({ url: '...' })
}
```

- `request.json()` works natively — no body-parsing middleware.
- `NextResponse.json()` or `Response.json()` both work.
- POST handlers are dynamic by default; no need for `export const dynamic =
  'force-dynamic'` unless you add GET that must not be cached.

## Metadata API

Static metadata (export a `Metadata` object) or dynamic (`generateMetadata`).
This project doesn't currently export much metadata — if you add it:

```ts
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Emily's Flowers",
  description: 'Handcrafted ribbon-flower arrangements',
}
```

For dynamic routes, `generateMetadata` is async and `params` is a Promise (see
[Async request APIs](#async-request-apis-required-not-optional) above).

## `next.config.ts`

The project uses the TypeScript config form (not `next.config.js`):

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
    ],
  },
}

export default config
```

`remotePatterns` whitelists `picsum.photos` (placeholder product images). If you
add a new image host, add it here.

---

## React 19 — what changed

### `ref` is a regular prop

`forwardRef` is no longer needed (but still works). You can accept `ref`
directly:

```tsx
// React 19 — no forwardRef needed
function FancyInput({ ref, ...props }: { ref: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}
```

### `<Context>` is equivalent to `<Context.Provider>`

```tsx
// Both work in React 19; the shorthand is preferred for new code
<CartContext.Provider value={cart}>...</CartContext.Provider>
<CartContext value={cart}>...</CartContext>
```

This project's `cart-context.tsx` uses the `.Provider` form — that's fine; don't
change it just to use the shorthand unless you're already editing that file.

### New hooks (available, not all used here)

| Hook | Use | In this project? |
|---|---|---|
| `use(promise)` | Read a promise or Context in render (can be conditional) | No |
| `useActionState(action, initialState)` | Form Actions with pending state | No |
| `useOptimistic(actualState)` | Optimistic updates during Transitions | No |
| `useFormStatus()` | Pending state of parent `<form action>` | No |

The project uses `useReducer` (in `cart-context.tsx`) rather than
`useActionState` — that's fine for the cart's local needs. If you add form
submission flows (e.g., a contact form, real checkout), consider `useActionState`
+ Server Actions.

### Document metadata in components

React 19 hoists `<title>`, `<meta>`, and `<link>` rendered in any component up
to `<head>`. You can render them directly. For route-level metadata, prefer the
Next.js Metadata API (above) for consistency.

### Removed in React 19

- `propTypes` and `defaultProps` for function components
- `ReactDOM.render` / `ReactDOM.hydrate` (use `createRoot` / `hydrateRoot`)
- `react-dom/test-utils`, `findDOMNode`, string refs, legacy Context API
- The old JSX transform (`import React from 'react'`) — the automatic runtime
  (`"jsx": "react-jsx"`, already set in `tsconfig.json`) is required.

### Server Components are the default

React Server Components (RSC) are stable. In the App Router, components are
Server Components by default. RSC cannot use hooks, event handlers, or browser
APIs; they can `await` data directly. This is why `page.tsx` files that don't
need interactivity are Server Components.