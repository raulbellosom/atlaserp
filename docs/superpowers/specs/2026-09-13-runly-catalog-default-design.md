# Runly — catálogo oficial por defecto

Date: 2026-09-13
Status: Planned
Autorización: el usuario eligió el alcance máximo ("branding + catálogo + rename de carpetas + IDs nativos") tras revisar el inventario de trabajo pendiente en `docs/migrations/runly-module-keys.md`.

## 1. Feature title

El catálogo oficial de módulos, el rol administrador y todas las comparaciones internas de claves pasan a emitir `runly.*` como espelling canónico para instalaciones nuevas, mientras `atlas.*` sigue funcionando como alias heredado.

## 2. Status

Planned. Depende de la capa de alias ya construida en stage 4a/4b (`packages/core/src/module-identity.js`, `apps/api/src/services/module-key-alias.js`) que resuelve ambos spellings; esta etapa cambia cuál de los dos se **genera** por defecto.

## 3. Context

`apps/api/src/manifests/official/core-modules.js` y `feature-modules.js` declaran las 21 llaves oficiales como `atlas.*`. `prisma/seed.js` las usa para crear filas `AtlasModule`/`Permission`/`Role` y además crea el rol de sistema con `key: 'atlas.admin'` de forma hardcodeada (no derivado del catálogo). Muchos archivos backend comparan contra el literal `"atlas.xxx"` directamente en vez de pasar por el resolutor de alias, incluyendo comprobaciones de rol admin (`apps/api/src/lib/tenant-context.js`, `apps/api/src/routes/notes/shares-service.js`), mapeos de sync (`sync-service.js`, `sync-push-service.js`), y `moduleKey` literales en rutas/servicios de fleet, growth, website, pos, pfm, projects, files, company, inventory, office.

El usuario va a recrear el proyecto de prueba con una base de datos completamente vacía, así que no hay datos existentes que preservar en esta instalación — el requisito es que una instalación limpia funcione de punta a punta con `runly.*` como identidad real, no solo como alias tolerado.

## 4. Problem

Si solo se cambia el catálogo/manifiestos sin actualizar los literales de comparación, un `pnpm db:seed` fresco crea roles/permisos/módulos con clave `runly.admin`/`runly.hr`/etc., pero el código que compara contra `"atlas.admin"` o `"atlas.hr"` deja de encontrar coincidencias: los administradores pierden privilegios de admin, el sync deja de mapear tablas, y las páginas públicas dejan de reconocer el prefijo ERP. Esto es un riesgo de seguridad/funcionalidad silencioso, no solo cosmético.

## 5. Goals

- El catálogo oficial (`core-modules.js`, `feature-modules.js`) declara `runly.*` como clave primaria de las 21 llaves oficiales, conservando `atlas.*` únicamente en la lista de alias ya existente en `module-identity.js` (sin duplicar entradas).
- `prisma/seed.js` crea el rol de sistema con `key: 'runly.admin'`.
- Todo literal de comparación de clave de módulo/rol/permiso identificado en la auditoría se actualiza a `runly.*` o se reescribe para usar la constante/resolutor compartido, de modo que quede una sola fuente de verdad.
- Pruebas nuevas/extendidas simulan una base vacía sembrada con el catálogo actualizado y verifican: login como admin conserva permisos de compañía, sync-push mapea las tablas correctas, notas comparte con `runly.admin`/`system.admin`, y las rutas públicas siguen reconociendo el prefijo ERP.
- Las instalaciones existentes con datos `atlas.*` siguen funcionando sin cambios gracias a la capa de alias ya construida (no se toca ninguna fila persistida).

## 6. Non-goals

No se ejecuta ningún seed/migración contra una base de datos real ni se sincroniza el catálogo con una instalación desplegada. No se renombran carpetas de módulos del frontend (`apps/desktop/src/modules/atlas.*/`), ni assets, ni identificadores nativos — son incrementos separados. No se altera el esquema de Prisma ni las migraciones existentes. No se cambia el comportamiento de resolución de alias ya construido, solo qué clave se genera por defecto.

## 7. User stories

Como operador que crea una instalación nueva de Runly, quiero que el administrador de la compañía tenga privilegios de admin, que la sincronización offline funcione, y que las páginas públicas respondan, todo usando claves `runly.*` desde el primer arranque.

## 8. UX requirements

N/A — cambio de identidad interna, sin superficie visual nueva.

## 9. Routes/screens

Mismas rutas de API y pantallas. El comportamiento visible no cambia salvo que las claves técnicas subyacentes ahora son `runly.*` en instalaciones nuevas.

## 10. Data model

Sin cambios de esquema. Cambian los valores de `key`/`module_key`/`role.key` que el seed inserta en una base nueva. Bases existentes no se tocan.

## 11. Prisma impact

`prisma/seed.js`: el rol de sistema pasa de `key: 'atlas.admin'` a `key: 'runly.admin'`; `upsertModule` sigue funcionando igual, solo cambia el valor de `manifest.key` que recibe desde el catálogo oficial actualizado. No se agregan migraciones.

## 12. API contract

