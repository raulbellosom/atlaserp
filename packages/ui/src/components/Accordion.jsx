import { forwardRef } from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils.js'

const Accordion = AccordionPrimitive.Root

const AccordionItem = forwardRef(function AccordionItem({ className, ...props }, ref) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn('border border-[hsl(var(--border))] rounded-xl overflow-hidden', className)}
      {...props}
    />
  )
})

const AccordionTrigger = forwardRef(function AccordionTrigger({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex flex-1 items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
          'hover:bg-[hsl(var(--muted))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0',
          '[&[data-state=open]>svg]:rotate-180',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
})

const AccordionContent = forwardRef(function AccordionContent({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn('px-3 pb-3 pt-0.5', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
})

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
