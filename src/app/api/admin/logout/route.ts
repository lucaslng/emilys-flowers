// src/app/api/admin/logout/route.ts
//
// Admin sign-out: clears the `admin_session` cookie and returns to the admin
// sign-in page. POST-only (form-submitted from the admin UI) so a plain link
// or prefetch cannot trigger the state change; same-origin enforced like the
// ship route so a cross-site form cannot force a sign-out.

import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/admin-auth';
import { isSameOriginRequest } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'Cross-origin request rejected.' },
      { status: 403 }
    );
  }

  // 303 so the browser follows the redirect with GET regardless of how the
  // target page handles POST.
  const response = NextResponse.redirect(
    new URL('/admin/orders', request.url).toString(),
    303
  );
  response.cookies.delete({ name: SESSION_COOKIE, path: '/' });
  return response;
}
