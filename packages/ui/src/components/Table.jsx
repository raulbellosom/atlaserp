import { forwardRef } from 'react'
import { cn } from '../lib/utils.js'

const Table = forwardRef(function Table({ className, ...props }, ref) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
})

const TableHeader = forwardRef(function TableHeader({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn('[&_tr]:border-b [&_tr]:border-[hsl(var(--border))]', className)}
      {...props}
    />
  )
})

const TableBody = forwardRef(function TableBody({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
})

const TableFooter = forwardRef(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn(
        'border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  )
})

const TableRow = forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-[hsl(var(--border))] transition-colors',
        'hover:bg-[hsl(var(--muted))]/50',
        'data-[state=selected]:bg-[hsl(var(--muted))]',
        className
      )}
      {...props}
    />
  )
})

const TableHead = forwardRef(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        'h-9 px-4 text-left align-middle font-medium text-[hsl(var(--muted-foreground))]',
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  )
})

const TableCell = forwardRef(function TableCell({ className, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn(
        'px-4 py-3 align-middle',
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  )
})

const TableCaption = forwardRef(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn('mt-4 text-sm text-[hsl(var(--muted-foreground))]', className)}
      {...props}
    />
  )
})

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
