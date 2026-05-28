import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { componentRegistry } from '../lib/moduleComponentRegistry'
import { atlas } from '../lib/atlas'
import { useAuth } from '../auth/AuthProvider'

const apiBase = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

async function loadModuleBundles(blueprints) {
  const seen = new Set()
  const modulesWithBundles = []

  for (const bp of blueprints) {
    const key = bp.module?.key
    const hasBundle = bp.module?.has_bundle
    if (key && hasBundle && !seen.has(key)) {
      seen.add(key)
      modulesWithBundles.push(key)
    }
  }

  await Promise.all(
    modulesWithBundles.map(async (key) => {
      const bundleUrl = `${apiBase}/modules/${key}/bundle.js`
      try {
        const mod = await import(/* @vite-ignore */ bundleUrl)
        if (typeof mod.register === 'function') {
          await mod.register(componentRegistry)
        }
      } catch (err) {
        console.error(`[ModuleBundleLoader] failed to load bundle for ${key}:`, err.message)
      }
    })
  )
}

export function ModuleBundleLoader({ children }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { data: blueprintData } = useQuery({
    queryKey: ['blueprints', token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!blueprintData?.data) return
    loadModuleBundles(blueprintData.data)
  }, [blueprintData])

  return children
}
