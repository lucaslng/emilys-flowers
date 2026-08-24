// Shared definition of "what a real Stripe Checkout session id looks like": format-guarding before any Stripe call
// turns malformed input into a clean 400 instead of a raw Stripe SDK error / 500.

const SESSION_ID_PATTERN = /^cs_(live|test)_[A-Za-z0-9]+$/;

export function isValidCheckoutSessionId(sessionId: string): boolean {
  return SESSION_ID_PATTERN.test(sessionId);
}
