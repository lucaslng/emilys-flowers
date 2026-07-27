import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonOwnProps<T extends ElementType> = {
  as?: T;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  fullWidth?: boolean;
  className?: string;
};

/**
 * Polymorphic Button props. `as` selects the rendered element/component
 * (defaults to `'button'`); the remaining props are inferred from that
 * element so `<Button as={Link} href="/">` type-checks anchor props while
 * `<Button disabled onClick>` keeps `ButtonHTMLAttributes`.
 */
type ButtonProps<T extends ElementType = 'button'> = ButtonOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#F9E4E4] text-[#4A3B3B] hover:bg-[#F0D4D4] active:shadow-[0_0_15px_rgba(212,165,165,0.5)] border border-transparent',
  secondary:
    'bg-transparent text-[#4A3B3B] border border-[#D4A5A5] hover:bg-[#FFF5F5]',
  ghost:
    'bg-transparent text-[#4A3B3B] hover:bg-[#FFF5F5] border border-transparent',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

export default function Button<T extends ElementType = 'button'>({
  as,
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps<T>) {
  // Cast to a concrete ElementType so JSX prop checks resolve against a real
  // element signature instead of an unresolved generic `T` (TS 6 can't narrow
  // `ComponentProps<T>` for a generic `T` here). Call-site type safety is
  // preserved by the `ButtonProps<T>` signature above.
  const Component = (as ?? 'button') as ElementType;
  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-sans font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
