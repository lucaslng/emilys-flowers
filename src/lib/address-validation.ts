// Shared delivery-address validation used by BOTH the client checkout form and the server —
// keep free of server-only imports (bundled into client JS).

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

/** Canadian postal code (A1A 1A1); separator may be space/hyphen/omitted; letter set excludes D/F/I/O/Q/U (+W/Z in first position). */
export const CA_POSTAL_CODE_REGEX =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

export function isValidCAPostalCode(value: string): boolean {
  return CA_POSTAL_CODE_REGEX.test(value.trim());
}

/** Canonical form: trimmed, uppercase, single-space separator; best-effort for invalid input. */
export function normalizeCAPostalCode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/[\s-]+/g, '');
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

/** One structured error per invalid field, in form order; [] when fully valid. */
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

/** Trim then hard-slice to Stripe's metadata cap — same treatment truncateDeliveryAddress gives each field. */
export function clampMetadataValue(
  value: string,
  maxLength: number = STRIPE_METADATA_VALUE_MAX_LENGTH
): string {
  return value.trim().slice(0, maxLength);
}

/** Per-field caps sized so full addresses serialize under Stripe's 500-char cap; client enforces via maxLength, server clamps again. */
export const ADDRESS_FIELD_MAX_LENGTHS: Record<AddressFieldName, number> = {
  name: 80,
  line1: 120,
  line2: 80,
  city: 60,
  province: 2,
  postalCode: 7,
};

/** Mirrors chitchats.ts's DeliveryAddress without importing it — that would cycle. */
export interface ValidatedDeliveryAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
}

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

/** Hard-guaranteed ≤500 chars: JSON escape inflation can overflow per-field truncation, so drop line2 then shorten the longest field until it fits. */
export function shippingAddressMetadataValue(
  address: ValidatedDeliveryAddress
): string {
  const truncated = truncateDeliveryAddress(address);

  let value = serializeShippingAddress(truncated);
  if (value.length <= STRIPE_METADATA_VALUE_MAX_LENGTH) return value;

  const { line2: _line2, ...withoutLine2 } = truncated;
  value = serializeShippingAddress(withoutLine2);
  if (value.length <= STRIPE_METADATA_VALUE_MAX_LENGTH) return value;

  // Removing one raw char shrinks the serialized form by 1–2 chars, so cutting `overflow` always makes progress.
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

/** json goes to Stripe metadata; value is parsed back from that exact string so the shipment label mirrors what was stored even after truncation. */
export function shippingAddressMetadata(
  address: ValidatedDeliveryAddress
): ShippingAddressMetadata {
  const json = shippingAddressMetadataValue(address);
  return { json, value: JSON.parse(json) as ValidatedDeliveryAddress };
}
