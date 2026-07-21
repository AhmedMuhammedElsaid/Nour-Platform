// Radio Suspense fallback — title + station-grid skeleton.
export default function RadioLoading() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12" aria-hidden="true">
      <div className="h-9 w-32 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-1 h-4 w-48 animate-pulse rounded bg-surface-2" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square w-full animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    </section>
  );
}
