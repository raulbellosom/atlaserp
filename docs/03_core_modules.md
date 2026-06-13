# Atlas ERP - Core Modules

Fourteen official modules. All have `core: true`, `uninstallable: false`. None can be removed or disabled from module lifecycle endpoints.

## Quality standards

All core modules must comply with the [Module Quality Standards](module-quality-standards.md). Criteria marked **REQUIRED** in that document are non-negotiable for any core module. CONDITIONAL criteria apply based on whether the module's design includes the relevant surface (list views, entity attachments, push events, etc.). Run a full 17-point audit before marking any core module update as production-ready.

## atlas.core

Owns module registry/lifecycle, dashboard shell entry, system config, and audit-level platform controls.

Depends on: none.

Permissions: `core.access`, `core.read`, `core.manage`, `core.modules.read|create|update|delete`, `core.instance.read|create|update|delete`, `audit.read`

Navigation: Modulos (`/modules`), Configuracion (`/settings`)

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

## atlas.fleet

Owns fleet management: vehicles, drivers, insurance policies, maintenance/service/repair reports, and catalogs (vehicle types, brands, models).

Depends on: `atlas.core`

Permissions: `fleet.access`, `fleet.vehicles.read|create|update|delete`, `fleet.drivers.read|create|update|delete`, `fleet.reports.read|create|update|delete`, `fleet.insurance.read|create|update|delete`, `fleet.catalogs.read|create|update|delete`

Navigation: Vehiculos (`/app/m/atlas.fleet/vehicles`), Seguros (`/app/m/atlas.fleet/insurance`), Reportes (`/app/m/atlas.fleet/reports`), Choferes (`/app/m/atlas.fleet/drivers`), Catalogos (`/app/m/atlas.fleet/catalogs`)

## atlas.ledger

Owns bank accounts, transactions, categories, transaction types, and multi-user ledger groups (shared accounts with role-based access).

Depends on: `atlas.core`

Permissions: `ledger.accounts.read|create|update|delete`, `ledger.transactions.read|create|update|delete`, `ledger.export`, `ledger.import`, `ledger.categories.manage`, `ledger.types.manage`, `ledger.groups.read|write`, `ledger.members.write`

Navigation: Cuentas (`/app/m/atlas.ledger/accounts`), Categorias (`/app/m/atlas.ledger/categories`), Tipos de mov. (`/app/m/atlas.ledger/types`)

Tauri offline mode (Tier 2.5): account list, detail, transaction history, and summary charts read from local SQLite cache when offline. Writes, groups, import, and export remain online-only.

## atlas.website

Owns the public website CMS: pages, blog, themes, menus, Puck visual editor, and dist-upload for external builds.

Depends on: `atlas.core`

Permissions: `website.access`, `website.site.read|update`, `website.pages.read|create|update|publish|delete`, `website.theme.read|update`, `website.menus.read|update`, `website.dist.upload`

Navigation: Sitio web (`/`), Contenido (`/pages`, `/blog`), Diseno (`/theme`, `/templates`), Negocio (`/forms`, `/payments`), Configuracion (`/settings`)

Kind: `WEBSITE` (not `CORE`). Uninstallable via data purge.

## atlas.calendar

Owns personal and shared calendars, events, reminders, and Google Calendar sync (OAuth-based source import).

Depends on: `atlas.core`, `atlas.identity`

Permissions: `calendar.access`, `calendar.calendars.read|create|update|delete`, `calendar.events.read|create|update|delete`, `calendar.share.manage`

Navigation: Calendario (`/app/m/atlas.calendar/calendar`)

Full-screen module (fullscreenPaths: `/calendar`).

## atlas.activity

Owns the cross-module activity feed: readable business event log surfaced in the notification bell and timeline.

Depends on: `atlas.core`, `atlas.identity`

Permissions: `activity.access`, `activity.read`, `activity.publish`, `activity.manage`

Navigation: Actividad (`/`)

Exposes: `publishActivity`, `logAndPublish` functions consumed by other modules.

## atlas.notifications

Owns user notification inbox: in-app alerts with priority levels, push delivery (Web Push via service worker), and per-user channel preferences.

Depends on: `atlas.core`, `atlas.identity`

Permissions: `notifications.access`, `notifications.read`, `notifications.publish`, `notifications.manage`

Navigation: Notificaciones (`/app/m/atlas.notifications`), Configuracion (`/app/m/atlas.notifications/settings`)

## atlas.catalog

Owns product catalog: categories, products (simple and variable), variants, option sets, and inventory stock movements.

Depends on: `atlas.core`

Permissions: `catalog.access`, `catalog.products.read|create|update|delete`, `catalog.categories.read|create|update|delete`, `catalog.inventory.adjust`

Navigation: Productos (`/app/m/atlas.catalog`), Categorias (`/app/m/atlas.catalog/categories`), Inventario (`/app/m/atlas.catalog/inventory`)

## atlas.projects

Owns project management: projects, task boards (kanban), tasks, statuses, members, file attachments, and task dependencies.

Depends on: `atlas.core`, `atlas.company`, `atlas.calendar` (optional)

Permissions: `projects.access`, `projects.project.read|create|update|delete`, `projects.task.read|create|update|delete`, `projects.member.manage`

Navigation: Proyectos (`/app/m/atlas.projects`)

Kanban boards with drag-and-drop (desktop + touch), inline @mention for members, optimistic updates, and mobile-first UX. Tasks support file attachments, dependency linking, and push notifications for assignments.

## Source of truth

Canonical runtime/seed manifests for official modules are in:
- `apps/api/src/manifests/official/core-modules.js` — atlas.core, atlas.identity, atlas.files, atlas.company, atlas.fleet, atlas.ledger, atlas.catalog, atlas.calendar
- `apps/api/src/manifests/official/feature-modules.js` — atlas.contacts, atlas.hr, atlas.website, atlas.activity, atlas.notifications (and `featureModules = []` export, all are seeded via `coreModules` array in core-modules.js)
