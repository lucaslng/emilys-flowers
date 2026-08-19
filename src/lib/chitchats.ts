// src/lib/chitchats.ts
//
// Thin server-only client + pure helpers for ChitChats shipping.
//
// ChitChats has NO standalone rates endpoint — rates are returned when a
// shipment is created with `postage_type: "unknown"`. The checkout route
// creates a shipment to obtain rates, charges the cheapest one as a Stripe
// shipping option, and stores the shipment id / tracking URL in session
// metadata so the admin can open the shipment later.
//
// The pure helpers (pickCheapestRate, parsePaymentAmountToCents,
// estimateShipmentWeight, buildShipmentPayload, validateDeliveryAddress) are
// isomorphic — no Node-only `Buffer`, no DOM — so they can be unit-tested
// with bun without touching the network. The client functions
// (isChitchatsConfigured, chitchatsApiBaseUrl, chitchatsHeaders,
// createShipment) read `process.env` and are server-only.

import type { LineItem } from '@/lib/order';

/** Canadian province/territory codes accepted by ChitChats. */
export const CA_PROVINCES = [
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'QC',
  'SK',
  'YT',
] as const;

export type CaProvince = (typeof CA_PROVINCES)[number];

export interface ChitChatsRate {
  postage_type: string;
  postage_description: string;
  /**
   * Total to charge the customer (postage + insurance + taxes + fees), as
   * string dollars e.g. "9.68". ChitChats returns no currency field — assume
   * CAD (the account currency).
   */
  payment_amount: string;
  delivery_time_description?: string;
}

export interface ChitChatsShipment {
  id: string;
  tracking_url: string;
  rates: ChitChatsRate[];
}

/** The address shape the checkout page collects (and we store in metadata). */
export interface DeliveryAddress {
  name: string;
  line1: string;
  /** Apartment/unit line — optional. */
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface ChitChatsShipmentLineItem {
  quantity: number;
  description: string;
  /** Declared value for the line, as string dollars e.g. "24.99". */
  value_amount: string;
  currency_code: 'cad';
}

export interface ChitChatsShipmentInput {
  name: string;
  address_1: string;
  /** Apartment/unit line — only sent when present. */
  address_2?: string;
  city: string;
  province_code: string;
  postal_code: string;
  country_code: string;
  package_contents: 'merchandise';
  value: string;
  value_currency: 'cad';
  order_id: string;
  order_store: 'other';
  package_type: 'parcel';
  weight_unit: 'g';
  weight: number;
  size_unit: 'cm';
  size_x: number;
  size_y: number;
  size_z: number;
  postage_type: 'unknown';
  ship_date: 'today';
  line_items: ChitChatsShipmentLineItem[];
}

// --- Config helpers (server-only) ---

/** True when both ChitChats credentials are present. */
export function isChitchatsConfigured(): boolean {
  return Boolean(
    process.env.CHITCHATS_CLIENT_ID && process.env.CHITCHATS_ACCESS_TOKEN
  );
}

/** API base URL: `CHITCHATS_API_BASE_URL` or the production default. */
export function chitchatsApiBaseUrl(): string {
  return process.env.CHITCHATS_API_BASE_URL ?? 'https://chitchats.com';
}

/**
 * Headers for ChitChats API calls. The access token is sent as a BARE token —
 * ChitChats rejects `Bearer <token>`.
 */
export function chitchatsHeaders(): Record<string, string> {
  return {
    Authorization: process.env.CHITCHATS_ACCESS_TOKEN ?? '',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

// --- Client (server-only) ---

/**
 * Create a ChitChats shipment. With `postage_type: "unknown"` this is how
 * rates are obtained — there is no standalone rates endpoint. Throws an
 * `Error` with a readable message on non-2xx or network failure (including
 * the API error message when present).
 */
export async function createShipment(
  input: ChitChatsShipmentInput
): Promise<ChitChatsShipment> {
  const clientId = process.env.CHITCHATS_CLIENT_ID;
  const accessToken = process.env.CHITCHATS_ACCESS_TOKEN;
  if (!clientId || !accessToken) {
    throw new Error(
      'ChitChats is not configured: CHITCHATS_CLIENT_ID and CHITCHATS_ACCESS_TOKEN are required.'
    );
  }

  const url = `${chitchatsApiBaseUrl()}/api/v1/clients/${clientId}/shipments`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: chitchatsHeaders(),
      body: JSON.stringify(input),
      // A hung ChitChats request must not leave the customer spinning at
      // checkout — abort after 10s and surface a readable error.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(
      `Failed to reach ChitChats: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    let message = `ChitChats API error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) {
        message = `${message}: ${body.error.message}`;
      }
    } catch {
      // Non-JSON error body — keep the status-only message.
    }
    throw new Error(message);
  }

  const body = (await response.json()) as { shipment?: ChitChatsShipment };
  // Validate the body shape so a malformed 2xx response throws a readable
  // error here instead of a TypeError escaping to the route's generic 500.
  if (!body.shipment || !Array.isArray(body.shipment.rates)) {
    throw new Error(
      'ChitChats API returned an unexpected response (missing shipment rates).'
    );
  }
  return body.shipment;
}

