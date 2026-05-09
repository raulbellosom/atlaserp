# [Feature Name] — Implementation Plan

<!-- Replace [Feature Name] with the human-readable feature name. -->

Date: YYYY-MM-DD
Spec: docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md
Status: Draft

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.

## Goal

<!-- One paragraph summarizing what this plan delivers.
     Must be consistent with the Goals section of the spec.
     Do not introduce scope not present in the spec. -->

## Architecture summary

<!-- One short paragraph on the approach taken.
     Reference the spec section numbers where relevant.
     Call out any non-obvious architectural decisions. -->

---

## File Structure Map

<!-- List every file this plan will create or modify.
     This is the authoritative scope boundary for implementation.
     If a file is not listed here, it should not be changed.
     If a discovery during implementation reveals a new file is needed, update this map first. -->

### Create

- `apps/api/src/services/module-service.js`
- `apps/desktop/src/modules/atlas.modulename/screens/ResourceListScreen.jsx`
- `apps/desktop/src/modules/atlas.modulename/screens/ResourceDetailScreen.jsx`
- `prisma/migrations/YYYYMMDDHHMMSS_add_module_models/migration.sql`

### Modify

- `packages/maps/src/feature-modules.js` — add module manifest
- `packages/validators/src/index.js` — add Zod schemas
- `packages/sdk/src/index.js` — add SDK domain
- `apps/api/src/index.js` — add routes
- `prisma/schema.prisma` — add models
- `prisma/seed.js` — seed permissions
- `docs/TASKS.md` — add phase entry

---

## Task 1 — [Task name]

<!-- Name each task after the logical unit of work it completes. -->

**Files:**
- Create: `path/to/new/file.js`
- Modify: `path/to/existing/file.js`

**Changes:**
<!-- Describe what changes and why at a level that a reviewer can understand without reading the code. -->

- [ ] Step 1: [description]
- [ ] Step 2: [description]
- [ ] Step 3: [description]

**Validation:**

```bash
pnpm build
# or specific command
```

<!-- State the observable success condition: "Command exits 0" or "GET /endpoint returns 200" etc. -->

---

## Task 2 — [Task name]

**Files:**
- Create: `...`
- Modify: `...`

**Changes:**

- [ ] Step 1: [description]
- [ ] Step 2: [description]

**Validation:**

```bash
pnpm db:generate
pnpm db:migrate
```

---

## Task 3 — [Task name]

**Files:**
- Modify: `...`

**Changes:**

- [ ] Step 1: [description]

**Validation:**

```bash
pnpm db:seed
```

---

## Task 4 — [Task name]

**Files:**
- Modify: `...`

**Changes:**

- [ ] Step 1: [description]

**Validation:**

```bash
# Manual: describe what to test and what success looks like
```

---

## Rollback Notes

<!-- What to do if this plan must be aborted mid-implementation.
     Which files were modified and can be reverted?
     If a migration was applied, is a rollback migration needed? -->

- If aborted before Task 3: revert modified files, no migration cleanup needed.
- If aborted after Task 3: create a new forward migration to undo schema changes.

---

## Verification Gate

Before marking any phase task complete in `docs/TASKS.md`:

- [ ] All task validation commands have been run.
- [ ] All commands exited without errors.
- [ ] Verification checklist at `docs/superpowers/templates/verification-checklist-template.md` has been filled in.
- [ ] `docs/TASKS.md` updated with `Verified: YYYY-MM-DD (commands executed)`.
