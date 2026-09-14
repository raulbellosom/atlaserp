# Runly — distribución e instaladores

Date: 2026-09-13
Spec: `docs/superpowers/specs/2026-09-13-runly-distribution-design.md`
Status: Complete (implementación y verificación locales; publicación pendiente)
Mode: IMPLEMENTATION
Autorización: continuación gradual solicitada por el usuario sobre el plan general presentado.

## Goal

Completar la primera etapa local: GitHub `raulbellosom/runly-erp`, Docker Hub `raulbellosom/runlyerp` y artefacto `Runly-ERP-Setup.exe`, preservando las identidades persistentes actuales.

## Architecture summary

Cambiar valores de distribución en los puntos existentes. Mantener contratos `ATLAS_*`, servicios Compose, directorios, paquetes e identidades nativas para aislar este cambio de las futuras migraciones de datos. Mantener los overrides configurables. No introducir dependencias compartidas nuevas en scripts que el bootstrap descarga por separado.

## File Structure Map

Create:

- `docs/superpowers/specs/2026-09-13-runly-distribution-design.md`
- `docs/superpowers/plans/2026-09-13-runly-distribution.md`

Modify:

- `infra/docker/build-push.mjs`
- `infra/installer/docker-compose.yml`
- `infra/installer/setup-local.mjs`
- `infra/installer/setup-external.mjs`
- `infra/installer/bootstrap-local.ps1`
- `infra/installer/bootstrap-local.sh`
- `infra/installer/bootstrap-external.ps1`
- `infra/installer/bootstrap-external.sh`
- `infra/installer/.env.local.example`
- `infra/installer/__tests__/devkit-installer.test.js`
- `infra/installer/README.md`
- `apps/desktop/src/lib/appConfig.js`
- `apps/desktop/scripts/publish-release.mjs`
- `apps/desktop/src/native/NativeHostDiagnostics.jsx`
- `apps/api/src/index.js` (solo URL de documentación)
- `README.md`
- `docs/DEPLOY_VPS_DEV.md`
- `docs/deployment/office-collabora.md`
- `docs/TASKS.md`
- `.git/config` (solo remoto local; no versionado)

## Task 1 — Destinos de distribución

- [x] Actualizar GitHub/raw URLs, repo por defecto del Dev Kit y remoto local.
- [x] Actualizar registry Docker, builder y defaults/fallbacks de imágenes en Compose/setup.
- [x] Actualizar nombre del artefacto, URL de descarga y notas de release.

Validation: `node --check` para scripts JS/MJS modificados; `git remote -v`; `git diff --check`; búsqueda de URLs e imágenes anteriores en archivos activos. El código no debe cambiar puertos, volúmenes, variables de entorno ni identidades.

## Task 2 — Documentación operativa

- [x] Actualizar enlaces y comandos de instalación y despliegue.
- [x] Documentar compatibilidad temporal y publicación pendiente.
- [x] Registrar las etapas siguientes en TASKS.md.

Validation: revisar que GitHub use `runly-erp` y Docker use `runlyerp`; que los ejemplos mantengan comandos e identidades aún vigentes.

## Task 3 — Verificación local

- [x] Ejecutar pruebas de instalador y bootstrap.
- [x] Ejecutar pruebas de renombrado y release de escritorio.
- [x] Resolver imágenes Compose local/external sin arrancar servicios.
- [x] Ejecutar React Doctor y lint acotado al cambio JSX.
- [x] Registrar resultados y límites reales.

Commands:

```powershell
node --test infra/installer/__tests__/*.test.js
node --test apps/desktop/scripts/__tests__/publish-release.test.mjs apps/desktop/scripts/__tests__/rename-installer.test.mjs
npx.cmd -y react-doctor@latest . --verbose --diff
pnpm.cmd exec eslint apps/desktop/src/native/NativeHostDiagnostics.jsx
git diff --check
```

Compose: `docker compose -f infra/installer/docker-compose.yml --profile local config --images` y variante `--profile external`; inspeccionar también overrides de imágenes. Solo configuración, sin pull/up. No imprimir secretos ni el Compose interpolado completo.

## Rollback Notes

Revertir el diff de esta etapa. No hay cambios de base de datos ni volúmenes. El remoto local anterior es `https://github.com/raulbellosom/atlaserp.git`.

## Evidence

Verified: 2026-09-13.

- `node --test infra/installer/__tests__/*.test.js apps/desktop/scripts/__tests__/publish-release.test.mjs apps/desktop/scripts/__tests__/rename-installer.test.mjs`: 27 pruebas pasaron, 0 fallos y 0 omitidas. Incluye ejecución de los cuatro bootstrap con fuentes simuladas y preservación de archivos existentes.
- `node --check` en build-push, ambos setup, publish-release, appConfig e index de API: sin errores.
- `docker compose --env-file infra/installer/.env.local.example -f infra/installer/docker-compose.yml --profile local config --images` y variante external: las tres imágenes apuntan a Runly.
- Comprobación adicional de Compose mediante JSON en memoria: los seis overrides de imágenes personalizados funcionan, el proyecto sigue siendo `atlaserp` y los nombres de contenedores se conservan. No se imprimieron credenciales ni configuración completa.
- Importación de appConfig con aserciones: repositorio, nombre de archivo y URL de release nuevos correctos.
- `pnpm.cmd exec eslint apps/desktop/src/native/NativeHostDiagnostics.jsx`: sin hallazgos.
- `npx.cmd -y react-doctor@latest . --verbose --diff`: 4 archivos analizados, sin hallazgos; puntuación reportada 85/100.
- Búsqueda en código, instaladores y documentación operativa revisados: sin destinos GitHub/Docker ni nombre de artefacto anteriores. Documentación histórica mantiene sus referencias.
- `git diff --check`: sin errores. Remoto local fetch/push confirmado en `https://github.com/raulbellosom/runly-erp.git`.

Límites: no se compilaron las imágenes Docker ni el binario nativo y no se ejecutaron instalaciones reales, push, releases, cambios de DNS o despliegues. Los destinos públicos nuevos requieren publicación coordinada. Assets, paleta, datos e identidades persistentes no se modificaron.
