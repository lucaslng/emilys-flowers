/**
 * PageWash — a decorative soft radial light laid over a section. Purely
 * presentational (aria-hidden, pointer-events-none); the gradient varies
 * per surface and is passed as `background`.
 */
export default function PageWash({ background }: { background: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ background }}
    />
  );
}
