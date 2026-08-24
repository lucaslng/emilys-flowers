import BloomSpinner from '@/components/ui/BloomSpinner';
import StoreShell from '@/components/layout/StoreShell';

export default function Loading() {
  return (
    <StoreShell>
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-background px-6">
        <BloomSpinner size={56} />
        <p className="font-hand text-3xl leading-none text-rose-deep">
          blooming…
        </p>
      </div>
    </StoreShell>
  );
}
