import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../lib/utils.js'

const alertVariants = cva(
  'relative w-full rounded-xl border p-4 backdrop-blur-sm shadow-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
  {
    variants: {
      variant: {
        default:
          'border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 text-[hsl(var(--foreground))] [&>svg]:text-[hsl(var(--foreground))]',
        destructive:
          'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200 [&>svg]:text-red-600 dark:[&>svg]:text-red-300',
        warning:
          'border-amber-400/50 bg-amber-400/10 text-amber-800 dark:text-amber-200 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300',
        success:
          'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 [&>svg]:text-emerald-700 dark:[&>svg]:text-emerald-300',
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
