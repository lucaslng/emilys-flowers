import { Resend } from 'resend';
import { formatCAD, formatPrice, formatShippingLabel } from '@/lib/format';

/**
 * Order email sending via Resend.
 *
 * Both senders read `process.env.RESEND_API_KEY` and throw a clear error when
 * it is missing. An optional client can be injected for tests.
 */

export interface EmailLineItem {
  name: string;
  quantity: number;
  unitAmountCents: number;
}

export interface OrderConfirmationData {
  to: string;
  orderNumber: string;
  customerName?: string;
  items: EmailLineItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  shippingAddress?: string;
}

export interface SendEmailOptions {
  idempotencyKey?: string;
}

const FROM_ADDRESS = "Emily's Flowers <hello@emilysflowers.ca>";

// Static values keep CASL's 60-day contact-info validity (s.6(3)) trivially true.
const CONTACT_EMAIL = 'contact@emilysflowers.ca';
const UNSUBSCRIBE_MAILTO = `mailto:${CONTACT_EMAIL}?subject=Unsubscribe`;

// Warm "gift tag" palette — mirrors the site design tokens in globals.css.
const EMAIL_BG = '#FEFAF5';
const EMAIL_SURFACE = '#FCF5EF';
const EMAIL_BORDER = '#EDE0D4';
const EMAIL_TEXT = '#4A3B3B';
const EMAIL_MUTED = '#7A6868';
const EMAIL_ROSE = '#9E5E5E';
const EMAIL_ROSE_LINE = '#B16E6E'; // non-text rose — tag/panel borders
const EMAIL_BLUSH = '#F9E4E4'; // soft satin pink panel
const EMAIL_STITCH = '#E4C9B8'; // dashed seam

// System font stacks only — no web fonts in email. The mono stack approximates
// Martian Mono (the site's geometric voice); the hand stack echoes the
// Reenie Beanie accents.
const EMAIL_FONT_MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";
const EMAIL_FONT_HAND = "'Segoe Script', 'Bradley Hand', cursive";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function greeting(customerName?: string): string {
  return customerName ? `Hi ${customerName},` : 'Hello,';
}

function complianceFooterHtml(): string {
  return `
        <tr>
          <td style="padding-top:20px; margin-top:20px; border-top:1px dashed ${EMAIL_STITCH}; font-family:${EMAIL_FONT_MONO}; font-size:11px; line-height:1.6; color:${EMAIL_MUTED};">
            <p style="margin:0 0 8px;">
              You're receiving this email because you placed an order with
              Emily's Flowers (emilysflowers.ca).
            </p>
            <p style="margin:0 0 8px;">
              Questions about your order? Email
              <a href="mailto:${CONTACT_EMAIL}" style="color:${EMAIL_ROSE};">${CONTACT_EMAIL}</a>.
            </p>
            <p style="margin:0;">
              To stop receiving these emails,
              <a href="${UNSUBSCRIBE_MAILTO}" style="color:${EMAIL_ROSE};">Unsubscribe</a>
              (or reply with the subject "Unsubscribe").
            </p>
          </td>
        </tr>`;
}

function complianceFooterLines(): string[] {
  return [
    '',
    '---',
    `You're receiving this email because you placed an order with Emily's Flowers (emilysflowers.ca).`,
    `Contact: ${CONTACT_EMAIL}`,
    `To stop receiving these emails, reply to or email ${CONTACT_EMAIL} with the subject 'Unsubscribe'.`,
  ];
}

function emailShell(innerHtml: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_BG}; padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_SURFACE}; border:1px solid ${EMAIL_BORDER}; padding:32px;">
        <tr>
          <td style="padding-bottom:20px; border-bottom:1px dashed ${EMAIL_STITCH};">
            <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_BG}; border:1px solid ${EMAIL_ROSE_LINE}; transform:rotate(-1deg);">
              <tr>
                <td style="padding:6px 12px; font-family:${EMAIL_FONT_MONO}; font-size:14px; font-weight:bold; letter-spacing:0.16em; text-transform:uppercase; color:${EMAIL_TEXT};">
                  Emily's Flowers <span style="color:${EMAIL_ROSE};">&#9825;</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px; font-family:${EMAIL_FONT_MONO}; font-size:13px; line-height:1.6; color:${EMAIL_TEXT};">
            ${innerHtml}
          </td>
        </tr>
        ${complianceFooterHtml()}
      </table>
    </td>
  </tr>
