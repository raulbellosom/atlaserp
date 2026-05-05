# Phase 9.1 - HR v2 (Org Chart + Relational Profile)

Date: 2026-05-05

## Goal

Upgrade HR from basic employee CRUD into a more complete people management experience with:
1. Navigable organizational chart.
2. Real employee-to-supervisor relationship (not free text).
3. Employee profile image support through the canonical files pipeline.
4. Relational Department and Job Title catalogs with create-on-the-fly combobox UX.
5. Optional linkage between employee record and platform user account.

## Scope

1. Data model expansion for hierarchy and catalogs.
2. API/service contracts for catalogs, hierarchy-safe employee updates, and profile image linkage.
3. SDK additions for new HR domains.
4. Desktop UX upgrade on dedicated employee routes.
5. Navigable org chart view with employee drill-down.

## Approved decisions

1. Org chart must be a navigable hierarchical view (card-based, click-through to employee profile).
2. Department and Job Title are first-class relational catalogs (`HrDepartment`, `HrJobTitle`), with combobox creation.
3. Employee to user account linkage remains optional and uses searchable selector of existing users.
4. No placeholder/fake data patterns; all flows use real backend data.

## Domain model design

### 1) HrEmployee changes

Add/confirm fields:
1. `supervisorEmployeeId` (nullable self-reference).
2. `departmentId` (nullable relation to `HrDepartment`).
3. `jobTitleId` (nullable relation to `HrJobTitle`).
4. `profileImageFileId` (nullable relation to `FileAsset`).
5. `userProfileId` (nullable relation to user profile/account, optional linkage).

Keep existing HR v1 fields and soft lifecycle:
1. `companyId` required for scope.
2. `enabled` for soft-disable behavior.
3. existing identity/employment/contact/notes fields remain valid.

### 2) New catalog entities

`HrDepartment`:
1. `id`, `companyId`, `name`, `code` (optional), `enabled`, timestamps.
2. Unique constraints scoped by company (`companyId + normalizedName`, optional `companyId + code`).

`HrJobTitle`:
1. `id`, `companyId`, `name`, `code` (optional), `enabled`, timestamps.
2. Unique constraints scoped by company (`companyId + normalizedName`, optional `companyId + code`).

### 3) Relationship rules

1. Employee cannot be their own supervisor.
2. Supervisor graph cannot contain cycles (A->B->C->A).
3. Disabling a department/job title does not delete linked employees.
4. Profile image uses `FileAsset` from canonical bucket `atlas-files`.

## Files strategy (profile image)

1. Reuse existing upload endpoint and files pipeline.
2. Profile images are uploaded with metadata:
- `moduleKey = atlas.hr`
- `entityType = HrEmployee`
- `entityId = <employeeId>`
3. Persist selected image on `HrEmployee.profileImageFileId`.
4. Read image via signed URL policy already used by Files module.

## API contracts

### Employee endpoints (expand existing)

1. `GET /hr/employees`
- Include relational summary fields (`department`, `jobTitle`, `supervisor`, `userProfile`).
- Support filters: status, department, job title, search.

2. `GET /hr/employees/:id`
- Return full profile with relation objects.

3. `POST /hr/employees`
4. `PUT /hr/employees/:id`
5. `PATCH /hr/employees/:id/enabled`
6. `GET /hr/employees/:id/audit`

### New catalog endpoints

1. `GET /hr/departments`
2. `POST /hr/departments`
3. `PUT /hr/departments/:id`
4. `PATCH /hr/departments/:id/enabled`

5. `GET /hr/job-titles`
6. `POST /hr/job-titles`
7. `PUT /hr/job-titles/:id`
8. `PATCH /hr/job-titles/:id/enabled`

### User linkage endpoint

1. `GET /hr/user-options`
- Searchable list of eligible platform users for optional employee linkage.
- Include enough data for combobox label (`name`, `email`, `role`).

### Org chart endpoint

