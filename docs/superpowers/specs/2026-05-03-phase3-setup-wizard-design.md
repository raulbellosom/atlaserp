# Phase 3 â€” Setup Wizard Design

> Superseded in storage policy by Phase 7.1 (2026-05-04): canonical bucket is `atlas-files` for branding and files.


## Goal

Replace the `SetupPlaceholder` stub with a real 4-step onboarding wizard that collects admin account details, company name, and branding, then initializes the Atlas ERP instance by creating all required records in a single atomic operation.

## Wizard layout

Left sidebar + right content panel (Option B). The sidebar lists all 4 steps with number badges and connector lines. The active step is highlighted; pending steps are dimmed. The right panel shows the step title, subtitle, form fields, and a Back / Next footer. The shell is constant across all steps â€” only the sidebar highlight and right-panel content change.

## Steps

| # | Title | Fields |
|---|---|---|
| 1 | Cuenta de administrador | Display name (required), email (required), password (required, min 8), confirm password (required) |
| 2 | Empresa | Company name (required, min 2) |
| 3 | Marca | Primary color (required, hex color picker), logo file (optional, image) |
| 4 | Revisar | Read-only summary of all fields + "Inicializar" button |

Company slug is auto-generated from company name (kebab-case). Not shown to the user during setup.

## Data model

New Prisma model `BrandingConfig`:

```prisma
model BrandingConfig {
  id           String   @id @default(uuid(7))
  companyId    String   @unique
  primaryColor String
  logoFileId   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company      Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
}
```

`Company` gains a `brandingConfig BrandingConfig?` back-relation.

`InstanceConfig` keys written on completion:
- `initialized = "true"`
- `company_id = <company uuid>`
- `completed_at = <ISO timestamp>`

## API

### POST /setup/initialize

Accepts `multipart/form-data`.

| Field | Type | Required | Validation |
|---|---|---|---|
| `adminDisplayName` | string | yes | min 2 |
| `adminEmail` | string | yes | valid email |
| `adminPassword` | string | yes | min 8 |
| `companyName` | string | yes | min 2 |
| `primaryColor` | string | yes | hex color (#rrggbb) |
| `logo` | file | no | image/*, max 2 MB |

**Transaction sequence:**

1. Check `InstanceConfig` key `initialized` â€” if `"true"`, return 409 `{ error: 'Already initialized' }`.
2. `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })` â†’ capture `authUserId`. If this fails, return 400 with Supabase error message.
3. If logo provided: upload to Supabase Storage bucket `atlas-branding` at `logos/<company-slug>.<ext>` â†’ create `FileAsset` row â†’ capture `logoFileId`.
4. `prisma.$transaction`:
   - Create `Company` (name, slug)
   - Create `UserProfile` (authUserId, displayName, email)
   - Create `Membership` (companyId, userId, roleId = id of the Role with key `atlas.admin`, looked up via `prisma.role.findFirst({ where: { key: 'atlas.admin' } })`)
   - Create `BrandingConfig` (companyId, primaryColor, logoFileId?)
   - Upsert `InstanceConfig` keys: `initialized`, `company_id`, `completed_at`
5. Return `{ ok: true }`.

**Cleanup on failure:** If step 2 succeeds but steps 3â€“4 fail, call `supabaseAdmin.auth.admin.deleteUser(authUserId)` before returning 500. This prevents orphaned Supabase Auth users.

**Idempotency:** The 409 guard in step 1 prevents double-initialization.

### Validator

`setupInitializeSchema` added to `packages/validators/src/index.js`:

```js
export const setupInitializeSchema = z.object({
  adminDisplayName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  companyName: z.string().min(2),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/)
})
```

(Logo is a file field handled via Hono's `parseBody` â€” not part of the Zod schema.)

### SDK

`setup.initialize(formData)` added to `packages/sdk/src/index.js`:

```js
setup: {
  initialize: (formData) => request('/setup/initialize', { method: 'POST', body: formData })
}
```

`formData` is a browser `FormData` object. No `Content-Type` header is set manually â€” the browser adds the correct `multipart/form-data` boundary automatically.

## Frontend

### File map

```
apps/desktop/src/
  setup/
    SetupWizard.jsx    â€” wizard shell: sidebar + step routing + form state
    StepAdmin.jsx      â€” step 1 form
    StepCompany.jsx    â€” step 2 form
    StepBranding.jsx   â€” step 3 form (color picker + optional logo)
    StepReview.jsx     â€” step 4 summary + submit
```

`main.jsx` imports `SetupWizard` and replaces `SetupPlaceholder` at the `/setup` route.

### State

`SetupWizard` owns a single `formData` state object accumulated across steps:

```js
{
  adminDisplayName: '',
  adminEmail: '',
  adminPassword: '',
  companyName: '',
  primaryColor: '#6366f1',
  logo: null   // File or null
}
```

Each step receives `{ data, onChange, onNext, onBack }`. Steps validate their own fields before calling `onNext`. `onBack` is disabled on step 1.

### Submit (step 4)

`StepReview` calls `useMutation` with `atlas.setup.initialize`. On mutation success:
1. Invalidate `['instance-status']` query in the shared `queryClient`
2. `navigate('/login', { replace: true })`

On error: show error message inline on step 4 without navigating away.

### UI components used

All from `@atlas/ui`: `Input`, `Button`, `Label`. Color picker uses a native `<input type="color">` wrapped with a label. Logo upload uses a native `<input type="file" accept="image/*">` with drag-target styling.

## Error handling

| Scenario | Behavior |
|---|---|
| Email already registered in Supabase | API returns 400 with message; step 4 shows inline error |
| Logo > 2 MB | Client-side validation on file select; step 3 shows inline error |
| Network error during submit | Step 4 shows inline error; user can retry |
| Already initialized (409) | Step 4 shows "Esta instancia ya fue configurada." with link to `/login` |
| Partial failure (Auth created, DB failed) | API cleans up Auth user; returns 500; step 4 shows generic error |

## Out of scope for Phase 3

- Password strength meter
- Email verification flow (email_confirm set to true server-side)
- Multi-language support
- Custom slug editing during setup
- Secondary colors or full theme customization (deferred to settings)


