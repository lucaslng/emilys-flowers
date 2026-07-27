export interface LineItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type LineItemsValidation =
  | { ok: true }
  | { ok: false; error: string };

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