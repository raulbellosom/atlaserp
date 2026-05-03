# Atlas ERP — Core Modules

Four core modules. All have `core: true`, `uninstallable: false`. None can be removed or disabled. All feature modules depend on one or more of these.

## atlas.core

**Owns:** Module registry, installer/uninstaller, navigation shell, dashboard shell, audit logs, system health endpoint, global settings UI, InstanceConfig reads.

**Depends on:** Nothing (root module).

**Permissions:** `core.read`, `core.manage`, `modules.install`, `modules.uninstall`, `modules.disable`, `audit.read`

**Navigation:** Dashboard (`/`), Módulos (`/modules`), Configuración (`/settings`)

## atlas.identity

**Owns:** Supabase Auth bridge, UserProfile records, Company profile, Membership assignments, Role and Permission definitions. Users UI, Roles UI, Permissions UI.

**Does NOT own:** Branding/theming (→ atlas.branding). HR employee records (→ future atlas.hr).

**Depends on:** `atlas.core`

**Permissions:** `identity.read`, `identity.manage`, `roles.read`, `roles.manage`, `permissions.read`, `permissions.manage`

**Navigation:** Usuarios (`/identity/users`), Roles (`/identity/roles`)

## atlas.files

**Owns:** FileAsset metadata records, Supabase Storage bucket strategy, upload/download proxy endpoints, reusable file picker component exposed to other modules.

**Depends on:** `atlas.core`

**Permissions:** `files.read`, `files.upload`, `files.delete`, `files.manage`

**Navigation:** None (files accessed through other modules' UI)

**Supabase Storage buckets:**
- `atlas-branding` — company logos and branding assets
- `atlas-files` — general file uploads from any module

## atlas.branding

**Owns:** Company logo (references a FileAsset), color palette, theme variables, login screen branding metadata.

**Why separate from atlas.identity:** Identity is about access control. Branding is about appearance. Different permissions, different UIs, different change frequency.

**Depends on:** `atlas.core`, `atlas.files`

**Permissions:** `branding.read`, `branding.manage`

**Navigation:** Marca (`/settings/branding`)

**Note:** The BrandingConfig Prisma model is added in Phase 3. Phase 0 adds the manifest and seeds the module metadata only.
