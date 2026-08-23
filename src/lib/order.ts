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
  /** Category carried through so the success page can render the right placeholder image. */
  category?: 'flower' | 'bouquet';
}

/**
 * The checkout wire shape the client is allowed to send: a product reference
 * and a quantity ONLY. Names and prices are never accepted from the client —
 * the server resolves them against the Stripe catalog (see
 * `src/lib/catalog-index.ts`), so a crafted request can't buy any product at
 * an attacker-chosen price.
 */
export interface CheckoutItemPayload {
  productId: string;
  quantity: number;
}

/** Hard cap on units per line, enforced server-side at the checkout boundary. */
export const MAX_LINE_ITEM_QUANTITY = 99;

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
 * Validate the checkout REQUEST payload — the `{productId, quantity}` pairs
 * the client is allowed to send. Names/prices are deliberately absent from
 * this shape; the server resolves them from the Stripe catalog.
 * - items must be a non-empty array (error: "No items provided")
 * - each item: non-empty productId, positive-integer quantity capped at
 *   MAX_LINE_ITEM_QUANTITY (else error: "Invalid line item")
 */
export function validateCheckoutItems(items: unknown): LineItemsValidation {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "No items provided" };
  }
  for (const item of items) {
    if (
      item === null ||
      typeof item !== "object" ||
      !("productId" in item) ||
      typeof item.productId !== "string" ||
      item.productId.trim() === "" ||
      !("quantity" in item) ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > MAX_LINE_ITEM_QUANTITY
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
  // Mirrors the semantic checks enforced at the checkout boundary
  // (`validateCheckoutItems`) so the success-page receipt can never surface
  // items that boundary would reject (empty ids/names, zero/negative/
  // non-integer prices or quantities, over-cap quantities).
  const categoryOk =
    o.category === undefined ||
    o.category === 'flower' ||
    o.category === 'bouquet';
  return (
    typeof o.id === 'string' &&
    o.id.trim() !== '' &&
    typeof o.name === 'string' &&
    o.name.trim() !== '' &&
    typeof o.price === 'number' &&
    Number.isInteger(o.price) &&
    o.price > 0 &&
    typeof o.quantity === 'number' &&
    Number.isInteger(o.quantity) &&
    o.quantity > 0 &&
    o.quantity <= MAX_LINE_ITEM_QUANTITY &&
    categoryOk
  );
}

/**
 * Generate the human-friendly order number shown to customers, e.g.
 * "EF-7Q3K9M". Uses an unambiguous alphabet (no I, O, 0, 1, L). Used by the
 * real checkout path and stored in Stripe session metadata as `order_number`;
 * emails/admin read it from there, falling back to the session id for legacy
 * sessions.
 */
export function generateOrderNumber(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EF-${s}`;
}
