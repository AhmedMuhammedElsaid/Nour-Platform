// Quran surah reader Suspense fallback — header + stacked ayah-line skeleton.
export default function SurahReaderLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8" aria-hidden="true">
      <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
      <header className="mt-4 border-b border-border pb-4 text-center">
        <div className="mx-auto h-9 w-48 animate-pulse rounded-md bg-surface-2" />
        <div className="mx-auto mt-3 h-4 w-40 animate-pulse rounded bg-surface-2" />
        <div className="mx-auto mt-4 h-7 w-64 animate-pulse rounded bg-surface-2" />
      </header>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 w-full animate-pulse rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
