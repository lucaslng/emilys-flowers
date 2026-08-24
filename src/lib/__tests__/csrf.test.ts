import { test, expect, describe } from 'bun:test';
import { isSameOriginRequest } from '@/lib/csrf';

function requestWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/admin/logout', {
    method: 'POST',
    headers,
  });
}

describe('isSameOriginRequest', () => {
  test('accepts a matching Origin header', () => {
    expect(
      isSameOriginRequest(requestWith({ origin: 'http://localhost' }))
    ).toBe(true);
  });

  test('rejects a mismatched Origin header', () => {
    expect(
      isSameOriginRequest(requestWith({ origin: 'https://evil.example' }))
    ).toBe(false);
  });

  test('falls back to a matching Referer when Origin is absent', () => {
    expect(
      isSameOriginRequest(
        requestWith({ referer: 'http://localhost/admin/orders' })
      )
    ).toBe(true);
  });

  test('rejects a mismatched Referer when Origin is absent', () => {
    expect(
      isSameOriginRequest(
        requestWith({ referer: 'https://evil.example/admin/orders' })
      )
    ).toBe(false);
  });

  test('rejects a malformed Origin header', () => {
    expect(isSameOriginRequest(requestWith({ origin: 'not-a-url' }))).toBe(
      false
    );
  });

  test('accepts requests with neither Origin nor Referer', () => {
    expect(isSameOriginRequest(requestWith({}))).toBe(true);
  });
});
