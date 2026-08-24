'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatCAD } from '@/lib/format';
import { CartItem as CartItemType } from '@/types';
import ProductImage from '@/components/shop/ProductImage';
import { collapseAndRemove, gsap } from '@/lib/gsap';
import { useScaleBump } from '@/lib/use-scale-bump';
import { prefersReducedMotion } from '@/lib/reduced-motion';

interface CartItemProps {
  item: CartItemType;
}

export default function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeFromCart } = useCart();
  const { product, quantity } = item;

  const rootRef = useRef<HTMLDivElement>(null);
  const qtyRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  // Kill the in-flight exit tween on unmount so a stale `onComplete` can't
  // mutate cart state after the user has navigated away.
  const removeTweenRef = useRef<gsap.core.Tween | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useScaleBump(quantity, [qtyRef, totalRef], rootRef);

  useEffect(() => {
    return () => {
      removeTweenRef.current?.kill();
      removeTweenRef.current = null;
    };
  }, []);

  const handleDecrement = () => {
    if (isRemoving) return;
    updateQuantity(product.id, quantity - 1);
  };

  const handleIncrement = () => {
    if (isRemoving) return;
    updateQuantity(product.id, quantity + 1);
  };

  const handleRemove = () => {
    if (isRemoving) return;
    const node = rootRef.current;
    if (!node || prefersReducedMotion()) {
      removeFromCart(product.id);
      return;
    }
    setIsRemoving(true);
    removeTweenRef.current = collapseAndRemove(node, () => {
      removeTweenRef.current = null;
      removeFromCart(product.id);
    });
  };

  return (
    <div
      ref={rootRef}
      data-cart-item
      className="gift-card cart-item-card group flex gap-4 p-4 sm:gap-6 sm:p-6"
    >
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden bg-blush/30 sm:h-28 sm:w-28">
        <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-60" />
        <ProductImage
          product={product}
          sizes="112px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="gift-name font-sans text-base font-bold uppercase tracking-[0.08em] text-foreground">
              {product.name}
            </h2>
            <p className="mt-0.5 font-sans text-sm text-muted">
              {formatCAD(product.price)} each
            </p>
          </div>
          <button
            onClick={handleRemove}
            disabled={isRemoving}
            className="ml-4 flex-shrink-0 p-1 text-muted transition-colors hover:text-rose-deep disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Remove ${product.name} from cart`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDecrement}
              disabled={isRemoving || quantity <= 1}
              className="flex h-8 w-8 items-center justify-center border border-border bg-surface text-foreground transition-colors hover:bg-blush disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 12h-15"
                />
              </svg>
            </button>
            <span
              ref={qtyRef}
              data-testid="cart-item-quantity"
              className="flex h-8 w-10 items-center justify-center font-sans text-sm font-medium tabular-nums text-foreground"
            >
              {quantity}
            </span>
            <button
              onClick={handleIncrement}
              disabled={isRemoving}
              className="flex h-8 w-8 items-center justify-center border border-border bg-surface text-foreground transition-colors hover:bg-blush disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          </div>

          <span
            ref={totalRef}
            className="font-sans text-lg font-bold tabular-nums text-foreground"
          >
            {formatCAD(product.price * quantity)}
          </span>
        </div>
      </div>
    </div>
  );
}