import { create } from "zustand";

export const useCommandStore = create((set) => ({
  isOpen: false,
  openCommand: () => set({ isOpen: true }),
  closeCommand: () => set({ isOpen: false }),
}));
