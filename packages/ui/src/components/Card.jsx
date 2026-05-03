import { forwardRef } from 'react'
import { cn } from '../lib/utils.js'

const Card = forwardRef(function Card({ className, variant = 'default', ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl',
        variant === 'default' && 'glass',
        variant === 'solid' && 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm',
        variant === 'bordered' && 'border border-[hsl(var(--border))] bg-transparent',
        className
      )}
      {...props}
    />
  )
})

const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
  )
})

const CardTitle = forwardRef(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn('text-base font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  )
})

const CardDescription = forwardRef(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn('text-sm text-[hsl(var(--muted-foreground))]', className)}
      {...props}
    />
  )
})

const CardContent = forwardRef(function CardContent({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
})

const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
})

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
