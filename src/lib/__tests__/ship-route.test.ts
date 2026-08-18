import { test, expect, describe, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { orderEmailMocks, resetOrderEmailMocks } from './order-emails-mocks';

// NOTE: the `stripe` and `resend` mocks live in `./order-emails-mocks`,
// registered exactly once per process (bun's `mock.module` registry is
// process-global and shared across test files).
//
// `@/lib/admin-auth` is deliberately NOT mocked: the real `verifySessionToken`
// is exercised with a real HS256 JWT signed against the test secret, matching
// how admin-auth.test.ts uses the module. Mocking it from this file previously
// replaced the module process-wide and broke admin-auth.test.ts's static
// import of `buildAuthorizeUrl`.

const { POST } = await import('@/app/api/admin/orders/[sessionId]/ship/route');

const ADMIN_SESSION_SECRET = 'a-very-long-admin-session-secret-for-hs256-signing';

let adminCookie = '';

describe('POST /api/admin/orders/[sessionId]/ship', () => {
  beforeEach(async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.RESEND_API_KEY = 're_test_mock';
    process.env.ADMIN_SESSION_SECRET = ADMIN_SESSION_SECRET;
    resetOrderEmailMocks();
    adminCookie = `admin_session=${await new SignJWT({ sub: 'admin-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(ADMIN_SESSION_SECRET))}`;
  });

  function shipRequest(): NextRequest {
    return new NextRequest('http://localhost/api/admin/orders/cs_test_123/ship', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookie,
      },
      body: JSON.stringify({ estimatedShippingTime: '2-4 business days' }),
    });
  }

  test('returns 200 without sending a duplicate email when already shipped', async () => {
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: {
        shipped_at: '2026-01-01T00:00:00Z',
        shipping_estimate: '2-4 business days',
      },
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };

    const response = await POST(shipRequest(), {
      params: Promise.resolve({ sessionId: 'cs_test_123' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

  test('sends the shipped email and stamps metadata when not yet shipped', async () => {
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: { confirmation_email_sent_at: '2026-01-01T00:00:00Z' },
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };

    const response = await POST(shipRequest(), {
      params: Promise.resolve({ sessionId: 'cs_test_123' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateCalls[0].sessionId).toBe('cs_test_123');
    expect(orderEmailMocks.stripeUpdateCalls[0].params.metadata).toEqual(
      expect.objectContaining({
        // Pre-existing keys (the webhook's confirmation stamps) must survive
        // the update — `sessions.update` replaces the whole metadata map.
        confirmation_email_sent_at: '2026-01-01T00:00:00Z',
        shipped_at: expect.any(String),
        shipping_estimate: '2-4 business days',
      })
    );
  });
});
