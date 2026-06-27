import { createClient } from '@supabase/supabase-js'
import { ATLAS_PUBLIC_DESKTOP_CONFIG_PATH } from './appConfig.js'
import { getApiUrl, runtimeConfig } from './runtimeConfig.js'

let currentSupabaseClient = null
let currentSupabaseKey = null

function getFallbackSupabaseConfig() {
  const url = runtimeConfig.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
  const anonKey =
    runtimeConfig.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null
  return { url, anonKey }
}

async function fetchSupabaseConfigFromServer(baseUrl = getApiUrl()) {
  const response = await fetch(`${baseUrl}${ATLAS_PUBLIC_DESKTOP_CONFIG_PATH}`)
  if (!response.ok) {
    throw new Error('SUPABASE_CONFIG_FETCH_FAILED')
  }

  const payload = await response.json().catch(() => null)
  const url = payload?.data?.supabaseUrl
  const anonKey = payload?.data?.supabaseAnonKey

  if (!url || !anonKey) {
    throw new Error('SUPABASE_CONFIG_MISSING')
  }

  return { url, anonKey }
}

export async function initSupabaseClient({
  baseUrl = getApiUrl(),
  forceReload = false,
  config = null,
} = {}) {
  const isTauriRuntime =
    typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)

  let resolvedConfig = config
  if (!resolvedConfig && isTauriRuntime) {
    resolvedConfig = await fetchSupabaseConfigFromServer(baseUrl)
  }
  if (!resolvedConfig) {
    resolvedConfig = getFallbackSupabaseConfig()
  }
  if (!resolvedConfig) {
    resolvedConfig = await fetchSupabaseConfigFromServer(baseUrl)
  }

  const nextKey = `${resolvedConfig.url}::${resolvedConfig.anonKey}`
  if (!forceReload && currentSupabaseClient && currentSupabaseKey === nextKey) {
    return currentSupabaseClient
  }

  currentSupabaseClient = createClient(resolvedConfig.url, resolvedConfig.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  currentSupabaseKey = nextKey
  return currentSupabaseClient
}

export function getSupabaseClient() {
  if (!currentSupabaseClient) {
    const fallbackConfig = getFallbackSupabaseConfig()
    if (!fallbackConfig) {
      throw new Error(
        'Missing Supabase config. In dev: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env. In Docker: set SUPABASE_URL and SUPABASE_ANON_KEY env vars on the container.',
      )
    }

    currentSupabaseClient = createClient(fallbackConfig.url, fallbackConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
    currentSupabaseKey = `${fallbackConfig.url}::${fallbackConfig.anonKey}`
  }

  return currentSupabaseClient
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      return Reflect.get(getSupabaseClient(), prop)
    },
  },
)
