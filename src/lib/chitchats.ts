// Thin server-only ChitChats client + isomorphic pure helpers (no Node-only APIs, unit-testable without the network).

import type { LineItem } from '@/lib/order';
import {
  normalizeCAPostalCode,
  validateDeliveryAddressFields,
  type AddressFieldError,
} from '@/lib/address-validation';

export { CA_PROVINCES } from '@/lib/address-validation';
export type { CaProvince } from '@/lib/address-validation';

export interface ChitChatsRate {
  postage_type: string;
  postage_description: string;
  /**
   * Total to charge (postage + insurance + taxes + fees), string dollars e.g. "9.68"; ChitChats returns no currency field — assume CAD.
   */
  payment_amount: string;
  delivery_time_description?: string;
}

export interface ChitChatsShipment {
  id: string;
  tracking_url: string;
  rates: ChitChatsRate[];
}

export interface DeliveryAddress {
  name: string;
  line1: string;
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
  address_2?: string;
  city: string;
  province_code: string;
  postal_code: string;
  country_code: string;
  package_contents: 'merchandise';
  /**
   * Free-text customs description; ChitChats derives the declaration from `line_items` when present, so this mirrors them as a fallback.
   */
  description: string;
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

export function isChitchatsConfigured(): boolean {
  return Boolean(
    process.env.CHITCHATS_CLIENT_ID && process.env.CHITCHATS_ACCESS_TOKEN
  );
}

export function chitchatsApiBaseUrl(): string {
  return process.env.CHITCHATS_BASE_URL ?? 'https://chitchats.com';
}

export function chitchatsClientId(): string {
  return process.env.CHITCHATS_CLIENT_ID ?? '';
}

/** Admin-facing dashboard URL (requires login): {base}/clients/{clientId}/shipments/{shipmentId}. */
export function shipmentDashboardUrl(shipmentId: string): string {
  return `${chitchatsApiBaseUrl()}/clients/${chitchatsClientId()}/shipments/${shipmentId}`;
}

/** Metadata-controlled ids are validated before href interpolation so a spoofed value can't become a javascript: link target. */
export function isValidShipmentId(shipmentId: string): boolean {
  return /^[A-Za-z0-9_-]{4,64}$/.test(shipmentId);
}

/** ChitChats rejects `Bearer <token>` — the access token must be sent bare. */
export function chitchatsHeaders(): Record<string, string> {
  return {
    Authorization: process.env.CHITCHATS_ACCESS_TOKEN ?? '',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

/** Creates a shipment with postage_type "unknown" — ChitChats has no standalone rates endpoint, so this is how rates are obtained. */
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
      // Abort after 10s so a hung ChitChats request can't leave the customer spinning at checkout.
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
  // Validate shape so a malformed 2xx throws a readable error instead of a TypeError reaching the route's generic 500.
  if (!body.shipment || !Array.isArray(body.shipment.rates)) {
    throw new Error(
      'ChitChats API returned an unexpected response (missing shipment rates).'
    );
  }
  return body.shipment;
}

/** Malformed rates must never be charged — a NaN→0 fallback would let a broken rate win as "$0 shipping". */
function paymentAmountToCentsOrNull(paymentAmount: string): number | null {
  const parsed = Number(paymentAmount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export interface CheapestRate {
  rate: ChitChatsRate;
  /** The chosen rate's `payment_amount` as integer cents (strict parse). */
  cents: number;
}

/** Cheapest rate by parsed cents; invalid rates skipped, null when none survive. Callers must charge the returned cents rather than re-parsing. */
export function pickCheapestRate(rates: ChitChatsRate[]): CheapestRate | null {
  let cheapest: CheapestRate | null = null;
  for (const rate of rates) {
    const cents = paymentAmountToCentsOrNull(rate.payment_amount);
    if (cents === null) continue;
    if (!cheapest || cents < cheapest.cents) {
      cheapest = { rate, cents };
    }
  }
  return cheapest;
}

// Grams per product; deliberately no base weight for the parcel itself.
const WEIGHT_PER_PRODUCT_GRAMS = 250;

export function estimateShipmentWeight(totalQuantity: number): number {
  return WEIGHT_PER_PRODUCT_GRAMS * totalQuantity;
}

/** Customs-declaration wording: ribbon flowers, never live plants, plus the order number for matching. */
function describeShipment(orderNumber: string): string {
  return `Handmade decorative ribbon flowers and bouquets (artificial floral crafts, no live plants) - Emily's Flowers order ${orderNumber}`;
}

/** ChitChats composes the customs declaration from line_items when present, overriding the shipment-level description. */
function describeLineItem(name: string): string {
  return `${name} - handmade decorative ribbon flower arrangement`;
}

/** Declared value is the order subtotal; postage_type "unknown" + ship_date "today" make ChitChats return rates. */
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
    ...(address.line2 ? { address_2: address.line2 } : {}),
    city: address.city,
    province_code: address.province,
    postal_code: address.postalCode,
    country_code: 'CA',
    package_contents: 'merchandise',
    description: describeShipment(orderNumber),
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
      description: describeLineItem(item.name),
      value_amount: ((item.price * item.quantity) / 100).toFixed(2),
      currency_code: 'cad',
    })),
  };
}

export type DeliveryAddressValidation =
  | { ok: true; address: DeliveryAddress }
  | { ok: false; fieldErrors: AddressFieldError[] };

/** Single-pass validation delegating rules to validateDeliveryAddressFields; errors come back on normalized values so callers never re-validate raw input. */
export function validateDeliveryAddress(
  address: unknown
): DeliveryAddressValidation {
  const record =
    typeof address === 'object' && address !== null
      ? (address as Record<string, unknown>)
      : {};
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const line1 = typeof record.line1 === 'string' ? record.line1.trim() : '';
  const line2 = typeof record.line2 === 'string' ? record.line2.trim() : '';
  const city = typeof record.city === 'string' ? record.city.trim() : '';
  const province =
    typeof record.province === 'string'
      ? record.province.trim().toUpperCase()
      : '';
  const postalCode =
    typeof record.postalCode === 'string'
      ? normalizeCAPostalCode(record.postalCode)
      : '';

  const fieldErrors = validateDeliveryAddressFields({
    name,
    line1,
    city,
    province,
    postalCode,
  });
  if (fieldErrors.length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    address: { name, line1, line2, city, province, postalCode },
  };
}
