import { useEffect } from 'react'

import { useStorefront } from './context.js'

export function useAnalytics({ autoStart = true } = {}) {
  const client = useStorefront()

  useEffect(() => {
    if (!autoStart) return undefined
    client.analytics.start().catch(() => {})
    return undefined
  }, [autoStart, client])

  return client.analytics
}

export function usePageView(properties = {}) {
  const analytics = useAnalytics()
  const propertiesKey = JSON.stringify(properties)

  useEffect(() => {
    analytics.page(properties)
  // propertiesKey intentionally represents the scalar analytics payload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics, propertiesKey])
}
