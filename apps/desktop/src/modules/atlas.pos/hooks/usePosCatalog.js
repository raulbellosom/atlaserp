import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosCatalogCategories() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'catalog', 'categories'],
    queryFn: () => atlas.catalog.listCategories(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

export function usePosCatalogProducts(params = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'catalog', 'products', params],
    queryFn: () => atlas.catalog.listProducts(token, params),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
