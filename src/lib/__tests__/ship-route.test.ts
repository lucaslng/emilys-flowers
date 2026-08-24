import { test, expect, describe, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { SESSION_COOKIE } from '@/lib/admin-auth';
import { orderEmailMocks, resetOrderEmailMocks } from './order-emails-mocks';

// @/lib/admin-auth is deliberately NOT mocked: the real verifySessionToken is exercised with a real HS256 JWT,
// and mocking it here would replace the module process-wide, breaking admin-auth.test.ts's static import.

const { POST } = await import('@/app/api/admin/orders/[sessionId]/ship/route');

const ADMIN_SESSION_SECRET = 'a-very-long-admin-session-secret-for-hs256-signing';

let adminCookie = '';

describe('POST /api/admin/orders/[sessionId]/ship', () => {
  beforeEach(async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.RESEND_API_KEY = 're_test_mock';
    process.env.ADMIN_SESSION_SECRET = ADMIN_SESSION_SECRET;
    // verifySessionToken re-checks ADMIN_OIDC_GROUPS per request, so the groups claim must match the allowlist.
    process.env.ADMIN_OIDC_GROUPS = 'admins';
    resetOrderEmailMocks();
    adminCookie = `${SESSION_COOKIE}=${await new SignJWT({
      sub: 'admin-1',
      groups: ['admins'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(ADMIN_SESSION_SECRET))}`;
  });

  // `cookie === null` omits the header entirely (unauthenticated request).
  function shipRequest(
    sessionId = 'cs_test_123',
    cookie: string | null = adminCookie,
    headers: Record<string, string> = {}
  ): NextRequest {
    return new NextRequest(
      `http://localhost/api/admin/orders/${sessionId}/ship`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookie !== null ? { cookie } : {}),
          ...headers,
        },
        body: JSON.stringify({ estimatedShippingTime: '2-4 business days' }),
      }
    );
  }

  test.each([
    ['empty string', ''],
    ['missing prefix', 'abc123'],
    ['wrong object type', 'seti_abc123'],
    ['pi id', 'pi_abc123'],
    ['subclassed id', 'cs_test'],
    ['trailing underscore only', 'cs_test_'],
    ['path traversal', '../../etc/passwd'],
    ['uppercase prefix', 'CS_TEST_abc123'],
  ])('rejects %s without hitting Stripe', async (_label, bad) => {
    const response = await POST(shipRequest(bad), {
      params: Promise.resolve({ sessionId: bad }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid session id.');
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

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
      metadata: {
        confirmation_email_sent_at: '2026-01-01T00:00:00Z',
        order_number: 'EF-ABC123',
      },
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };

    const response = await POST(shipRequest(), {
      params: Promise.resolve({ sessionId: 'cs_test_123' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(1);
    expect(
      (orderEmailMocks.emailSendCalls[0][0] as { subject: string }).subject
    ).toContain('#EF-ABC123');
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateCalls[0].sessionId).toBe('cs_test_123');
    expect(orderEmailMocks.stripeUpdateCalls[0].params.metadata).toEqual(
      expect.objectContaining({
        // Pre-existing keys must survive the stamp — sessions.update replaces the whole metadata map.
        confirmation_email_sent_at: '2026-01-01T00:00:00Z',
        shipped_at: expect.any(String),
        shipping_estimate: '2-4 business days',
      })
    );
  });

  test('returns 401 without hitting Stripe or email when no cookie is present', async () => {
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: {},
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };

    const response = await POST(shipRequest('cs_test_123', null), {
      params: Promise.resolve({ sessionId: 'cs_test_123' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized.' });
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

  test('returns 401 when the session groups no longer intersect ADMIN_OIDC_GROUPS', async () => {
    const revokedCookie = `${SESSION_COOKIE}=${await new SignJWT({
      sub: 'admin-1',
      groups: ['some-other-group'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(ADMIN_SESSION_SECRET))}`;
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: {},
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };

    const response = await POST(shipRequest('cs_test_123', revokedCookie), {
      params: Promise.resolve({ sessionId: 'cs_test_123' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized.' });
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

  test('rejects a cross-origin Origin header with 403 before touching Stripe or email', async () => {
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: {},
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };

    const response = await POST(
      shipRequest('cs_test_123', adminCookie, {
        origin: 'https://evil.example',
      }),
      { params: Promise.resolve({ sessionId: 'cs_test_123' }) }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Cross-origin request rejected.',
    });
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

  test('rejects a cross-origin Referer fallback with 403', async () => {
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: {},
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };

    const response = await POST(
      shipRequest('cs_test_123', adminCookie, {
        referer: 'https://evil.example/admin/orders',
      }),
      { params: Promise.resolve({ sessionId: 'cs_test_123' }) }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Cross-origin request rejected.',
    });
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

  test('accepts a matching Origin header and proceeds normally', async () => {
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: {},
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };

    const response = await POST(
      shipRequest('cs_test_123', adminCookie, { origin: 'http://localhost' }),
      { params: Promise.resolve({ sessionId: 'cs_test_123' }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(1);
  });

  test('clamps an oversized estimatedShippingTime to the 500-char metadata cap', async () => {
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: {},
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };
    const oversized = `  ${'a'.repeat(600)}  `;

    const response = await POST(
      new NextRequest(
        'http://localhost/api/admin/orders/cs_test_123/ship',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ estimatedShippingTime: oversized }),
        }
      ),
      { params: Promise.resolve({ sessionId: 'cs_test_123' }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const estimate = (
      orderEmailMocks.stripeUpdateCalls[0].params.metadata as Record<
        string,
        string
      >
    ).shipping_estimate;
    expect(estimate).toBe('a'.repeat(500));
  });

  test('returns an observable error with emailSent when the metadata update fails', async () => {
    orderEmailMocks.currentSession = {
      id: 'cs_test_123',
      object: 'checkout.session',
      metadata: {},
      customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    };
    orderEmailMocks.stripeUpdateShouldThrow = true;

    const response = await POST(shipRequest(), {
      params: Promise.resolve({ sessionId: 'cs_test_123' }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.emailSent).toBe(true);
    expect(typeof body.error).toBe('string');
    // The message must spell out the retry semantics for the owner.
    expect(body.error).toMatch(/already/i);
    expect(body.error).toMatch(/24 hours/i);
    expect(body.error).toMatch(/duplicate/i);
    expect(orderEmailMocks.emailSendCalls).toHaveLength(1);
  });
});
