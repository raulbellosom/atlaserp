# [Feature Title]

<!-- The human-readable name of the feature. -->

Date: YYYY-MM-DD
Status: Draft
Author: [name or agent identifier]
Spec file: docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md
Plan file: docs/superpowers/plans/YYYY-MM-DD-feature-name.md (created after spec approval)

---

## 1. Feature title

<!-- Restate the feature name. One line. -->

## 2. Status

<!-- One of: Draft / Proposed / Approved / In Progress / Complete / Superseded -->
<!-- If Superseded, add: "Superseded by: docs/superpowers/specs/YYYY-MM-DD-replacement-design.md" -->

Draft

## 3. Context

<!-- Why is this feature being built?
     Describe the business or product situation that motivates it.
     Focus on what is happening in the system or organization today that makes this necessary. -->

## 4. Problem

<!-- The specific problem this feature solves.
     Describe the problem, not the solution.
     A good problem statement can be validated independently of any implementation. -->

## 5. Goals

<!-- Numbered list. Each item is a concrete, observable outcome of a successful implementation.
     Avoid vague goals like "improve UX." Prefer "users can filter movements by date range." -->

1.
2.
3.

## 6. Non-goals

<!-- Numbered list. Be explicit about what this version does NOT do.
     Non-goals prevent scope creep and document deferred decisions. -->

1.
2.

## 7. User stories

<!-- Format: "As a [role], I want to [action] so that [outcome]."
     Include one story per distinct user need. -->

- As a [role], I want to [action] so that [outcome].

## 8. UX requirements

<!-- Required UX behaviors, layout constraints, interaction patterns.
     All UI-facing labels must be in Spanish.
     Reference existing Atlas UI patterns where applicable (e.g., DynamicTable, SideSheet, FormFields).
     Include loading states, error states, and empty states if they are non-obvious. -->

## 9. Routes/screens

<!-- List every frontend route this feature introduces.
     Format: route path | screen name | module key | description -->

| Route | Screen | Module | Description |
|---|---|---|---|
| /app/m/atlas.modulename/... | ScreenName | atlas.modulename | ... |

## 10. Data model

<!-- Describe the entities involved: new models and changes to existing models.
     For each model, list fields, types, constraints, and relationships.
     Do not paste Prisma schema here — describe the intent. -->

### New models

<!-- Model name, purpose, key fields -->

### Modified models

<!-- Model name, what changes and why -->

## 11. Prisma impact

<!-- State clearly:
     - Which models are new.
     - Which models are modified.
     - Whether a new migration is required (it almost always is for new models).
     - Any migration safety notes (e.g., "adding a nullable column to an existing table").
     Remember: never edit existing applied migrations. Always create a forward migration. -->

New models: [list]
Modified models: [list or N/A]
New migration required: Yes / No
Migration safety notes: [or N/A]

## 12. API contract

<!-- List every HTTP endpoint this feature introduces.
     For each endpoint:
     - Method and path
     - Auth required (always yes for Atlas ERP endpoints)
     - Permission guard (the requirePermission key)
     - Request body shape
     - Response shape (success and error)

     Atlas response convention:
     - success: { data: ... }
     - error: { error: string } -->

### GET /module/resource

Auth: required
Permission: `module.feature.read`
Response: `{ data: Resource[] }`

### POST /module/resource

Auth: required
Permission: `module.feature.create`
Body: `{ field1: string, field2: number }`
Response: `{ data: Resource }`

## 13. SDK contract

<!-- List new or modified methods on @atlas/sdk.
     Domain name, method name, parameters, return type.
     Follow existing SDK patterns (see packages/sdk/src/index.js). -->

Domain: `atlas.modulename`

- `listResources(token, query)` — returns `{ data: Resource[], pagination }`
- `getResource(id, token)` — returns `{ data: Resource }`
- `createResource(payload, token)` — returns `{ data: Resource }`
- `updateResource(id, payload, token)` — returns `{ data: Resource }`
- `setResourceEnabled(id, enabled, token)` — returns `{ data: Resource }`

## 14. Validator contract

<!-- List new or modified Zod schemas in @atlas/validators.
     Schema name and the fields it validates.
     Follow existing patterns in packages/validators/src/index.js. -->

- `createModuleResourceSchema` — validates: field1 (string, required), field2 (number, min 0)
- `updateModuleResourceSchema` — validates: [list fields]

## 15. Module manifest impact

<!-- Does this feature need a new or modified manifest in packages/maps/src/feature-modules.js?
     If yes, describe:
     - Module key
     - Dependencies
     - Permissions array
     - Navigation entries
     - ACL map (module, actions, models)
     - Blueprints (if any) -->

