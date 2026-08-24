'use client';

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ADDRESS_FIELD_MAX_LENGTHS,
  CA_PROVINCES,
  validateDeliveryAddressFields,
  type AddressFieldError,
  type AddressFieldName,
  type CaProvince,
} from '@/lib/address-validation';

/** Delivery address the checkout route uses to calculate shipping. */
export interface DeliveryAddress {
  name: string;
  line1: string;
  /** Apt, suite, unit — optional. */
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
}

export type AddressField = keyof DeliveryAddress;

type RequiredAddressField = Exclude<AddressFieldName, 'line2'>;

/** DOM element id per validated field — used to move focus to first error. */
export const FIELD_ELEMENT_IDS: Record<AddressFieldName, string> = {
  name: 'address-name',
  line1: 'address-line1',
  line2: 'address-line2',
  city: 'address-city',
  province: 'address-province',
  postalCode: 'address-postal-code',
};

/** Friendly names for the two-letter province codes the API expects. */
const PROVINCE_LABELS: Record<CaProvince, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

const ALL_TOUCHED: Record<RequiredAddressField, boolean> = {
  name: true,
  line1: true,
  city: true,
  province: true,
  postalCode: true,
};

const UNTOUCHED: Record<RequiredAddressField, boolean> = {
  name: false,
  line1: false,
  city: false,
  province: false,
  postalCode: false,
};

