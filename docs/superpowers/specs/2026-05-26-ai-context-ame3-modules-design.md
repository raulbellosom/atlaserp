# AI Context System — AME3 Custom Modules

**Date:** 2026-05-26
**Status:** Approved
**Authority:** This spec defines the AI-agnostic context layer for creating and modifying AME3 custom modules in Atlas ERP v2.

---

## 1. Problem Statement

Any AI agent working in this codebase — Claude Code, GitHub Copilot, OpenAI Codex, or a chat-based AI — must independently learn AME3 module patterns by reading 5+ reference files before it can write correct code. Without a dedicated context layer, agents frequently:

- Generate service functions outside the factory closure (breaking `prisma` scope)
- Edit `prisma/schema.prisma` for AME3 tables (violates the core rule)
- Use `prisma.xxx` model accessors instead of `prisma.$queryRaw` for AME3 tables
- Skip the AuditLog on mutations
- Import the error class from the wrong file
- Generate UUID in JavaScript instead of letting the database produce it

The goal is a single authoritative reference that any agent can consume, maintained in one place, with thin per-agent wrappers that require minimal upkeep.

---

## 2. Scope

**In scope:**
- Hub document: comprehensive AME3 module creation and modification guide
- Claude Code spoke: update existing `CLAUDE.md`
- Codex spoke: new `AGENTS.md` at repo root
- GitHub Copilot spoke: new `.github/copilot-instructions.md`

**Out of scope for this iteration:**
- Gemini CLI (`GEMINI.md`)
- Cursor (`.cursorrules`)
- Windsurf (`.windsurfrules`)
- Automated validation that spoke files stay in sync with hub

---

## 3. Architecture — Hub and Spokes

```
docs/
  ai-context/
    ame3-modules.md          ← HUB — single source of truth, all patterns

CLAUDE.md                    ← spoke: already exists, add AME3 section pointing to hub
                               + 4 critical rules inline (never break these)

AGENTS.md                    ← spoke: new, Codex/OpenAI convention
                               + 4 critical rules inline + pointer to hub

.github/
  copilot-instructions.md    ← spoke: new, GitHub Copilot convention
                               + 4 critical rules inline + pointer to hub
```

### Rule: what belongs in a spoke vs. the hub

A rule belongs **inline in every spoke** if breaking it corrupts the project in a way that is hard to detect at review time. Everything else belongs only in the hub.

The 4 rules that go inline in all spokes:
1. Never edit `prisma/schema.prisma` for AME3 module tables
2. Never use `prisma.<modelName>` accessors for AME3 tables — use `prisma.$queryRaw`
3. All service functions must be declared **inside** the `createXxxService({ prisma })` factory closure
4. Never generate UUIDs in JavaScript — the database produces them via `DEFAULT uuidv7()`

---

## 4. Hub Document Structure (`docs/ai-context/ame3-modules.md`)

### 4.1 Quick orientation
- What AME3 is (1 paragraph)
- Where modules live: `modules/custom/<moduleKey>/`
- The golden rule: a module must never require editing core files

### 4.2 Scaffolder first
- When to use it: creating a new module from scratch
- Command: `node scripts/scaffold-module.js [config.json]`
- Config JSON shape with a minimal working example
- When to write code directly instead: adding fields, entities, or custom views to an existing module

### 4.3 Folder structure
Full annotated tree of all files a complete module contains, including optional `components/`.

### 4.4 Critical patterns with code examples
Each pattern includes a correct example and a "what NOT to do" counter-example.

| Pattern | Why it matters |
|---|---|
| Service factory closure | `prisma` only exists inside the factory; functions declared outside will fail at runtime |
| `prisma.$queryRaw` tagged template | AME3 tables are not in Prisma schema; model accessors don't exist |
| Table naming | `${moduleSlug}_${entityName}` — e.g. `fleet_vehicle` for `custom.fleet` |
| UUID from DB | `INSERT ... RETURNING *` — DB column has `DEFAULT uuidv7()`, never call `uuidv7()` in JS |
| Soft delete | `enabled = false` via `PATCH /:id/enabled`, never hard-delete |
| AuditLog on every mutation | create / update / setEnabled each call `prisma.auditLog.create` |
| ErrorClass location | `${ModulePascal}ServiceError` lives in `api/service-helpers.js`, imported from there in routes |

