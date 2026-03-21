import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ClientProviders from '../components/ClientProviders';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: '365BIZ AI — AI Accounting System',
    template: '%s | 365BIZ AI',
  },
  description:
    'Smart AI-powered accounting system. Scan invoices, auto-match creditors and stock items, and submit directly to your accounting software — all in seconds.',
  keywords: [
    'AI accounting',
    'invoice scanning',
    'purchase invoice',
    'OCR invoice',
    'accounts payable automation',
    'AI bookkeeping',
    '365BIZ',
  ],
  authors: [{ name: '365BIZ' }],
  creator: '365BIZ',
  metadataBase: new URL('https://dash.my365biz.com'),
  openGraph: {
    title: '365BIZ AI — AI Accounting System',
    description:
      'Snap a photo, let AI read your invoice, auto-fill creditor & stock details, and post to your accounts — faster than any manual entry.',
    siteName: '365BIZ AI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '365BIZ AI — AI Accounting System',
    description:
      'Snap a photo, let AI read your invoice, auto-fill creditor & stock details, and post to your accounts — faster than any manual entry.',
  },
  robots: {
    index: false,
    follow: false,
  },
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
