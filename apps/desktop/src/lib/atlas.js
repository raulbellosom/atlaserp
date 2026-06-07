import { createAtlasClient } from '@atlas/sdk'
import { getApiUrl, setApiUrl } from './runtimeConfig.js'

let currentAtlasClient = null

export function initAtlasClient(url) {
  if (url) {
    setApiUrl(url)
  }
  currentAtlasClient = createAtlasClient({ baseUrl: getApiUrl() })
  return currentAtlasClient
}

export function getAtlasClient() {
  if (!currentAtlasClient) {
    currentAtlasClient = createAtlasClient({ baseUrl: getApiUrl() })
  }
  return currentAtlasClient
}

export const atlas = new Proxy(
  {},
  {
    get(_target, prop) {
      return Reflect.get(getAtlasClient(), prop)
    },
  },
)
