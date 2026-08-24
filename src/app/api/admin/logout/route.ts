// src/app/api/admin/logout/route.ts
//
// Admin sign-out: clears the `admin_session` cookie and returns to the admin
// sign-in page. POST-only (form-submitted from the admin UI) so a plain link
// or prefetch cannot trigger the state change.

import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL('/admin/orders', request.url).toString()
  );
  response.cookies.delete({ name: SESSION_COOKIE, path: '/' });
  return response;
}
