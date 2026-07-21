// Quran bookmarks Suspense fallback — title + grouped-row skeleton.
export default function BookmarksLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8" aria-hidden="true">
      <div className="mb-6 h-9 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 py-3">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-7 w-10 animate-pulse rounded-full bg-surface-2" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
