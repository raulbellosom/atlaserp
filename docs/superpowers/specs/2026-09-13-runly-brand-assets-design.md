# Runly — assets visuales y paleta

Date: 2026-09-13
Status: Planned
Autorización: el usuario eligió el alcance máximo el 2026-09-13 y entregó la guía de marca completa (paleta, tipografía, reglas de isotipo) más los assets nuevos en `apps/desktop/public/runly/`.

## 1. Feature title

Reemplazo de imágenes, animación de carga y paleta de color de Atlas por la identidad visual oficial de Runly.

## 2. Status

Planned. `2026-09-13-runly-visible-branding` ya cambió todo el texto humano a "Runly"; esta etapa cubre lo que esa etapa dejó explícitamente fuera: assets, paleta e identificadores nativos de icono.

## 3. Context

Existen assets nuevos ya entregados: `runly-app-icon-{light,dark}.png`, `runly-isotipo-{light,dark,alter-blue}.png`, `runly-logo-{light,dark}.png`, `runly-logo-horizontal-{light,dark}.png`, `runly-logo-vertical-{light,dark}.png`, `runly-loader.html`, `runly-loader-dark.html`, y subcarpetas `android/`, `ios/`, `web/` con sets de iconos por plataforma, todos bajo `apps/desktop/public/runly/`. Ninguno está conectado todavía a la aplicación. El PNG usado hoy en login/topbar/setup/watermark de llamadas sigue siendo `apps/desktop/public/brand/atlas-logo-*.png`. El loader de arranque (`apps/desktop/src/components/AtlasLogoLoader.jsx`) es un SVG animado a mano que redibuja el isotipo viejo con colores hardcodeados. Los favicons/manifest/iconos de Tauri también siguen en assets viejos. `apps/desktop/src/styles.css` define `--atlas-navy/-blue/-cyan` como las variables `--brand-primary`/`--brand-primary-hover`/`--brand-primary-foreground` activas.

## 4. Problem

La aplicación ya se llama "Runly ERP" en todo el texto visible, pero visualmente sigue mostrando el logo, la animación y los colores de Atlas — la identidad de marca está a medias, lo cual es más confuso que no haber empezado el rebrand.

## 5. Goals

- Sustituir las 5 referencias a `/brand/atlas-logo-*.png` (LoginScreen, Topbar, SetupWizard, PublicWebsiteEntry, GuestCallScreen) por los assets Runly equivalentes, respetando el uso claro/oscuro correcto en cada contexto.
- Sustituir la animación `AtlasLogoLoader.jsx` por una versión Runly: usar los loaders HTML ya entregados como referencia de temporización/colores y reconstruir el componente React con la geometría y paleta oficiales (Midnight/Navy para la sección estable, gradiente cálido Orange→Flame→Coral→Red→Crimson para el movimiento), o incrustar el HTML entregado si su estructura lo permite sin romper el ciclo de vida de React del `AppLoader`.
- Sustituir `ApiErrorScreen.jsx`'s inline `AtlasIsotype` SVG por el isotipo oficial.
- Actualizar favicon (`favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`), `site.webmanifest` icon array, y el set de iconos de `apps/desktop/src-tauri/icons/` (incluyendo Windows Square/StoreLogo y las subcarpetas `android/`/`ios/`) usando los assets ya provistos en `public/runly/web/`, `public/runly/android/`, `public/runly/ios/`.
- Remapear `--atlas-navy`, `--atlas-navy-2`, `--atlas-navy-dark`, `--atlas-blue`, `--atlas-cyan` (y sus consumidores `--brand-primary*`, `--brand-soft`) en `styles.css` a la paleta Runly: Midnight `#0C172D`, Navy `#132646`, Orange `#FD8B2A`, Flame `#FD6016`, Coral `#FC5736`, Red `#F6381A`, Crimson `#CF231A`, más los neutrales light/dark entregados por el usuario. Actualizar `theme-color`/`background_color` en `index.html` y `site.webmanifest` a los hex nuevos.

## 6. Non-goals

No se tocan textos (ya resueltos en la etapa de branding visible). No se cambia el catálogo de módulos, carpetas de módulos ni identificadores nativos de bundle (`applicationId`/`identifier`) — son incrementos separados, aunque los binarios de icono referenciados desde `tauri.conf.json` sí se reemplazan. No se introduce una librería de animación nueva si el componente React actual puede adaptarse con SVG/CSS puro.

## 7. User stories

Como usuario final quiero ver el isotipo, el loader y los colores de Runly en cada pantalla, sin que ninguna superficie muestre todavía el logo o los colores de Atlas.

