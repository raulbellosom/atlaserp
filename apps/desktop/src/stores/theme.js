import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useThemeStore = create(
  persist(
    (set, get) => ({
      isDark: false,
      toggle() {
        const next = !get().isDark;
        document.documentElement.classList.toggle("dark", next);
        set({ isDark: next });
      },
      init() {
        document.documentElement.classList.toggle("dark", get().isDark);
      },
    }),
    { name: "atlas-theme" },
  ),
);
