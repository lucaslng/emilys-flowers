/**
 * Format an integer-cent price as a CAD currency string with 2 fraction digits.
 * Example: 2499 -> "CA$24.99", 0 -> "CA$0.00", 5 -> "CA$0.05".
 */
export function formatPrice(cents: number): string {
  return `CA$${(cents / 100).toFixed(2)}`;
}