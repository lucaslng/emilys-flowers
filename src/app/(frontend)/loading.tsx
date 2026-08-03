import BloomSpinner from '@/components/ui/BloomSpinner';

/**
 * Loading UI — Suspense fallback for route segments (Next.js 16 App Router).
 * Server Component: renders markup plus a client-side BloomSpinner.
 *
 * Full-height centered flex column: the BloomSpinner above a short, on-brand
 * "Blooming…" message in the brand serif.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-[#FFFAFA] px-6">
      <BloomSpinner size={56} />
      <p className="font-serif text-sm tracking-wide text-[#8B7B7B]">
        Blooming…
      </p>
    </div>
  );
}