# Phase 9 - HR Module (Dedicated Record Route, Odoo-style UX)

Date: 2026-05-05

## Goal

Deliver a complete HR v1 module centered on a dedicated employee record route with full, always-visible profile information, direct view/edit toggling, markdown-rich notes, file attachments, and in-view change history.

## Scope

1. Dedicated routes for HR list and employee record detail.
2. Single long-form employee profile screen (not modal-centric).
3. View/Edit toggle with consistent layout and async loading feedback.
4. Real markdown authoring + rendered reading mode for notes.
5. Employee file dossier using canonical `atlas-files` pipeline.
6. Audit timeline embedded in the same employee page.

## UX decisions (approved)

1. Employee profile uses a dedicated route: `/app/m/atlas.hr/hr/employees/:id`.
2. Employee detail is a single long-form page with all key sections visible.
3. Main interactions are in-page (not modal-first).
4. Notes must render as formatted content (not raw markdown syntax).

## Domain model (HR v1)

Primary entity: `HrEmployee` (company-scoped, soft-disable with `enabled`).

Required fields:
1. Identity: `firstName`, `lastName`, `status`, `employeeCode`.
2. Employment: `jobTitle`, `department`, `managerName`, `hireDate`, `terminationDate`, `workLocation`, `employmentType`.
3. Contact: `workEmail`, `personalEmail`, `phone`, `emergencyContactName`, `emergencyContactPhone`.
4. Notes: `notesMarkdown`.
5. Extensibility: `metadata` JSON.

## Files strategy

1. Reuse `FileAsset` with canonical bucket policy (`atlas-files`).
2. HR attachments must persist with:
- `moduleKey = atlas.hr`
- `entityType = HrEmployee`
- `entityId = <employeeId>`
3. Employee record page shows dossier list and upload flow with multi-file support.

## Audit strategy

Reuse `AuditLog` for HR events with actor and before/after payloads.

Minimum actions:
1. `hr.employee.create`
2. `hr.employee.update`
3. `hr.employee.enable`
4. `hr.employee.disable`
5. `hr.employee.file.attach`
6. `hr.employee.note.update`

## API and SDK contracts

API endpoints:
1. `GET /hr/employees`
2. `GET /hr/employees/:id`
3. `POST /hr/employees`
4. `PUT /hr/employees/:id`
5. `PATCH /hr/employees/:id/enabled`
6. `GET /hr/employees/:id/audit`

SDK surface (`atlas.hr`):
1. `listEmployees(token, query)`
2. `getEmployee(id, token)`
3. `createEmployee(payload, token)`
4. `updateEmployee(id, payload, token)`
5. `setEmployeeEnabled(id, enabled, token)`
6. `getEmployeeAudit(id, token, options)`

## Permissions

1. `hr.read`
2. `hr.create`
3. `hr.update`
4. `hr.delete` (disable/soft-delete workflow)

## UI composition

Employee page sections (single long-form layout):
1. Header: identity, status, quick actions (Edit/Save/Cancel/Disable).
2. Employment profile block.
3. Contact block.
4. Documents block (upload + file list + preview/download entry points).
5. Notes block (markdown editor in edit mode, rich rendered view mode).
6. History block (actor/action/timestamp timeline).

## Error and loading behavior

1. Save actions must disable duplicate submission and show deterministic loading state.
2. Slow requests should surface explicit status feedback (button state + toast).
3. Validation errors remain in Spanish.

## Testing plan

1. Auth/permission contracts:
- Unauthenticated access returns `401`.
- Missing permission returns `403`.

2. CRUD contracts:
- Create/update/disable employee lifecycle with company scope.
- Validation errors for email/date/status fields.

3. File dossier:
- Multi-file upload from employee page.
- Files listed with correct HR metadata linkage.

4. Notes behavior:
- Markdown persists and renders formatted output in read mode.

5. Audit behavior:
- Employee edits produce audit entries with actor and timestamp.

6. UI stability:
- View/Edit toggle does not shift layout unexpectedly.
- Async save/upload states prevent accidental duplicate actions.

## Out of scope (deferred)

1. Payroll calculations.
2. Attendance/time tracking.
3. Leave approval workflows.
4. Recruitment pipeline.
5. Organizational chart visualization.

## Spec status

This spec defines the approved target for Phase 9 HR full module delivery and supersedes earlier ad-hoc HR notes in chat context.
