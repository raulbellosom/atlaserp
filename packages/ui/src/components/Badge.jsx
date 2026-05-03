import { cva } from 'class-variance-authority'
import { cn } from '../lib/utils.js'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[--color-primary] text-white',
        secondary:
          'border-transparent bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
        destructive:
          'border-transparent bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
        success:
          'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        warning:
          'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
        outline:
          'border-[hsl(var(--border))] text-[hsl(var(--foreground))] bg-transparent',
        glass:
          'glass-tinted text-[--color-primary] border-indigo-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