/** A single address text field with light inline validation. */
function TextField({
  id,
  label,
  value,
  autoComplete,
  error,
  onChange,
  onBlur,
  required = true,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete?: string;
  /** Specific message shown inline when present (undefined = valid). */
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  maxLength?: number;
}) {
  const invalid = Boolean(error);
  const errorId = `${id}-error`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block font-sans text-xs font-medium uppercase tracking-[0.1em] text-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        autoComplete={autoComplete}
        required={required}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        className={`w-full rounded-none border bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted/70 transition-colors focus:border-rose-line ${
          invalid ? 'border-[#9C4A2F]' : 'border-border'
        }`}
      />
      {invalid && (
        <p id={errorId} className="mt-1 font-sans text-xs text-[#9C4A2F]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Select counterpart of TextField, sharing its label/aria/error markup. */
export function SelectField({
  id,
  name,
  label,
  value,
  autoComplete,
  error,
  onChange,
  onBlur,
  required = true,
  children,
}: {
  id: string;
  /** Form field name when it differs from the DOM id (the province posts as `province`). */
  name?: string;
  label: string;
  value: string;
  autoComplete?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  children: ReactNode;
}) {
  const invalid = Boolean(error);
  const errorId = `${id}-error`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block font-sans text-xs font-medium uppercase tracking-[0.1em] text-foreground"
      >
        {label}
      </label>
      <select
        id={id}
        name={name ?? id}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        className={`w-full rounded-none border bg-background px-3 py-2 font-sans text-sm text-foreground transition-colors focus:border-rose-line ${
          invalid ? 'border-[#9C4A2F]' : 'border-border'
        }`}
      >
        {children}
      </select>
      {invalid && (
        <p id={errorId} className="mt-1 font-sans text-xs text-[#9C4A2F]">
          {error}
        </p>
      )}
    </div>
  );
}

export interface AddressFormPanelHandle {
  /**
   * Marks every field touched so invalid ones show their messages, and
   * focuses the first of `errors` when given (the local submit path; the
   * server-error path reveals without moving focus).
   */
  revealAllErrors(errors?: AddressFieldError[]): void;
}

interface AddressFormPanelProps {
  address: DeliveryAddress;
  onFieldChange: (field: AddressField, value: string) => void;
  /** Messages returned by the server, keyed by field; wins over local rules until edited. */
  serverFieldErrors: Partial<Record<AddressFieldName, string>>;
}

/**
 * AddressFormPanel — "where the blooms go". Owns the touched-field state and
 * inline error display for the delivery address; the parent keeps ownership
 * of the address value, server feedback, and submit-time validation wiring.
 */
const AddressFormPanel = forwardRef<AddressFormPanelHandle, AddressFormPanelProps>(
  function AddressFormPanel({ address, onFieldChange, serverFieldErrors }, ref) {
    const [touched, setTouched] = useState<Record<RequiredAddressField, boolean>>(UNTOUCHED);

    /** Shared validation rules (presence + province + postal format), in form order. */
    const invalidFields = useMemo(
      () => validateDeliveryAddressFields(address),
      [address]
    );

    /** The same rules keyed by field for quick inline lookup. */
    const validationErrors = useMemo(() => {
      const byField: Partial<Record<AddressFieldName, string>> = {};
      for (const { field, message } of invalidFields) {
        byField[field] = message;
      }
      return byField;
    }, [invalidFields]);

    /**
     * The message to show for a field, if any: server feedback wins until the
     * customer edits that field; otherwise show the shared rule once touched.
     */
    const fieldError = (field: AddressFieldName): string | undefined => {
      const serverMessage = serverFieldErrors[field];
      if (serverMessage) return serverMessage;
      if (field === 'line2') return undefined;
      return touched[field] ? validationErrors[field] : undefined;
    };

    const markTouched = (field: RequiredAddressField) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
    };

    useImperativeHandle(
      ref,
      () => ({
        revealAllErrors(errors) {
          setTouched(ALL_TOUCHED);
          const firstInvalid = errors?.[0]?.field;
          if (firstInvalid) {
            document.getElementById(FIELD_ELEMENT_IDS[firstInvalid])?.focus();
          }
        },
      }),
      []
    );

    return (
      <div className="stitch relative bg-background p-6 sm:p-8">
        <h2 className="font-sans text-lg font-bold uppercase tracking-[0.14em] text-foreground">
          Delivery address
        </h2>
        <div className="gift-divider mt-4" />

        <div className="mt-4 space-y-4">
          <TextField
            id="address-name"
            label="Full name"
            value={address.name}
            autoComplete="name"
            maxLength={ADDRESS_FIELD_MAX_LENGTHS.name}
            error={fieldError('name')}
            onChange={(value) => onFieldChange('name', value)}
            onBlur={() => markTouched('name')}
          />
          <TextField
            id="address-line1"
            label="Street address"
            value={address.line1}
            autoComplete="address-line1"
            maxLength={ADDRESS_FIELD_MAX_LENGTHS.line1}
            error={fieldError('line1')}
            onChange={(value) => onFieldChange('line1', value)}
            onBlur={() => markTouched('line1')}
          />
          <TextField
            id="address-line2"
            label="Apt, suite, unit (optional)"
            value={address.line2 ?? ''}
            autoComplete="address-line2"
            maxLength={ADDRESS_FIELD_MAX_LENGTHS.line2}
            error={fieldError('line2')}
            required={false}
            onChange={(value) => onFieldChange('line2', value)}
          />
          <TextField
            id="address-city"
            label="City"
            value={address.city}
            autoComplete="address-level2"
            maxLength={ADDRESS_FIELD_MAX_LENGTHS.city}
            error={fieldError('city')}
            onChange={(value) => onFieldChange('city', value)}
            onBlur={() => markTouched('city')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="address-province"
              name="province"
              label="Province"
              value={address.province}
              autoComplete="address-level1"
              error={fieldError('province')}
              onChange={(value) => onFieldChange('province', value)}
              onBlur={() => markTouched('province')}
            >
              <option value="">Select province</option>
              {CA_PROVINCES.map((code) => (
                <option key={code} value={code}>
                  {PROVINCE_LABELS[code]} ({code})
                </option>
              ))}
            </SelectField>
            <TextField
              id="address-postal-code"
              label="Postal code"
              value={address.postalCode}
              autoComplete="postal-code"
              maxLength={ADDRESS_FIELD_MAX_LENGTHS.postalCode}
              error={fieldError('postalCode')}
              onChange={(value) => onFieldChange('postalCode', value)}
              onBlur={() => markTouched('postalCode')}
            />
          </div>
        </div>
      </div>
    );
  }
);

export default AddressFormPanel;