</table>`;
}

function buildOrderConfirmationHtml(data: OrderConfirmationData): string {
  const itemRows = data.items
    .map((item) => {
      const lineTotal = item.unitAmountCents * item.quantity;
      return `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid ${EMAIL_BORDER}; color:${EMAIL_TEXT}; font-size:13px; line-height:1.5;">
            ${escapeHtml(item.name)} <span style="color:${EMAIL_MUTED};">&times; ${item.quantity}</span>
          </td>
          <td align="right" style="padding:8px 0; border-bottom:1px solid ${EMAIL_BORDER}; color:${EMAIL_TEXT}; font-size:13px; white-space:nowrap;">
            $${formatPrice(lineTotal)}
          </td>
        </tr>`;
    })
    .join('');

  const shippingLabel = formatShippingLabel(data.shippingCents);

  const addressBlock = data.shippingAddress
    ? `
        <tr>
          <td colspan="2" style="padding:16px 0 0; color:${EMAIL_MUTED}; font-size:13px; line-height:1.6;">
            <span style="font-size:11px; font-weight:bold; letter-spacing:0.14em; text-transform:uppercase; color:${EMAIL_ROSE};">Shipping to</span><br/>
            ${escapeHtml(data.shippingAddress).replace(/\n/g, '<br/>')}
          </td>
        </tr>`
    : '';

  return emailShell(`
    <p style="margin:0 0 16px; font-size:15px; font-weight:bold;">${escapeHtml(greeting(data.customerName))}</p>
    <p style="margin:0 0 16px;">
      Thank you for your order! Your order <strong>#${escapeHtml(data.orderNumber)}</strong> is confirmed,
      and we're wrapping every stem by hand.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
      ${itemRows}
      <tr>
        <td style="padding:12px 0 0; color:${EMAIL_MUTED}; font-size:11px; font-weight:bold; letter-spacing:0.14em; text-transform:uppercase;">Subtotal</td>
        <td align="right" style="padding:12px 0 0; color:${EMAIL_TEXT}; font-size:13px;">$${formatPrice(data.subtotalCents)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0 0; color:${EMAIL_MUTED}; font-size:11px; font-weight:bold; letter-spacing:0.14em; text-transform:uppercase;">Shipping</td>
        <td align="right" style="padding:4px 0 0; color:${EMAIL_TEXT}; font-size:13px;">${shippingLabel}</td>
      </tr>
      <tr>
        <td style="padding:12px 0 0; border-top:2px solid ${EMAIL_BORDER}; color:${EMAIL_TEXT}; font-size:13px; font-weight:bold; letter-spacing:0.14em; text-transform:uppercase;">Total</td>
        <td align="right" style="padding:12px 0 0; border-top:2px solid ${EMAIL_BORDER}; color:${EMAIL_TEXT}; font-size:14px; font-weight:bold;">$${formatPrice(data.totalCents)}</td>
      </tr>
      ${addressBlock}
    </table>
    <p style="margin:20px 0 0;">
      We can't wait for your flowers to arrive.
      Thank you for supporting a small handmade shop!
    </p>
    <p style="margin:16px 0 0; color:${EMAIL_MUTED}; font-size:13px;">
      Warmly,<br/>Emily's Flowers
    </p>
    <p style="margin:12px 0 0; font-family:${EMAIL_FONT_HAND}; font-size:16px; color:${EMAIL_ROSE};">handcrafted with love</p>
  `);
}

function buildOrderConfirmationText(data: OrderConfirmationData): string {
  const lines = data.items.map(
    (item) =>
      `- ${item.name} x ${item.quantity} — $${formatPrice(item.unitAmountCents * item.quantity)}`
  );
  const shippingLine = formatShippingLabel(data.shippingCents);

  return [
    `${greeting(data.customerName)}`,
    '',
    `Thank you for your order! Your order #${data.orderNumber} is confirmed, and we are shipping it now. We will send another email shortly with your estimated shipping time.`,
    '',
    'Items:',
    ...lines,
    '',
    `Subtotal: $${formatPrice(data.subtotalCents)}`,
    `Shipping: ${shippingLine}`,
    `Total: $${formatPrice(data.totalCents)}`,
    ...(data.shippingAddress
      ? ['', 'Shipping to:', data.shippingAddress]
      : []),
    '',
    "Thank you for supporting Emily's Flowers!",
    '',
    'Warmly,',
    "Emily's Flowers",
    ...complianceFooterLines(),
  ].join('\n');
}

