# Atlas ERP Dev Kit (AME3)

This folder is generated from the Atlas ERP source repository and downloaded by the installer into `custom-modules/_atlas-devkit/`.

## Start Here

1. Read `AGENTS.md`.
2. Read `docs/ai-context/ame3-modules.md`.
3. Read `docs/ai-context/ame3-runtime-capabilities.md`.
4. If generating code with AI, paste `prompt-starter.txt` first.
5. If the module uses a CUSTOM view, compare it against `golden-path-module/` before debugging.

## Important Files

- `capabilities.runtime.json` — machine-readable contract for imports, UI exports, and CUSTOM requirements.
- `troubleshooting.md` — common AME3 installer-mode failures and fixes.
- `golden-path-module/` — minimal working module with CRUD + CUSTOM dashboard.
- `docs/module-quality-standards.md` — shared UX and behavioral standards.

## Non-Negotiable Import Rules

- `toast` comes from `sonner`, not from `@atlas/ui`.
- `@atlas/ui` is for UI components only.
- Supported externals: @atlas/sdk, @atlas/ui, @atlas/validators, @tanstack/react-query, lucide-react, react, react-dom, react-router-dom, react/jsx-dev-runtime, react/jsx-runtime, recharts, sonner, zustand

