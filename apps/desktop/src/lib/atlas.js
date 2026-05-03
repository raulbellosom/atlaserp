import { createAtlasClient } from '@atlas/sdk'

const apiUrl = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
export const atlas = createAtlasClient({ baseUrl: apiUrl })
