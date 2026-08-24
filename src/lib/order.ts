// Order-line module: flat LineItem shape, order/cart math, checkout validation.
// Isomorphic — imported by both the Workers checkout route and client pages, so no Node-only APIs.

export interface LineItem {
  id: string;
  name: string;
  price: number; // integer cents (Stripe convention)
  quantity: number;
  /** Category carried through so the success page can render the right placeholder image. */
  category?: 'flower' | 'bouquet';
}

/** Client sends {productId, quantity} ONLY — names/prices resolve server-side against the Stripe catalog so prices can't be attacker-chosen. */
export interface CheckoutItemPayload {
  productId: string;
  quantity: number;
}

/** Hard cap on units per line, enforced server-side at the checkout boundary. */
export const MAX_LINE_ITEM_QUANTITY = 99;

/** Hard cap on distinct lines per checkout request, enforced server-side at the checkout boundary. */
export const MAX_LINE_ITEMS = 20;

export type LineItemsValidation =
  | { ok: true }
  | { ok: false; error: string };

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

export function validateCheckoutItems(items: unknown): LineItemsValidation {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "No items provided" };
  }
  if (items.length > MAX_LINE_ITEMS) {
    return { ok: false, error: "Too many line items" };
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

/** Server-side twin of the cart's client-side merge — sums duplicate productIds (first-seen order) so a request can't smuggle one product across multiple lines. Pure. */
export function mergeCheckoutItems(
  items: CheckoutItemPayload[]
): CheckoutItemPayload[] {
  const merged: CheckoutItemPayload[] = [];
  const indexByProductId = new Map<string, number>();
  for (const item of items) {
    const existingIndex = indexByProductId.get(item.productId);
    if (existingIndex === undefined) {
      indexByProductId.set(item.productId, merged.length);
      merged.push({ productId: item.productId, quantity: item.quantity });
    } else {
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        productId: existing.productId,
        quantity: existing.quantity + item.quantity,
      };
    }
  }
  return merged;
}

/** Customer-facing order number e.g. "EF-7Q3K9M"; unambiguous alphabet (no I, O, 0, 1, L). Stored in Stripe metadata as `order_number`. */
export function generateOrderNumber(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EF-${s}`;
}
