'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Button from '@/components/ui/Button';

/**
 * Inline "confirm shipment" form for a single order. POSTs the estimated
 * shipping time to /api/admin/orders/<sessionId>/ship, shows inline
 * error/success feedback, and reloads on success so the order re-renders
 * with its shipped badge.
 */
export default function ShipForm({ sessionId }: { sessionId: string }) {
  const [estimate, setEstimate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/orders/${sessionId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedShippingTime: estimate }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        // A metadata-stamp failure (`emailSent: true`) means the shipped
        // email already went out — the server's message carries the
        // do-not-resubmit guidance, so surface it verbatim instead of the
        // generic retry prompt.
        if (
          data &&
          typeof data === 'object' &&
          data.emailSent === true &&
          typeof data.error === 'string'
        ) {
          setError(data.error);
          setLoading(false);
          return;
        }
        throw new Error(
          data && typeof data.error === 'string'
            ? data.error
            : 'Failed to confirm shipment. Please try again.'
        );
      }

      setSuccess('Shipped — the customer has been notified.');
      // Let the success message render, then reload so the order shows its
      // shipped badge (the ship route persists metadata before responding).
      window.setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to confirm shipment. Please try again.'
      );
      setLoading(false);
    }
  };

  const inputId = `ship-estimate-${sessionId}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor={inputId}
          className="mb-1 block font-sans text-xs font-medium uppercase tracking-[0.1em] text-foreground"
        >
          Estimated shipping time
        </label>
        <input
          id={inputId}
          name="estimatedShippingTime"
          type="text"
          required
          placeholder="2–4 business days"
          value={estimate}
          onChange={(event) => setEstimate(event.target.value)}
          className="w-full border border-border bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted/70"
        />
      </div>

      {error && (
        <p role="alert" className="font-sans text-sm text-[#9C4A2F]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="font-sans text-sm text-rose-deep">
          {success}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? 'Sending…' : 'Confirm order & notify customer'}
      </Button>
    </form>
  );
}