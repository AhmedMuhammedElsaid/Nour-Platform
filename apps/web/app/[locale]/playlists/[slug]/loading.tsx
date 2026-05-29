// Playlist detail Suspense fallback — header + track-row skeletons.
export default function PlaylistLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10" aria-hidden="true">
      <div className="h-10 w-2/3 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-surface-2" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="h-4 w-6 animate-pulse rounded bg-surface-2" />
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-10 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
