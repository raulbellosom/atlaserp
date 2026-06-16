# Atlas ERP v2 — Agent Instructions

Atlas ERP v2 is a Node.js + React + Hono monorepo. ERP features are built as self-contained
**AME3 modules** under `modules/custom/<moduleKey>/`. No module requires editing core files.

---

## Before working on any module

Read **`docs/ai-context/ame3-modules.md`** — it contains the full pattern guide with
working code examples for every pattern you need.

Read **`docs/ai-context/ame3-runtime-capabilities.md`** — it lists all available
`@atlas/ui` components (forms, inputs, cards, dropdowns, dialogs, tables, etc.),
view kind examples (TABLE, FORM, DETAIL, CUSTOM), and the dynamic bundle system
for custom React components. Custom React components in `components/index.js` are
compiled at install time — no web image rebuild is ever needed for module UI.

### Critical rules — violating these corrupts the project

1. **Never edit `prisma/schema.prisma`** for module tables — Atlas ORM manages them
   via `defineModel` declarations + `POST /modules/sync`

2. **Never use `prisma.<model>` accessors** for AME3 tables — those Prisma models do not
   exist. Use `prisma.$queryRaw` tagged template literals instead.

3. **All service functions must be inside the factory closure** — declare every function
   inside `createXxxService({ prisma })`, never at module scope. Functions outside the
   factory cannot access `prisma` and will throw `ReferenceError` at runtime.

4. **Never generate UUIDs in JavaScript** — the `id` column has `DEFAULT uuidv7()` in
   PostgreSQL. Use `INSERT ... RETURNING *` and let the database produce the ID.

5. **Every new module must declare its PWA identity** — `icon`, six-digit hexadecimal
   `color`, and `pwa: { shortName, startPath }` are mandatory. `startPath` is relative
   to `/app/m/<moduleKey>` and must stay inside that module. The `icon` field must be
   one of the whitelisted values from `MODULE_ICON_NAMES` — see the full list in
   `docs/ai-context/ame3-modules.md`. Using an unlisted icon name will cause the sync
   endpoint to reject the manifest. Navigation item icons are not restricted.

### UI-first rule — mandatory

Before writing any UI element, check `@atlas/ui` first. The full inventory is in
`docs/ai-context/ame3-runtime-capabilities.md`.

**Never use native HTML form elements when an `@atlas/ui` equivalent exists:**

| Instead of | Use |
|---|---|
| `<select>` | `CreatableComboboxField` (new entries) · `ComboboxField` (read-only) · `SelectField` (short fixed list) |
| `<input type="text">` | `TextField` / `Input` |
| `<textarea>` | `TextareaField` / `Textarea` |
| `<input type="checkbox">` | `CheckboxField` / `Checkbox` |
| `<input type="date">` | `DateField` / `DatePickerField` |
| hand-rolled table | `AtlasTable` / `DataTable` |
| hand-rolled modal | `Dialog` / `Sheet` |
| hand-rolled dropdown | `DropdownMenu` |

Key components every module screen must use:
- `PageHeader` — every screen starts here
- `EmptyState` / `ErrorState` — never plain text for empty/error states
- `ConfirmDialog` — all destructive confirmations
- `AttachmentsPanel` / `FileUploader` — file attachments inline in the module, never redirect to atlas.files
- `CreatableComboboxField` with `placeholder="Buscar o crear..."` — canonical UX for selects that allow new entries

---

## Creating a new module

Use the Dev Kit flow:

1. Read this file first.
2. Read `docs/ai-context/ame3-modules.md` and `docs/ai-context/ame3-runtime-capabilities.md`.
3. In installer-mode workspaces, start from `golden-path-module/` inside the Dev Kit.
4. Rename the copied folder to the new module key and edit files directly.

Do not assume a scaffolder command exists in installer-mode or external workspaces.

---

## Modifying an existing module

Edit files directly. Follow the patterns in `docs/ai-context/ame3-modules.md`.
After changes: `curl -X POST http://localhost:4010/modules/sync -H "Authorization: Bearer $ATLAS_TOKEN"`

---

## Reference implementation

`modules/custom/custom.fleet/` is the canonical example of a complete AME3 module.

---

## Tech stack quick reference

- API: Node.js + Hono (`apps/api/`)
- Frontend: React + Vite + Tauri (`apps/desktop/`)
- DB: Supabase PostgreSQL via Prisma (`prisma/schema.prisma` for core tables only)
- Module engine: `@atlas/module-engine` — `defineAtlasModule`, `defineModel`, `defineView`, `definePage`
- Tests: Node.js built-in `node:test` (no Jest/Vitest)
- Style: JavaScript only, no TypeScript, Tailwind CSS, all UI text in Spanish
