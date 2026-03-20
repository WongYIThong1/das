import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      {/* Number */}
      <p className="select-none text-[10rem] font-black leading-none tracking-tighter text-zinc-100">
        404
      </p>

      {/* Content */}
      <div className="-mt-4 flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Page not found
        </h1>
        <p className="max-w-sm text-sm text-zinc-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-2 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Go home
          </Link>
          <Link
            href="/purchase-invoice"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Purchase invoices
          </Link>
        </div>
      </div>
    </div>
  );
}
