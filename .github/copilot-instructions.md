# Atlas ERP v2 — GitHub Copilot Instructions

## Module system

ERP features live under `modules/custom/<moduleKey>/` as self-contained **AME3 modules**.
Full guide with code examples: `docs/ai-context/ame3-modules.md` — read it before
suggesting module code.

### Rules that break the app when violated

- **Do NOT edit `prisma/schema.prisma`** for module tables — use `defineModel` + `POST /modules/sync`
- **Do NOT use `prisma.<model>` for AME3 tables** — use `prisma.$queryRaw` tagged templates
- **Declare ALL service functions inside `createXxxService({ prisma })`** — never at module scope.
  Functions outside the factory cannot access `prisma` and will throw `ReferenceError` at runtime.
- **Do NOT call `uuidv7()` in JavaScript** — let the database generate IDs via `DEFAULT uuidv7()`

### Creating a new module

```bash
node scripts/scaffold-module.js   # interactive, generates all files correctly
```

### Reference implementation

`modules/custom/custom.fleet/` — canonical AME3 module example.

## General conventions

- JavaScript only (no TypeScript)
- All UI text in Spanish
- Tailwind CSS for all styles
- `node:test` for tests (no Jest/Vitest)
- UUID v7 only (no cuid, no uuid v4)
- Soft delete: `enabled = false`, never hard-delete
- Hono for API routes — keep routes thin, business logic in service files
