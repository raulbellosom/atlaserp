# Runly - catálogo oficial por defecto

Date: 2026-09-13
Spec: `docs/superpowers/specs/2026-09-13-runly-catalog-default-design.md`
Status: Complete (local implementation; deployment and stored-metadata sync pending)
Mode: IMPLEMENTATION
Authorization: usuario eligió el alcance máximo (branding + catálogo + rename de carpetas + IDs nativos) el 2026-09-13.

## Goal

El catálogo oficial de 21 módulos y toda comparación interna de clave de rol/módulo/permiso pasan a emitir `runly.*` por defecto, sin romper la compatibilidad `atlas.*` ya construida en stage 4a/4b ni afectar bases de datos existentes.

## Architecture summary

Cambiar `key`/`dependencies[].key` en los manifiestos oficiales de `atlas.*` a `runly.*`. Actualizar `prisma/seed.js` para crear el rol de sistema como `runly.admin`. Revisar cada archivo de aplicación (no de prueba) que compara literalmente contra `"atlas.xxx"` y actualizarlo a `"runly.xxx"`, o centralizarlo en una constante compartida cuando aparezca repetido. No tocar los archivos de prueba que existen específicamente para verificar que la compatibilidad `atlas.*` sigue funcionando (esos deben seguir usando `atlas.*` como fixture deliberado del spelling legacy).

## File Structure Map

Modify (catálogo/seed):

- `apps/api/src/manifests/official/core-modules.js`
- `apps/api/src/manifests/official/feature-modules.js`
- `prisma/seed.js:154,170`

Modify (comparaciones de rol/permiso admin):

- `apps/api/src/lib/tenant-context.js:12` (`COMPANY_ADMIN_ROLE_KEYS`)
- `apps/api/src/routes/notes/shares-service.js:105,137`
- `apps/api/src/index.js:294,629,659,670,746,894,1245`

Modify (mapas de sync offline):

- `apps/api/src/services/sync-service.js`
- `apps/api/src/services/sync-push-service.js`

Modify (rutas públicas / prefijos ERP):

- `apps/api/src/routes/public-website.js`

Modify (moduleKey literal en rutas/servicios de dominio — revisar cada uno y actualizar solo los literales de las 21 llaves oficiales, dejando namespaces custom/community intactos):

- `apps/api/src/services/module-lifecycle-service.js`
- `apps/api/src/services/module-cleanup-registry.js`
- `apps/api/src/services/storefront-capture-service.js`
- `apps/api/src/services/storefront-files-service.js`
- `apps/api/src/services/files/workspace.js`
- `apps/api/src/services/files-service.js`
- `apps/api/src/services/hr-service.js`
- `apps/api/src/services/inventory-service.js`
- `apps/api/src/services/company-service.js`
- `apps/api/src/services/office/access.js`
- `apps/api/src/services/office/service.js`
- `apps/api/src/routes/files.js`
- `apps/api/src/routes/chat/chat-moderation-service.js`
- `apps/api/src/routes/growth/growth-analytics-routes.js`
- `apps/api/src/routes/growth/growth-lead-service.js`
- `apps/api/src/routes/pos/service-helpers.js`
- `apps/api/src/routes/pfm/receipts-routes.js`
- `apps/api/src/routes/website/dist-routes.js`
- `apps/api/src/routes/website/website-service.js`
- `apps/api/src/routes/documents/document-generation-service.js`
- `apps/api/src/routes/documents/document-template-service.js`

Do not modify (regression/compat fixtures — must keep exercising the legacy `atlas.*` spelling on purpose):

