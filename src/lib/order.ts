// order.ts
//
// The Order-line module: the single home for the flat line-item shape, the
// order/cart math that operates on it, the base64url encoding used by the
// checkout success URL, and checkout payload validation.
//
// Both the server (the `/api/checkout` route, which runs on Cloudflare Workers)
// and the client (the `/checkout` and `/checkout/success` pages, plus the cart
// context) import these, so the helpers must be isomorphic — no Node-only
// `Buffer`, no DOM-only types. `btoa`/`atob` are available globally in browsers,
// Cloudflare Workers, and bun.
//
// The encoding is base64url (URL-safe: `-` and `_` instead of `+` and `/`, no
// padding `=`) so it can be dropped into a query string without further
// `encodeURIComponent`. Product names are ASCII today, but the UTF-8-safe
// `unescape(encodeURIComponent(...))` / `decodeURIComponent(escape(...))` trick
// is used so future non-ASCII names round-trip correctly.

export interface LineItem {
  id: string;
  name: string;
  price: number; // integer cents (Stripe convention)
  quantity: number;
}

export type LineItemsValidation =
  | { ok: true }
  | { ok: false; error: string };

// --- Order/cart math (pure, unit-tested) ---
// AGENTS.md: all order/cart math stays in cents and lives in this module.

/** Sum of (price * quantity) across line items, in cents. */
export function computeLineItemTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** Total unit count across all line items. */
export function computeLineItemCount(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Free shipping at/above $50 (5000 cents); otherwise flat $5.99 (599 cents). */
export function computeShipping(subtotalCents: number): number {
  return subtotalCents >= 5000 ? 0 : 599;
}

// --- Validation ---

/**
 * Validate the checkout payload's line items.
 * - items must be a non-empty array (error: "No items provided")
 * - each item: non-empty id, non-empty name, positive-integer price (cents),
 *   positive-integer quantity (else error: "Invalid line item")
 */
export function validateLineItems(items: unknown): LineItemsValidation {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "No items provided" };
  }
  for (const item of items) {
    if (
      item === null ||
      typeof item !== "object" ||
      !("id" in item) ||
      typeof item.id !== "string" ||
      item.id.trim() === "" ||
      !("name" in item) ||
      typeof item.name !== "string" ||
      item.name.trim() === "" ||
      !("price" in item) ||
      typeof item.price !== "number" ||
      !Number.isInteger(item.price) ||
      item.price <= 0 ||
      !("quantity" in item) ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      return { ok: false, error: "Invalid line item" };
    }
  }
  return { ok: true };
}

// --- Encoding ---

/**
 * Encode a list of line items as a base64url string suitable for a URL
 * query param. Returns the base64url string (no padding).
 */
export function encodeOrderItems(items: LineItem[]): string {
  const json = JSON.stringify(items);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url-encoded `LineItem[]`. Returns `[]` for any malformed
 * input or if the decoded JSON isn't a valid array of line items — never throws.
 */
export function decodeOrderItems(encoded: string): LineItem[] {
  if (!encoded) return [];
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLineItem);
  } catch {
    return [];
  }
}

function isLineItem(v: unknown): v is LineItem {
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