## 8. UX requirements

Mantener glassmorphism/superficies flotantes ya usadas en el shell actual. El loader de arranque debe seguir comunicando "cargando" con la misma latencia percibida; su animación puede evocar el lenguaje de movimiento de la R (trazo progresivo) descrito en la guía de marca, pero no es obligatorio implementar la secuencia completa de construcción de letras en esta etapa — un loader más simple es aceptable si el tiempo no alcanza, documentado como seguimiento. Contraste: verificar que texto sobre `--brand-primary`/superficies nuevas cumpla AA tanto en light como en dark.

## 9. Routes/screens

LoginScreen, Topbar, SetupWizard (2 usos), PublicWebsiteEntry, GuestCallScreen (llamadas de invitado), AppLoader/AtlasLogoLoader (splash global), ApiErrorScreen. Ningún cambio de ruta.

## 10. Data model

N/A.

## 11. Prisma impact

N/A.

## 12. API contract

N/A — cambio puramente de frontend/estáticos.

## 13. SDK contract

N/A.

## 14. Validator contract

N/A.

## 15. Module manifest impact

Los manifiestos oficiales referencian rutas de icono de módulo (no el logo de producto); no se tocan en esta etapa salvo que alguno apunte literalmente a `/brand/atlas-logo-*` (a verificar durante la implementación).

## 16. Navigation impact

N/A.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

N/A.

## 19. Multi-company behavior

El logo de producto (marca propia) es independiente del logo de empresa que cada compañía puede subir en `CompanyBranding.jsx`; esta etapa no toca la lógica de logo por-compañía, solo el logo de producto/plataforma.

## 20. Files/storage impact

Los PNG/ico/manifest afectados viven en `apps/desktop/public/` (assets estáticos servidos por Vite/nginx), no en Supabase Storage. `scripts/build-brand-assets.mjs` (mencionado en la etapa de branding visible como archivo tocado) se revisa por si genera/copia assets — si existe, se actualiza para apuntar a los archivos Runly en vez de a los de Atlas.

## 21. Export/import requirements

Los footers de PDF/Excel ya usan las variables de marca actualizadas en la etapa de branding visible; se verifica que no incrusten directamente el PNG viejo — si lo hacen, se actualiza la referencia de imagen para exports en esta etapa.

## 22. Audit log requirements

N/A.

## 23. Edge cases

Modo oscuro/claro: cada punto de uso debe elegir el asset `-dark`/`-light` correcto según el tema activo, igual que hoy. Cache de PWA: cambiar assets estáticos por debajo de una ruta ya cacheada requiere que el manifest ETag (ya invalidado en la etapa de branding visible) siga sirviendo el HTML/CSS actualizado a clientes con caché previa — se verifica manualmente cargando con caché fría y con caché previa simulada.

## 24. Risks

Cambiar `styles.css` `--brand-primary` puede afectar contraste/legibilidad en componentes que asumen el azul cyan actual (botones, focus rings, links) — se revisa visualmente en 390px y 1440px tras el cambio, siguiendo la política de QA responsive del proyecto. Sustituir el loader SVG a mano por una versión nueva puede introducir jank si la animación es pesada; se mantiene simple (CSS transforms/opacity) para evitar regresión de performance en el arranque.

## 25. Acceptance criteria

Ninguna pantalla de las enumeradas en el punto 9 referencia ya un archivo bajo `/brand/atlas-*`; el loader de arranque usa geometría/colores Runly; favicons/manifest/iconos Tauri apuntan a los assets nuevos; `--brand-primary`/`--brand-soft`/`theme-color`/`background_color` reflejan la paleta Runly en light y dark; build web pasa; revisión visual en 390px y 1440px sin regresiones de contraste.

## 26. Verification plan

`pnpm --filter @runly/desktop build:web`; revisión visual manual (dev server) de login, topbar, setup wizard, pantalla de error de API, y splash de arranque en ambos temas y ambos anchos de viewport; `pnpm lint` sobre los archivos JS/JSX tocados; inspección de que `site.webmanifest`/`tauri.conf.json` sigan siendo JSON válido tras el cambio de rutas de icono.

## 27. Rollback plan

Revertir el diff de esta etapa restaura los assets y colores de Atlas; no hay cambios de base de datos ni de identificadores persistidos.

## 28. Future enhancements

Secuencia de animación completa de construcción de la R (loading/splash/onboarding) descrita en la guía de marca, si el loader simple de esta etapa no la cubre; imágenes de marketing/fotografía; landing pública con el nuevo lenguaje visual.