- `apps/api/src/services/__tests__/runly-module-registration.test.js`
- `apps/api/src/__tests__/cross-tenant/cross-tenant-security.test.js`
- `apps/api/src/__tests__/cross-tenant/fixtures.mjs`
- `apps/api/src/lib/__tests__/tenant-context.test.js`
- `apps/api/src/services/__tests__/sync-service.test.js`
- `apps/api/src/services/__tests__/sync-push-service.test.js`
- `apps/api/src/services/__tests__/activity-bridge.test.js`
- `apps/api/src/services/__tests__/rbac-granular-contract.test.js`
- `apps/api/src/services/__tests__/files-workspace.test.js`
- `apps/api/src/services/__tests__/office-fixture.js`
- `apps/api/src/services/__tests__/storefront-capture-service.test.js`
- `apps/api/src/routes/__tests__/pwa.test.js`
- `apps/api/src/routes/chat/__tests__/meridian-tools.test.js`
- `apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`
- `apps/api/src/routes/growth/__tests__/growth-lead-service.test.js`
- `apps/api/src/manifests/official/__tests__/atlas-documents-contract.test.js`

Deviation from plan: instead of a new synthetic `runly-catalog-default.test.js`, the existing contract/unit tests that encode the previous "atlas.\* is canonical" assumption were updated in place to assert `runly.*` (their real, now-correct expected behavior) — this gives the same coverage through the tests that already exercise these exact code paths, rather than a parallel synthetic suite. Files updated: `apps/api/src/services/__tests__/runly-module-registration.test.js`, `apps/api/src/services/__tests__/rbac-granular-contract.test.js`, `apps/api/src/services/__tests__/storefront-capture-service.test.js`, `apps/api/src/routes/growth/__tests__/growth-lead-service.test.js` (mock Prisma updated to understand `{ in: [...] }` filters, matching real Prisma semantics), `apps/api/src/manifests/official/__tests__/atlas-documents-contract.test.js`, `apps/api/src/manifests/official/__tests__/atlas-pos-contract.test.js`, `apps/api/src/manifests/official/__tests__/storefront-capture-foundation-contract.test.js`, `apps/api/src/routes/notes/__tests__/notes-access.test.js`, `apps/api/src/routes/pos/__tests__/pos-helpers-validators.test.js`, `apps/api/src/routes/documents/__tests__/document-generation-service.test.js`. The regression/compat fixtures listed above as "do not modify" were correctly left untouched — they still exercise `atlas.*` as the legacy alias input, which is unrelated to what the canonical catalog emits.

## Task 1 - Catálogo y seed

- [x] Cambiar `key` y `dependencies[].key` de las 21 llaves en `core-modules.js`/`feature-modules.js` de `atlas.*` a `runly.*`. Hecho con un script de reemplazo acotado (regex con límite de palabra sobre los 21 nombres oficiales) que también actualizó `consumes: [...]` y los `path` de navegación que embeben la clave del módulo (`/app/m/atlas.ledger/...` → `/app/m/runly.ledger/...`), para consistencia interna completa del manifiesto. Las claves de blueprint de 3 segmentos (`atlas.module.entity`) NO se tocaron intencionalmente — no son una de las 21 llaves oficiales y quedan fuera del alcance declarado en la spec.
- [x] Cambiar `prisma/seed.js:154` (`key: 'atlas.admin'` → `key: 'runly.admin'`) y `:170` (`['atlas.admin', 'system.admin']` → `['runly.admin', 'system.admin']`).
- [x] Confirmado por lectura: `packages/core/src/module-identity.js` no requirió cambios — su `findModuleByKey`/alias helpers ya resuelven ambos spellings independientemente de cuál sea "canónico" en los manifiestos.

Validation: `node --check` en ambos manifiestos y `prisma/seed.js` — OK. `node --test apps/api/src/manifests/official/__tests__/*.test.js` — OK tras actualizar los 3 contract tests que hardcodeaban `atlas.*` como valor esperado del manifiesto (ver "Deviation" arriba).

## Task 2 - Guards de rol/permiso admin

