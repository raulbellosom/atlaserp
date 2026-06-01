import { createContext, useContext, createElement } from 'react'

export const StorefrontContext = createContext(null)

export function StorefrontProvider({ client, children }) {
  if (!client) throw new Error('StorefrontProvider: la prop "client" es requerida')
  return createElement(StorefrontContext.Provider, { value: client }, children)
}

export function useStorefront() {
  const client = useContext(StorefrontContext)
  if (!client) throw new Error('useStorefront debe usarse dentro de <StorefrontProvider>')
  return client
}
