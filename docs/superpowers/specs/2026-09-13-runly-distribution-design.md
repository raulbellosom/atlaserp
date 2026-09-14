# Runly — primera etapa de distribución

Date: 2026-09-13
Status: Complete
Autorización: el usuario aprobó avanzar gradualmente con la migración después del plan general de la conversación.

## 1. Feature title

Migración de repositorio, imágenes Docker y descarga de escritorio a Runly.

## 2. Status

Complete para el alcance local de esta etapa. Publicación y despliegue pendientes; ver evidencia en el plan.

## 3. Context

El producto pasa de Atlas ERP a Runly ERP. GitHub es `raulbellosom/runly-erp`, Docker Hub es `raulbellosom/runlyerp` y la futura instancia principal será `runly.mx`.

## 4. Problem

Los scripts, instaladores y enlaces activos siguen apuntando al repositorio y a las imágenes anteriores.

## 5. Goals

1. Usar el repositorio nuevo para código, documentación y futuras releases.
2. Publicar y consumir por defecto `raulbellosom/runlyerp:api-latest`, `worker-latest` y `web-latest`.
3. Producir y enlazar `Runly-ERP-Setup.exe` en las futuras releases.
4. Preservar overrides de entorno e identidad de instalaciones existentes.

## 6. Non-goals

Publicar imágenes/releases, desplegar, cambiar DNS, assets, colores, marcas de todas las pantallas, paquetes npm, módulos, variables de entorno, base de datos, buckets, volúmenes o identificadores nativos. Tags versionados quedan para la etapa de publicación.

## 7. User stories

Como administrador quiero obtener código, documentación e imágenes desde los repositorios de Runly para instalar y distribuir la nueva marca.

## 8. UX requirements

El enlace GitHub del diagnóstico nativo abre el repositorio nuevo. No se agregan pantallas ni componentes. Las futuras notas de release identifican Runly ERP.

## 9. Routes/screens

N/A: mismas rutas. Cambia únicamente el destino externo del diagnóstico nativo.

## 10. Data model

N/A: ninguna entidad cambia.

## 11. Prisma impact

N/A: sin modelos ni migraciones; no ejecutar seed ni reset.

## 12. API contract

El campo `docs` de la información pública de la API apunta al GitHub nuevo; la forma de respuesta no cambia.

## 13. SDK contract

N/A: se mantienen paquetes y exports existentes. Las constantes `ATLAS_*` de appConfig conservan sus nombres y cambian sus valores de distribución.

## 14. Validator contract

N/A: sin cambios de validación.

## 15. Module manifest impact

N/A: mismas claves, dependencias, permisos, ACL y manifiestos. No se requiere sincronización de módulos.

## 16. Navigation impact

N/A: sin entradas nuevas.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

N/A: no cambia autorización.

## 19. Multi-company behavior

Sin cambios de contexto, consultas ni aislamiento entre empresas.

## 20. Files/storage impact

No cambia almacenamiento de usuarios. El nombre del futuro artefacto de release será `Runly-ERP-Setup.exe`; el Dev Kit conserva `_atlas-devkit` en esta etapa.

## 21. Export/import requirements

Los descargadores del Dev Kit usan `runly-erp` por defecto. Overrides `ATLAS_DOCS_*` siguen vigentes.

## 22. Audit log requirements

N/A: cambio de código y configuración de distribución; evidencia en el plan y TASKS.md.

## 23. Edge cases

1. Overrides de imágenes y repositorio personalizados deben seguir funcionando.
2. Actualizar también imágenes de fallback y las cuatro variantes de bootstrap.
3. Los artefactos nuevos no existirán públicamente hasta la publicación; documentar esta condición.
4. El ejecutable generado por Tauri aún puede contener Atlas en su nombre original; el renombrador existente debe producir el nombre fijo nuevo.
5. Documentación histórica y migraciones aplicadas conservan referencias originales.

## 24. Risks

Cambiar identidad Compose crearía recursos distintos: conservar nombres de proyecto, servicios y volúmenes. Cambiar applicationId afectaría actualizaciones: conservarlo. No activar estos cambios en producción hasta publicar y comprobar las imágenes y el instalador correspondientes.

## 25. Acceptance criteria

1. Los defaults de build, Compose y setup local/external apuntan a las tres imágenes Runly.
2. Bootstrap y descarga del Dev Kit apuntan a `runly-erp` y preservan archivos del usuario.
3. El renombrador produce `Runly-ERP-Setup.exe` y el publicador resuelve ese archivo.
4. Los enlaces GitHub activos y el remoto local apuntan al nuevo repositorio.
5. Las pruebas existentes relevantes pasan y no hay cambios de identidad persistente.

## 26. Verification plan

Pruebas node:test de instalador/bootstrap y scripts de release; validación de Compose local/external con `config --images`; comprobación sintáctica de scripts modificados; búsqueda de destinos antiguos en archivos activos; React Doctor para el enlace JSX. No ejecutar setup, push, release, migraciones ni pruebas contra producción.

## 27. Rollback plan

Revertir los cambios de esta etapa y restaurar el remoto anterior si fuera necesario. No requiere migraciones ni restaurar datos. Antes de cualquier futura publicación, coordinar URLs y artefactos para evitar enlaces incompletos.

## 28. Future enhancements

Marca visible; paquetes y variables Runly; módulos y datos; Dev Kit; SDK público; identidad nativa y offline; dominio e integraciones; publicación con tags versionados; assets y paleta. Cada etapa conserva sus propias verificaciones y revisión de compatibilidad.
