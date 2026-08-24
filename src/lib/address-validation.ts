/**
 * Shared delivery-address validation for checkout.
 *
 * Used by BOTH the client checkout form (per-field error messages) and the
 * server (`src/lib/chitchats.ts`, `POST /api/checkout`) so both sides enforce
 * identical rules. Keep this module free of server-only imports — it is
 * bundled into client JS.
 */

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

export type AddressFieldName =
  | 'name'
  | 'line1'
  | 'line2'
  | 'city'
  | 'province'
  | 'postalCode';

export interface AddressFieldError {
  field: AddressFieldName;
  message: string;
}

/**
 * Canadian postal code (`A1A 1A1`). Case-insensitive; the separator between
 * the two halves may be a space, a hyphen, or omitted. First-position letters
 * exclude D/F/I/O/Q/U/W/Z; third-position letters exclude D/F/I/O/Q/U.
 */
export const CA_POSTAL_CODE_REGEX =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

export function isValidCAPostalCode(value: string): boolean {
  return CA_POSTAL_CODE_REGEX.test(value.trim());
}

/**
 * Canonical postal-code form: trimmed, uppercase, single-space separator
 * ("  m5v-2t6 " → "M5V 2T6", "m5v2t6" → "M5V 2T6"). Best-effort for invalid
 * input.
 */
export function normalizeCAPostalCode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/[\s-]+/g, '');
  // A well-formed (case-insensitive, separator-free) code is exactly 6
  // characters — split it into its two halves at the canonical position.
  return compact.length === 6
    ? `${compact.slice(0, 3)} ${compact.slice(3)}`
    : compact;
}

/** Customer-facing message per address field. `line2` is optional — no message. */
export const ADDRESS_FIELD_MESSAGES: {
  [K in Exclude<AddressFieldName, 'line2'>]: string;
} = {
  name: 'Enter your full name',
  line1: 'Enter your street address',
  city: 'Enter your city',
  province: 'Select a province',
  postalCode: 'Enter a valid Canadian postal code (e.g. M5V 2T6)',
};

const REQUIRED_FIELDS = [
  'name',
  'line1',
  'city',
  'province',
  'postalCode',
] as const satisfies readonly Exclude<AddressFieldName, 'line2'>[];

