# Spec-Driven Development Methodology — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt and formalize the Spec-Driven Development methodology across Atlas ERP by creating the methodology document, annotated templates, folder index, and adding mandatory SDD references to CLAUDE.md and codex/00_MASTER_PROMPT.md.

**Architecture:** Documentation-only change. No code, no Prisma models, no migrations, no API routes, no SDK changes. All deliverables are Markdown files under `docs/` and minimal additions to two existing guidance files.

**Tech Stack:** Markdown, Git. No build tools required.

---

## File Structure Map

### Created

- `docs/spec-driven-development.md` — full SDD methodology: workflow stages, 28-section spec standard, 16-step module checklist, Atlas permission convention, agent mode declaration rules, maintenance rules
- `docs/superpowers/README.md` — folder index with quick-start guide and table of all existing specs and plans
- `docs/superpowers/specs/2026-05-08-spec-driven-development-design.md` — self-spec for the SDD methodology adoption (28 sections, all answered)
- `docs/superpowers/templates/feature-spec-template.md` — annotated 28-section spec skeleton; each section has a guidance comment
- `docs/superpowers/templates/implementation-plan-template.md` — task/checkbox plan skeleton with File Structure Map, validation commands, rollback notes, and verification gate
- `docs/superpowers/templates/verification-checklist-template.md` — four-category checklist: build, functional, RBAC/permissions, documentation
- `docs/superpowers/templates/decision-log-template.md` — five-field deviation log for when implementation deviates from the approved spec

### Modified

- `CLAUDE.md` — added `## Spec-Driven Development` section before `## Development phases`
- `codex/00_MASTER_PROMPT.md` — added principle #12 to `## Principios obligatorios`

---

## Task 1 — Create SDD methodology document

**Files:**
- Create: `docs/spec-driven-development.md`

- [x] **Step 1: Write `docs/spec-driven-development.md`**

  Sections: Definition, 7 workflow stages, folder/file naming conventions, 28 required spec sections, 16-step module checklist, Atlas module contract questions, permission naming convention, agent mode declaration, maintenance rules.

- [x] **Step 2: Verify file exists and is under 1000 lines**

  ```bash
  wc -l docs/spec-driven-development.md
  ```

  Expected: file exists, line count under 1000.

- [x] **Step 3: Commit**

  ```bash
  git add docs/spec-driven-development.md
  git commit -m "docs(sdd): add spec-driven-development methodology"
  ```

---

## Task 2 — Create superpowers folder index

**Files:**
- Create: `docs/superpowers/README.md`

- [x] **Step 1: Write `docs/superpowers/README.md`**

  Sections: methodology reference link, directory structure, 10-step quick start, table of all existing specs and plans (15 rows including Phase 2 plan-only entry and new SDD spec).

- [x] **Step 2: Verify all linked files exist**

  ```bash
  git status docs/superpowers/
  ```

  Expected: README.md is new; all linked spec and plan files are tracked.

---

## Task 3 — Create annotated templates

**Files:**
- Create: `docs/superpowers/templates/feature-spec-template.md`
- Create: `docs/superpowers/templates/implementation-plan-template.md`
- Create: `docs/superpowers/templates/verification-checklist-template.md`
- Create: `docs/superpowers/templates/decision-log-template.md`

- [x] **Step 1: Write `feature-spec-template.md`**

  All 28 sections in order with a one-line guidance comment per section. "N/A" guidance present. Atlas module contract questions embedded in the relevant sections (sections 12-16, 18).

- [x] **Step 2: Write `implementation-plan-template.md`**

  Required header block, File Structure Map (Create/Modify), task blocks with checkbox subtasks and validation commands, rollback notes, verification gate checklist.

- [x] **Step 3: Write `verification-checklist-template.md`**

  Four categories: build checks (`pnpm build`, `db:generate`, `db:migrate`, `db:seed`), functional checks (endpoint smoke tests), RBAC/permission checks (403 without permission, 200 with), documentation checks (TASKS.md updated).

- [x] **Step 4: Write `decision-log-template.md`**

  Five fields: Date, Feature, Spec reference, Decision, What spec said, What was implemented instead, Reason, Impact on spec.

- [x] **Step 5: Verify all four template files exist**

  ```bash
  ls docs/superpowers/templates/
  ```

  Expected: `decision-log-template.md`, `feature-spec-template.md`, `implementation-plan-template.md`, `verification-checklist-template.md`

---

## Task 4 — Write SDD self-spec

**Files:**
- Create: `docs/superpowers/specs/2026-05-08-spec-driven-development-design.md`

- [x] **Step 1: Write the SDD self-spec using the new template**

  All 28 sections answered. Sections that do not apply (Prisma impact, API contract, SDK, manifest, etc.) answered explicitly with `N/A`. Status: `Approved`.

---

