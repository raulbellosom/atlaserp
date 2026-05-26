# Atlas ERP - Core Modules

Six core modules. All have `core: true`, `uninstallable: false`. None can be removed or disabled from module lifecycle endpoints.

## atlas.core

Owns module registry/lifecycle, dashboard shell entry, system config, and audit-level platform controls.

Depends on: none.

Permissions: `core.access`, `core.read`, `core.manage`, `core.modules.read|create|update|delete`, `core.instance.read|create|update|delete`, `audit.read`

Navigation: Dashboard (`/`), Modulos (`/modules`), Configuracion (`/settings`)

## atlas.identity

Owns identity and access control: users, roles, permissions, profiles, memberships.

Depends on: `atlas.core`

Permissions: `identity.access`, `identity.users.read|create|update|delete`, `identity.roles.read|create|update|delete`, `identity.permissions.read|create|update|delete`, `profile.self.read|update`, `profile.avatar.update`, `profile.password.update`

Navigation: Usuarios (`/identity/users`), Roles (`/identity/roles`)

## atlas.files

Owns file metadata (`FileAsset`) and storage integration contracts for uploads, signed URLs, and asset lifecycle.

Depends on: `atlas.core`

Permissions: `files.access`, `files.assets.read|create|update|delete`

Navigation: Archivos (`/files`)

Storage baseline: bucket `atlas-files` is canonical for module assets.

## atlas.company

Owns company profile, address, and branding configuration.

Depends on: `atlas.core`, `atlas.files`

Permissions: `company.access`, `company.profile.read|create|update|delete`, `company.address.read|create|update|delete`, `company.branding.read|create|update|delete`

Navigation: Resumen (`/`), Perfil (`/company`), Direccion (`/company/address`), Marca visual (`/company/branding`)

## atlas.contacts

Owns customer/supplier/person/company contact records and reusable picker contracts.

Depends on: `atlas.core`, `atlas.identity`

Permissions: `contacts.access`, `contacts.contacts.read|create|update|delete`

Navigation: Contactos (`/contacts`)

## atlas.hr

Owns employee records, departments, job titles, and HR org-chart surfaces.

Depends on: `atlas.core` (`atlas.files` optional)

Permissions: `hr.access`, `hr.employee.read|create|update|delete`, `hr.department.read|create|update|delete`, `hr.job_title.read|create|update|delete`, `hr.org_chart.read|create|update|delete`

Navigation: Colaboradores (`/hr/employees`), Organigrama (`/hr/org-chart`), Catalogos (`/hr/catalogs`)

## Source of truth

Canonical runtime/seed manifests for official modules are in:
- `apps/api/src/manifests/official/core-modules.js`
- `apps/api/src/manifests/official/feature-modules.js`
