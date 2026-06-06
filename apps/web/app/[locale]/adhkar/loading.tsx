// Adhkar landing page Suspense fallback — skeleton grid mirroring the azkar cards.
export default function AdhkarLoading() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16" aria-hidden="true">
      <div className="h-4 w-24 animate-pulse rounded bg-surface-2 mb-2" />
      <div className="h-9 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="h-4 w-64 animate-pulse rounded bg-surface-2 mt-2" />
      <hr className="border-border my-8" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-surface p-4 space-y-3"
          >
            <div className="h-12 w-12 animate-pulse rounded-xl bg-surface-2" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-2" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-surface-2" />
            <div className="h-1 w-full animate-pulse rounded-full bg-surface-2" />
          </div>
        ))}
      </div>
    </section>
  );
}