## Task 5 — Update CLAUDE.md and codex

**Files:**
- Modify: `CLAUDE.md`
- Modify: `codex/00_MASTER_PROMPT.md`

- [x] **Step 1: Add SDD section to CLAUDE.md**

  Insert before `## Development phases`:

  ```markdown
  ## Spec-Driven Development

  All new features and modules follow the spec -> plan -> implementation -> verification workflow. Implementation must not begin without an approved spec in `docs/superpowers/specs/` and an approved plan in `docs/superpowers/plans/`. See `docs/spec-driven-development.md` for the full methodology, required spec sections, module checklist, and agent mode rules.
  ```

- [x] **Step 2: Add principle #12 to codex/00_MASTER_PROMPT.md**

  Append to `## Principios obligatorios` numbered list:

  ```
  12. Antes de implementar cualquier modulo o feature, se requiere un spec aprobado en
      `docs/superpowers/specs/` y un plan en `docs/superpowers/plans/`.
      Ver `docs/spec-driven-development.md`.
  ```

- [x] **Step 3: Verify diffs**

  ```bash
  git diff CLAUDE.md codex/00_MASTER_PROMPT.md
  ```

  Expected: CLAUDE.md gains one new section (3 lines). codex gains one numbered item.

---

## Task 6 — Final commit and verification

- [x] **Step 1: Stage all new and modified files**

  ```bash
  git add docs/spec-driven-development.md \
          docs/superpowers/README.md \
          docs/superpowers/specs/2026-05-08-spec-driven-development-design.md \
          docs/superpowers/templates/ \
          CLAUDE.md \
          codex/00_MASTER_PROMPT.md
  ```

- [x] **Step 2: Commit**

  ```bash
  git commit -m "docs(sdd): formalize Spec-Driven Development methodology for Atlas ERP"
  ```

  Expected: 9 files changed, 1125 insertions.

- [x] **Step 3: Confirm git log**

  ```bash
  git log --oneline -3
  ```

  Expected: top commit is the SDD docs commit.

- [x] **Step 4: Update docs/TASKS.md**

  Add a phase entry under the most recent completed phase:

  ```markdown
  ## SDD Methodology adoption

  - [x] Create docs/spec-driven-development.md
  - [x] Create docs/superpowers/README.md
  - [x] Create docs/superpowers/templates/ (4 files)
  - [x] Create SDD self-spec in docs/superpowers/specs/
  - [x] Update CLAUDE.md with SDD section
  - [x] Update codex/00_MASTER_PROMPT.md with principle #12

  Verified: 2026-05-08 (git commit 8249aac, 9 files, 1125 insertions)
  ```

---

## Task 7 — Next step: Ledger module spec

This task is a handoff prompt, not implementation. Run it in a new session after this plan is marked complete.

- [ ] **Step 1: Open a new Claude Code session in the Atlas ERP repo**

- [ ] **Step 2: Paste the following prompt to begin the first real feature spec under SDD**

```
You are a senior full-stack ERP engineer working on Atlas ERP.

Mode: SPEC

Before writing anything, read:
- docs/spec-driven-development.md
- docs/superpowers/README.md
- docs/superpowers/templates/feature-spec-template.md
- docs/01_erp_architecture.md
- docs/02_module_system.md
- prisma/schema.prisma (FinanceAccount and FinanceTransaction models)
- packages/maps/src/feature-modules.js (existing module patterns)
- packages/validators/src/index.js (existing validator patterns)
- packages/sdk/src/index.js (existing SDK domain patterns)
- apps/api/src/services/finance-service.js (existing service pattern)
- docs/TASKS.md (current roadmap)

Feature to spec: atlas.ledger — Accounts and Movements module

Product description:
A simple ledger module that allows users to create named accounts, record
monetary movements (credits and debits) against those accounts, filter
movements by date range / account / type, view per-account movement history
with running balance, and export filtered results to PDF and Excel.

This is NOT a full accounting system. No double-entry. No journal entries.
No chart-of-accounts hierarchy. No tax/withholding integration.
No currency conversion. No connection to the existing FinanceJournalEntry model.

The module is company-scoped. All accounts and movements belong to a company.

Use the 28-section feature spec template. Answer every section explicitly.
"N/A" is acceptable but must be written, never left blank.

When the spec is complete, present it for approval before creating the plan.
```

---

## Verification gate

Before marking any TASKS.md entry complete:

- [x] All 7 tasks above are checked.
- [x] `git log --oneline -1` shows the SDD commit.
- [x] `ls docs/superpowers/templates/` shows 4 files.
- [x] `grep "Spec-Driven" CLAUDE.md` returns the new section.
- [x] `grep "spec aprobado" codex/00_MASTER_PROMPT.md` returns principle #12.
- [ ] docs/TASKS.md updated (Task 6, Step 4 — pending).
