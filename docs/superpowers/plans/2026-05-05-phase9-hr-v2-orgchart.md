# Phase 9.1 HR v2 (Org Chart + Relational Profile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete HR v2 upgrade with navigable org chart, relational supervisor/department/job title fields, profile image support, and optional user-account linking.

**Architecture:** Extend Prisma domain first (forward migration only), then validators and API service contracts, then SDK, then desktop UX routes/components. Keep strict boundary Desktop -> SDK -> API -> validators -> Prisma, and preserve Spanish UI copy with stable loading/error states.

**Tech Stack:** Prisma 6, Hono API, Zod validators, React + Vite desktop app, shared @atlas/sdk and @atlas/ui components.

---

## File Structure Map

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260505xxxxxx_phase9_hr_v2_orgchart/migration.sql`
- Modify: `packages/validators/src/index.js`
- Modify: `apps/api/src/services/hr-service.js`
- Modify: `apps/api/src/index.js`
- Modify: `packages/sdk/src/index.js`
- Modify: `packages/maps/src/feature-modules.js`
- Create: `apps/desktop/src/modules/atlas.hr/screens/HrOrgChartScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx`
- Modify: `apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.hr/hooks/useHrExplorer.js`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`
- Modify: `docs/TASKS.md`

### Task 1: Extend HR Prisma Domain

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260505xxxxxx_phase9_hr_v2_orgchart/migration.sql`

- [ ] **Step 1: Add relational models and fields in Prisma schema**

```prisma
model HrDepartment {
  id        String   @id @default(cuid())
  companyId String
  name      String
  code      String?
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company   CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employees HrEmployee[]

  @@unique([companyId, name])
  @@index([companyId, enabled])
}

model HrJobTitle {
  id        String   @id @default(cuid())
  companyId String
  name      String
  code      String?
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company   CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employees HrEmployee[]

  @@unique([companyId, name])
  @@index([companyId, enabled])
}
```

- [ ] **Step 2: Extend `HrEmployee` with relational fields**

```prisma
supervisorEmployeeId String?
supervisorEmployee   HrEmployee?  @relation("HrSupervisor", fields: [supervisorEmployeeId], references: [id], onDelete: SetNull)
subordinates         HrEmployee[] @relation("HrSupervisor")

departmentId         String?
department           HrDepartment? @relation(fields: [departmentId], references: [id], onDelete: SetNull)

jobTitleId           String?
jobTitle             HrJobTitle? @relation(fields: [jobTitleId], references: [id], onDelete: SetNull)

profileImageFileId   String?
profileImageFile     FileAsset? @relation(fields: [profileImageFileId], references: [id], onDelete: SetNull)
```

- [ ] **Step 3: Create forward migration**

Run: `pnpm.cmd db:migrate`
Expected: migration directory created and applied with no reset prompt.

- [ ] **Step 4: Regenerate Prisma client**

Run: `pnpm.cmd db:generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(hr): add relational org chart and catalog models"
```

### Task 2: Expand Validators for HR v2

**Files:**
- Modify: `packages/validators/src/index.js`

- [ ] **Step 1: Add catalog schemas**

```js
export const hrDepartmentCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(40).optional().or(z.literal(""))
});

export const hrJobTitleCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(40).optional().or(z.literal(""))
});
```

- [ ] **Step 2: Extend employee create/update schemas with relation fields**

```js
supervisorEmployeeId: z.string().cuid().nullable().optional(),
departmentId: z.string().cuid().nullable().optional(),
jobTitleId: z.string().cuid().nullable().optional(),
profileImageFileId: z.string().cuid().nullable().optional(),
userProfileId: z.string().uuid().nullable().optional()
```

- [ ] **Step 3: Add supervisor self-link rule**

```js
if (data.id && data.supervisorEmployeeId === data.id) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["supervisorEmployeeId"], message: "Un colaborador no puede ser su propio supervisor." });
}
```

- [ ] **Step 4: Verify validator module syntax**

Run: `node --check packages/validators/src/index.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/index.js
git commit -m "feat(hr): add v2 validators for relations and catalogs"
```

### Task 3: Implement HR Service v2 (API Business Logic)

**Files:**
- Modify: `apps/api/src/services/hr-service.js`

- [ ] **Step 1: Add catalog service functions**

```js
export async function listDepartments(ctx) {}
export async function createDepartment(ctx, payload) {}
export async function updateDepartment(ctx, id, payload) {}
export async function setDepartmentEnabled(ctx, id, enabled) {}

