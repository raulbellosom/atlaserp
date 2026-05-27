import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../lib/utils.js'

const alertVariants = cva(
  'relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-[hsl(var(--foreground))]',
  {
    variants: {
      variant: {
        default: 'glass text-[hsl(var(--foreground))]',
        destructive:
          'border-red-500/50 bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-200 [&>svg]:text-red-900 dark:[&>svg]:text-red-200',
        warning:
          'border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 [&>svg]:text-amber-900 dark:[&>svg]:text-amber-200',
        success:
          'border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 [&>svg]:text-emerald-900 dark:[&>svg]:text-emerald-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Alert = forwardRef(function Alert({ className, variant, ...props }, ref) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
})

const AlertTitle = forwardRef(function AlertTitle({ className, ...props }, ref) {
  return (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight text-sm', className)}
      {...props}
    />
  )
})

const AlertDescription = forwardRef(function AlertDescription({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
})

export { Alert, AlertTitle, AlertDescription }
