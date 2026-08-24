'use client';

import type { ReactNode, Ref } from 'react';
import { formatCAD } from '@/lib/format';

/** Shared receipt rows; the caller owns the surrounding card and line-item markup. */
interface OrderReceiptProps {
  dividerClassName?: string;
  children?: ReactNode;
  totalsClassName: string;
  /** Adds `data-reveal` to the totals stack for the success page's GSAP timeline. */
  totalsDataReveal?: boolean;
  subtotalLabel: ReactNode;
  subtotal: number;
  /** Omit for the muted "Calculated at checkout" cell; a value renders the amount, or "Free" at 0. */
  shipping?: number;
  total: number;
  totalRowWrapperClassName?: string;
  totalRowClassName?: string;
  /** Target of the cart page's scale-bump micro-interaction on the total. */
  totalValueRef?: Ref<HTMLSpanElement>;
}

const DEFAULT_TOTAL_ROW_CLASS_NAME =
  'flex justify-between border-t border-dashed border-rose-line/40 pt-2 font-sans text-lg font-bold uppercase tracking-[0.1em] text-foreground';

function TotalRow({
  className,
  totalValueRef,
  total,
}: {
  className: string;
  totalValueRef?: Ref<HTMLSpanElement>;
  total: number;
}) {
  return (
    <div className={className}>
      <span>Total</span>
      <span ref={totalValueRef} className="tabular-nums">
        {formatCAD(total)}
      </span>
    </div>
  );
}

export default function OrderReceipt({
  dividerClassName = 'mt-4',
  children,
  totalsClassName,
  totalsDataReveal = false,
  subtotalLabel,
  subtotal,
  shipping,
  total,
  totalRowWrapperClassName,
  totalRowClassName = DEFAULT_TOTAL_ROW_CLASS_NAME,
  totalValueRef,
}: OrderReceiptProps) {
  return (
    <>
      <h2 className="font-sans text-lg font-bold uppercase tracking-[0.14em] text-foreground">
        Order Summary
      </h2>
      <div className={`gift-divider ${dividerClassName}`} />

      {children}

      <div
        data-reveal={totalsDataReveal || undefined}
        className={totalsClassName}
      >
        <div className="flex justify-between font-sans text-sm text-foreground">
          <span>{subtotalLabel}</span>
          <span className="tabular-nums">{formatCAD(subtotal)}</span>
        </div>
        <div className="flex justify-between font-sans text-sm text-foreground">
          <span>Shipping</span>
          {shipping === undefined ? (
            <span className="text-right text-sm text-muted">
              Calculated at checkout
            </span>
          ) : (
            <span className="tabular-nums">
              {shipping === 0 ? (
                <span className="font-semibold text-rose-deep">Free</span>
              ) : (
                formatCAD(shipping)
              )}
            </span>
          )}
        </div>
        {totalRowWrapperClassName ? (
          <div className={totalRowWrapperClassName}>
            <TotalRow
              className={totalRowClassName}
              totalValueRef={totalValueRef}
              total={total}
            />
          </div>
        ) : (
          <TotalRow
            className={totalRowClassName}
            totalValueRef={totalValueRef}
            total={total}
          />
        )}
      </div>
    </>
  );
}
