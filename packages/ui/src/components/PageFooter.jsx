import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button.jsx'
import { cn } from '../lib/utils.js'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function PageFooter({
  total = 0,
  pageIndex = 0,
  pageCount = 1,
  pageSize = 10,
  onPrevious,
  onNext,
  canPrevious = false,
  canNext = false,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}) {
  const from = total === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, total)

  return (
    <div className={cn('flex items-center justify-between gap-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 md:px-6', className)}>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {total === 0 ? 'Sin registros' : `${from}–${to} de ${total} registros`}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Por página</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Página anterior"
              onClick={onPrevious}
              disabled={!canPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[4rem] text-center text-xs text-[hsl(var(--muted-foreground))]">
              {pageIndex + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Página siguiente"
              onClick={onNext}
              disabled={!canNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
