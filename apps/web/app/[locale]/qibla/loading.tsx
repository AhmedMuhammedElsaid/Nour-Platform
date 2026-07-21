// Qibla Suspense fallback — title + compass-card skeleton.
export default function QiblaLoading() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12" aria-hidden="true">
      <div className="h-9 w-28 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-1 h-4 w-40 animate-pulse rounded bg-surface-2" />
      <div className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-6">
        <div className="mx-auto h-56 w-56 animate-pulse rounded-full bg-surface-2" />
        <div className="mx-auto mt-4 h-6 w-32 animate-pulse rounded bg-surface-2" />
        <div className="mx-auto mt-2 h-4 w-24 animate-pulse rounded bg-surface-2" />
      </div>
    </section>
  );
}