Module key: `atlas.modulename`
Dependencies: `[{ key: "atlas.core" }, { key: "atlas.identity" }]`
Core: false
Uninstallable: true

Permissions:
- `modulename.access`
- `modulename.feature.read`
- `modulename.feature.create`
- `modulename.feature.update`
- `modulename.feature.delete`

ACL module: `modulename.access`
ACL actions: [map action names to permission keys]
ACL models: [map model names to CRUD permission keys]

## 16. Navigation impact

<!-- New navigation items added by this module.
     Label must be in Spanish.
     permissionKey must match a declared permission. -->

| Label (Spanish) | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Recursos | /resources | Package | main | modulename.feature.read |

## 17. Blueprint impact

<!-- Does this feature define new blueprints or modify existing ones?
     If yes: blueprint key, kind (ENTITY/FORM/TABLE/DASHBOARD/ACTION/RELATION/PERMISSION), schema summary.
     If no: N/A -->

N/A

## 18. RBAC/permissions

<!-- List all permission keys this feature declares.
     For each permission, state:
     - Which API endpoint(s) it guards
     - Whether it gates a navigation item
     Follow the Atlas granular permission convention. -->

| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| modulename.access | (module access) | No |
| modulename.feature.read | GET /module/resource | Yes |
| modulename.feature.create | POST /module/resource | No |
| modulename.feature.update | PUT /module/resource/:id | No |
| modulename.feature.delete | PATCH /module/resource/:id/enabled | No |

## 19. Multi-company behavior

<!-- How does this feature handle company scoping?
     Are all queries scoped to the authenticated user's active company?
     How is cross-company data isolation enforced at the API layer?
     Are there any cases where cross-company data is intentionally accessible? -->

## 20. Files/storage impact

<!-- Does this feature upload, store, or retrieve files via Supabase Storage?
     If yes:
     - Which Supabase Storage bucket is used? (canonical: atlas-files)
     - What objectKey prefix convention is used? (e.g., modules/atlas.modulename/EntityType/<entityId>/...)
     - Is FileAsset metadata written via Prisma?
     If no: N/A -->

N/A

## 21. Export/import requirements

<!-- Does this feature require PDF, Excel, or CSV exports?
     Does it require bulk import?
     If yes: specify format, scope (what data), and trigger (user action or scheduled).
     If no: N/A -->

N/A

## 22. Audit log requirements

<!-- Which user actions must be recorded in AuditLog?
     For each action:
     - Action key: module.entity.action (e.g., ledger.account.create)
     - Actor: authenticated user
     - Before/after payload shape
     If no audit logging is required: N/A -->

| Action key | Trigger | Payload |
|---|---|---|
| modulename.resource.create | POST /module/resource | after: { id, field1, field2 } |
| modulename.resource.update | PUT /module/resource/:id | before: {...}, after: {...} |
| modulename.resource.disable | PATCH .../enabled | after: { enabled: false } |

## 23. Edge cases

<!-- Numbered list of non-obvious cases the implementation must handle correctly.
     Think: concurrent updates, empty states, permission boundary conditions,
     soft-deleted parent records, missing optional dependencies, etc. -->

1.
2.
3.

## 24. Risks

<!-- Numbered list of technical or product risks.
     For each risk, state the mitigation strategy. -->

1. Risk: [description]. Mitigation: [strategy].
2.

## 25. Acceptance criteria

<!-- Numbered, testable, falsifiable statements.
     Format: "Given [precondition], when [action], then [observable outcome]."
     Every goal in Section 5 should have at least one acceptance criterion. -->

1. Given a user with `modulename.feature.read`, when they navigate to /module/resource, then the resource list is displayed.
2. Given a user without `modulename.feature.create`, when they POST /module/resource, then the API returns 403.
3.

## 26. Verification plan

<!-- The specific commands and checks that will be run to verify the implementation.
     These become the basis for the verification checklist.
     Include: build commands, migration commands, API smoke tests, permission checks. -->

- `pnpm build` — no build errors
- `pnpm db:generate` — Prisma client regenerates cleanly
- `pnpm db:migrate` — migration applies without errors
- `pnpm db:seed` — new permissions are seeded
- Manual: authenticate as a user with `modulename.feature.read`, confirm list endpoint returns 200
- Manual: authenticate as a user without `modulename.feature.create`, confirm POST returns 403

## 27. Rollback plan

<!-- How to safely revert this feature if a critical issue is found.
     Which migrations are involved?
     Is a rollback migration (new forward migration undoing the schema change) required?
     Is there a feature flag or module disable path? -->

## 28. Future enhancements

<!-- Things explicitly deferred to a later version.
     Listing them here prevents non-goals from being forgotten and makes future spec work faster. -->

1.
2.
