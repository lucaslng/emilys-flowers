'use client';

import { useMemo, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import StarMotif from '@/components/ui/StarMotif';
import {
  ADDRESS_FIELD_MAX_LENGTHS,
  CA_PROVINCES,
  normalizeCAPostalCode,
  validateDeliveryAddressFields,
  type AddressFieldError,
  type AddressFieldName,
  type CaProvince,
} from '@/lib/address-validation';

/**
 * CheckoutPageClient — "the wrapping desk". The order summary reads like a
 * store receipt (stitched edges, dashed seams) and the payment button is a
 * big stamp. The delivery address is collected once, here; the shipping rate
 * is calculated server-side and shown in Stripe at payment.
 *
 * Field validation is shared with the server (`src/lib/address-validation.ts`)
 * so customers see the exact rule the API enforces — including Canadian
 * postal-code format — before anything leaves the browser.
 */

/** Delivery address the checkout route uses to calculate shipping. */
interface DeliveryAddress {
  name: string;
  line1: string;
  /** Apt, suite, unit — optional. */
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
}

type RequiredAddressField = Exclude<AddressFieldName, 'line2'>;
type AddressField = keyof DeliveryAddress;

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

/** DOM element id per validated field — used to move focus to first error. */
const FIELD_ELEMENT_IDS: Record<AddressFieldName, string> = {
  name: 'address-name',
  line1: 'address-line1',
  line2: 'address-line2',
  city: 'address-city',
  province: 'address-province',
  postalCode: 'address-postal-code',
};

const EMPTY_ADDRESS: DeliveryAddress = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  province: '',
  postalCode: '',
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

/**
 * Defensively extract structured field errors from a non-OK checkout
 * response. The body is `{ error, fieldErrors? }` — `fieldErrors` may be
 * absent or malformed, so every entry is verified before use.
 */
function parseServerFieldErrors(data: unknown): AddressFieldError[] {
  if (typeof data !== 'object' || data === null || !('fieldErrors' in data)) {
    return [];
  }
  const raw = (data as { fieldErrors?: unknown }).fieldErrors;
  if (!Array.isArray(raw)) return [];
  const KNOWN_FIELDS = new Set<string>(Object.keys(FIELD_ELEMENT_IDS));
  return raw.flatMap((entry): AddressFieldError[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const field = (entry as { field?: unknown }).field;
    const message = (entry as { message?: unknown }).message;
    if (
      typeof field !== 'string' ||
      !KNOWN_FIELDS.has(field) ||
      typeof message !== 'string' ||
      message.trim() === ''
    ) {
      return [];
    }
    return [{ field: field as AddressFieldName, message }];
  });
}

/** Read `{ error }` off an untrusted response body, defensively. */
function parseErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim() !== '') return error;
  }
  return fallback;
}

