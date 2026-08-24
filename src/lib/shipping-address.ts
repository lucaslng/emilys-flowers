// src/lib/shipping-address.ts
//
// Shared shipping-address presentation for the two surfaces that render it:
// the order-confirmation email (webhook) and the admin order list. Both read
// the same two sources — Stripe's `shipping_details` (null for us, since the
// address is collected on our own checkout page) and the `shipping_address`
// JSON stored in session metadata at checkout time.
//
// Isomorphic: no server-only imports.

import type Stripe from 'stripe';

/**
 * `shipping_details` is returned by the Stripe API on Checkout Sessions but
 * is not yet present on the stripe-node v22 `Checkout.Session` type.
 */
export type SessionWithShippingDetails = Stripe.Checkout.Session & {
  shipping_details?: { name: string; address: Stripe.Address } | null;
};

/** Field names of the `shipping_address` metadata JSON written at checkout. */
export interface StoredShippingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
}

/**
 * Parse the `shipping_address` JSON stored in session metadata. Non-string
 * field values coerce to ''; returns null when absent or unparseable.
 */
export function parseMetadataShippingAddress(
  metadata: Stripe.Metadata | null | undefined
): StoredShippingAddress | null {
  const stored = metadata?.shipping_address;
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const address = parsed as Record<string, unknown>;
    const field = (key: keyof StoredShippingAddress): string =>
      typeof address[key] === 'string' ? (address[key] as string) : '';
    return {
      name: field('name'),
      line1: field('line1'),
      line2: field('line2'),
      city: field('city'),
      province: field('province'),
      postalCode: field('postalCode'),
    };
  } catch {
    return null;
  }
}

/**
 * Render the stored address joined by `separator`: one line per field,
 * except city/province which share a comma-separated line, plus an optional
 * trailing country line. Empty fields drop out; null when nothing renders.
 */
export function formatMetadataShippingAddress(
  metadata: Stripe.Metadata | null | undefined,
  separator: string,
  country?: string
): string | null {
  const address = parseMetadataShippingAddress(metadata);
  if (!address) return null;
  const lines = [
    address.name,
    address.line1,
    address.line2,
    [address.city, address.province].filter(Boolean).join(', '),
    address.postalCode,
    country,
  ].filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines.join(separator) : null;
}
