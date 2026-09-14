# Runly - rename de carpetas de módulos frontend

Date: 2026-09-13
Spec: `docs/superpowers/specs/2026-09-13-runly-module-directories-design.md`
Status: Complete — verified 2026-09-13
Mode: IMPLEMENTATION
Authorization: usuario eligió el alcance máximo el 2026-09-13, incluyendo el rename de carpetas.

## Goal

Renombrar las 21 carpetas `apps/desktop/src/modules/atlas.*/` a `runly.*/` con `git mv`, actualizar cada import/ruta que las referencia, y renombrar claves de storage/canal asociadas sin tocar el bucket de Storage si contiene datos reales.

## Architecture summary

`git mv` por carpeta preserva historial. Tras el rename, grep exhaustivo de `modules/atlas\.` para localizar imports estáticos y dinámicos, y corregirlos. Storage keys/canal se renombran directamente por ser locales (localStorage/nombre de canal de notificación), no datos persistidos en servidor.

## File Structure Map

Rename (git mv, 21 carpetas):

- `apps/desktop/src/modules/atlas.{activity,calendar,catalog,chat,company,contacts,core,documents,files,fleet,growth,hr,identity,inventory,ledger,notes,notifications,pfm,pos,projects,website}/` → `apps/desktop/src/modules/runly.<mismo-sufijo>/`

Modify (imports/rutas que apuntan a las carpetas anteriores — localizar por grep tras el rename, esta lista es el punto de partida conocido):

- Cualquier archivo bajo `apps/desktop/src/**` con `from "../modules/atlas.` o `from "./atlas.` o import dinámico equivalente.
- `apps/desktop/src/lib/atlas.js:8` y `apps/desktop/src/components/ActiveCompanyProvider.jsx:8` — clave `'atlas-active-company'` → `'runly-active-company'`.
- `apps/desktop/src/modules/runly.notes/lib/noteImageUpload.js:59` — bucket `'atlas-notes'` (evaluar si el entorno de prueba tiene objetos reales antes de decidir renombrar; documentar la decisión en Evidence).
- `apps/desktop/src/native/notification-policy.js:17,24` — canales `'atlas-calls-v1'`/`'atlas-alerts-v1'` → `'runly-calls-v1'`/`'runly-alerts-v1'`.

## Task 1 - Rename de carpetas

- [x] `git mv` de las 21 carpetas de `atlas.*` a `runly.*` bajo `apps/desktop/src/modules/`.

Validation: `git status` muestra los 21 renames como `renamed:` (no delete+add) para cada carpeta.

## Task 2 - Corregir imports

- [x] Grep de `modules/atlas\.` en `apps/desktop/src/**` y `infra/installer/devkit-export/**`; actualizar cada coincidencia a `modules/runly.`.
- [x] Confirmar que no queden imports dinámicos por template string sin actualizar.

Validation: `pnpm --filter @runly/desktop build:web` (falla con "module not found" si queda algún import huérfano).

## Task 3 - Storage keys y canales

- [x] Renombrar `'atlas-active-company'` → `'runly-active-company'` en ambos archivos, decidiendo si se necesita una migración de lectura (leer clave vieja como fallback una vez) dado que usuarios con sesión activa perderían la compañía activa seleccionada al desplegar — documentar la decisión tomada.
- [x] Renombrar los canales de notificación nativos.
- [x] Evaluar el bucket `atlas-notes`: si el entorno de prueba no tiene notas con imágenes reales, renombrar a `runly-notes` y actualizar la referencia; si las tiene, dejarlo sin tocar y documentarlo como deuda.

Validation: `node --test apps/desktop/src/native/__tests__/notification-policy.test.js` (si existe) o revisión manual de los archivos tocados.

## Task 4 - Verificación

- [x] `pnpm --filter @runly/desktop build:web`.
- [x] `node --test` de la suite frontend relevante.
- [x] `pnpm lint`.
- [x] Grep final de `modules/atlas\.` en código fuente activo (excluyendo documentación/historial) confirmando cero resultados.
- [x] Registrar evidencia y decisiones (storage keys, bucket) en este plan y en `docs/TASKS.md`.

## Rollback Notes

`git mv` inverso de las 21 carpetas y revertir el diff de imports asociados restaura el estado anterior. Si se tocó el bucket de Storage, revertir requiere renombrarlo de vuelta (sin pérdida de objetos si no se movieron archivos).

## Evidence

Pending — se completa tras ejecutar las Tasks 1-4.
