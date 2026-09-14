# Runly — SDK público del storefront

Date: 2026-09-14
Status: Complete
Autorización: el usuario pidió continuar la migración con "paquetes, importaciones y demás" el 2026-09-14; este es el hallazgo principal de esa continuación.

## 1. Feature title

El SDK JavaScript público que el website builder inyecta en cada sitio publicado de cliente (`atlas-sdk.js`, global `window.AtlasERP`) pasa a `runly-sdk.js`/`window.RunlyERP`, conservando compatibilidad completa con sitios ya publicados.

## 2. Status

Complete localmente. No se ha publicado ningún sitio nuevo con la URL nueva en este entorno (requiere republicar/republish, fuera de alcance de este cambio de código).

## 3. Context

El resto de la migración (paquetes npm, variables de entorno, claves de módulo, branding, identificadores nativos) ya estaba en `runly.*`/`@runly/*`/`RUNLY_*`, pero el SDK que se sirve directamente a los visitantes de sitios públicos de clientes (vía `<script src="/public/site/atlas-sdk.js">`) seguía siendo 100% Atlas: nombre de archivo, ruta, global `window.AtlasERP`, variable `window.ATLAS_CONFIG`, prefijo de claves de `localStorage`, nombre de campo honeypot, y atributos `data-atlas-*` que los propios clientes pueden haber escrito a mano en bloques de código personalizado de sus sitios (confirmado por el texto de ayuda de Growth Analytics: "Usa data-atlas-event en los elementos que quieras seguir").

## 4. Problem

Cualquier sitio público construido con el builder de Runly carga un script llamado `atlas-sdk.js` que expone `window.AtlasERP` — visible en el código fuente de la página para cualquier visitante técnico, y inconsistente con el resto de la identidad ya migrada.

## 5. Goals

- `window.RunlyERP` como global canónico; `window.AtlasERP` se mantiene como alias en vivo (misma referencia de objeto) para sitios ya publicados que llamen `window.AtlasERP.*` en su HTML estático.
- `window.RUNLY_CONFIG` como fuente de configuración canónica; el SDK sigue leyendo `window.ATLAS_CONFIG` como fallback.
- Nueva ruta `/public/site/runly-sdk.js`; la ruta vieja `/public/site/atlas-sdk.js` sigue sirviendo el mismo archivo.
- Atributos de datos que el propio SDK genera y lee en el mismo ciclo (`data-atlas-form-id`, `data-atlas-managed`) renombrados sin necesidad de alias, porque son atributos efímeros creados en tiempo de ejecución, nunca contenido guardado.
- Atributos que los clientes pueden haber escrito a mano en su propio contenido (`data-atlas-event`, `-label`, `-placement`) se leen con ambos nombres (`data-runly-*` preferido, `data-atlas-*` como fallback), sin migrar contenido ya guardado.
- Prefijo de clave de `localStorage` (`atlas:company:site:name`) y nombre del campo honeypot (`_atlas_company_url`) renombrados sin alias — son estado puramente interno del propio SDK, invisibles para el cliente/contenido.
- Evento personalizado `atlas:ready` se sigue disparando junto con el nuevo `runly:ready`.

## 6. Non-goals

No se tocan las cabeceras HTTP `X-Atlas-Company`/`X-Atlas-Site`/`X-Atlas-Company-Id` (la última es el header de contexto de tenant usado en TODA la API autenticada, no solo en el storefront — renombrarla es un cambio mucho más grande y sensible a seguridad, fuera de alcance aquí; las dos primeras son específicas del storefront pero tienen ~10 consumidores en el backend, invisibles al cliente, de bajo valor para renombrar ahora). No se migra ningún contenido de sitio ya guardado en base de datos. No se republican sitios existentes.

## 7. User stories

Como visitante de un sitio público construido con Runly, el script que carga mi navegador debería identificarse como Runly, no como Atlas. Como cliente con un sitio ya publicado antes de este cambio, mi sitio debe seguir funcionando exactamente igual sin que yo tenga que hacer nada.

## 8. UX requirements

N/A — sin cambio de superficie visual; es un cambio de identidad técnica de un script de terceros embebido.

## 9. Routes/screens

Nuevo: `GET /public/site/runly-sdk.js`. Existente sin cambios de comportamiento: `GET /public/site/atlas-sdk.js` (ahora sirve el mismo archivo renombrado). Pantallas que consumen el SDK: `ContactFormRenderer.jsx` (bloque de formulario de contacto embebible), `PublicWebsiteEntry.jsx` (analítica del builder), `DistUploadPanel.jsx` (snippet de ejemplo para sitios subidos manualmente).

