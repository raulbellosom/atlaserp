# Runly — rename de carpetas de módulos frontend

Date: 2026-09-13
Status: Planned
Autorización: el usuario eligió el alcance máximo el 2026-09-13, incluyendo el rename de carpetas.

## 1. Feature title

Las 21 carpetas `apps/desktop/src/modules/atlas.<nombre>/` pasan a `apps/desktop/src/modules/runly.<nombre>/`, junto con cada import que las referencia y las claves de storage/canal asociadas.

## 2. Status

Planned. Es puramente organizativo/mecánico: no cambia el comportamiento en tiempo de ejecución, ya que el Route Loader de AME3 solo aplica a módulos custom bajo `modules/custom/`, y estas son carpetas de pantallas oficiales del frontend importadas estáticamente.

## 3. Context

`docs/superpowers/plans/2026-09-13-runly-packages-devkit.md` ya tocó ~330 archivos dentro de estas carpetas (imports de paquete `@atlas/*`→`@runly/*`), pero dejó los nombres de directorio y sus imports internos (`modules/atlas.hr/...`) sin cambiar. La clave de módulo lógica (`atlas.hr` vs `runly.hr`) que resuelve `2026-09-13-runly-catalog-default` es independiente del nombre de carpeta: el mapeo entre clave de módulo y componente de pantalla vive en un registro estático del frontend, no en el nombre de la carpeta en sí.

## 4. Problem

Mientras el catálogo backend ya emite (o emitirá) `runly.*`, el código fuente del frontend sigue organizado bajo nombres de carpeta `atlas.*`, lo cual es inconsistente para cualquiera que navegue el repo y contradice el objetivo de "pasar por completo a la nueva identidad".

## 5. Goals

- Renombrar las 21 carpetas de módulo (`git mv`, preservando historial) de `atlas.*` a `runly.*`.
- Actualizar cada import/ruta literal que referencia `modules/atlas.<x>` a `modules/runly.<x>` en todo el árbol (`apps/desktop/src/**`, `infra/installer/devkit-export/**` si aplica, cualquier config de build que enumere paths).
- Renombrar claves de storage local/canal asociadas: `'atlas-active-company'` (`ActiveCompanyProvider.jsx`, `lib/atlas.js`), bucket Supabase `'atlas-notes'` (`atlas.notes/lib/noteImageUpload.js`), canales de notificación `'atlas-calls-v1'`/`'atlas-alerts-v1'` (`native/notification-policy.js`) — evaluando caso por caso si el bucket de Storage puede renombrarse sin migrar objetos existentes (si no, dejarlo documentado como pendiente y no tocarlo).
- Build web y suite de tests pasan sin cambios de comportamiento.

## 6. Non-goals

No se cambia la clave lógica del módulo en el catálogo backend (ya cubierto por el incremento de catálogo). No se renombra el registro estático que mapea clave→componente si su propio nombre de archivo no contiene "atlas" (solo se actualizan las rutas de import que apunten a las carpetas renombradas). No se toca ningún bucket de Storage que ya contenga archivos de usuarios reales sin plan de migración de objetos.

## 7. User stories

Como desarrollador que navega el repo, quiero que la carpeta de cada módulo coincida con su nombre de marca actual (Runly), sin sorpresas de "por qué esta carpeta sigue diciendo atlas".

## 8. UX requirements

N/A — sin cambio visible para el usuario final.

## 9. Routes/screens

Mismas rutas de navegación (`/app/m/<key>`); la clave de ruta depende del catálogo backend, no del nombre de carpeta.

## 10. Data model

N/A.

## 11. Prisma impact

N/A.

## 12. API contract

N/A.

## 13. SDK contract

N/A.

## 14. Validator contract

N/A.

## 15. Module manifest impact

N/A directamente; el manifiesto sigue apuntando a componentes por el registro estático, que se actualiza para importar desde las carpetas renombradas.

## 16. Navigation impact

N/A.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

N/A.

## 19. Multi-company behavior

N/A.

## 20. Files/storage impact

Bucket `atlas-notes` de Supabase Storage: renombrar el bucket requeriría mover objetos existentes o crear uno nuevo y actualizar todas las referencias — se evalúa en la implementación si el entorno de prueba tiene datos reales; si los tiene, se deja `atlas-notes` sin tocar y se documenta como deuda pendiente en vez de arriesgar archivos de usuario.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A.

## 23. Edge cases

Imports dinámicos (`import()`) o rutas construidas por template string (`` `../modules/atlas.${key}/...` ``) deben detectarse por búsqueda de texto, no solo imports estáticos con `import ... from`. Cualquier snapshot/fixture de test que compare rutas de archivo literal debe actualizarse junto con el rename.

## 24. Risks

Un import olvidado rompe el build de Vite de inmediato (módulo no encontrado), lo cual es detectable en la validación — riesgo bajo de fallo silencioso. El riesgo real es el bucket de Storage: renombrarlo sin migrar objetos rompe archivos ya subidos por usuarios de notas.

## 25. Acceptance criteria

Ninguna carpeta bajo `apps/desktop/src/modules/` empieza con `atlas.`; `pnpm --filter @runly/desktop build:web` pasa; `node --test` de la suite frontend pasa; ningún grep de `modules/atlas\.` queda en código fuente activo (se permite en documentación histórica/changelog).

## 26. Verification plan

`git mv` por carpeta (preserva historial); grep exhaustivo de `modules/atlas\.` tras el rename para detectar imports huérfanos; `pnpm --filter @runly/desktop build:web`; `node --test` de las suites frontend relevantes; `pnpm lint`.

## 27. Rollback plan

`git mv` inverso restaura los nombres de carpeta; revertir el diff de imports asociados. Sin cambios de base de datos salvo que se hubiera tocado el bucket de Storage (no se toca según el punto 20 si hay datos reales).

## 28. Future enhancements

Si el bucket `atlas-notes` se deja pendiente, planear su migración de objetos como incremento propio cuando se decida el corte de datos definitivo.
