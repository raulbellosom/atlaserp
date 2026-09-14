# Runly - SDK público del storefront

Date: 2026-09-14
Spec: `docs/superpowers/specs/2026-09-14-runly-storefront-sdk-design.md`
Status: Complete
Mode: IMPLEMENTATION
Authorization: usuario pidió continuar la migración ("quedan paquetes, importaciones y demás") el 2026-09-14.

## Goal

Renombrar el SDK público del website builder (`atlas-sdk.js` → `runly-sdk.js`, `window.AtlasERP` → `window.RunlyERP`) preservando compatibilidad total con sitios de cliente ya publicados.

## Architecture summary

`window.RunlyERP` como global canónico con `window.AtlasERP` como alias en vivo (misma referencia). Nueva ruta `/public/site/runly-sdk.js` sirviendo el archivo renombrado; ruta vieja `/public/site/atlas-sdk.js` sirve el mismo archivo. Atributos `data-*` efímeros (creados y leídos por el propio SDK en el mismo ciclo) renombrados directo; atributos que el cliente puede haber escrito a mano en contenido guardado (`data-atlas-event/-label/-placement`) se leen con ambos nombres indefinidamente.

## File Structure Map

Renamed (git mv):

- `apps/api/src/public/atlas-sdk.js` → `apps/api/src/public/runly-sdk.js`
- `apps/api/src/public/__tests__/atlas-sdk.test.js` → `apps/api/src/public/__tests__/runly-sdk.test.js`

Modify:

- `apps/api/src/index.js` (rutas `/public/site/runly-sdk.js` nueva + `/public/site/atlas-sdk.js` alias, comentario de ordering)
- `apps/api/src/services/dist-serve-service.js` (`injectAtlasConfig` → `injectRunlyConfig`, tag inyectado)
- `apps/api/src/services/__tests__/dist-serve-service.test.js`
- `apps/desktop/src/shell/PublicWebsiteEntry.jsx`
- `apps/desktop/src/website/atlasBlocks/ContactFormRenderer.jsx`
- `apps/desktop/src/modules/runly.website/components/DistUploadPanel.jsx` (snippet de ejemplo)
- `apps/desktop/src/modules/runly.growth/components/GrowthAnalyticsReports.jsx` (texto de ayuda)

## Task 1 - SDK público [complete]

- [x] Renombrar archivo fuente y exponer `window.RunlyERP` canónico + `window.AtlasERP` alias en ambas IIFEs del archivo.
- [x] `window.RUNLY_CONFIG` como fuente primaria, `window.ATLAS_CONFIG` como fallback de lectura.
- [x] Prefijo de `localStorage` (`atlas:` → `runly:`) y campo honeypot (`_atlas_company_url` → `_runly_company_url`) renombrados sin alias (estado interno, invisible a contenido de cliente).
- [x] Atributos efímeros `data-atlas-form-id`/`-managed` renombrados directo (creados y leídos por el mismo SDK, nunca contenido persistido).
- [x] Atributos potencialmente autoría de cliente `data-atlas-event`/`-label`/`-placement` con lectura dual (`data-runly-*` preferido, `data-atlas-*` fallback).
- [x] Evento `runly:ready` disparado junto con `atlas:ready`.

Validation: `node --test apps/api/src/public/__tests__/runly-sdk.test.js` (incluye una prueba nueva que confirma `window.AtlasERP === window.RunlyERP`).

## Task 2 - Rutas y generación de sitios [complete]

- [x] Nueva ruta `GET /public/site/runly-sdk.js`; ruta vieja `GET /public/site/atlas-sdk.js` sirve el mismo archivo (misma función `serveRunlySdk`).
- [x] `dist-serve-service.js`: función renombrada `injectRunlyConfig`, inyecta `window.RUNLY_CONFIG` y el script tag nuevo para sitios publicados desde ahora.

Validation: `node --test apps/api/src/services/__tests__/dist-serve-service.test.js`.

## Task 3 - Consumidores del frontend [complete]

- [x] `PublicWebsiteEntry.jsx`: setea `window.RUNLY_CONFIG` (y `ATLAS_CONFIG` como alias para el fallback del SDK), usa `window.RunlyERP`, id de script `runly-storefront-sdk`.
- [x] `ContactFormRenderer.jsx`: mismo patrón de carga perezosa actualizado a `window.RunlyERP`/`runly-storefront-sdk`.
- [x] `DistUploadPanel.jsx`: snippet de ejemplo mostrado a usuarios actualizado a `window.RunlyERP`/`window.RUNLY_CONFIG` (con nota de que `AtlasERP` sigue funcionando).
- [x] `GrowthAnalyticsReports.jsx`: texto de ayuda menciona `data-runly-event` como principal, nota que `data-atlas-event` sigue funcionando.

Validation: `pnpm --filter @runly/desktop build:web`; `node --test "apps/desktop/src/**/__tests__/**/*.test.js"`.

## Task 4 - Verificación completa [complete]

- [x] `node --test "apps/api/src/**/__tests__/**/*.test.js"` completo.
- [x] `node --test "apps/desktop/src/**/__tests__/**/*.test.js"` completo.
- [x] `pnpm lint` repo completo.
- [x] `pnpm --filter @runly/desktop build:web`.

## Rollback Notes

Revertir el diff completo de esta etapa restaura `atlas-sdk.js`/`window.AtlasERP` como único nombre; `git mv` en reversa recupera los nombres de archivo originales. Sin cambios de base de datos ni de contenido de cliente.

## Evidence

Verified: 2026-09-14.

- `node --test apps/api/src/public/__tests__/runly-sdk.test.js apps/api/src/services/__tests__/dist-serve-service.test.js`: 36 tests, 36 passing (incluye la prueba nueva del alias).
- `node --test "apps/api/src/**/__tests__/**/*.test.js"` completo: 1374 tests, 1372 passing, 0 failing, 2 skipped (requieren BD real, sin relación a este cambio).
- `node --test "apps/desktop/src/**/__tests__/**/*.test.js"` completo: 368 tests, 368 passing.
- `pnpm lint`: 0 errores en todo el repo.
- `pnpm --filter @runly/desktop build:web`: pasa.
- Grep de barrido (`atlas-sdk|AtlasERP|ATLAS_CONFIG`) sobre `apps/api/src` y `apps/desktop/src` fuera de `__tests__`: las únicas coincidencias restantes son los alias/comentarios deliberados documentados en la spec (sección 5/23), revisadas una por una.
- No se ejecutó ningún build/publicación de sitio real; no se tocó contenido de cliente guardado en base de datos.

Límites honestos: `X-Atlas-Company`/`X-Atlas-Site`/`X-Atlas-Company-Id` quedan sin tocar — la última en particular es el header de tenant-scoping de TODA la API autenticada (no solo storefront), fuera de alcance de este incremento. No se verificó visualmente un sitio público real cargando el SDK nuevo en un navegador (requiere una instalación con un sitio publicado).
