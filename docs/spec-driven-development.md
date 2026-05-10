# Spec-Driven Development — Atlas ERP

## 1. Definition

Spec-Driven Development (SDD) is the mandatory development methodology for Atlas ERP. Every new feature module or significant system change must begin with a written specification and a separate implementation plan before any code is written.

The spec is the source of truth for the feature. It defines what will be built, why it exists, what is in scope, what is out of scope, how it fits the architecture, what data models are required, what API contracts are required, what UI screens are required, what permissions are required, what edge cases exist, what acceptance criteria must be met, and how the work will be verified.

An agent or developer must not jump directly to code. The sequence is always:

```
Discovery -> Spec -> Plan -> Approval Gate -> Implementation -> Verification -> Maintenance
```

## 2. Workflow Stages

### Stage 1: Discovery

Before writing the spec, read the current architecture and the modules related to the new feature.

Required reading:
- `docs/01_erp_architecture.md`
- `docs/02_module_system.md`
- `docs/03_core_modules.md`
- `docs/08_blueprints.md`
- `docs/TASKS.md`
- Any existing spec or plan for related modules in `docs/superpowers/`

Tasks during discovery:
- Identify existing patterns to reuse (services, validators, SDK domains, UI components from `@atlas/ui`).
- Identify risks, conflicts, and dependencies on other modules.
- Identify which Prisma models exist and which would be new.
- Identify whether any existing files are near the 800-line warning threshold and would need splitting.

Forbidden during discovery: Writing any implementation code.

---

### Stage 2: Feature Spec

Create a spec file at:

```
docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md
```

Use the template at `docs/superpowers/templates/feature-spec-template.md`.

The spec must answer all 28 required sections (see Section 4 of this document). "N/A" is a valid answer for sections that do not apply, but the answer must be explicit. Leaving a section blank is not acceptable.

The spec is considered complete when:
- All 28 sections are answered.
- The Atlas module contract questions are answered (see Section 6).
- A reviewer can implement the feature from the spec alone without asking clarifying questions.

Forbidden during spec: Starting the implementation plan. Writing implementation code.

---

### Stage 3: Implementation Plan

Create a plan file at:

```
docs/superpowers/plans/YYYY-MM-DD-feature-name.md
```

Use the template at `docs/superpowers/templates/implementation-plan-template.md`.

The plan must:
- Reference the spec file by path.
- Include a File Structure Map listing every file to be created or modified.
- Break work into numbered tasks with checkbox subtasks.
- Include explicit validation commands for each task.
- Not add scope that is not present in the approved spec.

Forbidden during plan: Starting implementation. Writing implementation code.

---

### Stage 4: Approval Gate

Neither the spec nor the plan may be self-approved by the agent that wrote them. Before implementation begins, a human must confirm that the spec and plan are correct.

If working autonomously, the agent must explicitly declare entry into implementation mode:

```
Mode: IMPLEMENTATION
Spec: docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md
Plan: docs/superpowers/plans/YYYY-MM-DD-feature-name.md
```

Forbidden: Crossing into implementation mode without this declaration and human confirmation.

---

### Stage 5: Implementation

Implement exactly what the approved spec and plan describe.

Rules:
- Mark each plan task as in_progress before starting it. Mark it completed only after validation commands pass.
- No scope expansion. If something not in the spec is discovered during implementation, stop and update the spec first or write a decision log.
- No unrelated refactors. If a file touched during implementation has unrelated problems, note them but do not fix them within this feature's scope.
- Follow all Atlas architecture constraints: manifest, permissions, service layer, Zod validators, SDK methods, and frontend screens.
- Source files must stay under 1000 lines. Hard ceiling is 1500 lines.

---

### Stage 6: Verification

After all plan tasks are complete, run the verification checklist template at `docs/superpowers/templates/verification-checklist-template.md`. Document each check with its actual result.

Update `docs/TASKS.md` with explicit verification evidence:

```
Verified: YYYY-MM-DD (commands/checks executed)
```

Forbidden: Marking a task complete in TASKS.md without running verification commands and documenting their output.

---

### Stage 7: Maintenance

When an implemented feature must change:
- Update the spec first. The spec must always reflect the current intended state.
- If the implementation deviates from the spec for a valid reason, write a decision log at `docs/superpowers/decisions/YYYY-MM-DD-feature-name-decision.md` using the template at `docs/superpowers/templates/decision-log-template.md`.
- Do not delete specs. Mark the `Status` field as `Superseded` and reference the replacement spec.

## 3. Folder and File Naming Conventions

```
docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md
docs/superpowers/plans/YYYY-MM-DD-feature-name.md
docs/superpowers/decisions/YYYY-MM-DD-feature-name-decision.md
docs/superpowers/templates/
```

File naming rules:
- Use lowercase kebab-case for `feature-name`.
- Always prefix with `YYYY-MM-DD` (the date the document was created).
- Spec files end with `-design.md`.
- Plan files end with `.md` (no additional suffix).
- Decision files end with `-decision.md`.

