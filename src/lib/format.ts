/**
 * Format an integer-cent price as a decimal string with 2 fraction digits.
 * Example: 2499 -> "24.99", 0 -> "0.00", 5 -> "0.05".
 * Returns the number only; callers add the currency symbol ($).
 */
export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}