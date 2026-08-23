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
