// order.ts
//
// Helpers for encoding/decoding the purchased-items payload that the checkout
// API route appends to the success URL and the success page reads back.
//
// Both the server (the `/api/checkout` route, which runs on Cloudflare Workers)
// and the client (the `/checkout/success` page) import these, so the helpers
// must be isomorphic — no Node-only `Buffer`, no DOM-only types. `btoa`/`atob`
// are available globally in browsers, Cloudflare Workers, and bun.
//
// The encoding is base64url (URL-safe: `-` and `_` instead of `+` and `/`, no
// padding `=`) so it can be dropped into a query string without further
// `encodeURIComponent`. Product names are ASCII today, but the UTF-8-safe
// `unescape(encodeURIComponent(...))` / `decodeURIComponent(escape(...))` trick
// is used so future non-ASCII names round-trip correctly.

export interface OrderLineItem {
  id: string;
  name: string;
  price: number; // integer cents (Stripe convention)
  quantity: number;
}

/**
 * Encode a list of order line items as a base64url string suitable for a URL
 * query param. Returns the base64url string (no padding).
 */
export function encodeOrderItems(items: OrderLineItem[]): string {
  const json = JSON.stringify(items);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url-encoded `OrderLineItem[]`. Returns `[]` for any malformed
 * input or if the decoded JSON isn't a valid array of line items — never throws.
 */
export function decodeOrderItems(encoded: string): OrderLineItem[] {
  if (!encoded) return [];
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOrderLineItem);
  } catch {
    return [];
  }
}

function isOrderLineItem(v: unknown): v is OrderLineItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.price === 'number' &&
    typeof o.quantity === 'number'
  );
}

/**
 * Generate a short, human-readable order number for the simulated checkout
 * path, e.g. "EF-7Q3K9M". Uses an unambiguous alphabet (no I, O, 0, 1, L).
 * Real Stripe payments use the Stripe session id (`{CHECKOUT_SESSION_ID}`)
 * instead, so this is only for the simulated/local-dev path.
 */
export function generateOrderNumber(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EF-${s}`;
}