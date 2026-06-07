import { initAtlasClient } from './atlas.js'
import { initSupabaseClient } from './supabase.js'
import {
  getServerUrl,
  getFallbackServerUrl,
  isTauriRuntime,
  normalizeServerUrl,
  setServerUrl,
} from './serverStore.js'
import { setApiUrl } from './runtimeConfig.js'

const DEFAULT_CONNECTION_ERROR =
  'No se pudo conectar. Verifica la URL e intenta de nuevo.'

export function getServerConnectionErrorMessage(error) {
  if (error?.message === 'INVALID_SERVER_URL') {
    return 'Ingresa una URL valida que comience con http:// o https://.'
  }
  return DEFAULT_CONNECTION_ERROR
}

export async function validateAtlasServer(url) {
  const response = await fetch(`${url}/health`)
  if (!response.ok) {
    throw new Error('SERVER_HEALTH_FAILED')
  }

  const data = await response.json().catch(() => null)
  if (data?.status !== 'ok') {
    throw new Error('SERVER_HEALTH_INVALID')
  }
}

export async function initializeRuntimeForServer(url) {
  const normalizedUrl = normalizeServerUrl(url)
  if (!normalizedUrl) {
    throw new Error('INVALID_SERVER_URL')
  }

  setApiUrl(normalizedUrl)
  initAtlasClient(normalizedUrl)
  await initSupabaseClient({ baseUrl: normalizedUrl, forceReload: true })
  return normalizedUrl
}

export async function bootstrapDesktopRuntime() {
  const storedUrl = await getServerUrl()
  if (storedUrl) {
    try {
      const serverUrl = await initializeRuntimeForServer(storedUrl)
      return { initialServerUrl: serverUrl, requiresServerSetup: false, bootstrapError: '' }
    } catch {
      return {
        initialServerUrl: storedUrl,
        requiresServerSetup: true,
        bootstrapError: DEFAULT_CONNECTION_ERROR,
      }
    }
  }

  const fallbackUrl = getFallbackServerUrl()
  if (!isTauriRuntime() && fallbackUrl) {
    await initializeRuntimeForServer(fallbackUrl)
    return { initialServerUrl: fallbackUrl, requiresServerSetup: false, bootstrapError: '' }
  }

  return {
    initialServerUrl: null,
    requiresServerSetup: true,
    bootstrapError: '',
  }
}

export async function connectToAtlasServer(rawUrl) {
  const normalizedUrl = normalizeServerUrl(rawUrl)
  if (!normalizedUrl) {
    throw new Error('INVALID_SERVER_URL')
  }

  await validateAtlasServer(normalizedUrl)
  await initializeRuntimeForServer(normalizedUrl)
  await setServerUrl(normalizedUrl)
  return normalizedUrl
}
