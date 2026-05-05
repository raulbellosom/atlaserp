import { cn } from '../lib/utils.js'
import { Skeleton } from './Skeleton.jsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

export function StatCard({ label, value, icon: Icon, trend, loading, className }) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          {label}
        </p>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
            <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </div>
        )}
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <p className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">{value}</p>
        )}
      </div>
      {trend != null && !loading && (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
          {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  )
}