### 4.5 Field type reference
Compact table of all 17 AME3 field types with their Zod schema expression and form renderer.

### 4.6 Permission keys and navigation
- Format: `<moduleSlug>.<entityName>.<action>` (read / create / update / delete)
- How to declare them in `defineAtlasModule`
- How `requirePermission(key)` is used in routes

### 4.7 Anti-patterns table
What never to do and why, in a scannable table format.

### 4.8 Advanced: Custom components and CUSTOM views
Two opt-in features for modules that need custom UI beyond TABLE/FORM/DETAIL:

**Custom column renderers** — React components registered into the ComponentRegistry, used as column renderers in TABLE or DETAIL views. Lives in `components/index.js`, exports `register(registry)`. Registry keys follow `moduleKey:ComponentName` convention.

**CUSTOM view kind** — a `defineView` with `kind: 'CUSTOM'` that renders a fully custom React component at a specific URL path via `ImmersiveShell`. Requires a registered component and a path declaration. If the path starts with `/p/`, the view is public and `schema.public: true` must be set.

### 4.9 Post-generation steps
Exact commands to install a new module and verify it works end-to-end.

---

## 5. Spoke Files

### 5.1 `CLAUDE.md` (update existing)

Add a new section after the current "Module system" paragraph:

```
## AME3 custom module creation

Full guide: docs/ai-context/ame3-modules.md — read it before creating or modifying any module.

Critical rules (also in the guide):
- Never edit prisma/schema.prisma for AME3 tables
- Never use prisma.<model> accessors for AME3 tables — use prisma.$queryRaw
- All service functions must be declared inside createXxxService({ prisma }) — not at module scope
- Never generate UUIDs in JavaScript — the DB produces them via DEFAULT uuidv7()
```

### 5.2 `AGENTS.md` (new file at repo root)

OpenAI Codex reads `AGENTS.md` by convention. Format: short project description, the 4 critical rules, and a directive to read the hub before touching modules.

Contents:
- 2-sentence project description (Atlas ERP v2, AME3 module system)
- Section: "Before working on modules"
  - Read `docs/ai-context/ame3-modules.md`
  - The 4 critical rules inline
- Section: "Scaffolder"
  - One-liner on using the CLI for new modules
- Section: "Reference implementation"
  - Point to `modules/custom/custom.fleet/` as the canonical example

### 5.3 `.github/copilot-instructions.md` (new file)

GitHub Copilot reads `.github/copilot-instructions.md` when present in the repo. Same structure as `AGENTS.md` but formatted for Copilot's context window (shorter, more directive).

Contents: same 4 critical rules + pointer to hub + pointer to `custom.fleet`.

---

## 6. Maintenance Contract

The hub (`docs/ai-context/ame3-modules.md`) is the only file that requires updates when AME3 patterns evolve. Spokes require updates only if the location of the hub changes or a new "instant project corruption" rule is discovered.

When a new AME3 feature is shipped (new view kind, new field type, new lifecycle hook), update the hub as part of the same PR.

---

## 7. Success Criteria

1. A fresh AI agent given only the repo can correctly create a complete, working AME3 module by reading `docs/ai-context/ame3-modules.md` — without needing to read `custom.fleet` source files
2. The 4 critical rules appear verbatim in all three spoke files
3. All spoke files point to the same hub path
4. `node --check` passes on a module generated by an AI using only the hub as reference (verified manually)

---

## 8. Files to Create or Modify

| File | Action | Notes |
|---|---|---|
| `docs/ai-context/ame3-modules.md` | Create | Hub — full guide |
| `CLAUDE.md` | Modify | Add AME3 section with 4 rules + hub pointer |
| `AGENTS.md` | Create | Codex spoke |
| `.github/copilot-instructions.md` | Create | Copilot spoke |
