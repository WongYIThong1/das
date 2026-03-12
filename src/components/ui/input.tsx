'use client';

import * as React from 'react';

type InputProps = React.ComponentProps<'input'>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', type = 'text', ...props },
  ref
) {
  return (
    <input
      type={type}
      ref={ref}
      className={[
        'flex h-9 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-900 shadow-xs transition-[color,box-shadow,border-color]',
        'outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-zinc-400 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200',
        'aria-invalid:border-red-300 aria-invalid:ring-red-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
});