1. `GET /hr/org-chart`
- Returns hierarchy nodes for selected root or full company tree.
- Payload optimized for card graph rendering and drill-down.

## Service-layer rules

1. Keep route handlers thin; all business logic in `hr-service`.
2. Validate cycle prevention server-side on create/update supervisor assignments.
3. Validate company scope on every relation assignment (department, title, supervisor, file, user).
4. Emit audit events for:
- `hr.employee.create`
- `hr.employee.update`
- `hr.employee.enable`
- `hr.employee.disable`
- `hr.employee.link-user`
- `hr.employee.unlink-user`
- `hr.employee.profile-image.update`
- catalog create/update/enable/disable actions.

## SDK surface additions

Under `atlas.hr`:
1. `listDepartments(token, query)`
2. `createDepartment(payload, token)`
3. `updateDepartment(id, payload, token)`
4. `setDepartmentEnabled(id, enabled, token)`
5. `listJobTitles(token, query)`
6. `createJobTitle(payload, token)`
7. `updateJobTitle(id, payload, token)`
8. `setJobTitleEnabled(id, enabled, token)`
9. `getOrgChart(token, params)`

Existing employee methods continue with expanded payload support.

## Desktop UX design

### 1) Employee profile page (dedicated route)

Route stays dedicated and visible (`/app/m/atlas.hr/hr/employees/:id`).

Sections:
1. Header: avatar, status, quick actions (Edit/Save/Cancel/Disable).
2. Employment: supervisor combobox, department combobox-create, title combobox-create, dates, type.
3. Contact: email/phone fields.
4. User linkage: optional platform account selector + clear action.
5. Notes: rich markdown editor in edit mode, formatted render in read mode.
6. Documents and history blocks remain embedded.

### 2) Org chart screen

Add HR navigation item/route for org chart (`/app/m/atlas.hr/hr/org-chart`).

Features:
1. Hierarchical card graph with connectors.
2. Click card to open employee profile route.
3. Pan/zoom controls for medium teams.
4. Root/team filter for navigation and performance.
5. Empty state and broken-link state handling (missing supervisor fallback).

### 3) Combobox UX

Department/job title fields:
1. Search existing options.
2. `Create "<typed value>"` inline action in dropdown.
3. New option selected automatically on creation success.
4. Disable duplicate submissions with loading indicator.

## Error handling and loading behavior

1. All async mutations must disable repeated action while pending.
2. Save/link/create catalog actions show deterministic pending state and completion toast.
3. Validation and business errors remain in Spanish with proper accents.
4. If org chart fetch fails, show recoverable in-view error with retry action.

## Security and boundaries

1. Maintain architecture boundary: Desktop -> SDK -> API -> validators -> Prisma.
2. No direct frontend Supabase/Postgres access.
3. Enforce company scope even if current deployment is single-company.

## Testing plan

1. Data integrity:
- supervisor self-link blocked.
- hierarchy cycle blocked.
- cross-company relation assignment blocked.

2. Catalog lifecycle:
- create/search/update/disable for departments and job titles.
- inline create in combobox selects new item correctly.

3. Employee profile:
- create/update with relations and user linkage.
- unlink user flow works.
- profile image upload/link and signed URL rendering works.

4. Org chart:
- graph renders hierarchy correctly.
- card click navigates to employee profile.
- pan/zoom interaction works on desktop and responsive layouts.

5. Regression:
- existing HR list/detail, files attachments, and audit timeline remain stable.

## Out of scope (deferred)

1. Payroll engine.
2. Attendance/clock-in.
3. Leave approval workflow.
4. Recruitment pipeline.
5. Advanced HR analytics dashboards.

## Success criteria

1. HR module feels complete for core people structure management.
2. Supervisor and org structure are relational and navigable.
3. Department/title options are managed as reusable catalogs, not free text.
4. Employee profile includes both identity and system-linkage context (optional user account).