## 4. Required Spec Sections

Every spec file must contain the following 28 sections in this order. "N/A" is acceptable when a section does not apply, but must be stated explicitly.

1. **Feature title** — The human-readable name of the feature.
2. **Status** — One of: `Draft` / `Proposed` / `Approved` / `In Progress` / `Complete` / `Superseded`.
3. **Context** — The business or product situation that motivates this feature.
4. **Problem** — The specific problem being solved. Describe the problem, not the solution.
5. **Goals** — Numbered list of what a successful implementation achieves.
6. **Non-goals** — Numbered list of what is explicitly out of scope for this version.
7. **User stories** — Who does what and why. Format: "As a [role], I want to [action] so that [outcome]."
8. **UX requirements** — Required UX behaviors, layout constraints, interaction patterns, and Spanish UI label conventions.
9. **Routes/screens** — List of frontend routes and screen names, including the full route path and the module key that owns them.
10. **Data model** — Entities involved, their fields, field types, and relationships. Describe new models and changes to existing ones.
11. **Prisma impact** — Which Prisma models are new, which are modified, and whether a new migration is required.
12. **API contract** — All HTTP endpoints: method, path, auth requirement, request body shape, response shape, and error codes.
13. **SDK contract** — New or modified methods on `@atlas/sdk`: domain name, method signature, parameters, and return type.
14. **Validator contract** — New or modified Zod schemas in `@atlas/validators`: schema name and the fields it validates.
15. **Module manifest impact** — Whether the feature requires a new or modified manifest in `packages/maps/`. Module key, dependencies, navigation entries, permissions array, and ACL map.
16. **Navigation impact** — New navigation items: label (in Spanish), path, icon, layout, and permissionKey.
17. **Blueprint impact** — Whether the feature defines new blueprints or modifies existing ones: blueprint key, kind, and schema summary.
18. **RBAC/permissions** — All permission keys the feature declares, which API endpoints each guards, and which navigation items each permissionKey gates.
19. **Multi-company behavior** — How the feature handles company scoping and data isolation between companies.
20. **Files/storage impact** — Whether the feature uploads or retrieves files via Supabase Storage, and which object key prefix convention is used.
21. **Export/import requirements** — Whether the feature requires PDF, Excel, or CSV exports or bulk import.
22. **Audit log requirements** — Which actions must be recorded in `AuditLog`: action key (`module.entity.action`), actor, and before/after payload shape.
23. **Edge cases** — Numbered list of non-obvious cases the implementation must handle correctly.
24. **Risks** — Numbered list of technical or product risks, each with a mitigation strategy.
25. **Acceptance criteria** — Numbered, testable, falsifiable statements. Format: "Given X, when Y, then Z."
26. **Verification plan** — The specific commands and checks that will be run to verify the implementation.
27. **Rollback plan** — How to safely revert the feature if a critical issue is found. Which migrations are involved and whether a rollback migration is required.
28. **Future enhancements** — Things explicitly deferred to a later version, so they are not forgotten.

## 5. Atlas Module Checklist

Every new feature module must complete all items in this checklist before the implementation is considered done. New modules use AME3 (`defineAtlasModule`). See [docs/03_custom_modules.md](03_custom_modules.md) for the full developer guide and [docs/architecture/atlas-module-engine-v3.md](architecture/atlas-module-engine-v3.md) for the SDD mandate.

- [ ] 1. Spec created at `docs/superpowers/specs/YYYY-MM-DD-ame3-<moduleKey>-design.md`
- [ ] 2. Implementation plan created at `docs/superpowers/plans/YYYY-MM-DD-ame3-<moduleKey>.md`
- [ ] 3. Module manifest at `modules/custom/<moduleKey>/module.manifest.js` using `defineAtlasModule`
- [ ] 4. Module key uses `custom.*` or `community.*` namespace (`atlas.*` is reserved for the Atlas team)
- [ ] 5. Granular permissions declared in manifest:
  - `module.access`
  - `module.feature.read`
  - `module.feature.create`
  - `module.feature.update`
  - `module.feature.delete`
  - Non-CRUD extras declared as `module.feature.action` only when applicable
- [ ] 6. `navigation[].permissionKey` set for every navigation item
- [ ] 7. `acl.module`, `acl.actions`, and `acl.models` declared in manifest
- [ ] 8. Models declared with `defineModel` in `models/*.model.js` (Phase 3+; Phase 1–2: transitional Prisma model with `// TODO: remove when Phase 3 complete` comment)
- [ ] 9. Views declared with `defineView` in `views/*.view.js` (Phase 3+)
- [ ] 10. Pages declared with `definePage` in `pages/*.page.js` (Phase 3+)
- [ ] 11. Module-local validators in `validators/index.js` (no edit to `packages/validators/src/index.js`)
- [ ] 12. `api/index.js` exports Hono router factory; all routes guarded by `requirePermission`
- [ ] 13. Business logic in `api/*-service.js`, not in route handlers
- [ ] 14. Cleanup handler registered if `resettable: true` or `supportsDataPurge: true`
- [ ] 15. Exports or reports implemented if the spec requires them
- [ ] 16. Module discovered (`POST /modules/sync`), installed from catalog, and fail-closed permission test passes
- [ ] 17. Verification commands run and results documented
- [ ] 18. `docs/TASKS.md` updated with phase entry and `Verified: YYYY-MM-DD (...)` evidence

