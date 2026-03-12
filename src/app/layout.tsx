import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ClientProviders from '../components/ClientProviders';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Accounting Workspace',
  description: 'TechCorp ledger and account book management.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-zinc-50 font-sans text-zinc-900">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
