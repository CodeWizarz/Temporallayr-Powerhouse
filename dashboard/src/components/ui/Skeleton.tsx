interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = 'h-4 w-full', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`bg-[var(--bg-elevated)] rounded animate-pulse ${className}`} />
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
