// src/lib/csrf.ts
//
// Origin check for state-changing admin endpoints. Browsers always attach
// `Origin` (or `Referer`) to cross-site POSTs, so a mismatch proves the
// request was forged from another site; absent headers mean a non-browser
// client, which cannot be CSRF-forced (the session cookie is still required).

/** True when the request's Origin/Referer matches its own origin. */
export function isSameOriginRequest(request: Request): boolean {
  const selfOrigin = new URL(request.url).origin;

  const origin = request.headers.get('origin');
  if (origin !== null) {
    try {
      return new URL(origin).origin === selfOrigin;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('referer');
  if (referer !== null) {
    try {
      return new URL(referer).origin === selfOrigin;
    } catch {
      return false;
    }
  }

  return true;
}
