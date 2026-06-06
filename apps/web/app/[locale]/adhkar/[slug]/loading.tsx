// Adhkar reading-view Suspense fallback — dhikr card skeleton.
export default function AdhkarReadingLoading() {
  return (
    <div
      className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6"
      aria-hidden="true"
    >
      {/* Header: title + count */}
      <div className="flex items-baseline justify-between gap-4">
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-surface-2" />
        <div className="h-4 w-10 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full animate-pulse rounded-full bg-surface-2" />

      {/* Dhikr card */}
      <div className="flex flex-col items-center gap-5 rounded-lg border border-border bg-surface p-6">
        <div className="h-6 w-16 animate-pulse rounded-full bg-surface-2" />
        <div className="h-24 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="size-40 animate-pulse rounded-full bg-surface-2" />
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between gap-4">
        <div className="h-9 w-24 animate-pulse rounded-md bg-surface-2" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-surface-2" />
      </div>
    </div>
  );
}
