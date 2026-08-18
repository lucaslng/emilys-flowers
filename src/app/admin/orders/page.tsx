// src/app/admin/orders/page.tsx
//
// Password-gated admin page: reviews recent paid Stripe checkout sessions
// and lets the shop owner confirm shipment (which emails the customer).
// Reads the `admin_session` cookie; unauthenticated visitors get a minimal
// login form, and a missing ADMIN_PASSWORD env var renders a config error.

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import Stripe from 'stripe';
import { formatPrice } from '@/lib/format';
import Container from '@/components/ui/Container';
import AdminLogin from './admin-login';
import ShipForm from './ship-form';

export const metadata: Metadata = {
  robots: { index: false },
};

// Reads cookies and fetches Stripe at request time — never prerender.
export const dynamic = 'force-dynamic';

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

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

export default async function AdminOrdersPage() {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
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
              <p className="font-semibold">Admin page not configured</p>
              <p className="mt-1">
                Set the <code className="font-sans">ADMIN_PASSWORD</code>{' '}
                environment variable on the server to enable order review and
                shipping notifications.
              </p>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session')?.value;
  const expectedToken = hash(adminPassword);

  if (!sessionCookie || sessionCookie !== expectedToken) {
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
            <div className="gift-card mt-6 p-6">
              <AdminLogin />
            </div>
          </div>
        </Container>
      </div>
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
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
              <p className="font-semibold">Stripe not configured</p>
              <p className="mt-1">
                Set the <code className="font-sans">STRIPE_SECRET_KEY</code>{' '}
                environment variable on the server to list orders.
              </p>
            </div>
          </div>
        </Container>
      </div>
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
          <p className="mt-2 font-sans text-sm text-muted">
            Recent paid orders — confirm shipment to notify the customer.
          </p>

          {orders.length === 0 ? (
            <p className="mt-8 font-sans text-sm text-muted">
              No paid orders yet.
            </p>
          ) : (
            <ul className="mt-8 space-y-6">
              {orders.map((session) => {
                const sessionWithShipping = session as SessionWithShippingDetails;
                const shippedAt = session.metadata?.shipped_at;
                const shippingEstimate = session.metadata?.shipping_estimate;
                return (
                  <li key={session.id} className="gift-card p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-foreground">
                          Order {session.id}
                        </h2>
                        <p className="mt-1 font-sans text-xs text-muted">
                          {formatDate(session.created)}
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
                        {session.customer_details?.name ?? 'Customer'}
                      </p>
                      <p className="font-sans text-xs text-muted">
                        {session.customer_details?.email ?? 'No email on file'}
                      </p>
                    </div>

                    <ul className="mt-4 divide-y divide-dashed divide-rose-line/30">
                      {session.line_items?.data.map((item) => (
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
                        ${formatPrice(session.amount_total ?? 0)}
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
                        <ShipForm sessionId={session.id} />
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