import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { unsetEnv } from './env-helpers';
import { getStripeClient } from '@/lib/stripe-client';

const ORIGINAL_KEY = process.env.STRIPE_SECRET_KEY;

describe('getStripeClient', () => {
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      unsetEnv("STRIPE_SECRET_KEY");
    } else {
      process.env.STRIPE_SECRET_KEY = ORIGINAL_KEY;
    }
  });

  test('returns null when STRIPE_SECRET_KEY is unset', () => {
    unsetEnv("STRIPE_SECRET_KEY");
    expect(getStripeClient()).toBeNull();
  });

  test('returns a client when STRIPE_SECRET_KEY is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_memo';
    const client = getStripeClient();
    expect(client).not.toBeNull();
  });

  test('memoizes: repeated calls with the same key return the SAME instance', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_memo';
    const first = getStripeClient();
    const second = getStripeClient();
    expect(second).toBe(first);
  });

  test('rebuilds the client when the key changes', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_first';
    const first = getStripeClient();

    process.env.STRIPE_SECRET_KEY = 'sk_test_second';
    const second = getStripeClient();

    expect(second).not.toBe(first);
    expect(getStripeClient()).toBe(second);
  });

  test('a null result is not cached — setting the key afterwards constructs', () => {
    unsetEnv("STRIPE_SECRET_KEY");
    expect(getStripeClient()).toBeNull();

    process.env.STRIPE_SECRET_KEY = 'sk_test_late';
    expect(getStripeClient()).not.toBeNull();
  });
});
