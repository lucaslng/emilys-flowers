import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { isBaseUrlConfigured, resolveBaseOrigin } from '@/lib/base-url';

describe('resolveBaseOrigin', () => {
  // `NODE_ENV` is declared read-only on ProcessEnv; cast to mutate it.
  const env = process.env as Record<string, string | undefined>;
  let savedBaseUrl: string | undefined;
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedBaseUrl = env.BASE_URL;
    savedNodeEnv = env.NODE_ENV;
    delete env.BASE_URL;
  });

  afterEach(() => {
    if (savedBaseUrl === undefined) delete env.BASE_URL;
    else env.BASE_URL = savedBaseUrl;
    if (savedNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = savedNodeEnv;
  });

  test('prefers BASE_URL over the request origin', () => {
    env.BASE_URL = 'https://emilysflowers.ca';
    expect(resolveBaseOrigin('http://evil.example.com/api/checkout')).toBe(
      'https://emilysflowers.ca'
    );
  });

  test('falls back to the request origin when BASE_URL is unset (dev)', () => {
    expect(resolveBaseOrigin('http://localhost:3000/api/checkout')).toBe(
      'http://localhost:3000'
    );
  });

  test('trims trailing slashes from BASE_URL', () => {
    env.BASE_URL = 'https://example.com/';
    expect(resolveBaseOrigin('http://localhost:3000/x')).toBe(
      'https://example.com'
    );
  });
});

describe('isBaseUrlConfigured', () => {
  const env = process.env as Record<string, string | undefined>;
  let savedBaseUrl: string | undefined;
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedBaseUrl = env.BASE_URL;
    savedNodeEnv = env.NODE_ENV;
    delete env.BASE_URL;
  });

  afterEach(() => {
    if (savedBaseUrl === undefined) delete env.BASE_URL;
    else env.BASE_URL = savedBaseUrl;
    if (savedNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = savedNodeEnv;
  });

  test('fails closed in production without BASE_URL', () => {
    env.NODE_ENV = 'production';
    expect(isBaseUrlConfigured()).toBe(false);
  });

  test('passes in production with BASE_URL set', () => {
    env.NODE_ENV = 'production';
    env.BASE_URL = 'https://emilysflowers.ca';
    expect(isBaseUrlConfigured()).toBe(true);
  });

  test('passes without BASE_URL outside production (dev/test fallback)', () => {
    env.NODE_ENV = 'development';
    expect(isBaseUrlConfigured()).toBe(true);
  });
});
