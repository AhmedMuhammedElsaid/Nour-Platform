// Prayer times Suspense fallback — countdown + arc + timetable skeleton.
export default function PrayerTimesLoading() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 h-40 w-full animate-pulse rounded-xl bg-surface-2" />
      <div className="mt-6 h-8 w-48 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="size-8 animate-pulse rounded-md bg-surface-2" />
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-14 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </section>
  );
}
