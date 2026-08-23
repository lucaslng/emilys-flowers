// order.ts
//
// The Order-line module: the single home for the flat line-item shape, the
// order/cart math that operates on it, and checkout payload validation.
//
// Both the server (the `/api/checkout` route, which runs on Cloudflare Workers)
// and the client (the `/checkout` and `/checkout/success` pages, plus the cart
// context) import these, so the helpers must be isomorphic — no Node-only
// `Buffer`, no DOM-only types.

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
