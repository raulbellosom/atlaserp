import { cn } from '../lib/utils.js'

// `value` in [0, 100]. `value = null` renders an indeterminate (striped,
// animated) bar for phases where the total isn't known yet.
function ProgressBar({ value = null, className, barClassName, ...props }) {
  const clamped = typeof value === 'number' ? Math.min(100, Math.max(0, value)) : null

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]',
        className
      )}
      {...props}
    >
      {clamped === null ? (
        <div className="h-full w-full animate-pulse rounded-full bg-[hsl(var(--ring))]" />
      ) : (
        <div
          className={cn('h-full rounded-full bg-[hsl(var(--ring))] transition-[width] duration-300', barClassName)}
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  )
}

export { ProgressBar }
