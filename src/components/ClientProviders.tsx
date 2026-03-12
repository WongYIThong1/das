'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from './AuthProvider';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="top-right"
        offset={16}
        richColors={false}
        toastOptions={{
          className: 'rounded-xl bg-white text-zinc-900 border border-zinc-200 shadow-lg',
          closeButton: false,
        }}
      />
    </AuthProvider>
  );
}
