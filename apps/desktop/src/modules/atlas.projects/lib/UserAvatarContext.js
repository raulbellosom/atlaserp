import { createContext, useContext } from 'react'

export const UserAvatarContext = createContext(null)

export function useUserAvatarUrl(userId) {
  const map = useContext(UserAvatarContext)
  return (userId && map?.get(userId)) ?? null
}
