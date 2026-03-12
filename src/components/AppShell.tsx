'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
