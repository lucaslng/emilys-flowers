export default function OutOfStockStamp() {
  return (
    <div className="absolute inset-0 z-[2] flex items-center justify-center bg-background/80">
      <span className="border border-rose-line bg-foreground px-4 py-2 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-background">
        Out of Stock
      </span>
    </div>
  );
}