// --- Pure helpers (isomorphic, unit-tested) ---

/** Parse a ChitChats string-dollars amount into integer cents. NaN → 0. */
export function parsePaymentAmountToCents(paymentAmount: string): number {
  const parsed = Number(paymentAmount);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Parse a rate's `payment_amount` into integer cents, or `null` when it
 * doesn't parse to a finite positive number. Malformed rates must never be
 * selected — a NaN→0 fallback would make a broken rate win as "$0 shipping",
 * violating the always-charge-the-real-rate decision.
 */
function paymentAmountToCentsOrNull(paymentAmount: string): number | null {
  const parsed = Number(paymentAmount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

/**
 * Cheapest rate by `payment_amount`. Rates whose `payment_amount` doesn't
 * parse to a finite positive number are skipped; `null` when no valid rates
 * survive.
 */
export function pickCheapestRate(rates: ChitChatsRate[]): ChitChatsRate | null {
  let cheapest: ChitChatsRate | null = null;
  let cheapestCents = Infinity;
  for (const rate of rates) {
    const cents = paymentAmountToCentsOrNull(rate.payment_amount);
    if (cents === null) continue;
    if (cents < cheapestCents) {
      cheapest = rate;
      cheapestCents = cents;
    }
  }
  return cheapest;
}

// Weight estimate constants (grams): the parcel itself (box + wrapping +
// ribbon) is assumed to weigh ~500g, plus ~250g per item.
const BASE_WEIGHT_GRAMS = 500;
const WEIGHT_PER_ITEM_GRAMS = 250;

/** Estimate shipment weight in grams: 500g base + 250g per item. */
export function estimateShipmentWeight(totalQuantity: number): number {
  return BASE_WEIGHT_GRAMS + WEIGHT_PER_ITEM_GRAMS * totalQuantity;
}

/**
 * Build the ChitChats create-shipment payload for a checkout. Declared value
 * is the order subtotal; line items carry their own line totals; weight comes
 * from `estimateShipmentWeight`; fixed 30×20×10 cm parcel; `postage_type`
 * "unknown" so ChitChats returns rates; `ship_date` "today" (required for
 * rates).
 */
export function buildShipmentPayload({
  address,
  items,
  orderNumber,
  subtotalCents,
}: {
  address: DeliveryAddress;
  items: LineItem[];
  orderNumber: string;
  subtotalCents: number;
}): ChitChatsShipmentInput {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    name: address.name,
    address_1: address.line1,
    // ChitChats supports `address_2`; only send it when the customer
    // provided an apartment/unit line.
    ...(address.line2 ? { address_2: address.line2 } : {}),
    city: address.city,
    province_code: address.province,
    postal_code: address.postalCode,
    country_code: 'CA',
    package_contents: 'merchandise',
    value: (subtotalCents / 100).toFixed(2),
    value_currency: 'cad',
    order_id: orderNumber,
    order_store: 'other',
    package_type: 'parcel',
    weight_unit: 'g',
    weight: estimateShipmentWeight(totalQuantity),
    size_unit: 'cm',
    size_x: 30,
    size_y: 20,
    size_z: 10,
    postage_type: 'unknown',
    ship_date: 'today',
    line_items: items.map((item) => ({
      quantity: item.quantity,
      description: item.name,
      value_amount: ((item.price * item.quantity) / 100).toFixed(2),
      currency_code: 'cad',
    })),
  };
}

export type DeliveryAddressValidation =
  | { ok: true; value: DeliveryAddress }
  | { ok: false; error: string };

/**
 * Validate a checkout delivery address: name, line1, city, province and
 * postalCode required non-empty strings; `line2` (apartment/unit) optional.
 * Strings are trimmed; the province is normalized to uppercase.
 */
export function validateDeliveryAddress(
  address: unknown
): DeliveryAddressValidation {
  if (typeof address !== 'object' || address === null) {
    return {
      ok: false,
      error: 'A delivery address is required to calculate shipping.',
    };
  }
  const record = address as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const line1 = typeof record.line1 === 'string' ? record.line1.trim() : '';
  const line2 = typeof record.line2 === 'string' ? record.line2.trim() : '';
  const city = typeof record.city === 'string' ? record.city.trim() : '';
  const province =
    typeof record.province === 'string'
      ? record.province.trim().toUpperCase()
      : '';
  const postalCode =
    typeof record.postalCode === 'string' ? record.postalCode.trim() : '';

  if (!name || !line1 || !city || !province || !postalCode) {
    return {
      ok: false,
      error: 'Delivery address is missing required fields (name, line1, city, province, postalCode).',
    };
  }
  if (!CA_PROVINCES.includes(province as CaProvince)) {
    return {
      ok: false,
      error: `Invalid province code "${province}". Must be one of: ${CA_PROVINCES.join(', ')}.`,
    };
  }
  return { ok: true, value: { name, line1, line2, city, province, postalCode } };
}