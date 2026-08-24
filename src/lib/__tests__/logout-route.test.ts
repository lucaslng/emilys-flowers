import { test, expect, describe } from 'bun:test';
import { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/admin-auth';

const { POST } = await import('@/app/api/admin/logout/route');

function logoutRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/admin/logout', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/admin/logout', () => {
  test('clears the session cookie and redirects with 303', async () => {
    const response = await POST(logoutRequest({ origin: 'http://localhost' }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'http://localhost/admin/orders'
    );
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie).toMatch(/expires=thu, 01 jan 1970/i);
  });

  test('rejects a cross-origin POST with 403 without clearing the cookie', async () => {
    const response = await POST(
      logoutRequest({ origin: 'https://evil.example' })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Cross-origin request rejected.',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  test('falls back to Referer for the same-origin check', async () => {
    const response = await POST(
      logoutRequest({ referer: 'http://localhost/admin/orders' })
    );

    expect(response.status).toBe(303);
  });
});
