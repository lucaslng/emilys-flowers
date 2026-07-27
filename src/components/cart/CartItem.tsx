'use client';

import Image from 'next/image';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { CartItem as CartItemType } from '@/types';

interface CartItemProps {
  item: CartItemType;
}

export default function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeFromCart } = useCart();
  const { product, quantity } = item;

  const handleDecrement = () => {
    updateQuantity(product.id, quantity - 1);
  };

  const handleIncrement = () => {
    updateQuantity(product.id, quantity + 1);
  };

  return (
    <div className="flex gap-4 rounded-xl border border-[#F0E0E0] bg-[#FFFAFA] p-4 sm:gap-6 sm:p-6">
      {/* Image */}
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#FFF5F5] sm:h-28 sm:w-28">
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-base font-semibold text-[#4A3B3B]">
              {product.name}
            </h3>
            <p className="mt-0.5 font-sans text-sm text-[#8B7B7B]">
              ${formatPrice(product.price)} each
            </p>
          </div>
          <button
            onClick={() => removeFromCart(product.id)}
            className="ml-4 flex-shrink-0 text-[#8B7B7B] transition-colors hover:text-red-500"
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
              disabled={quantity <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F0E0E0] bg-[#FFF5F5] text-[#4A3B3B] transition-colors hover:bg-[#F9E4E4] disabled:cursor-not-allowed disabled:opacity-40"
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
            <span className="flex h-8 w-10 items-center justify-center font-sans text-sm font-medium text-[#4A3B3B]">
              {quantity}
            </span>
            <button
              onClick={handleIncrement}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F0E0E0] bg-[#FFF5F5] text-[#4A3B3B] transition-colors hover:bg-[#F9E4E4]"
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
          <span className="font-serif text-lg font-bold text-[#4A3B3B]">
            ${formatPrice(product.price * quantity)}
          </span>
        </div>
      </div>
    </div>
  );
}
