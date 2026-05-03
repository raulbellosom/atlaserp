import { forwardRef } from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '../lib/utils.js'

const Breadcrumb = forwardRef(function Breadcrumb({ ...props }, ref) {
  return <nav ref={ref} aria-label="breadcrumb" {...props} />
})

const BreadcrumbList = forwardRef(function BreadcrumbList({ className, ...props }, ref) {
  return (
    <ol
      ref={ref}
      className={cn(
        'flex flex-wrap items-center gap-1.5 break-words text-sm text-[hsl(var(--muted-foreground))]',
        className
      )}
      {...props}
    />
  )
})

const BreadcrumbItem = forwardRef(function BreadcrumbItem({ className, ...props }, ref) {
  return (
    <li ref={ref} className={cn('inline-flex items-center gap-1.5', className)} {...props} />
  )
})

const BreadcrumbLink = forwardRef(function BreadcrumbLink({ className, asChild, ...props }, ref) {
  return (
    <a
      ref={ref}
      className={cn('transition-colors hover:text-[hsl(var(--foreground))]', className)}
      {...props}
    />
  )
})

const BreadcrumbPage = forwardRef(function BreadcrumbPage({ className, ...props }, ref) {
  return (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-medium text-[hsl(var(--foreground))]', className)}
      {...props}
    />
  )
})

const BreadcrumbSeparator = function BreadcrumbSeparator({ children, className, ...props }) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:h-3.5 [&>svg]:w-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  )
}

const BreadcrumbEllipsis = function BreadcrumbEllipsis({ className, ...props }) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