function fieldValue(
  record: Record<string, unknown>,
  field: AddressFieldName,
): string {
  const value = record[field];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validate an untrusted delivery-address payload and return one structured
 * error per invalid field, in form order. Returns [] when the address is
 * fully valid. Rules: name/line1/city/province/postalCode required non-empty;
 * province must be a known CA code; postalCode must be a valid Canadian
 * postal code; `line2` is optional and never produces an error.
 */
export function validateDeliveryAddressFields(
  address: unknown,
): AddressFieldError[] {
  if (typeof address !== 'object' || address === null) {
    return REQUIRED_FIELDS.map((field) => ({
      field,
      message: ADDRESS_FIELD_MESSAGES[field],
    }));
  }
  const record = address as Record<string, unknown>;
  const errors: AddressFieldError[] = [];
  for (const field of REQUIRED_FIELDS) {
    const value = fieldValue(record, field);
    if (!value) {
      errors.push({ field, message: ADDRESS_FIELD_MESSAGES[field] });
      continue;
    }
    if (field === 'province' && !isKnownProvince(value)) {
      errors.push({
        field,
        message: `Invalid province code "${value}". Must be one of: ${CA_PROVINCES.join(', ')}.`,
      });
    }
    if (field === 'postalCode' && !isValidCAPostalCode(value)) {
      errors.push({ field, message: ADDRESS_FIELD_MESSAGES.postalCode });
    }
  }
  return errors;
}

function isKnownProvince(value: string): boolean {
  return CA_PROVINCES.includes(value.toUpperCase() as CaProvince);
}

/** Stripe caps every Checkout Session metadata value at 500 characters. */
export const STRIPE_METADATA_VALUE_MAX_LENGTH = 500;

/**
 * Clamp a free-form string to Stripe's metadata-value cap: trim surrounding
 * whitespace first, then hard-slice. Same treatment `truncateDeliveryAddress`
 * gives each address field, for values that aren't address fields (e.g. the
 * admin ship route's `estimatedShippingTime`).
 */
export function clampMetadataValue(
  value: string,
  maxLength: number = STRIPE_METADATA_VALUE_MAX_LENGTH
): string {
  return value.trim().slice(0, maxLength);
}

/**
 * Per-field caps: fully-filled fields serialize to ≈349 chars + ≈85 chars of
 * JSON overhead — under the 500-char cap with margin. The client form
 * enforces them via `maxLength`; the server clamps again (never trust the client).
 */
export const ADDRESS_FIELD_MAX_LENGTHS: Record<AddressFieldName, number> = {
  name: 80,
  line1: 120,
  line2: 80,
  city: 60,
  province: 2,
  postalCode: 7,
};

/**
 * Structural address shape (mirrors chitchats.ts's `DeliveryAddress` without
 * importing it — that would cycle, since chitchats.ts imports this module).
 */
export interface ValidatedDeliveryAddress {
  name: string;
  line1: string;
  /** Apartment/unit line — optional. */
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
}

/** Clamp an already-validated (trimmed) address to `ADDRESS_FIELD_MAX_LENGTHS`. */
export function truncateDeliveryAddress(
  address: ValidatedDeliveryAddress
): ValidatedDeliveryAddress {
  const clamp = (field: AddressFieldName, value: string) =>
    value.slice(0, ADDRESS_FIELD_MAX_LENGTHS[field]);
  return {
    name: clamp('name', address.name),
    line1: clamp('line1', address.line1),
    // `line2` is optional — preserve absence instead of materializing ''.
    ...(address.line2 === undefined
      ? {}
      : { line2: clamp('line2', address.line2) }),
    city: clamp('city', address.city),
    province: clamp('province', address.province),
    postalCode: clamp('postalCode', address.postalCode),
  };
}

const METADATA_ADDRESS_FIELDS = [
  'name',
  'line1',
  'city',
  'province',
  'postalCode',
] as const satisfies readonly Exclude<AddressFieldName, 'line2'>[];

function serializeShippingAddress(address: ValidatedDeliveryAddress): string {
  return JSON.stringify({
    name: address.name,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
  });
}

/**
 * Serialize the address for the `shipping_address` metadata, hard-guaranteed
 * to fit Stripe's 500-char cap: per-field truncation normally suffices, but
 * JSON escape inflation (each quote/backslash doubles) can still overflow —
 * so drop the optional `line2`, then shorten the longest field until it fits.
 */
export function shippingAddressMetadataValue(
  address: ValidatedDeliveryAddress
): string {
  const truncated = truncateDeliveryAddress(address);

  let value = serializeShippingAddress(truncated);
  if (value.length <= STRIPE_METADATA_VALUE_MAX_LENGTH) return value;

  // Escape inflation: drop the optional apartment/unit line and retry.
  const { line2: _line2, ...withoutLine2 } = truncated;
  value = serializeShippingAddress(withoutLine2);
  if (value.length <= STRIPE_METADATA_VALUE_MAX_LENGTH) return value;

  // Removing one raw char shrinks the serialized form by 1–2 chars, so
  // cutting `overflow` raw chars always makes progress — this terminates.
  const current: Record<(typeof METADATA_ADDRESS_FIELDS)[number], string> = {
    name: withoutLine2.name,
    line1: withoutLine2.line1,
    city: withoutLine2.city,
    province: withoutLine2.province,
    postalCode: withoutLine2.postalCode,
  };
  while (true) {
    value = serializeShippingAddress(current);
    if (value.length <= STRIPE_METADATA_VALUE_MAX_LENGTH) return value;
    let longest: (typeof METADATA_ADDRESS_FIELDS)[number] | null = null;
    for (const field of METADATA_ADDRESS_FIELDS) {
      if (longest === null || current[field].length > current[longest].length) {
        longest = field;
      }
    }
    if (longest === null || current[longest].length === 0) return value;
    const overflow = value.length - STRIPE_METADATA_VALUE_MAX_LENGTH;
    current[longest] = current[longest].slice(
      0,
      Math.max(0, current[longest].length - overflow)
    );
  }
}

export interface ShippingAddressMetadata {
  /** JSON string for the `shipping_address` metadata value (≤500 chars). */
  json: string;
  /** The exact address encoded in `json`, ready for the shipment payload. */
  value: ValidatedDeliveryAddress;
}

/**
 * Build the `shipping_address` metadata once: `json` goes into Stripe
 * metadata and `value` (parsed back from that same string) feeds the
 * ChitChats payload, so the label always mirrors what was stored — including
 * when the 500-char fallback drops `line2` or shortens a field. Callers must
 * not re-serialize or re-parse either half.
 */
export function shippingAddressMetadata(
  address: ValidatedDeliveryAddress
): ShippingAddressMetadata {
  const json = shippingAddressMetadataValue(address);
  return { json, value: JSON.parse(json) as ValidatedDeliveryAddress };
}
