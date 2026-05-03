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
          'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 [&>svg]:text-red-600 dark:[&>svg]:text-red-400',
        warning:
          'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-400',
        success:
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 [&>svg]:text-emerald-700 dark:[&>svg]:text-emerald-400',
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
      className={cn('text-sm [&_p]:leading-relaxed opacity-90', className)}
      {...props}
    />
  )
})

export { Alert, AlertTitle, AlertDescription }
