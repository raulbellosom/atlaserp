import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Read shared monorepo env vars from repository root (.env, .env.local, etc.).
  envDir: "../..",
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@atlas/core": resolve(__dirname, "../../packages/core/src/index.js"),
      "@atlas/maps": resolve(__dirname, "../../packages/maps/src/index.js"),
      "@atlas/sdk": resolve(__dirname, "../../packages/sdk/src/index.js"),
      "@atlas/ui": resolve(__dirname, "../../packages/ui/src/index.js"),
      "@atlas/validators": resolve(
        __dirname,
        "../../packages/validators/src/index.js",
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
});
