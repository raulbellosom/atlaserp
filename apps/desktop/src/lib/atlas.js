import { createAtlasClient } from '@atlas/sdk'
import { getApiUrl } from './runtimeConfig.js'

export const atlas = createAtlasClient({ baseUrl: getApiUrl() })
