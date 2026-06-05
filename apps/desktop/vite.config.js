import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Bare specifiers that AME3 module bundles declare as external (must stay in sync
// with BUNDLE_EXTERNALS in apps/api/src/services/module-bundler-service.js).
// The importmap plugins below map these specifiers to URLs the browser can resolve
// both in dev (Vite /@id/ virtual modules) and in production (shim entry files).
const MODULE_EXTERNALS_IMPORTMAP = {
  "react":                  "ext-react",
  "react-dom":              "ext-react-dom",
  "react/jsx-runtime":      "ext-react-jsx-runtime",
  "react/jsx-dev-runtime":  "ext-react-jsx-dev-runtime",
  "@tanstack/react-query":  "ext-tanstack-react-query",
  "zustand":                "ext-zustand",
  "@atlas/ui":              "ext-atlas-ui",
  "@atlas/sdk":             "ext-atlas-sdk",
  "@atlas/validators":      "ext-atlas-validators",
  "react-router-dom":       "ext-react-router-dom",
  "sonner":                 "ext-sonner",
  "lucide-react":           "ext-lucide-react",
  "recharts":               "ext-recharts",
};

// Dev-mode: inject importmap that resolves bare specifiers via Vite's /@id/ virtual
// module system.  Only the dynamically-loaded AME3 bundles use this importmap;
// Vite-processed source files have their imports transformed at serve time.
function atlasDevImportmapPlugin() {
  return {
    name: "atlas-module-externals-importmap-dev",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      handler() {
        const imports = Object.fromEntries(
          Object.keys(MODULE_EXTERNALS_IMPORTMAP).map((specifier) => [
            specifier,
            `/@id/${specifier}`,
          ]),
        );
        return [
          {
            tag: "script",
            attrs: { type: "importmap" },
            children: JSON.stringify({ imports }),
            injectTo: "head-prepend",
          },
        ];
      },
    },
  };
}

// Build-mode: inject importmap that resolves bare specifiers to the shim JS files
// baked into the production build at shims/ext-*.js (non-hashed paths for
// predictable importmap entries).
function atlasBuildImportmapPlugin() {
  let resolvedBasePath = "";
  return {
    name: "atlas-module-externals-importmap-build",
    apply: "build",
    configResolved(config) {
      resolvedBasePath = (config.base ?? "/").replace(/\/$/, "");
    },
    transformIndexHtml: {
      order: "pre",
      handler() {
        const basePath = resolvedBasePath || "";
        const imports = Object.fromEntries(
          Object.entries(MODULE_EXTERNALS_IMPORTMAP).map(
            ([specifier, shimName]) => [
              specifier,
              `${basePath}/shims/${shimName}.js`,
            ],
          ),
        );
        return [
          {
            tag: "script",
            attrs: { type: "importmap" },
            children: JSON.stringify({ imports }),
            injectTo: "head-prepend",
          },
        ];
      },
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  // Read shared monorepo env vars from repository root (.env, .env.local, etc.).
  envDir: "../..",
  plugins: [
    tailwindcss(),
    react(),
    atlasDevImportmapPlugin(),
    atlasBuildImportmapPlugin(),
  ],
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
      // 'allow-extension' tells Rolldown/Rollup: preserve every export declared in
      // entry modules, even if no other module in the build graph imports it.
      // Without this, Rolldown tree-shakes exports like `Alert` from the atlas-ui
      // chunk when the main app never imports them directly — the shim's
      // `export * from '@atlas/ui'` then appears to provide no such export at
      // runtime, breaking AME3 module bundles that use those components.
      preserveEntrySignatures: "allow-extension",
      input: {
        index: resolve(__dirname, "index.html"),
        // Shim entry points — each becomes shims/<name>.js (non-hashed) in the
        // production build and is referenced by the importmap injected above.
        "ext-react":               resolve(__dirname, "src/shims/ext-react.js"),
        "ext-react-dom":           resolve(__dirname, "src/shims/ext-react-dom.js"),
        "ext-react-jsx-runtime":   resolve(__dirname, "src/shims/ext-react-jsx-runtime.js"),
        "ext-react-jsx-dev-runtime": resolve(__dirname, "src/shims/ext-react-jsx-dev-runtime.js"),
        "ext-tanstack-react-query": resolve(__dirname, "src/shims/ext-tanstack-react-query.js"),
        "ext-zustand":             resolve(__dirname, "src/shims/ext-zustand.js"),
        "ext-atlas-ui":            resolve(__dirname, "src/shims/ext-atlas-ui.js"),
        "ext-atlas-sdk":           resolve(__dirname, "src/shims/ext-atlas-sdk.js"),
        "ext-atlas-validators":    resolve(__dirname, "src/shims/ext-atlas-validators.js"),
        "ext-react-router-dom":    resolve(__dirname, "src/shims/ext-react-router-dom.js"),
        "ext-sonner":              resolve(__dirname, "src/shims/ext-sonner.js"),
        "ext-lucide-react":        resolve(__dirname, "src/shims/ext-lucide-react.js"),
        "ext-recharts":            resolve(__dirname, "src/shims/ext-recharts.js"),
      },
      output: {
        // Shim entries get non-hashed names at a predictable path so the
        // importmap entries above never need to be updated.
        entryFileNames: (chunk) =>
          chunk.name.startsWith("ext-")
            ? "shims/[name].js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
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
          // NOTE: @atlas/ui, @atlas/sdk, @atlas/validators are intentionally NOT
          // in manualChunks. Rolldown has a CJS-interop bug when React is imported
          // from a separate manual chunk — the chunk captures React as null, breaking
          // hooks in AME3 module bundles that use those packages via the shim.
          // Letting Rolldown auto-split them into a shared chunk (created from the
          // main HTML entry) avoids the issue. preserveEntrySignatures ensures all
          // exports remain accessible through the shims.
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
