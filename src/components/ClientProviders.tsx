'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from './AuthProvider';
import { SubmitProvider } from './SubmitProvider';
import SubmitProgressModal from './SubmitProgressModal';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SubmitProvider>
        {children}
        <SubmitProgressModal />
        <Toaster
          position="top-right"
          offset={16}
          richColors={false}
          toastOptions={{
            className: 'rounded-xl bg-white text-zinc-900 border border-zinc-200 shadow-lg',
            closeButton: false,
          }}
        />
      </SubmitProvider>
    </AuthProvider>
  );
}
