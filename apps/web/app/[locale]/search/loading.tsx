// Search results Suspense fallback.
export default function SearchLoading() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-10" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-5 w-full animate-pulse rounded bg-surface-2" />
        ))}
      </div>
    </section>
  );
}
