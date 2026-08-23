// src/lib/stripe-session-id.ts
//
// Single definition of "what a real Stripe Checkout session id looks like",
// shared by every route that forwards a caller-supplied session id to the
// Stripe SDK (success-receipt retrieval, admin ship). Format-guarding BEFORE
// any Stripe call keeps crafted ids out of the SDK and turns malformed input
// into a clean 400 instead of a raw Stripe SDK error / 500.

/** Only real Stripe Checkout session ids may reach the Stripe API. */
const SESSION_ID_PATTERN = /^cs_(live|test)_[A-Za-z0-9]+$/;

/** True when `sessionId` is shaped like a real Stripe Checkout session id. */
export function isValidCheckoutSessionId(sessionId: string): boolean {
  return SESSION_ID_PATTERN.test(sessionId);
}