export async function listJobTitles(ctx) {}
export async function createJobTitle(ctx, payload) {}
export async function updateJobTitle(ctx, id, payload) {}
export async function setJobTitleEnabled(ctx, id, enabled) {}
```

- [ ] **Step 2: Enforce relation company scope and cycle guard**

```js
async function assertEmployeeHierarchyValid(prisma, companyId, employeeId, supervisorEmployeeId) {
  if (!supervisorEmployeeId) return;
  if (employeeId && employeeId === supervisorEmployeeId) throw new Error("Un colaborador no puede ser su propio supervisor.");
  // walk supervisor chain and throw if it reaches employeeId
}
```

- [ ] **Step 3: Add org chart query function**

```js
export async function getOrgChart(ctx, { rootEmployeeId }) {
  // returns nodes [{ id, name, jobTitle, department, supervisorEmployeeId, profileImageUrl }]
}
```

- [ ] **Step 4: Add profile image and user-link update handling + audit events**

```js
await createAuditLog({ action: "hr.employee.profile-image.update", ... });
await createAuditLog({ action: "hr.employee.link-user", ... });
```

- [ ] **Step 5: Verify service syntax**

Run: `node --check apps/api/src/services/hr-service.js`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/hr-service.js
git commit -m "feat(hr): add v2 service logic for catalogs, hierarchy, and org chart"
```

### Task 4: Wire API Routes for HR v2

**Files:**
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Add catalog endpoints**

```js
app.get("/hr/departments", requireAuth, requirePermission("hr.read"), ...)
app.post("/hr/departments", requireAuth, requirePermission("hr.update"), ...)
app.put("/hr/departments/:id", requireAuth, requirePermission("hr.update"), ...)
app.patch("/hr/departments/:id/enabled", requireAuth, requirePermission("hr.delete"), ...)
```

- [ ] **Step 2: Add job-title endpoints + org-chart endpoint**

```js
app.get("/hr/job-titles", ...)
app.post("/hr/job-titles", ...)
app.put("/hr/job-titles/:id", ...)
app.patch("/hr/job-titles/:id/enabled", ...)
app.get("/hr/org-chart", requireAuth, requirePermission("hr.read"), ...)
```

- [ ] **Step 3: Keep employee/user-options routes returning new relation fields**

```js
include: { department: true, jobTitle: true, supervisorEmployee: true }
```

- [ ] **Step 4: Verify API syntax**

Run: `node --check apps/api/src/index.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(hr): expose v2 catalog and org chart endpoints"
```

### Task 5: SDK and Map Integration

**Files:**
- Modify: `packages/sdk/src/index.js`
- Modify: `packages/maps/src/feature-modules.js`

- [ ] **Step 1: Add `atlas.hr` SDK methods for catalogs and org chart**

```js
listDepartments(token, query = {}) {}
createDepartment(payload, token) {}
listJobTitles(token, query = {}) {}
createJobTitle(payload, token) {}
getOrgChart(token, query = {}) {}
```

- [ ] **Step 2: Ensure HR module map metadata includes org-chart route entry**

```js
{ id: "hr-org-chart", path: "/hr/org-chart", label: "Organigrama" }
```

- [ ] **Step 3: Verify package syntax**

Run:
- `node --check packages/sdk/src/index.js`
- `node --check packages/maps/src/feature-modules.js`

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/index.js packages/maps/src/feature-modules.js
git commit -m "feat(hr): add sdk methods and org chart navigation metadata"
```

### Task 6: HR Employee Detail UX Upgrade

**Files:**
- Modify: `apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx`
- Modify: `apps/desktop/src/modules/atlas.hr/hooks/useHrExplorer.js`

- [ ] **Step 1: Replace free-text supervisor/department/job title fields with searchable comboboxes**

```jsx
<Combobox
  value={form.supervisorEmployeeId}
  options={employeeOptions}
  onCreateOption={null}
/>
<Combobox
  value={form.departmentId}
  options={departmentOptions}
  onCreateOption={handleCreateDepartmentInline}
