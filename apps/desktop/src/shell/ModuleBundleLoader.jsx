import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { componentRegistry } from '../lib/moduleComponentRegistry'
import { atlas } from '../lib/atlas'
import { useAuth } from '../auth/AuthProvider'
import { getApiUrl } from '../lib/runtimeConfig.js'

async function loadModuleBundles(blueprints) {
  const seen = new Set()
  const modulesWithBundles = []

  for (const bp of blueprints) {
    const key = bp.module?.key
    const hasBundle = bp.module?.has_bundle
    if (key && hasBundle && !seen.has(key)) {
      seen.add(key)
      const bundleVersion =
        bp.module?.bundle_hash ??
        bp.module?.bundleHash ??
        bp.module?.updated_at ??
        bp.module?.updatedAt ??
        bp.module?.version ??
        null
      modulesWithBundles.push({ key, bundleVersion })
    }
  }

  const results = await Promise.all(
    modulesWithBundles.map(async ({ key, bundleVersion }) => {
      const bundleUrl = new URL(`${getApiUrl()}/modules/${key}/bundle.js`)
      bundleUrl.searchParams.set('web_origin', window.location.origin)
      // Bust stale browser module cache entries after runtime rewriting changes.
      bundleUrl.searchParams.set('v', String(bundleVersion ?? Date.now()))
      try {
        const mod = await import(/* @vite-ignore */ bundleUrl.toString())
        if (typeof mod.register === 'function') {
          await mod.register(componentRegistry)
        }
        return { key, loaded: true }
      } catch (err) {
        console.error(`[ModuleBundleLoader] failed to load bundle for ${key}:`, err.message)
        return { key, loaded: false }
      }
    })
  )

  return results
}

export function ModuleBundleLoader({ children }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const loadedRef = useRef(new Set())

  const { data: blueprintData } = useQuery({
    queryKey: ['blueprints', token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!blueprintData?.data) return
    const toLoad = blueprintData.data.filter(
      (bp) => bp.module?.has_bundle && bp.module?.key && !loadedRef.current.has(bp.module.key)
    )
    if (!toLoad.length) return
    let cancelled = false

    ;(async () => {
      const results = await loadModuleBundles(toLoad)
      if (cancelled) return
      for (const result of results) {
        if (result?.loaded) {
          loadedRef.current.add(result.key)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [blueprintData])

  return children
}
