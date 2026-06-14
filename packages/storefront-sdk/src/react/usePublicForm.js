import { useCallback, useEffect, useState } from 'react'

import { useStorefront } from './context.js'

export function usePublicForm(formId) {
  const client = useStorefront()
  const [form, setForm] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(formId))
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!formId) {
      setForm(null)
      setIsLoading(false)
      return undefined
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    client.analytics.start()
      .catch(() => null)
      .then(() => client.forms.get(formId))
      .then((data) => {
        if (!cancelled) setForm(data)
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [client, formId])

  const submit = useCallback(async (values, options = {}) => {
    if (!formId) throw new Error('usePublicForm: formId es requerido')
    setIsSubmitting(true)
    setError(null)
    try {
      const submission = await client.forms.submit(formId, values, options)
      setResult(submission)
      return submission
    } catch (submitError) {
      setError(submitError)
      throw submitError
    } finally {
      setIsSubmitting(false)
    }
  }, [client, formId])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return {
    form,
    result,
    error,
    isLoading,
    isSubmitting,
    submit,
    reset,
  }
}
