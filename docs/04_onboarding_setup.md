# Atlas ERP - Onboarding Setup Wizard

## Purpose

On first launch, Atlas ERP has no company, no admin user, and no configuration. The setup wizard guides the first administrator through initialization. After it completes, the instance is marked initialized and cannot run setup again.

## First-run detection (Phase 2)

```
GET /instance/status -> { initialized: boolean, companyId: string | null }
```

Frontend route guard on startup:
- `initialized: false` -> redirect to `/setup`
- `initialized: true` -> redirect to `/login`

Initialization state lives in `InstanceConfig`:

| key | value | written when |
|---|---|---|
| `initialized` | `"true"` | Setup wizard completes |
| `company_id` | company UUID | Company created |
| `completed_at` | ISO timestamp | Setup wizard completes |

## Setup wizard steps

### Step 1 - Administrator account
- First name (required)
- Last name (required)
- Email (required, valid email format)
- Password (required, min 8 chars, uppercase + number + special char)
- Confirm password (must match)
- Phone number (optional)

### Step 2 - Company information
- Company name (required)
- RFC / Tax ID (required)
- Contact email (required)
- Phone number (optional)
- Address (optional)
- Industry (optional, select list)
- Country (required)
- State / City (optional)
- Website (optional)

### Step 3 - Branding
- Company logo upload (image only, max 2 MB)
- Primary color picker
- Secondary/accent color picker
- Logo uploaded to Supabase Storage bucket `atlas-files` under `company/branding/<companyId>/...`
- FileAsset metadata is created with `moduleKey=atlas.company`, `entityType=BrandingConfig`, `entityId=<companyId>`

### Step 4 - Review and confirm
- Summary of all entered data
- Back buttons to edit any step
- Confirm and finish button

## Setup API (Phase 3)

```
POST /setup/initialize
Body: { admin: { firstName, lastName, email, password, phone },
        company: { name, taxId, email, phone, country, ... },
        branding: { logoFile, primaryColor, secondaryColor } }

Steps:
1. Validate all input with Zod
2. If InstanceConfig.initialized == "true" -> return 409
3. Create Supabase Auth user (Admin SDK, service role key)
4. Create UserProfile via Prisma
5. Create Company via Prisma
6. Upload logo to Supabase Storage (bucket: atlas-files)
7. Create FileAsset metadata via Prisma
8. Create BrandingConfig via Prisma
9. Mark all 4 core modules as INSTALLED
10. Create system.admin Role (if not seeded)
11. Assign admin role to UserProfile via Membership
12. Write InstanceConfig records
13. Return { success: true }
```

## Security

- `POST /setup/initialize` is unauthenticated (no user exists yet)
- Returns 409 if already initialized
- Endpoint is idempotent per request but permanently blocked after first success
- No "reset instance" admin UI until explicitly designed

## After setup

React redirects to `/login`. Login screen shows company logo, company name, and branding colors loaded from the API.
