import BloomSpinner from '@/components/ui/BloomSpinner';

/**
 * Loading UI — Suspense fallback for route segments (Next.js 16 App Router).
 * Server Component: renders markup plus a client-side BloomSpinner.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-background px-6">
      <BloomSpinner size={56} />
      <p className="font-hand text-3xl leading-none text-rose-deep">
        blooming…
      </p>
    </div>
  );
}