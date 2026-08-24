import { test, expect, describe } from 'bun:test';
import { Resend } from 'resend';
import {
  sendOrderConfirmationEmail,
  sendShippedEmail,
  type OrderConfirmationData,
} from '@/lib/email';

interface FakeSendPayload {
  from?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
}

interface FakeSendOptions {
  idempotencyKey?: string;
}

interface FakeError {
  message: string;
  statusCode: number | null;
  name: string;
}

function createFakeClient(options?: { error?: FakeError }) {
  const sent: FakeSendPayload[] = [];
  const sentOptions: FakeSendOptions[] = [];
  const client = {
    emails: {
      send: async (payload: FakeSendPayload, requestOptions?: FakeSendOptions) => {
        sent.push(payload);
        sentOptions.push(requestOptions ?? {});
        if (options?.error) {
          return { data: null, error: options.error, headers: null };
        }
        return { data: { id: 'email_123' }, error: null, headers: null };
      },
    },
  };
  return { client: client as unknown as Resend, sent, sentOptions };
}

const confirmationData: OrderConfirmationData = {
  to: 'customer@example.com',
  orderNumber: 'EF-ABC123',
  customerName: 'Ada',
  items: [
    { name: 'Blush Romance Bouquet', quantity: 1, unitAmountCents: 8999 },
    { name: 'Ribbon Rose', quantity: 2, unitAmountCents: 2499 },
  ],
  subtotalCents: 13997,
  shippingCents: 599,
  totalCents: 14596,
  shippingAddress: 'Ada\n1 Analytical Way\nToronto, ON\nM5V 2T6\nCA',
};

describe('sendOrderConfirmationEmail', () => {
  test('sends a confirmation email with the expected payload shape', async () => {
    const { client, sent } = createFakeClient();
    const result = await sendOrderConfirmationEmail(confirmationData, undefined, client);

    expect(result).toEqual({ id: 'email_123' });
    expect(sent).toHaveLength(1);

    const payload = sent[0];
    expect(payload.from).toBe("Emily's Flowers <hello@emilysflowers.ca>");
    expect(payload.to).toBe('customer@example.com');
    expect(payload.subject).toContain('EF-ABC123');
    expect(payload.subject).toContain('is confirmed');
    expect(typeof payload.text).toBe('string');
    expect(payload.text!.length).toBeGreaterThan(0);
    expect(typeof payload.html).toBe('string');
    expect(payload.html!.length).toBeGreaterThan(0);
  });

  test('renders item lines, totals, and shipping address into the email', async () => {
    const { client, sent } = createFakeClient();
    await sendOrderConfirmationEmail(confirmationData, undefined, client);

    const payload = sent[0];
    expect(payload.text).toContain('Blush Romance Bouquet x 1');
    expect(payload.text).toContain('Ribbon Rose x 2');
    expect(payload.text).toContain('Subtotal: $139.97');
    expect(payload.text).toContain('Shipping: $5.99');
    expect(payload.text).toContain('Total: $145.96');
    expect(payload.text).toContain('1 Analytical Way');
    expect(payload.html).toContain('Blush Romance Bouquet');
    expect(payload.html).toContain('$145.96');
  });

  test('passes the idempotency key through as the SDK request option', async () => {
    const { client, sentOptions } = createFakeClient();
    await sendOrderConfirmationEmail(confirmationData, { idempotencyKey: 'evt_123' }, client);

    expect(sentOptions[0].idempotencyKey).toBe('evt_123');
  });

  test('omits the idempotency key option when none is given', async () => {
    const { client, sentOptions } = createFakeClient();
    await sendOrderConfirmationEmail(confirmationData, undefined, client);

    expect(sentOptions[0].idempotencyKey).toBeUndefined();
  });

  test('throws when RESEND_API_KEY is missing', async () => {
    const original = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      // No client injected: the default `new Resend(requireApiKey())` evaluates and throws on the missing env var.
      await expect(
        sendOrderConfirmationEmail(confirmationData, undefined)
      ).rejects.toThrow('RESEND_API_KEY');
    } finally {
      if (original !== undefined) {
        process.env.RESEND_API_KEY = original;
      }
    }
  });

  test('throws when the client reports an error', async () => {
    const { client } = createFakeClient({
      error: { message: 'Invalid API key', statusCode: 401, name: 'invalid_api_key' },
    });
    await expect(
      sendOrderConfirmationEmail(confirmationData, undefined, client)
    ).rejects.toThrow('Failed to send order confirmation email');
  });
});

describe('sendShippedEmail', () => {
  test('sends a shipped email with the estimated shipping time', async () => {
    const { client, sent } = createFakeClient();
    const result = await sendShippedEmail(
      {
        to: 'customer@example.com',
        orderNumber: 'EF-ABC123',
        customerName: 'Ada',
        estimatedShippingTime: '2-4 business days',
      },
      undefined,
      client
    );

    expect(result).toEqual({ id: 'email_123' });
    expect(sent).toHaveLength(1);

    const payload = sent[0];
    expect(payload.from).toBe("Emily's Flowers <hello@emilysflowers.ca>");
    expect(payload.to).toBe('customer@example.com');
    expect(payload.subject).toContain('EF-ABC123');
    expect(payload.subject).toContain('is on its way');
    expect(payload.text).toContain('2-4 business days');
    expect(payload.html).toContain('2-4 business days');
  });

  test('passes the idempotency key through as the SDK request option', async () => {
    const { client, sentOptions } = createFakeClient();
    await sendShippedEmail(
      {
        to: 'customer@example.com',
        orderNumber: 'EF-ABC123',
        estimatedShippingTime: '2-4 business days',
      },
      { idempotencyKey: 'evt_456' },
      client
    );

    expect(sentOptions[0].idempotencyKey).toBe('evt_456');
  });

  test('throws when RESEND_API_KEY is missing', async () => {
    const original = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      // No client injected: the default `new Resend(requireApiKey())` evaluates and throws on the missing env var.
      await expect(
        sendShippedEmail(
          {
            to: 'customer@example.com',
            orderNumber: 'EF-ABC123',
            estimatedShippingTime: '2-4 business days',
          },
          undefined
        )
      ).rejects.toThrow('RESEND_API_KEY');
    } finally {
      if (original !== undefined) {
        process.env.RESEND_API_KEY = original;
      }
    }
  });
});