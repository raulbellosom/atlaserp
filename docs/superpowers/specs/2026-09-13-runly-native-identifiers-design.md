# Runly — identificadores nativos (Tauri/Cargo/Android)

Date: 2026-09-13
Status: Planned
Autorización: el usuario eligió el alcance máximo el 2026-09-13, incluyendo cambiar los identificadores nativos ya porque el proyecto de prueba se recrea completamente desde cero.

## 1. Feature title

El identificador de aplicación nativa (`com.racoondevs.atlaserp`), el nombre de paquete Cargo (`atlas_erp`/`atlas_erp_lib`) y el `applicationId`/`namespace` de Android pasan a su forma Runly definitiva.

## 2. Status

Planned. El usuario confirmó explícitamente que no hay continuidad de datos/appdata que proteger porque el proyecto de prueba se recrea desde cero.

## 3. Context

`apps/desktop/src-tauri/tauri.conf.json` ya tiene `productName`/`title` en "Runly ERP" pero `identifier: "com.racoondevs.atlaserp"` sigue en Atlas. `Cargo.toml` declara paquetes `atlas_erp`/`atlas_erp_lib`. `gen/android/app/build.gradle.kts` declara `namespace`/`applicationId = "com.racoondevs.atlaserp"`.

## 4. Problem

El identificador de aplicación nativo es lo único que un usuario nunca ve en pantalla pero que el sistema operativo usa para aislar datos de la app (carpeta de AppData en Windows, keychain/sandbox en otras plataformas, Play Store listing en Android) — dejarlo en Atlas mientras todo lo demás dice Runly es la última pieza de inconsistencia de identidad, y cambiarlo ahora (con datos de prueba desechables) es más barato que después de publicar oficialmente.

## 5. Goals

- Cambiar `tauri.conf.json` `identifier` a `com.racoondevs.runlyerp` (o el identificador definitivo que el usuario confirme si difiere).
- Renombrar los paquetes Cargo `atlas_erp`→`runly_erp`, `atlas_erp_lib`→`runly_erp_lib` en `Cargo.toml` y sus referencias internas (`lib.rs`, `main.rs`, cualquier `use atlas_erp_lib::...`).
- Cambiar `namespace`/`applicationId` en `gen/android/app/build.gradle.kts` a `com.racoondevs.runlyerp`, y el paquete Kotlin de `ScreenSharePlugin.kt` si referencia el namespace viejo en su declaración `package`.
- Verificar Info.plist (iOS) por si declara un bundle identifier equivalente.

## 6. Non-goals

No se publica ninguna build firmada ni se sube a ninguna store. No se migra ninguna instalación existente con datos — el usuario asumió explícitamente esa pérdida de continuidad para el proyecto de prueba actual. No se cambian claves de módulo de negocio ni catálogo backend (incremento separado).

## 7. User stories

Como desarrollador que compila el instalador nativo, quiero que el identificador de la aplicación coincida con la marca Runly desde la primera build de prueba, sin arrastrar el identificador legado de Atlas.

## 8. UX requirements

N/A.

## 9. Routes/screens

N/A.

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

N/A.

## 16. Navigation impact

N/A.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

N/A.

## 19. Multi-company behavior

N/A.

## 20. Files/storage impact

Cambiar el `identifier` de Tauri cambia la carpeta de AppData/config local donde Tauri guarda su propio estado (no la base de datos de Supabase); cualquier instalación de escritorio existente del usuario deberá reinstalarse para usar el nuevo identificador — aceptado explícitamente por el usuario.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A.

## 23. Edge cases

Si `Cargo.toml` tiene un solo workspace con dos paquetes (`atlas_erp` binario, `atlas_erp_lib` librería), ambos nombres deben cambiar juntos y todo `use`/`extern crate` que los referencie por nombre debe actualizarse o el build de Rust falla en compilación (fallo detectable, no silencioso).

## 24. Risks

Riesgo bajo dado que el entorno se recrea desde cero: el único riesgo real es un build de Rust roto si se olvida actualizar una referencia cruzada de nombre de paquete — se mitiga compilando (`cargo check` o `pnpm tauri build`) tras el cambio.

## 25. Acceptance criteria

`tauri.conf.json identifier`, `Cargo.toml` package names y Android `applicationId`/`namespace` reflejan Runly; `cargo check`/`cargo metadata` (o `pnpm tauri build` si el toolchain está disponible) compila sin errores de nombre de paquete no encontrado.

## 26. Verification plan

`cargo check` dentro de `apps/desktop/src-tauri` (si el toolchain Rust está disponible en el entorno de ejecución); revisión textual de todas las referencias cruzadas de nombre de paquete; `node --check`/lint no aplica a archivos Rust/Kotlin, se usa `rustfmt --check` si está disponible.

## 27. Rollback plan

Revertir el diff de esta etapa restaura los identificadores de Atlas. Cualquier instalación nativa ya compilada con el identificador nuevo necesitaría desinstalarse/reinstalarse para volver al identificador viejo, pero no hay tal instalación en este momento según el usuario.

## 28. Future enhancements

Confirmar el identificador definitivo antes de cualquier publicación real en stores (Play Store/Microsoft Store), ya que cambiarlo después de publicar sí rompe actualizaciones para usuarios reales.
