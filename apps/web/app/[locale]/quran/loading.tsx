// Quran surah-list Suspense fallback — tabs row + surah grid skeleton.
export default function QuranLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 h-4 w-24 animate-pulse rounded bg-surface-2" />
      <div className="mt-6 flex gap-2 border-b border-border pb-2">
        <div className="h-8 w-20 animate-pulse rounded bg-surface-2" />
        <div className="h-8 w-20 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-surface-2" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
