// src/app/api/admin/login/route.ts
//
// Admin sign-in. Compares the submitted password against
// `process.env.ADMIN_PASSWORD` and, on success, sets an httpOnly
// `admin_session` cookie whose value is sha256(password) — the same token
// the ship route and the admin page recompute from the env var.

import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison (lengths must match). */
function passwordsMatch(submitted: string, expected: string): boolean {
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD is not configured on the server.' },
      { status: 500 }
    );
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!passwordsMatch(password, adminPassword)) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  const token = createHash('sha256').update(password).digest('hex');
  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_session', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}