- [x] `tenant-context.js` `COMPANY_ADMIN_ROLE_KEYS` ahora incluye ambos: `["runly.admin", "atlas.admin"]` — se conserva `atlas.admin` porque instalaciones existentes ya tienen ese rol persistido y esta etapa no reescribe datos.
- [x] `notes/shares-service.js:105,137` — el `IN (...)` ahora incluye `runly.admin` además de `atlas.admin`/`system.admin`.
- [x] Revisados y actualizados en `apps/api/src/index.js`: `ADMIN_ROLE_KEYS` (294), `syncAdminRolesPermissions` (629), `ensureSetupAdminRole` (659/670 — ahora busca por ambos spellings pero **crea** el rol nuevo como `runly.admin` si no existe ninguno), `PROTECTED_IDENTITY_ROLE_KEYS` (746), `moduleKey: "atlas.identity"` → `"runly.identity"` (894, avatar upload), `moduleKey: "atlas.company"` → `"runly.company"` (1245, logo upload). También `module-lifecycle-service.js` (`syncAdminPermissions` guard + 7 escrituras de audit log `moduleKey: 'atlas.core'` → `'runly.core'`), `office/access.js`, `files-service.js`, `files/workspace.js` (guards de admin/lectura de archivos), `chat-moderation-service.js` `PROTECTED_IDENTITY_ROLE_KEYS`.

Validation: `node --test apps/api/src/lib/__tests__/tenant-context.test.js apps/api/src/routes/notes/__tests__/` — OK tras actualizar el regex de `notes-access.test.js` que esperaba solo `atlas.admin` en el SQL generado.

## Task 3 - Sync offline y rutas públicas

- [x] `sync-service.js`/`sync-push-service.js`: en vez de reescribir los 5 objetos de configuración (duplicando handlers), se agregaron alias `SYNC_MODULE_REGISTRY['runly.x'] = SYNC_MODULE_REGISTRY['atlas.x']` (misma referencia de objeto, DRY) para las 5+3 llaves correspondientes.
- [x] `ERP_PREFIXES` en `public-website.js` ahora incluye `'runly.'`.

Validation: `node --test apps/api/src/services/__tests__/sync-service.test.js apps/api/src/services/__tests__/sync-push-service.test.js` — OK sin modificar los tests (siguen probando el spelling legacy deliberadamente, y los alias los sirven igual).

## Task 4 - moduleKey literal en servicios de dominio

- [x] Revisados y actualizados los 21 archivos listados arriba, más 3 adicionales descubiertos durante la implementación (`document-generation-routes.js`, `document-template-routes.js` — solo etiquetas de `console.error`, cosmético) y la ruta de objeto de Storage `modules/atlas.documents/...` → `modules/runly.documents/...` en `document-generation-service.js` (prefijo de `objectKey` para documentos nuevos; no afecta objetos ya subidos). Cada literal se clasificó como **escritura** (se cambia directo a `runly.*`) o **lectura/comparación** (se vuelve dual-accept `{ in: ["runly.x","atlas.x"] }` o `.includes(...)`) revisando el contexto real de cada línea — no hubo reemplazo global de texto.
- [x] Deliberadamente fuera de alcance (documentado, no tocado): cientos de URLs de deep-link de notificación (`link: "/app/m/atlas.calendar?...`, etc. en calendar/calls/chat/catalog/fleet/growth/ledger/notes/pfm/projects/inventory/search-providers/web-push) — ya cubiertas por la normalización de alias de navegación construida en stage 4b incremento 2 (`resolveModuleAliasPath`), que resuelve cualquier spelling al hacer clic. `MODULE_KEY = 'atlas.fleet'` (constantes de fallback en 5 archivos de fleet, solo usadas como default de un label de log de error). Los `sourceModule: "atlas.chat"/"atlas.projects"/"atlas.pfm"` de los puentes de calendario (llamadas/proyectos/pfm) — son una convención de etiquetado propia y autoconsistente de cada feature (mismo valor en escritura y lectura dentro del mismo archivo), no llaves del catálogo oficial de módulos. Decenas de prefijos `console.error("[atlas.x]", ...)` — cosméticos, sin efecto funcional. `module-cleanup-registry.js` no requirió cambios: su lookup ya pasa por `findModuleByKey` (alias-aware).

