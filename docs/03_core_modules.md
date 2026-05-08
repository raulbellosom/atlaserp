# Atlas ERP - Core Modules

Four core modules. All have `core: true`, `uninstallable: false`. None can be removed or disabled. All feature modules depend on one or more of these.

## atlas.core

**Owns:** Module registry, installer/uninstaller, navigation shell, dashboard shell, audit logs, system health endpoint, global settings UI, InstanceConfig reads.

**Depends on:** Nothing (root module).

**Permissions:** `core.access`, `core.read`, `core.manage`, `core.modules.read|create|update|delete`, `core.instance.read|create|update|delete`, `audit.read`

**Navigation:** Dashboard (`/`), Modulos (`/modules`), Configuracion (`/settings`)

## atlas.identity

**Owns:** Supabase Auth bridge, UserProfile records, Company profile, Membership assignments, Role and Permission definitions. Users UI, Roles UI, Permissions UI.

**Does NOT own:** Company/branding config (-> atlas.company). HR employee records (-> future atlas.hr).

**Depends on:** `atlas.core`

**Permissions:** `identity.access`, `identity.users.read|create|update|delete`, `identity.roles.read|create|update|delete`, `identity.permissions.read|create|update|delete`, `profile.self.read|update`, `profile.avatar.update`, `profile.password.update`

**Navigation:** Usuarios (`/identity/users`), Roles (`/identity/roles`)

## atlas.files

**Owns:** FileAsset metadata records, Supabase Storage bucket strategy, upload/download proxy endpoints, reusable file picker component exposed to other modules.

**Depends on:** `atlas.core`

**Permissions:** `files.access`, `files.assets.read|create|update|delete`

**Navigation:** None (files accessed through other modules' UI)

**Supabase Storage bucket policy:**

- `atlas-files` - canonical bucket for all uploads (branding, files, profile media)
- Resource ownership and origin are tracked in `FileAsset` (`moduleKey`, `entityType`, `entityId`, `metadata`)

## atlas.company

**Owns:** Company logo (references a FileAsset), color palette, theme variables, login screen branding metadata.

**Why separate from atlas.identity:** Identity is about access control. Branding is about appearance. Different permissions, different UIs, different change frequency.

**Depends on:** `atlas.core`, `atlas.files`

**Permissions:** `company.access`, `company.profile.read|create|update|delete`, `company.address.read|create|update|delete`, `company.branding.read|create|update|delete`

**Navigation:** Marca (`/settings/branding`)

**Note:** The BrandingConfig Prisma model is added in Phase 3. Phase 0 adds the manifest and seeds the module metadata only.
