import { create } from 'zustand'

export const useBrandingStore = create((set) => ({
  /** null while loading, object once resolved */
  branding: null,
  setBranding: (data) => set({ branding: data }),
}))
