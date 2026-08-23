import { test, expect, describe } from 'bun:test';

import { isValidCheckoutSessionId } from '@/lib/stripe-session-id';

describe('isValidCheckoutSessionId', () => {
  test.each(['cs_test_abc123', 'cs_live_XyZ019', 'cs_test_1'])(
    'accepts %s',
    (id) => {
      expect(isValidCheckoutSessionId(id)).toBe(true);
    }
  );

  test.each([
    ['empty string', ''],
    ['missing prefix', 'abc123'],
    ['wrong object type', 'seti_abc123'],
    ['pi id', 'pi_abc123'],
    ['subclassed id', 'cs_test'],
    ['trailing underscore only', 'cs_test_'],
    ['path traversal', '../../etc/passwd'],
    ['uppercase prefix', 'CS_TEST_abc123'],
    ['non-alphanumeric suffix', 'cs_test_abc-123'],
  ])('rejects %s', (_label, id) => {
    expect(isValidCheckoutSessionId(id)).toBe(false);
  });
});
