import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  // Read shared monorepo env vars from repository root (.env, .env.local, etc.).
  envDir: "../..",
  plugins: [tailwindcss(), react()],
  resolve: {
    // Prevents duplicate React instances across chunks (e.g. workspace packages
    // that list react in devDependencies). Without this, Rollup's auto-splitting
    // can place React in a cross-chunk reference cycle where e.useRef is accessed
    // before the React module finishes initializing (null reference crash).
    dedupe: ["react", "react-dom"],
    alias: {
      "node:crypto": resolve(__dirname, "src/shims/node-crypto.js"),
      "@atlas/core": resolve(__dirname, "../../packages/core/src/index.js"),
      "@atlas/module-engine": resolve(__dirname, "../../packages/module-engine/src/index.js"),
      "@atlas/sdk": resolve(__dirname, "../../packages/sdk/src/index.js"),
      "@atlas/ui": resolve(__dirname, "../../packages/ui/src/index.js"),
      "@atlas/validators": resolve(
        __dirname,
        "../../packages/validators/src/index.js",
      ),
      // Ensure non-hoisted packages used by modules/custom/* components resolve
      // to the desktop app's installation, not a missing root-level location.
      "react-router-dom": resolve(__dirname, "node_modules/react-router-dom"),
      "@tanstack/react-query": resolve(__dirname, "node_modules/@tanstack/react-query"),
      "sonner": resolve(__dirname, "node_modules/sonner"),
      "lucide-react": resolve(__dirname, "node_modules/lucide-react"),
      "recharts": resolve(__dirname, "node_modules/recharts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Put React into its own chunk so it initializes before all other chunks.
        // Without this, Rollup's auto-splitting can create a circular reference
        // between the main chunk and AuthProvider's chunk, causing React to be
        // accessed as null on the first render in production.
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("/node_modules/@supabase/")) {
            return "supabase-vendor";
          }
          if (
            id.includes("/node_modules/@tanstack/") ||
            id.includes("/node_modules/zustand/")
          ) {
            return "state-vendor";
          }
          if (
            id.includes("/node_modules/@radix-ui/") ||
            id.includes("/node_modules/@tiptap/") ||
            id.includes("/node_modules/lucide-react/") ||
            id.includes("/node_modules/sonner/")
          ) {
            return "ui-vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
});
