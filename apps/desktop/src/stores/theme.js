import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useThemeStore = create(
  persist(
    (set, get) => ({
      isDark: false,
      toggle() {
        const next = !get().isDark;
        const root = document.documentElement;
        // Many components use transition-colors for hover states; that same
        // transition fires on the theme swap too, and since not every
        // element shares the same duration, the swap reads as a staggered
        // lag (most visible on borders). Suppress transitions for one paint.
        root.classList.add("theme-transitioning-off");
        root.classList.toggle("dark", next);
        set({ isDark: next });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            root.classList.remove("theme-transitioning-off");
          });
        });
      },
      init() {
        document.documentElement.classList.toggle("dark", get().isDark);
      },
    }),
    { name: "atlas-theme" },
  ),
);