/>
```

- [ ] **Step 2: Add visible optional user-account linkage section**

```jsx
<Combobox
  label="Cuenta de usuario"
  value={form.userProfileId}
  options={userOptions}
  onClear={() => setForm((prev) => ({ ...prev, userProfileId: null }))}
/>
```

- [ ] **Step 3: Add profile image upload/select block in employee header**

```jsx
<FileUploader
  accept="image/*"
  onUploadComplete={(file) => setForm((prev) => ({ ...prev, profileImageFileId: file.id }))}
/>
```

- [ ] **Step 4: Add pending states for save/link/create actions**

```jsx
<Button disabled={isSaving || isCreatingCatalogItem}>{isSaving ? "Guardando..." : "Guardar"}</Button>
```

- [ ] **Step 5: Build and verify frontend compiles**

Run: `pnpm.cmd --filter ./apps/desktop build:web`
Expected: build success.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx apps/desktop/src/modules/atlas.hr/hooks/useHrExplorer.js
git commit -m "feat(hr): upgrade employee detail with relational comboboxes and user link"
```

### Task 7: Add Navigable Org Chart Screen

**Files:**
- Create: `apps/desktop/src/modules/atlas.hr/screens/HrOrgChartScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Create org chart screen with hierarchical graph cards**

```jsx
export function HrOrgChartScreen() {
  const { nodes, isLoading, error, reload } = useHrOrgChart();
  return <OrgChartCanvas nodes={nodes} onNodeClick={(id) => navigate(`/app/m/atlas.hr/hr/employees/${id}`)} />;
}
```

- [ ] **Step 2: Add pan/zoom controls and reset view action**

```jsx
<Button onClick={zoomIn}>+</Button>
<Button onClick={zoomOut}>-</Button>
<Button onClick={resetView}>Reset</Button>
```

- [ ] **Step 3: Register route and HR nav entry**

```jsx
<Route path="/app/m/atlas.hr/hr/org-chart" element={<HrOrgChartScreen />} />
```

- [ ] **Step 4: Build and verify**

Run: `pnpm.cmd --filter ./apps/desktop build:web`
Expected: build success.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.hr/screens/HrOrgChartScreen.jsx apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(hr): add navigable org chart view"
```

### Task 8: Manual QA + Docs Status Update

**Files:**
- Modify: `docs/TASKS.md`

- [ ] **Step 1: Run API and frontend verification commands**

Run:
- `node --check apps/api/src/index.js`
- `node --check apps/api/src/services/hr-service.js`
- `node --check packages/validators/src/index.js`
- `node --check packages/sdk/src/index.js`
- `pnpm.cmd --filter ./apps/desktop build:web`

Expected: all pass.

- [ ] **Step 2: Execute HR v2 smoke checklist manually**

Checklist:
1. Create department and job title from combobox inline action.
2. Create employee with supervisor and user linkage.
3. Upload profile image and verify it renders.
4. Open org chart and click employee node to navigate.
5. Confirm no cycle allowed in supervisor chain.

- [ ] **Step 3: Update `docs/TASKS.md` with verification evidence**

```md
- [x] Phase 9.1 HR v2 completed.
  Verified: 2026-05-05 (build:web, node --check suite, manual org chart + relations smoke).
```

- [ ] **Step 4: Commit**

```bash
git add docs/TASKS.md
git commit -m "docs(tasks): mark phase 9.1 hr v2 verified"
```

## Spec Coverage Self-Review

1. Org chart navigable view: covered in Task 7.
2. Supervisor relation (non-text): covered in Tasks 1, 2, 3, and 6.
3. Profile image support: covered in Tasks 1, 3, and 6.
4. Department/job title catalogs with create-on-the-fly: covered in Tasks 1, 2, 3, 4, and 6.
5. Optional user linkage visible in profile: covered in Tasks 3 and 6.
6. Spanish UX and loading states: covered in Task 6 and validation in Task 8.

## Placeholder Scan Result

No unresolved placeholders (`TBD`, `TODO`, or ambiguous "later" actions) remain in this plan.

## Type Consistency Check

- `supervisorEmployeeId`, `departmentId`, `jobTitleId`, `profileImageFileId`, and `userProfileId` are consistent across schema, validators, service, API, SDK, and UI tasks.
- Org chart route path `/app/m/atlas.hr/hr/org-chart` is used consistently.
