/**
 * Format an integer-cent price as a decimal string with 2 fraction digits.
 * Example: 2499 -> "24.99", 0 -> "0.00", 5 -> "0.05".
 * Returns the number only; callers add the currency symbol ($).
 */
export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Format an integer-cent price with the currency symbol. Example: 2499 -> "$24.99". */
export function formatCAD(cents: number): string {
  return `$${formatPrice(cents)}`;
}

/** Shipping-cost label: "Free" when the rate is zero, otherwise the dollar amount. */
export function formatShippingLabel(cents: number): string {
  return cents === 0 ? 'Free' : formatCAD(cents);
}