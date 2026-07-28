'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { CartItem as CartItemType } from '@/types';
import ProductImage from '@/components/shop/ProductImage';
import { gsap, useGSAP } from '@/lib/gsap';
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
  // Holds the in-flight exit tween so we can kill it on unmount and avoid
  // a stale `onComplete` firing `removeFromCart` after navigation.
  const removeTweenRef = useRef<gsap.core.Tween | null>(null);
  // Skips the quantity-bump on the initial mount (only react to real changes).
  const isFirstRun = useRef(true);
  const [isRemoving, setIsRemoving] = useState(false);

  // Quantity-change micro-interaction: a subtle scale bump on the
  // quantity number and the line total whenever `quantity` changes.
  // Skips the first run so the bump only plays on real changes, and is
  // a no-op under reduced motion.
  useGSAP(
    () => {
      if (isFirstRun.current) {
        isFirstRun.current = false;
        return;
      }
      if (prefersReducedMotion()) return;
      const targets = [qtyRef.current, totalRef.current].filter(
        (n): n is HTMLElement => n !== null
      );
      if (targets.length === 0) return;
      gsap.fromTo(
        targets,
        { scale: 1 },
        {
          scale: 1.12,
          duration: 0.12,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          stagger: 0.04,
        }
      );
    },
    { dependencies: [quantity], scope: rootRef }
  );

  // Kill any in-flight exit tween if the component unmounts mid-animation
  // (e.g. user navigates away) so a stale onComplete can't mutate cart
  // state after the user has moved on.
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
    // Reduced motion or missing ref: dispatch immediately, no animation.
    if (!node || prefersReducedMotion()) {
      removeFromCart(product.id);
      return;
    }
    setIsRemoving(true);
    // Animate the row out (fade + slide + collapse height/margins/padding),
    // then dispatch the removal in onComplete so React state and the visual
    // exit stay in sync. Keep it short (≤400ms) so Playwright doesn't flake.
    removeTweenRef.current = gsap.to(node, {
      opacity: 0,
      x: 40,
      height: 0,
      marginTop: 0,
      marginBottom: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        removeTweenRef.current = null;
        removeFromCart(product.id);
      },
    });
  };

  return (
    <div
      ref={rootRef}
      data-cart-item
      className="plaque-card cart-item-card group flex gap-4 p-4 sm:gap-6 sm:p-6"
    >
      {/* Image — sharp corners, surface backdrop */}
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden bg-[#FFF5F5] sm:h-28 sm:w-28">
        <ProductImage
          product={product}
          sizes="112px"
          className="object-cover"
        />
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="plaque-name font-serif text-base font-semibold text-[#4A3B3B]">
              {product.name}
            </h3>
            <p className="mt-0.5 font-sans text-sm text-[#8B7B7B]">
              {formatPrice(product.price)} each
            </p>
          </div>
          <button
            onClick={handleRemove}
            disabled={isRemoving}
            className="ml-4 flex-shrink-0 text-[#8B7B7B] transition-colors hover:text-[#A8625A] disabled:cursor-not-allowed disabled:opacity-40"
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
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDecrement}
              disabled={isRemoving || quantity <= 1}
              className="flex h-8 w-8 items-center justify-center border border-[#F0E0E0] bg-[#FFF5F5] text-[#4A3B3B] transition-colors hover:bg-[#F9E4E4] disabled:cursor-not-allowed disabled:opacity-40"
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
              className="flex h-8 w-10 items-center justify-center font-sans text-sm font-medium tabular-nums text-[#4A3B3B]"
            >
              {quantity}
            </span>
            <button
              onClick={handleIncrement}
              disabled={isRemoving}
              className="flex h-8 w-8 items-center justify-center border border-[#F0E0E0] bg-[#FFF5F5] text-[#4A3B3B] transition-colors hover:bg-[#F9E4E4] disabled:cursor-not-allowed disabled:opacity-40"
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

          {/* Line Total */}
          <span
            ref={totalRef}
            className="font-serif text-lg font-bold tabular-nums text-[#4A3B3B]"
          >
            {formatPrice(product.price * quantity)}
          </span>
        </div>
      </div>
    </div>
  );
}