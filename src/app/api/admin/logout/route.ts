// Admin sign-out: clears the `admin_session` cookie. POST-only + same-origin
// so a link, prefetch, or cross-site form cannot force a sign-out.

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

  // 303 so the browser follows the redirect with GET.
  const response = NextResponse.redirect(
    new URL('/admin/orders', request.url).toString(),
    303
  );
  response.cookies.delete({ name: SESSION_COOKIE, path: '/' });
  return response;
}
