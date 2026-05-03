import { createContext, forwardRef, useContext, useId } from 'react'
import { Controller, FormProvider, useFormContext } from 'react-hook-form'
import { Label } from './Label.jsx'
import { cn } from '../lib/utils.js'

const Form = FormProvider

const FormFieldContext = createContext({})

function FormField({ ...props }) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

function useFormField() {
  const fieldContext = useContext(FormFieldContext)
  const itemContext = useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField must be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

const FormItemContext = createContext({})

const FormItem = forwardRef(function FormItem({ className, ...props }, ref) {
  const id = useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn('space-y-1.5', className)} {...props} />
    </FormItemContext.Provider>
  )
})

const FormLabel = forwardRef(function FormLabel({ className, ...props }, ref) {
  const { error, formItemId } = useFormField()
  return (
    <Label
      ref={ref}
      className={cn(error && 'text-red-500', className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})

const FormControl = forwardRef(function FormControl({ ...props }, ref) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  return (
    <div
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  )
})

const FormDescription = forwardRef(function FormDescription({ className, ...props }, ref) {
  const { formDescriptionId } = useFormField()
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn('text-xs text-[hsl(var(--muted-foreground))]', className)}
      {...props}
    />
  )
})

const FormMessage = forwardRef(function FormMessage({ className, children, ...props }, ref) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? '') : children

  if (!body) return null

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn('text-xs font-medium text-red-500', className)}
      {...props}
    >
      {body}
    </p>
  )
})

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField }
