// src/app/admin/orders/page.tsx
//
// OIDC-gated admin page: reviews recent paid Stripe checkout sessions and
// lets the shop owner confirm shipment (which emails the customer). Reads the
// `admin_session` JWT cookie; unauthenticated visitors get an OIDC sign-in
// control, and missing OIDC env vars render a config error.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { formatPrice } from '@/lib/format';
import { isOidcConfigured, verifySessionToken } from '@/lib/admin-auth';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import ShipForm from './ship-form';

export const metadata: Metadata = {
  robots: { index: false },
};

// Reads cookies and fetches Stripe at request time — never prerender.
export const dynamic = 'force-dynamic';

// `shipping_details` is returned by the Stripe API on Checkout Sessions but is
// absent from stripe-node v22's Checkout.Session type — same workaround as the
// webhook route (src/app/api/webhooks/stripe/route.ts).
type SessionWithShippingDetails = Stripe.Checkout.Session & {
  shipping_details?: { name: string; address: Stripe.Address } | null;
};

function formatDate(created: number): string {
  return new Date(created * 1000).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAddress(address: Stripe.Address | null | undefined): string {
  if (!address) return '';
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}

const REQUIRED_ENV_VARS = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_CLIENT_SECRET',
  'ADMIN_SESSION_SECRET',
  'ADMIN_OIDC_GROUPS',
  'BASE_URL',
];

function ConfigErrorCard({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-md">
          <h1 className="font-sans text-2xl font-bold uppercase tracking-[0.1em] text-foreground">
            Admin — Orders
          </h1>
          <div
            role="alert"
            className="mt-6 border border-[#E8C4B4] bg-[#FDF0EA] p-4 font-sans text-sm text-[#9C4A2F]"
          >
            <p className="font-semibold">{title}</p>
            <p className="mt-1">{description}</p>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isOidcConfigured()) {
    return (
      <ConfigErrorCard
        title="Admin page not configured"
        description={
          <>
            Set the OIDC environment variables on the server to enable order
            review and shipping notifications:{' '}
            <code className="font-sans">{REQUIRED_ENV_VARS.join(', ')}</code>
          </>
        }
      />
    );
  }

  const session = await verifySessionToken(
    (await cookies()).get('admin_session')?.value
  );

  if (!session) {
    const params = await searchParams;
    const error = params.error;
    return (
      <div className="py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-md">
            <h1 className="font-sans text-2xl font-bold uppercase tracking-[0.1em] text-foreground">
              Admin — Orders
            </h1>
            <p className="mt-2 font-sans text-sm text-muted">
              Sign in to review orders and send shipping notifications.
            </p>
            {(error === 'forbidden' || error === 'signin') && (
              <div
                role="alert"
                className="mt-6 border border-[#E8C4B4] bg-[#FDF0EA] p-4 font-sans text-sm text-[#9C4A2F]"
              >
                {error === 'forbidden'
                  ? "Your account isn't in an allowed admin group."
                  : 'Sign-in failed. Please try again.'}
              </div>
            )}
            <div className="gift-card mt-6 p-6">
              <Button as="a" href="/api/admin/login">
                Sign in with OIDC
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return (
      <ConfigErrorCard
        title="Stripe not configured"
        description={
          <>
            Set the <code className="font-sans">STRIPE_SECRET_KEY</code>{' '}
            environment variable on the server to list orders.
          </>
        }
      />
    );
  }

  const stripe = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const { data } = await stripe.checkout.sessions.list({
    limit: 25,
    expand: ['data.line_items'],
  });

  const orders = data
    .filter((session) => session.payment_status === 'paid')
    .sort((a, b) => b.created - a.created);

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="font-sans text-2xl font-bold uppercase tracking-[0.1em] text-foreground">
            Orders
          </h1>
          <div className="mt-2 flex items-center justify-between gap-4">
            <p className="font-sans text-sm text-muted">
              Recent paid orders — confirm shipment to notify the customer.
            </p>
            <a
              href="/api/admin/logout"
              className="shrink-0 font-sans text-xs text-muted underline"
            >
              Sign out
            </a>
          </div>

          {orders.length === 0 ? (
            <p className="mt-8 font-sans text-sm text-muted">
              No paid orders yet.
            </p>
          ) : (
            <ul className="mt-8 space-y-6">
              {orders.map((order) => {
                const sessionWithShipping = order as SessionWithShippingDetails;
                const shippedAt = order.metadata?.shipped_at;
                const shippingEstimate = order.metadata?.shipping_estimate;
                return (
                  <li key={order.id} className="gift-card p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-foreground">
                          Order {order.metadata?.order_number ?? order.id}
                        </h2>
                        <p className="mt-1 font-sans text-xs text-muted">
                          {formatDate(order.created)}
                        </p>
                      </div>
                      {shippedAt && (
                        <span className="inline-flex items-center gap-1 border border-rose-line bg-blush px-2 py-1 font-sans text-xs font-medium uppercase tracking-[0.08em] text-rose-deep">
                          Shipped
                          {shippingEstimate ? ` — ${shippingEstimate}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="gift-divider mt-4" />

                    <div className="mt-4">
                      <p className="font-sans text-sm font-medium text-foreground">
                        {order.customer_details?.name ?? 'Customer'}
                      </p>
                      <p className="font-sans text-xs text-muted">
                        {order.customer_details?.email ?? 'No email on file'}
                      </p>
                    </div>

                    <ul className="mt-4 divide-y divide-dashed divide-rose-line/30">
                      {order.line_items?.data.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-4 py-2"
                        >
                          <span className="font-sans text-sm text-foreground">
                            {item.description ?? 'Item'}
                            <span className="text-muted">
                              {' '}
                              × {item.quantity ?? 1}
                            </span>
                          </span>
                          <span className="font-sans text-sm tabular-nums text-foreground">
                            ${formatPrice(item.amount_total ?? 0)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex items-center justify-between border-t border-dashed border-rose-line/40 pt-3">
                      <span className="font-sans text-sm font-bold uppercase tracking-[0.1em] text-foreground">
                        Total
                      </span>
                      <span className="font-sans text-sm font-bold tabular-nums text-foreground">
                        ${formatPrice(order.amount_total ?? 0)}
                      </span>
                    </div>

                    {sessionWithShipping.shipping_details?.address && (
                      <p className="mt-3 font-sans text-xs text-muted">
                        Ship to:{' '}
                        {formatAddress(
                          sessionWithShipping.shipping_details.address,
                        )}
                      </p>
                    )}

                    <div className="mt-5">
                      {shippedAt ? (
                        <p className="font-sans text-xs text-muted">
                          Confirmed shipped on{' '}
                          {new Date(shippedAt).toLocaleDateString('en-CA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      ) : (
                        <ShipForm sessionId={order.id} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Container>
    </div>
  );
}