Mismos endpoints y payloads. Las respuestas que incluían `"atlas.admin"`/`"atlas.hr"` como valor de campo ahora devuelven `"runly.admin"`/`"runly.hr"` en instalaciones nuevas; instalaciones existentes con datos persistidos en `atlas.*` siguen devolviendo esos valores sin cambio (no se reescribe nada persistido).

## 13. SDK contract

Sin cambios de firma. Los valores de clave que el SDK recibe reflejan lo que la API devuelve (ver punto 12).

## 14. Validator contract

Sin cambios de esquema Zod. Los `enum`/`literal` que validen contra claves fijas del catálogo oficial se revisan para asegurarse de que no rechacen `runly.*`.

## 15. Module manifest impact

`core-modules.js`/`feature-modules.js`: cada `key` y cada referencia en `dependencies[].key` pasa de `atlas.*` a `runly.*`. `module-identity.js` ya declara el mapa de alias; se verifica que las 21 llaves sigan aaraeciendo ahí como par legacy/current sin duplicar entradas cuando el catálogo cambie de spelling.

## 16. Navigation impact

Sin cambios de estructura de navegación; las claves subyacentes que identifican cada entrada cambian de spelling en instalaciones nuevas, resueltas igual que hoy por el alias del runtime web.

## 17. Blueprint impact

Los blueprints se siguen sirviendo por `module_key`; en una base nueva ese valor será `runly.*`. Sin cambios de estructura de blueprint.

## 18. RBAC/permissions

Punto crítico de esta etapa: `apps/api/src/lib/tenant-context.js` (`COMPANY_ADMIN_ROLE_KEYS`), `apps/api/src/routes/notes/shares-service.js` (SQL `r.key IN (...)`), y cualquier otro guard que compare contra `'atlas.admin'` deben aceptar `'runly.admin'` para que el admin de una instalación nueva conserve sus privilegios. Se prefiere una constante compartida (o extender el resolutor de alias) antes que repetir el literal en cada archivo.

## 19. Multi-company behavior

Sin cambios: el aislamiento por compañía no depende del spelling de la clave de módulo/rol.

## 20. Files/storage impact

`apps/api/src/services/sync-service.js` y `sync-push-service.js` mapean `module_key` a nombres de tabla para sync offline; sus mapas literales (`atlas.contacts`, `atlas.hr`, `atlas.calendar`, `atlas.catalog`, `atlas.ledger`) deben incluir/usar `runly.*` para que el sync funcione en una instalación nueva. `apps/api/src/routes/public-website.js` (`ERP_PREFIXES`) debe reconocer el prefijo `runly.` para servir contenido público correctamente.

## 21. Export/import requirements

Sin cambios de formato de export. Los literales `moduleKey: "atlas.xxx"` usados como metadato en servicios de fleet/growth/website/pos/pfm/projects/files/company/inventory/office deben actualizarse para que el metadato coincida con la clave real de una instalación nueva.

## 22. Audit log requirements

Los registros de auditoría existentes conservan su `module_key` histórico sin reescritura; los nuevos registros de una instalación nueva usan `runly.*` de forma natural al usar el catálogo actualizado.

## 23. Edge cases

Instalación existente (datos `atlas.*`) debe seguir operando sin cambios — se verifica revisando que ningún cambio toque datos persistidos ni el comportamiento de alias ya probado en stage 4a/4b. Colisión de nombre exacto entre `atlas.*` y `runly.*` sigue resolviéndose por el mecanismo de precedencia ya implementado, sin tocar esa lógica.

## 24. Risks

El riesgo principal es un literal olvidado: si algún guard de permisos sigue comparando contra `'atlas.admin'` tras el cambio del catálogo, una instalación nueva puede quedar con administradores sin privilegios (fail-closed, no fail-open, pero rompe funcionalidad) o con sync/notas fallando silenciosamente. Mitigación: barrido exhaustivo por `grep` de cada archivo enumerado en el punto 18/20/21, más pruebas end-to-end de un seed simulado.

## 25. Acceptance criteria

Catálogo oficial y seed emiten `runly.*` como clave primaria; todos los literales de comparación identificados quedan actualizados o centralizados; pruebas nuevas confirman que un seed fresco preserva admin/sync/notas/rutas públicas; pruebas existentes de compatibilidad `atlas.*` (stage 4a/4b) siguen pasando sin modificación; lint y build pasan.

## 26. Verification plan

`node --test` sobre los suites de módulos/alias/tenant-context/sync/notes/public-website afectados, más una prueba nueva que simule un seed con el catálogo actualizado y verifique privilegios de admin y mapeo de sync. `pnpm lint`. Revisión manual de diff para confirmar que ningún dato persistido ni contrato de API cambia de forma.

## 27. Rollback plan

Revertir el diff de esta etapa completa restaura el catálogo `atlas.*` como canónico; la capa de alias ya existente sigue funcionando igual en ambos sentidos, así que el rollback no requiere cambios de base de datos.

## 28. Future enhancements

Rename de carpetas de módulos del frontend, identificadores nativos, y (opcional, fuera de alcance actual) conversión real de datos persistidos para instalaciones existentes que quieran completar el cutover.
