export default function HomePage() {
  return (
    <>
      <header className="bg-white border-b border-zinc-200 px-8 py-5 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-zinc-900 capitalize tracking-tight">Home</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your home efficiently.</p>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full overflow-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-12 min-h-[400px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-6 ring-1 ring-zinc-100">
            <span className="text-3xl grayscale">*</span>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Welcome Back!</h2>
          <p className="text-zinc-500 max-w-md leading-relaxed">
            This is the placeholder content area for the <span className="font-medium text-zinc-900">home</span>{' '}
            section. Select other items from the sidebar to navigate.
          </p>

          <button className="mt-8 px-6 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors shadow-sm">
            Get Started
          </button>
        </div>
      </div>
    </>
  );
}
