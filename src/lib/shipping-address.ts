// Shipping-address presentation shared by the confirmation email and the admin order list; reads Stripe's
// shipping_details plus the shipping_address JSON stored in session metadata. Isomorphic.

import type Stripe from 'stripe';

/** Present on the Stripe API but missing from stripe-node v22's Checkout.Session type. */
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

/** Parses the shipping_address metadata JSON; non-string fields coerce to '', null when absent or unparseable. */
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

/** One line per field (city/province share a comma-separated line), optional trailing country; empty fields dropped, null when nothing renders. */
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
