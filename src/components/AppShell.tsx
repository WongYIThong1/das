'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar with hamburger */}
        <div className="flex h-12 items-center border-b border-zinc-200 bg-white px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100"
          >
            <Menu size={18} />
          </button>
          <span className="ml-3 text-sm font-semibold text-zinc-900">365BIZ AI</span>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
