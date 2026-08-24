'use client';

import { useMemo, useRef, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatCAD } from '@/lib/format';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import StarMotif from '@/components/ui/StarMotif';
import ArrowFlourish from '@/components/shop/ArrowFlourish';
import PageWash from '@/components/ui/PageWash';
import OrderReceipt from '@/components/order/OrderReceipt';
import EmptyCartCard from '@/components/cart/EmptyCartCard';
import AddressFormPanel, {
  FIELD_ELEMENT_IDS,
  type AddressField,
  type AddressFormPanelHandle,
  type DeliveryAddress,
} from '@/components/checkout/AddressFormPanel';
import {
  normalizeCAPostalCode,
  validateDeliveryAddressFields,
  type AddressFieldError,
  type AddressFieldName,
} from '@/lib/address-validation';

// Field validation is shared with the server (`src/lib/address-validation.ts`)
// so customers see the exact rule the API enforces before anything leaves the
// browser.

const EMPTY_ADDRESS: DeliveryAddress = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  province: '',
  postalCode: '',
};

/**
 * Defensively extract structured field errors from a non-OK checkout
 * response; `fieldErrors` may be absent or malformed.
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
  const addressPanelRef = useRef<AddressFormPanelHandle>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [address, setAddress] = useState<DeliveryAddress>(EMPTY_ADDRESS);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<AddressFieldName, string>>
  >({});
  const [agreed, setAgreed] = useState(false);
  const [agreementAttempted, setAgreementAttempted] = useState(false);

  const agreementError = agreementAttempted && !agreed;

  const subtotal = getTotal();

  const invalidFields = useMemo(
    () => validateDeliveryAddressFields(address),
    [address]
  );

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

  const handleCheckout = async () => {
    if (loading) return;

    // Always give visible feedback for invalid input at submit attempt,
    // whether the button was clicked or the form submitted with Enter.
    if (invalidFields.length > 0) {
      setError('');
      setServerFieldErrors({});
      if (!agreed) setAgreementAttempted(true);
      addressPanelRef.current?.revealAllErrors(invalidFields);
      return;
    }

    if (!agreed) {
      setError('');
      setServerFieldErrors({});
      setAgreementAttempted(true);
      document.getElementById('terms-agreement')?.focus();
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
          // server resolves names/prices from the Stripe catalog.
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
          // `line2` has no inline slot — surface its messages in the banner.
          const byField: Partial<Record<AddressFieldName, string>> = {};
          const bannerExtras: string[] = [];
          for (const { field, message } of serverErrors) {
            if (field === 'line2') {
              bannerExtras.push(message);
            } else {
              byField[field] = message;
            }
          }
          addressPanelRef.current?.revealAllErrors();
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
        // Navigation is async — loading stays true so a second click can't
        // fire a duplicate POST (a second real Stripe session / shipment).
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
          <EmptyCartCard
            className="min-h-[400px]"
            headingLevel="h1"
            motif={<StarMotif size={48} className="text-rose opacity-80" />}
            titleClassName="mt-6 font-sans text-2xl font-bold uppercase tracking-[0.1em] text-foreground"
            message="Nothing to wrap yet — add some blooms and come back."
            messageClassName="mt-2 font-sans text-sm text-muted"
            ctaHref="/bouquets"
            ctaLabel="Shop Bouquets"
            ctaClassName="mt-6"
          />
        </Container>
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden py-12 sm:py-16">
      <PageWash background="radial-gradient(ellipse 50% 40% at 80% 10%, rgba(243, 228, 211, 0.55), rgba(243, 228, 211, 0) 70%)" />

      <Container className="relative z-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <StarMotif size={44} className="mx-auto text-rose opacity-80" />
            <h1 className="mt-4 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
              Checkout
            </h1>
            <div className="mt-2 flex items-center justify-center gap-2">
              <ArrowFlourish />
              <span className="font-hand text-3xl leading-none text-rose-deep">
                almost wrapped ♡
              </span>
            </div>
          </div>

          <form noValidate onSubmit={(event) => { event.preventDefault(); handleCheckout(); }}>
            <AddressFormPanel
              ref={addressPanelRef}
              address={address}
              onFieldChange={updateField}
              serverFieldErrors={serverFieldErrors}
            />

            {/* Order summary — the receipt */}
            <div className="stitch relative mt-6 bg-background p-6 sm:p-8">
              <OrderReceipt
                totalsClassName="mt-4 space-y-2 border-t border-dashed border-rose-line/40 pt-4"
                subtotalLabel={
                  <>
                    Subtotal ({getItemCount()} item
                    {getItemCount() !== 1 ? 's' : ''})
                  </>
                }
                subtotal={subtotal}
                total={subtotal}
              >
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
                        {formatCAD(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </OrderReceipt>
            </div>

            <div className="mt-8">
              <div className="flex items-start gap-2">
                <input
                  id="terms-agreement"
                  name="terms-agreement"
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => {
                    setAgreed(event.target.checked);
                    if (event.target.checked) setAgreementAttempted(false);
                  }}
                  aria-invalid={agreementError}
                  aria-describedby={agreementError ? 'terms-agreement-error' : undefined}
                  className={`checkbox-check h-6 w-6 shrink-0 cursor-pointer appearance-none rounded-none border bg-background transition-colors focus:border-rose-line ${
                    agreementError ? 'border-[#9C4A2F]' : 'border-border'
                  }`}
                />
                <label
                  htmlFor="terms-agreement"
                  className="font-sans text-sm text-foreground"
                >
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-deep underline decoration-rose-line underline-offset-4 transition-colors hover:text-foreground"
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-deep underline decoration-rose-line underline-offset-4 transition-colors hover:text-foreground"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {agreementError && (
                <p id="terms-agreement-error" className="mt-1 font-sans text-xs text-[#9C4A2F]">
                  Please agree to the Terms of Service and Privacy Policy before paying.
                </p>
              )}
              {error && (
                <div role="alert" className="alert-warm mb-4">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                className="mt-6"
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
