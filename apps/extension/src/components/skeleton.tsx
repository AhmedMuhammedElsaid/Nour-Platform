type SkeletonProps = {
  className?: string;
};

// Static placeholder block for newtab loading states — same
// `animate-pulse bg-surface-2` recipe as the web `loading.tsx` fallbacks
// (tokens match 1:1, see apps/extension/src/styles/tailwind.css).
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}
