import { cn } from '../lib/utils.js'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-[hsl(var(--muted))]',
        className
      )}
      {...props}
    />
  )
}

function FormSkeleton({ sections = 2, cols = 2 }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="space-y-4">
          <div className="pb-3 border-b border-[hsl(var(--border))]">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className={cols === 1 ? 'grid gap-4' : 'grid gap-4 md:grid-cols-2'}>
            {Array.from({ length: cols * 2 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export { Skeleton, FormSkeleton }