## 6. Atlas Module Contract Questions

Before a spec is considered complete, it must explicitly answer every question below. These questions appear within the relevant spec sections but are listed here for completeness.

**Manifest:**
- What is the module key? (Use `custom.*` or `community.*` namespace; `atlas.*` is reserved)
- Where does the manifest live? (`modules/custom/<moduleKey>/module.manifest.js` — uses `defineAtlasModule`, not `createModuleManifest`)
- What modules does it declare as dependencies?
- Is it `kind: 'FEATURE'` and `lifecycle.uninstallable: true`?

**Permissions:**
- What is the full list of permission keys the module declares?
- What is the `acl.module` key?
- What action-to-permission map does `acl.actions` declare?
- What model-to-CRUD map does `acl.models` declare?

**Navigation:**
- What navigation items does the module expose?
- What is the label (in Spanish), path, icon, layout, and permissionKey for each?

**API:**
- What HTTP endpoints does the feature require?
- Which permission key guards each endpoint?
- What is the request and response shape for each endpoint?

**Data:**
- What entities does the module own? (declared via `defineModel` in AME3; transitional Prisma model in Phase 1–2 only)
- Does the feature require a new forward migration? (Atlas ORM migration in Phase 3+; Prisma migration in Phase 1–2 only)

**Validators:**
- What Zod schemas are required? (module-local `validators/index.js` in AME3; `@atlas/validators` only for truly shared contracts)

**SDK:**
- What SDK domain and methods are required in `@atlas/sdk`?

**Frontend:**
- What views are required? (declared via `defineView` in AME3; Phase 1–2 only: screen files under `apps/desktop/src/modules/`)
- Which existing `@atlas/ui` components can be reused?

**Documentation:**
- Which section of `docs/TASKS.md` covers this feature?
- Does any architecture doc (`docs/01-09`) need updating?

## 7. Permission Naming Convention

All Atlas permissions follow this granular format:

```
module.access                   — grants access to the module runtime
module.feature.read             — read access to a specific feature area
module.feature.create           — create access
module.feature.update           — update access
module.feature.delete           — delete (soft-disable) access
module.feature.action           — non-CRUD action, declared only when it exists
```

Rules:
- `module` is the module key prefix (e.g., `finance`, `hr`, `contacts`).
- `feature` is the functional sub-area (e.g., `accounts`, `employees`, `entries`).
- Non-CRUD actions use a descriptive verb (e.g., `finance.applications.reverse`).
- `module.access` is always required. It is the minimum permission for a user to see the module in runtime.
- Navigation items must declare `permissionKey` pointing to a `feature.read` key, not to `module.access`.
- API endpoints must reference the matching granular permission in their `requirePermission` guard.
- Seed the full permission catalog in `prisma/seed.js` so new permissions are available on fresh installs.

Example for a hypothetical `atlas.ledger` module:

```
ledger.access
ledger.accounts.read
ledger.accounts.create
ledger.accounts.update
ledger.accounts.delete
ledger.movements.read
ledger.movements.create
ledger.movements.update
ledger.movements.delete
ledger.movements.export
```

## 8. Agent Mode Declaration

When an AI agent is working on an Atlas ERP feature, it must declare its current mode at the start of each work session and whenever it transitions between stages.

Valid modes:

| Mode | Allowed actions |
|---|---|
| `SPEC` | Writing or reviewing the feature specification |
| `PLAN` | Writing or reviewing the implementation plan |
| `IMPLEMENTATION` | Writing code against an approved spec and plan |
| `VERIFICATION` | Running checks and documenting results |

Declaration format at session start:

```
Mode: IMPLEMENTATION
Spec: docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md
Plan: docs/superpowers/plans/YYYY-MM-DD-feature-name.md
```

Behavioral rules:
- An agent in `SPEC` mode must not write implementation code.
- An agent in `PLAN` mode must not write implementation code.
- An agent in `IMPLEMENTATION` mode must not add scope not present in the approved spec.
- An agent in `VERIFICATION` mode must run actual commands and document actual output, not assume success.

## 9. Maintenance Rules

- When a feature's behavior must change, update the spec first. The spec must always reflect the current intended state of the feature.
- If an implementation deviates from the approved spec for a valid reason (discovered constraint, approved scope reduction, stakeholder decision), write a decision log.
- Do not delete specs. Mark the `Status` field as `Superseded` and add a reference line pointing to the replacement spec.
- `docs/TASKS.md` checklist items are marked `[x]` only when the task has explicit verification evidence. Implemented but unverified tasks remain unchecked.
- The verification evidence format is:
  ```
  Verified: YYYY-MM-DD (commands/checks executed)
  ```