function buildShippedHtml(data: {
  orderNumber: string;
  customerName?: string;
  estimatedShippingTime: string;
}): string {
  return emailShell(`
    <p style="margin:0 0 16px; font-size:15px; font-weight:bold;">${escapeHtml(greeting(data.customerName))}</p>
    <p style="margin:0 0 16px;">
      Great news - your order <strong>#${escapeHtml(data.orderNumber)}</strong> is on its way!
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_BLUSH}; border:1px solid ${EMAIL_ROSE_LINE}; padding:16px; margin:0 0 16px;">
      <tr>
        <td style="color:${EMAIL_TEXT}; font-size:11px; font-weight:bold; letter-spacing:0.14em; text-transform:uppercase;">Estimated delivery</td>
      </tr>
      <tr>
        <td style="color:${EMAIL_TEXT}; font-size:18px; font-weight:bold; padding-top:4px;">${escapeHtml(data.estimatedShippingTime)}</td>
      </tr>
    </table>
    <p style="margin:0 0 16px;">
      Keep an eye on your doorstep. Thank you for supporting Emily's Flowers!
    </p>
    <p style="margin:16px 0 0; color:${EMAIL_MUTED}; font-size:13px;">
      Warmly,<br/>Emily's Flowers
    </p>
    <p style="margin:12px 0 0; font-family:${EMAIL_FONT_HAND}; font-size:16px; color:${EMAIL_ROSE};">handcrafted with love</p>
  `);
}

function buildShippedText(data: {
  orderNumber: string;
  customerName?: string;
  estimatedShippingTime: string;
}): string {
  return [
    `${greeting(data.customerName)}`,
    '',
    `Great news — your order #${data.orderNumber} is on its way!`,
    '',
    `Estimated delivery: ${data.estimatedShippingTime}`,
    '',
    'Your flowers are travelling in good hands. Keep an eye on your doorstep — they\'re wrapped and ready to brighten someone\'s day.',
    '',
    'Warmly,',
    "Emily's Flowers",
    ...complianceFooterLines(),
  ].join('\n');
}

function requireApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not set; cannot send order emails. Set it in your environment before sending.'
    );
  }
  return apiKey;
}

/**
 * Send an order confirmation email.
 *
 * @param data  Order details to render into the email.
 * @param opts  Optional idempotency key. Passed via the SDK's
 *              `idempotencyKey` request option (sent as the HTTP
 *              `Idempotency-Key` header) so Stripe webhook retries don't
 *              produce duplicate emails.
 * @param client  Injectable Resend client (defaults to one built from
 *                `process.env.RESEND_API_KEY`).
 */
export async function sendOrderConfirmationEmail(
  data: OrderConfirmationData,
  opts?: SendEmailOptions,
  client: Resend = new Resend(requireApiKey())
): Promise<{ id: string }> {
  const response = await client.emails.send(
    {
      from: FROM_ADDRESS,
      to: data.to,
      subject: `Your Emily's Flowers order #${data.orderNumber} is confirmed`,
      text: buildOrderConfirmationText(data),
      html: buildOrderConfirmationHtml(data),
    },
    opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined
  );

  if (response.error) {
    throw new Error(
      `Failed to send order confirmation email: ${response.error.message}`
    );
  }

  return { id: response.data.id };
}

/**
 * Send a "your order shipped" email.
 *
 * @param data  Order + shipping details to render into the email.
 * @param opts  Optional idempotency key. Passed via the SDK's
 *              `idempotencyKey` request option (sent as the HTTP
 *              `Idempotency-Key` header).
 * @param client  Injectable Resend client (defaults to one built from
 *                `process.env.RESEND_API_KEY`).
 */
export async function sendShippedEmail(
  data: {
    to: string;
    orderNumber: string;
    customerName?: string;
    estimatedShippingTime: string;
  },
  opts?: SendEmailOptions,
  client: Resend = new Resend(requireApiKey())
): Promise<{ id: string }> {
  const response = await client.emails.send(
    {
      from: FROM_ADDRESS,
      to: data.to,
      subject: `Your Emily's Flowers order #${data.orderNumber} is on its way`,
      text: buildShippedText(data),
      html: buildShippedHtml(data),
    },
    opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined
  );

  if (response.error) {
    throw new Error(`Failed to send shipped email: ${response.error.message}`);
  }

  return { id: response.data.id };
}