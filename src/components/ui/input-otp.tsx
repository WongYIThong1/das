'use client';

import React, { createContext, useContext, useMemo } from 'react';

type InputOTPContextValue = {
  value: string;
  maxLength: number;
  setValue: (value: string) => void;
};

const InputOTPContext = createContext<InputOTPContextValue | null>(null);

function useInputOTPContext() {
  const context = useContext(InputOTPContext);
  if (!context) {
    throw new Error('InputOTP components must be used within <InputOTP>.');
  }
  return context;
}

type InputOTPProps = {
  maxLength: number;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  defaultValue?: string;
};

export function InputOTP({ maxLength, value, onChange, children }: InputOTPProps) {
  const contextValue = useMemo<InputOTPContextValue>(
    () => ({
      value,
      maxLength,
      setValue: (nextValue: string) => {
        onChange(nextValue.replace(/\D/g, '').slice(0, maxLength));
      },
    }),
    [maxLength, onChange, value]
  );

  return (
    <InputOTPContext.Provider value={contextValue}>
      <div className="w-full">{children}</div>
    </InputOTPContext.Provider>
  );
}

export function InputOTPGroup({ children }: { children: React.ReactNode }) {
  const { maxLength } = useInputOTPContext();
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${maxLength}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

export function InputOTPSlot({ index }: { index: number }) {
  const { value, maxLength, setValue } = useInputOTPContext();
  const char = value[index] ?? '';

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete={index === 0 ? 'one-time-code' : 'off'}
      maxLength={1}
      value={char}
      onChange={(event) => {
        const digit = event.target.value.replace(/\D/g, '').slice(-1);
        const chars = value.split('');
        chars[index] = digit;
        setValue(chars.join('').slice(0, maxLength));

        if (digit) {
          const next = document.querySelector<HTMLInputElement>(`[data-otp-slot="${index + 1}"]`);
          next?.focus();
          next?.select();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Backspace' && !char) {
          const prev = document.querySelector<HTMLInputElement>(`[data-otp-slot="${index - 1}"]`);
          prev?.focus();
          prev?.select();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, maxLength);
        if (!pasted) {
          return;
        }
        setValue(pasted);
        const focusIndex = Math.min(pasted.length, maxLength - 1);
        const target = document.querySelector<HTMLInputElement>(`[data-otp-slot="${focusIndex}"]`);
        target?.focus();
        target?.select();
      }}
      data-otp-slot={index}
      className="h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 text-center text-xl font-semibold text-zinc-950 outline-none transition focus:border-zinc-950 focus:bg-white focus:ring-4 focus:ring-zinc-950/5"
    />
  );
}
