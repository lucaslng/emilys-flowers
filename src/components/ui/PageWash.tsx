/** Decorative soft radial light; purely presentational. */
export default function PageWash({ background }: { background: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ background }}
    />
  );
}
