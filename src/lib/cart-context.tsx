'use client';

import {
  type ReactNode,
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CartItem, Product } from '@/types';
import {
  computeLineItemTotal,
  computeLineItemCount,
  MAX_LINE_ITEM_QUANTITY,
  type LineItem,
} from '@/lib/order';

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_TO_CART'; payload: Product }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; payload: CartItem[] };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existingIndex = state.items.findIndex(
        (item) => item.product.id === action.payload.id
      );
      if (existingIndex >= 0) {
        const updated = [...state.items];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(
            updated[existingIndex].quantity + 1,
            MAX_LINE_ITEM_QUANTITY
          ),
        };
        return { ...state, items: updated };
      }
      return {
        ...state,
        items: [...state.items, { product: action.payload, quantity: 1 }],
      };
    }

    case 'REMOVE_FROM_CART':
      return {
        ...state,
        items: state.items.filter(
          (item) => item.product.id !== action.payload
        ),
      };

    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      // Quantities must be positive integers — the badge, order math, and Stripe payload all assume integer counts.
      if (quantity <= 0 || !Number.isInteger(quantity)) {
        return {
          ...state,
          items: state.items.filter(
            (item) => item.product.id !== id
          ),
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.product.id === id
            ? { ...item, quantity: Math.min(quantity, MAX_LINE_ITEM_QUANTITY) }
            : item
        ),
      };
    }

    case 'CLEAR_CART':
      return { ...state, items: [] };

    case 'HYDRATE':
      return { ...state, items: action.payload };

    default:
      return state;
  }
}

// Seam between cart-internal CartItem and the flat LineItem shape the shared order math operates on.
export function toLineItems(items: CartItem[]): LineItem[] {
  return items.map((item) => ({
    id: item.product.id,
    name: item.product.name,
    price: item.product.price,
    quantity: item.quantity,
    category: item.product.category,
  }));
}

/** localStorage is user-editable: drop malformed items and clamp over-cap quantities so a bad store can't poison totals or die at checkout. */
export function sanitizeStoredCart(parsed: unknown): CartItem[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isCartItem).map((item) =>
    item.quantity > MAX_LINE_ITEM_QUANTITY
      ? { ...item, quantity: MAX_LINE_ITEM_QUANTITY }
      : item
  );
}

function isCartItem(v: unknown): v is CartItem {
  if (typeof v !== 'object' || v === null) return false;
  const item = v as Record<string, unknown>;
  if (
    typeof item.quantity !== 'number' ||
    !Number.isInteger(item.quantity) ||
    item.quantity <= 0
  ) {
    return false;
  }
  const p = item.product as Record<string, unknown> | undefined;
  if (typeof p !== 'object' || p === null) return false;
  return (
    typeof p.id === 'string' &&
    p.id.trim() !== '' &&
    typeof p.name === 'string' &&
    typeof p.description === 'string' &&
    typeof p.price === 'number' &&
    Number.isInteger(p.price) &&
    p.price > 0 &&
    Array.isArray(p.images) &&
    p.images.every(
      (image) =>
        typeof image === 'string' &&
        image.startsWith('/') &&
        !image.startsWith('//')
    ) &&
    (p.category === 'flower' || p.category === 'bouquet') &&
    Array.isArray(p.tags) &&
    typeof p.inStock === 'boolean'
  );
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'emilys-flowers-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Screen-reader live region (WCAG 4.1.2); the message clears after a delay so repeat actions re-announce.
  const [announcement, setAnnouncement] = useState('');
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    if (announceTimerRef.current) {
      clearTimeout(announceTimerRef.current);
    }
    announceTimerRef.current = setTimeout(() => {
      setAnnouncement('');
      announceTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        dispatch({ type: 'HYDRATE', payload: sanitizeStoredCart(parsed) });
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Ignore quota errors
    }
  }, [state.items]);

  const addToCart = useCallback(
    (product: Product) => {
      announce(`Added ${product.name} to your cart`);
      dispatch({ type: 'ADD_TO_CART', payload: product });
    },
    [announce]
  );

  const removeFromCart = useCallback(
    (productId: string) => {
      const item = state.items.find((i) => i.product.id === productId);
      if (item) {
        announce(`Removed ${item.product.name} from your cart`);
      }
      dispatch({ type: 'REMOVE_FROM_CART', payload: productId });
    },
    [state.items, announce]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      const item = state.items.find((i) => i.product.id === productId);
      if (item) {
        const applied = Math.min(quantity, MAX_LINE_ITEM_QUANTITY);
        announce(`Quantity of ${item.product.name} updated to ${applied}`);
      }
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity } });
    },
    [state.items, announce]
  );

  const clearCart = useCallback(() => {
    announce('Your cart has been cleared');
    dispatch({ type: 'CLEAR_CART' });
  }, [announce]);

  const getTotal = useCallback(() => {
    return computeLineItemTotal(toLineItems(state.items));
  }, [state.items]);

  const getItemCount = useCallback(() => {
    return computeLineItemCount(toLineItems(state.items));
  }, [state.items]);

  const value = useMemo(
    () => ({
      items: state.items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotal,
      getItemCount,
    }),
    [state.items, addToCart, removeFromCart, updateQuantity, clearCart, getTotal, getItemCount]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* Visually-hidden live region (WCAG 4.1.2); role="status" implies aria-live="polite"; inline styles since no sr-only utility exists. */}
      <span
        role="status"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          margin: '-1px',
          padding: 0,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </span>
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