export default function CheckoutPageClient() {
  const { items, getTotal, getItemCount } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [address, setAddress] = useState<DeliveryAddress>(EMPTY_ADDRESS);
  const [touched, setTouched] = useState<Record<RequiredAddressField, boolean>>(UNTOUCHED);
  /** Messages returned by the server, keyed by field. Wins over local ones until edited. */
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<AddressFieldName, string>>
  >({});

  const subtotal = getTotal();

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

  const updateField = (field: AddressField, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    // Editing a field dismisses any server complaint about it.
    setServerFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const markTouched = (field: RequiredAddressField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  /** Reveal every invalid field and move focus to the first one. */
  const revealAllErrors = (errors: AddressFieldError[]) => {
    setTouched(ALL_TOUCHED);
    const firstInvalid = errors[0]?.field;
    if (firstInvalid) {
      document.getElementById(FIELD_ELEMENT_IDS[firstInvalid])?.focus();
    }
  };

  const handleCheckout = async () => {
    if (loading) return;

    // Always give visible feedback for invalid input at submit attempt —
    // whether the button was clicked or the form submitted with Enter.
    if (invalidFields.length > 0) {
      setError('');
      setServerFieldErrors({});
      revealAllErrors(invalidFields);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only product references and quantities leave the browser — the
          // server resolves names/prices from the Stripe catalog, so a
          // tampered request can't buy any product at a chosen price.
          items: items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          address: {
            name: address.name.trim(),
            line1: address.line1.trim(),
            line2: (address.line2 ?? '').trim(),
            city: address.city.trim(),
            province: address.province.trim(),
            postalCode: normalizeCAPostalCode(address.postalCode),
          },
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const serverErrors = parseServerFieldErrors(data);
        if (serverErrors.length > 0) {
          // Map each server complaint onto its field; `line2` has no inline
          // slot, so surface its messages in the banner instead.
          const byField: Partial<Record<AddressFieldName, string>> = {};
          const bannerExtras: string[] = [];
          for (const { field, message } of serverErrors) {
            if (field === 'line2') {
              bannerExtras.push(message);
            } else {
              byField[field] = message;
            }
          }
          setTouched(ALL_TOUCHED);
          setServerFieldErrors(byField);
          setError(
            bannerExtras.length > 0
              ? `Please check the highlighted delivery address fields. ${bannerExtras.join(' ')}`
              : 'Please check the highlighted delivery address fields.'
          );
          setLoading(false);
          return;
        }
        throw new Error(parseErrorMessage(data, 'Failed to create checkout session'));
      }

      if (
        typeof data === 'object' &&
        data !== null &&
        'url' in data &&
        typeof (data as { url?: unknown }).url === 'string'
      ) {
        // Navigation is async — loading stays true through this window so a
        // second click can't fire a duplicate POST (a second real Stripe
        // session / ChitChats shipment).
        window.location.href = (data as { url: string }).url;
        return;
      }

      setError('Could not start checkout. Please try again.');
      setLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-12 sm:py-16">
        <Container>
          <div className="stitch relative flex min-h-[400px] flex-col items-center justify-center bg-surface px-6 text-center">
            <StarMotif size={48} className="text-rose opacity-80" />
            <h1 className="mt-6 font-sans text-2xl font-bold uppercase tracking-[0.1em] text-foreground">
              Your cart is empty
            </h1>
            <p className="mt-2 font-sans text-sm text-muted">
              Nothing to wrap yet — add some blooms and come back.
            </p>
            <Link href="/bouquets" className="mt-6">
              <Button variant="primary">Shop Bouquets</Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden py-12 sm:py-16">
      {/* Warm wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 80% 10%, rgba(243, 228, 211, 0.55), rgba(243, 228, 211, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <StarMotif size={44} className="mx-auto text-rose opacity-80" />
            <h1 className="mt-4 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
              Checkout
            </h1>
            {/* Hand-drawn arrow annotation */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <svg aria-hidden="true" width="64" height="20" viewBox="0 0 64 20" fill="none" className="line-boil text-rose-line">
                <path d="M2 16 C 20 12 38 6 60 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                <path d="M60 3 L 51 2 M 60 3 L 56 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              </svg>
              <span className="font-hand text-3xl leading-none text-rose-deep">
                almost wrapped ♡
              </span>
            </div>
          </div>

          <form noValidate onSubmit={(event) => { event.preventDefault(); handleCheckout(); }}>
            {/* Delivery address — where the blooms go */}
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
                  onChange={(value) => updateField('name', value)}
                  onBlur={() => markTouched('name')}
                />
                <TextField
                  id="address-line1"
                  label="Street address"
                  value={address.line1}
                  autoComplete="address-line1"
                  maxLength={ADDRESS_FIELD_MAX_LENGTHS.line1}
                  error={fieldError('line1')}
                  onChange={(value) => updateField('line1', value)}
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
                  onChange={(value) => updateField('line2', value)}
                />
                <TextField
                  id="address-city"
                  label="City"
                  value={address.city}
                  autoComplete="address-level2"
                  maxLength={ADDRESS_FIELD_MAX_LENGTHS.city}
                  error={fieldError('city')}
                  onChange={(value) => updateField('city', value)}
                  onBlur={() => markTouched('city')}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="address-province"
                      className="mb-1 block font-sans text-xs font-medium uppercase tracking-[0.1em] text-foreground"
                    >
                      Province
                    </label>
                    <select
                      id="address-province"
                      name="province"
                      autoComplete="address-level1"
                      required
                      value={address.province}
                      onChange={(event) => updateField('province', event.target.value)}
                      onBlur={() => markTouched('province')}
                      aria-invalid={Boolean(fieldError('province'))}
                      aria-describedby={
                        fieldError('province') ? 'address-province-error' : undefined
                      }
                      className={`w-full rounded-none border bg-background px-3 py-2 font-sans text-sm text-foreground transition-colors focus:border-rose-line ${
                        fieldError('province') ? 'border-[#9C4A2F]' : 'border-border'
                      }`}
                    >
                      <option value="">Select province</option>
                      {CA_PROVINCES.map((code) => (
                        <option key={code} value={code}>
                          {PROVINCE_LABELS[code]} ({code})
                        </option>
                      ))}
                    </select>
                    {fieldError('province') && (
                      <p id="address-province-error" className="mt-1 font-sans text-xs text-[#9C4A2F]">
                        {fieldError('province')}
                      </p>
                    )}
                  </div>
                  <TextField
                    id="address-postal-code"
                    label="Postal code"
                    value={address.postalCode}
                    autoComplete="postal-code"
                    maxLength={ADDRESS_FIELD_MAX_LENGTHS.postalCode}
                    error={fieldError('postalCode')}
                    onChange={(value) => updateField('postalCode', value)}
                    onBlur={() => markTouched('postalCode')}
                  />
                </div>
              </div>
            </div>

            {/* Order Summary — the receipt */}
            <div className="stitch relative mt-6 bg-background p-6 sm:p-8">
              <h2 className="font-sans text-lg font-bold uppercase tracking-[0.14em] text-foreground">
                Order Summary
              </h2>
              <div className="gift-divider mt-4" />

              <div className="mt-4 divide-y divide-dashed divide-rose-line/30">
                {items.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex-1">
                      <p className="font-sans text-sm font-medium uppercase tracking-[0.06em] text-foreground">
                        {item.product.name}
                      </p>
                      <p className="font-sans text-xs text-muted">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <span className="font-sans text-sm font-medium tabular-nums text-foreground">
                      ${formatPrice(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 border-t border-dashed border-rose-line/40 pt-4">
                <div className="flex justify-between font-sans text-sm text-foreground">
                  <span>
                    Subtotal ({getItemCount()} item
                    {getItemCount() !== 1 ? 's' : ''})
                  </span>
                  <span className="tabular-nums">${formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between font-sans text-sm text-foreground">
                  <span>Shipping</span>
                  <span className="text-right text-sm text-muted">
                    Calculated at checkout
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-rose-line/40 pt-2 font-sans text-lg font-bold uppercase tracking-[0.1em] text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums">${formatPrice(subtotal)}</span>
                </div>
              </div>
            </div>

            {/* Payment Button — the stamp */}
            <div className="mt-8">
              {error && (
                <div
                  role="alert"
                  className="mb-4 border border-[#E8C4B4] bg-[#FDF0EA] p-4 font-sans text-sm text-[#9C4A2F]"
                >
                  {error}
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Pay with Stripe'
                )}
              </Button>
              <p className="mt-3 text-center font-sans text-xs text-muted">
                Shipping is calculated from your delivery address and shown at
                payment.
              </p>
              <p className="mt-1 text-center font-sans text-xs text-muted">
                You will be redirected to Stripe&apos;s secure checkout to
                complete your payment.
              </p>
            </div>
          </form>
        </div>
      </Container>
    </div>
  );
}