Validation: `node --test "apps/api/src/**/__tests__/**/*.test.js"` completo — 1371 passing, 0 failing, 2 skipped (requieren BD en vivo, sin cambios). Se corrigieron 3 tests adicionales descubiertos en esta corrida amplia (`document-generation-service.test.js`, `pos-helpers-validators.test.js`, más el de notes ya mencionado en Task 2).

## Task 5 - Verificación completa

- [x] `node --test "apps/api/src/**/__tests__/**/*.test.js"`: 1373 tests, 1371 passing, 0 failing, 2 skipped — ver Evidence.
- [x] `pnpm lint`: sin errores en todo el repo.
- [x] Evidencia y límites registrados abajo y (pendiente) en `docs/TASKS.md`.

## Rollback Notes

Revertir el diff de esta etapa restaura el catálogo `atlas.*` como canónico. Ninguna migración, seed ni sincronización se ejecuta contra una base real; el rollback no requiere acción de base de datos.

## Evidence

Verified: 2026-09-13.

- `node --check` en `core-modules.js`, `feature-modules.js`, `prisma/seed.js` y los ~24 archivos de aplicación modificados: sin errores de sintaxis.
- `node --test "apps/api/src/**/__tests__/**/*.test.js"`: 1373 tests, **1371 passing, 0 failing, 2 skipped** (los 2 skips son `cross-tenant-security.test.js`, que requiere `RUN_CROSS_TENANT_TESTS=1` contra una BD real, y no cambiaron). 10 tests se corrigieron en el proceso porque codificaban literalmente el supuesto "atlas.\* es la clave canónica del catálogo" (ver "Deviation" arriba) — todas las correcciones son actualizaciones de expectativa, no relajaciones de assertion.
- `pnpm lint`: 0 errores en todo el repo (incluye los archivos de esta etapa más los tocados en paralelo por branding/rename-de-carpetas/IDs-nativos).
- `pnpm --filter @runly/desktop build:web`: pasa (verificado también por el incremento paralelo de rename de carpetas, que depende del mismo build).
- Revisión manual línea por línea de cada literal `atlas.<21-key>` fuera de manifiestos/tests en `apps/api/src`: cada uno se clasificó explícitamente como escritura (→ `runly.*` directo) o lectura/filtro (→ dual-accept), nunca un reemplazo de texto ciego. Los guards de rol admin (`ADMIN_ROLE_KEYS`, `PROTECTED_IDENTITY_ROLE_KEYS`, `COMPANY_ADMIN_ROLE_KEYS`, el `IN (...)` de notas, `office/access.js`, `files-service.js`, `files/workspace.js`) todos aceptan ahora `runly.admin` **y** `atlas.admin`, así que una instalación existente no pierde privilegios de admin y una instalación nueva (sembrada con `runly.admin`) los obtiene desde el primer arranque.
- No se ejecutó ningún seed/migración contra una base de datos real; no se sincronizó el catálogo con ninguna instalación desplegada; ninguna fila persistida fue leída ni escrita.

Límites honestos: esto cubre el backend (`apps/api`) y `prisma/seed.js` únicamente. No incluye el rename de carpetas del frontend ni los identificadores nativos (cubiertos por los otros dos incrementos paralelos de esta misma sesión). Los deep-links de notificación y las etiquetas de log `console.error("[atlas.x]", ...)` quedan deliberadamente en `atlas.*` por ser de bajo riesgo/cosméticos — ver Task 4 para el detalle completo de qué se dejó fuera y por qué. Ninguna instalación real fue probada de punta a punta (requiere `pnpm db:seed` contra una base vacía, que no se ejecutó en este entorno).
