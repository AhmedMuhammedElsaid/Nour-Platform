// Homepage Suspense fallback — a skeleton grid that mirrors the playlist cards.
export default function HomeLoading() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16" aria-hidden="true">
      <div className="h-9 w-48 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 animate-pulse rounded-full bg-surface-2"
          />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-square w-full animate-pulse rounded-lg bg-surface-2" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </section>
  );
}
