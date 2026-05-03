import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../lib/utils.js'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-500 text-white shadow-sm hover:bg-indigo-600 active:scale-[0.98]',
        secondary:
          'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 active:scale-[0.98]',
        ghost:
          'hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] active:scale-[0.98]',
        destructive:
          'bg-red-500 text-white shadow-sm hover:bg-red-600 active:scale-[0.98]',
        outline:
          'border border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--muted))] active:scale-[0.98]',
        glass:
          'glass text-[hsl(var(--foreground))] hover:brightness-110 active:scale-[0.98]',
        'glass-prominent':
          'glass-tinted text-indigo-500 dark:text-indigo-400 font-semibold hover:brightness-110 active:scale-[0.98]',
        link:
          'text-indigo-500 dark:text-indigo-400 underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-6 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = forwardRef(function Button(
  { className, variant, size, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})

export { Button, buttonVariants }
