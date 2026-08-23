const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stamp confirmation-email state onto a Checkout Session's metadata.
 * `sessions.update` replaces the whole metadata map, so existing keys are
 * merged in. Retries transient failures; returns the last error when every
 * attempt fails.
 */
export async function stampConfirmationMetadata(
  updateSessionMetadata: (metadata: Record<string, string>) => Promise<unknown>,
  existingMetadata: Record<string, string> | null | undefined,
  emailId: string
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await updateSessionMetadata({
        ...existingMetadata,
        confirmation_email_sent_at: new Date().toISOString(),
        confirmation_email_id: emailId,
      });
      return { ok: true };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  return { ok: false, error: lastError };
}