## 10. Data model

N/A — sin cambios de esquema. El SDK usa `localStorage` del navegador del visitante, no la base de datos.

## 11. Prisma impact

N/A.

## 12. API contract

Nueva ruta añadida; ninguna ruta existente cambia de forma. `injectRunlyConfig` (renombrado desde `injectAtlasConfig`, mismo comportamiento) ahora inyecta `window.RUNLY_CONFIG` y el `<script src="/public/site/runly-sdk.js">` en el HTML de sitios `dist` publicados a partir de ahora; sitios `dist` ya publicados conservan su HTML estático sin cambios (siguen funcionando vía la ruta vieja + el fallback de lectura del SDK).

## 13. SDK contract

Este *es* el "otro" SDK del proyecto (el script público, distinto del paquete npm `@raulbellosom/runly-sdk` ya migrado en Stage 3a). Contrato nuevo: `window.RunlyERP.{auth,analytics,renderLogin,renderForm,config}`. Contrato viejo preservado por alias: `window.AtlasERP` apunta al mismo objeto.

## 14. Validator contract

N/A.

## 15. Module manifest impact

N/A.

## 16. Navigation impact

N/A.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

N/A — el SDK público no pasa por el sistema de permisos de la app (usa su propio flujo de auth de Supabase directo para `renderLogin`, y endpoints públicos sin autenticación para analítica/formularios).

## 19. Multi-company behavior

Sin cambios: `COMPANY`/`SITE_ID` se siguen resolviendo igual desde `window.RUNLY_CONFIG`/`ATLAS_CONFIG`.

## 20. Files/storage impact

N/A — no toca Supabase Storage. Solo `localStorage` del navegador del visitante (prefijo de clave cambia de `atlas:` a `runly:`; visitantes existentes simplemente reinician su identificador de visitante/sesión de analítica una vez, sin pérdida de datos del lado servidor).

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A.

## 23. Edge cases

Un sitio publicado ANTES de este cambio, con HTML estático que dice `<script src="/public/site/atlas-sdk.js">` y `window.ATLAS_CONFIG = {...}`, sigue funcionando exactamente igual: la ruta vieja sirve el mismo archivo, y el archivo lee `ATLAS_CONFIG` como fallback cuando `RUNLY_CONFIG` no existe. Un cliente con `data-atlas-event` ya escrito a mano en su contenido sigue siendo reconocido por el listener de clics. El objeto `window.AtlasERP` es la MISMA referencia que `window.RunlyERP`, así que un consumidor externo que capture uno de los dos y luego el SDK actualice sus métodos (poco probable pero posible) los ve reflejados en ambos igual.

## 24. Risks

El riesgo principal identificado era renombrar `data-atlas-event`/`-label`/`-placement` sin soporte dual, ya que son atributos que los propios clientes escriben a mano en contenido guardado — mitigado leyendo ambos nombres indefinidamente. Cabeceras HTTP (`X-Atlas-Company-Id` especialmente) identificadas como fuera de alcance por su uso extensivo en rutas de tenant-scoping de toda la API, no solo storefront — cualquier intento de renombrarlas necesita su propio incremento con el mismo patrón dual-accept ya usado en el resto de esta migración.

## 25. Acceptance criteria

`window.RunlyERP` funcional con paridad completa; `window.AtlasERP` sigue funcionando como alias; ambas rutas de URL sirven el mismo SDK; pruebas existentes actualizadas y una prueba nueva confirma el alias; lint y build pasan.

## 26. Verification plan

`node --test` sobre `apps/api/src/public/__tests__/runly-sdk.test.js` y `apps/api/src/services/__tests__/dist-serve-service.test.js`; suite completa de `apps/api` y `apps/desktop` para regresiones; `pnpm lint`; `pnpm --filter @runly/desktop build:web`.

## 27. Rollback plan

Revertir el diff de este archivo restaura `atlas-sdk.js`/`window.AtlasERP` como único nombre. Sin cambios de base de datos ni de contenido de cliente que revertir.

## 28. Future enhancements

Evaluar si migrar `X-Atlas-Company-Id` (y las cabeceras `X-Atlas-Company`/`X-Atlas-Site` del storefront) a `X-Runly-*` merece su propio incremento dual-accept, dado su alcance mucho mayor (toda la API autenticada, no solo el storefront público).
