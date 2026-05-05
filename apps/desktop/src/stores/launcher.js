import { create } from "zustand";

export const useLauncherStore = create((set) => ({
  isOpen: false,
  openLauncher: () => set({ isOpen: true }),
  closeLauncher: () => set({ isOpen: false }),
  toggleLauncher: () => set((s) => ({ isOpen: !s.isOpen })),
}));
