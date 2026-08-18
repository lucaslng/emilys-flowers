'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Button from '@/components/ui/Button';

/**
 * Minimal admin sign-in form. POSTs the password to /api/admin/login and
 * reloads the page on success (the server sets the httpOnly admin_session
 * cookie, so a reload re-renders the gated page as authenticated).
 */
export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data && typeof data.error === 'string'
            ? data.error
            : 'Sign-in failed. Please try again.'
        );
      }

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign-in failed. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="admin-password"
          className="mb-1 block font-sans text-xs font-medium uppercase tracking-[0.1em] text-foreground"
        >
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full border border-border bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted/70"
        />
      </div>

      {error && (
        <p role="alert" className="font-sans text-sm text-[#9C4A2F]">
          {error}
        </p>
      )}

      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}