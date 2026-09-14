# Runly - assets visuales y paleta

Date: 2026-09-13
Spec: `docs/superpowers/specs/2026-09-13-runly-brand-assets-design.md`
Status: Complete (local implementation; visual QA and native rebuild pending)
Mode: IMPLEMENTATION
Authorization: usuario eligió el alcance máximo (branding + catálogo + rename de carpetas + IDs nativos) el 2026-09-13 y entregó la guía de marca completa.

## Goal

Sustituir imágenes, animación de carga, favicons/iconos y paleta de color de Atlas por la identidad oficial de Runly, usando los assets ya entregados en `apps/desktop/public/runly/`.

## Architecture summary

Actualizar cada `<img src>`/import que apunte a `/brand/atlas-logo-*.png` para usar el equivalente en `/runly/`. Reconstruir `AtlasLogoLoader.jsx` como componente Runly (SVG/CSS puro, sin dependencia nueva) usando la paleta de movimiento oficial. Remapear variables CSS de marca en `styles.css`. Apuntar `site.webmanifest`, `index.html` y `tauri.conf.json` a los sets de iconos entregados.

## File Structure Map

Modify:

- `apps/desktop/src/auth/LoginScreen.jsx:97,152`
- `apps/desktop/src/components/Topbar.jsx:89`
- `apps/desktop/src/setup/SetupWizard.jsx:237,361`
- `apps/desktop/src/shell/PublicWebsiteEntry.jsx:136`
- `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx:9`
- `apps/desktop/src/components/AtlasLogoLoader.jsx` (reescritura completa del SVG/paleta)
- `apps/desktop/src/components/AppLoader.jsx` (solo si cambia el nombre/props del componente de loader)
- `apps/desktop/src/components/ApiErrorScreen.jsx:24,284`
- `apps/desktop/src/styles.css:55-66,147` (`--atlas-navy*`, `--atlas-blue`, `--atlas-cyan`, `--brand-primary*`, `--brand-soft`)
- `apps/desktop/index.html:9,14-16` (`theme-color`, favicon links)
- `apps/desktop/public/site.webmanifest` (`icons`, `background_color`, `theme_color`)
- `apps/desktop/src-tauri/tauri.conf.json:31-36` (`icon` array)
- `apps/desktop/src-tauri/icons/` (reemplazar binarios: 32x32, 128x128, 128x128@2x, icon.icns, icon.ico, Square*Logo.png, StoreLogo.png, y subcarpetas android/ios) desde `apps/desktop/public/runly/{web,android,ios}/`
- `scripts/build-brand-assets.mjs` (si referencia rutas/archivos de Atlas)

Create:

- `apps/desktop/public/favicon.ico`, `apps/desktop/public/favicon-32x32.png`, `apps/desktop/public/apple-touch-icon.png`, `apps/desktop/public/icon-192.png`, `apps/desktop/public/icon-512.png` — regenerados/copiados desde `public/runly/web/` (sobrescriben los archivos existentes; no se listan como "modify" porque son binarios reemplazados, no editados).

## Task 1 - Logo/isotipo en pantallas

- [x] Reemplazar las 6 referencias `/brand/atlas-logo-*.png` (Login x2, Topbar, SetupWizard x2, PublicWebsiteEntry, GuestCallScreen) por el asset Runly correcto según contexto claro/oscuro (`runly-logo-*.png`, `runly-isotipo-*.png`, `runly-logo-horizontal-*.png`).
- [x] Reemplazar el SVG inline `AtlasIsotype` en `ApiErrorScreen.jsx` por el isotipo oficial (SVG propio si se puede vectorizar desde el PNG entregado, o `<img>` a `runly-isotipo-*.png` si no).

Validation: `pnpm --filter @runly/desktop build:web`; revisión visual manual de cada pantalla en light y dark.

## Task 2 - Loader de arranque

- [x] Reescribir `AtlasLogoLoader.jsx` para dibujar la R oficial de Runly (usar `runly-loader.html`/`runly-loader-dark.html` como referencia de geometría/temporización) con la paleta Midnight/Navy para la parte estable y el gradiente Orange→Flame→Coral→Red→Crimson para el trazo de movimiento.
- [x] Verificar que `AppLoader.jsx` siga montando el componente sin cambios de prop-contract salvo el nombre si se renombra.

Validation: `pnpm --filter @runly/desktop build:web`; revisión visual del splash en dev server (recarga forzada para disparar el loader).

## Task 3 - Paleta de color

- [x] Remapear en `styles.css` las variables `--atlas-navy`, `--atlas-navy-2`, `--atlas-navy-dark`, `--atlas-blue`, `--atlas-cyan` a los valores Runly (Midnight `#0C172D`, Navy `#132646`, y un tono intermedio para el actual `--atlas-navy-2`/`--atlas-blue` según contraste, más Orange/Flame/Coral/Red/Crimson donde corresponda a acentos de movimiento) y `--brand-soft` a la variante rgba del nuevo acento.
- [x] Actualizar `theme-color` en `index.html` y `background_color`/`theme_color` en `site.webmanifest` a los hex Runly.

Validation: `pnpm --filter @runly/desktop build:web`; revisión visual de contraste AA en botones/focus rings/links en light y dark, 390px y 1440px.

## Task 4 - Favicons, PWA icons, iconos nativos

- [x] Copiar/generar `favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` desde `public/runly/web/` hacia `apps/desktop/public/`.
- [x] Actualizar `site.webmanifest` `icons[].src` si los nombres de archivo cambian. (No cambiaron — se mantuvieron `icon-192.png`/`icon-512.png`; solo se actualizaron `background_color`/`theme_color` en Task 3.)
- [x] Copiar los iconos de `public/runly/{android,ios}/` hacia las rutas correspondientes bajo `apps/desktop/src-tauri/icons/` (incluye Windows Square*Logo/StoreLogo) y actualizar `tauri.conf.json` `icon` array si los nombres cambian. Ejecutado vía `pnpm exec tauri icon "public/runly/runly-app-icon-light.png" -o src-tauri/icons` en vez de copia manual — ver Evidence para justificación. `tauri.conf.json` no requirió cambios (los nombres de archivo del array `icon` no cambiaron).

Validation: `node --check` no aplica (binarios); parsear `site.webmanifest`/`tauri.conf.json` como JSON tras el cambio; `pnpm --filter @runly/desktop build:web`.

## Task 5 - Verificación

- [x] `pnpm lint` sobre los archivos JS/JSX tocados.
- [x] `pnpm --filter @runly/desktop build:web`.
- [x] Registrar evidencia y límites reales (sin build nativo, sin publicación) en este plan y en `docs/TASKS.md`.

## Rollback Notes

Revertir el diff de esta etapa restaura assets, loader y paleta de Atlas. Sin cambios de base de datos.

## Evidence

Verified: 2026-09-13 (implementación local, sin QA visual en navegador ni rebuild nativo)

### Task 1 — Logo/isotipo

Reemplazos aplicados (`grep -rn "atlas-logo" apps/desktop/src apps/desktop/index.html apps/desktop/public/site.webmanifest` → 0 resultados tras el cambio):

- `apps/desktop/src/auth/LoginScreen.jsx:97` (panel lateral, fondo oscuro `var(--brand-primary)`) → `/runly/runly-logo-dark.png`.
- `apps/desktop/src/auth/LoginScreen.jsx:152` (isotipo pequeño sobre `bg-background`, que cambia con el tema) → par `runly-isotipo-light.png` / `runly-isotipo-dark.png` con `dark:hidden` / `hidden dark:block` (sin JS, Tailwind `@custom-variant dark`).
- `apps/desktop/src/components/Topbar.jsx:88-98` (botón de inicio, topbar con `glass` que cambia con el tema) → mismo patrón de par light/dark.
- `apps/desktop/src/setup/SetupWizard.jsx:237,361` (ambos sobre gradiente navy fijo, no depende del tema de la app) → `/runly/runly-logo-dark.png`.
- `apps/desktop/src/shell/PublicWebsiteEntry.jsx:136` (navbar de `ComingSoonScreen`, fondo claro fijo `rgba(245,243,239,.9)`) → `/runly/runly-logo-light.png`.
- `apps/desktop/src/modules/runly.chat/calls/guest/GuestCallScreen.jsx:9` (`ATLAS_LOGO`, watermark + logo de pie sobre fondo claro) → `/runly/runly-logo-horizontal-light.png`.

**Corrección post-QA del usuario (2026-09-13):** `LoginScreen.jsx` mostraba, además del logo Runly, el logo/nombre de la empresa configurada a nivel de instancia (`useBrandingStore`) debajo de un separador en el panel lateral, y sustituía el texto "Runly ERP · Meridian Edition" del panel de formulario por `branding.companyName` cuando existía. Esto es incorrecto en un producto multi-tenant: el login es una sola pantalla compartida por todas las empresas de la instancia, y en el momento de iniciar sesión todavía no se sabe a qué empresa(s) pertenece el usuario — la marca de una empresa específica no debe aparecer ahí, solo dentro de la app ya con una compañía activa. Se removió el bloque de logo/nombre de empresa del panel lateral y el fallback condicional del panel de formulario (ahora siempre "Runly ERP · Meridian Edition"), junto con el import ahora no usado de `useBrandingStore`. El store en sí no se tocó — sigue usándose correctamente en `CompanyBranding.jsx`, `SetupWizard.jsx` y otros consumidores post-login.

`ApiErrorScreen.jsx`: el `AtlasIsotype` inline (paths de un cubo isométrico aproximado, no el isotipo real) fue reemplazado por un componente que renderiza `<img>` a `runly-isotipo-light.png`/`runly-isotipo-dark.png` (par `dark:hidden`/`hidden dark:block`), preservando la prop `muted` vía `opacity`. Se optó por `<img>` en vez de vectorizar el PNG a paths SVG a mano (el spec permite explícitamente esta opción) porque no existe un SVG fuente de Runly y trazar los paths a mano introduciría imprecisión geométrica frente al isotipo oficial.

### Task 2 — Loader de arranque

`AtlasLogoLoader.jsx` reescrito por completo: elimina los ~180 paths SVG hardcodeados del isotipo viejo de Atlas y el uso de `motion/react`. Nueva implementación, 100% CSS/SVG:

- Isotipo base real (`runly-isotipo-{light,dark}.png`, theme-aware vía `MutationObserver` sobre `document.documentElement.classList`, igual que la versión anterior) renderizado atenuado (`opacity-25`).
- Capa de "sweep" con el gradiente cálido oficial (`Orange→Flame→Coral→Red→Crimson`) enmascarada al alpha channel del mismo PNG vía `mask-image`/`-webkit-mask-image`, animada con `background-position` (`@keyframes loader-gradient-sweep`, 2.6s linear infinite).
- Halo ambiental pulsante detrás (reutiliza la clase `.loader-halo` ya existente en `styles.css`, con `background` inline al gradiente de marca).
- Label con pulso de opacidad vía CSS (`@keyframes loader-label-pulse`) en vez de `framer-motion`.
- `@media (prefers-reduced-motion: reduce)` desactiva las 3 animaciones nuevas.

**Corrección post-QA del usuario (2026-09-13, mismo día):** el usuario revisó el resultado en el dev server y aclaró que el loader de arranque debía ser literalmente las animaciones ya entregadas en `apps/desktop/public/runly/runly-loader.html`/`runly-loader-dark.html` (una construcción de la R con SVG animado por CSS `@keyframes` — trazo, "flood", onda, breathing, glow, dots, barra de progreso — ~1.4 MB cada una, generadas fuera de este repo), no una reconstrucción aproximada en React. Se revirtió el enfoque de esta sección:

- `AtlasLogoLoader.jsx` **eliminado** (sin otros consumidores).
- `AppLoader.jsx` reescrito para renderizar un `<iframe>` a pantalla completa apuntando a `runly-loader.html`/`-dark.html` según el tema activo (mismo hook `useIsDark` con `MutationObserver` que tenía el componente eliminado). El mensaje contextual (`message` prop, usado por `AppRouteGuard`, `GoogleCalendarCallbackScreen`, `ActiveCompanyProvider` con distintos textos) se pasa como query string `?msg=`; ambos archivos HTML recibieron un cambio mínimo (un `id="rl3-msg"` en el `<span>` del texto y 3 líneas de JS al final del `<script>` existente) para leer ese parámetro y sobrescribir el texto por defecto ("Cargando tu espacio de trabajo") sin tocar la animación en sí.
- Clases CSS `.loader-gradient-sweep`/`.loader-label-pulse` (y sus `@keyframes`) retiradas de `styles.css` por quedar huérfanas; `.loader-halo` preexistente se dejó intacta (no se tocó su otro posible uso fuera de esta etapa).

Esto reemplaza la subsección anterior de esta evidencia (SVG/CSS puro reconstruido a mano) — se conserva aquí para que quede el porqué del cambio de rumbo.

**Segunda ronda de feedback (2026-09-13):** el usuario reportó que, tras recargar, no vio ninguna animación. Causa real: `AppEntry.jsx` solo renderiza `<AppLoader>` mientras `atlas.instance.status()` está pendiente, y contra la API local esa llamada resuelve en ~20-50ms — el iframe de 1.4 MB nunca alcanza a cargar/pintar antes de ser desmontado. Se agregó un piso de 900ms (`MIN_LOADER_MS`) en ese efecto para que el loader quede visible al menos un ciclo de animación, sin afectar el resto del flujo (solo pospone cuándo se marca `brandReady`, no la llamada real a la API).

También se encontraron y corrigieron colores de marca Atlas que **no** pasan por las variables CSS (por lo tanto el remapeo de la Task 3 no los tocó): `apps/desktop/src/setup/SetupWizard.jsx` y `StepBranding.jsx` (el asistente de primer arranque / alta de instancia) tenían el gradiente hero (`#0A1D44`/`#102A5E`), el acento de texto/iconos (`#21C7FF`) y la paleta de sugerencias de color de marca por-compañía completamente hardcodeados en estilos inline. Reemplazados por Midnight/Navy (`#0C172D`/`#132646`) y Orange (`#FD8B2A`) respectivamente; `FALLBACK_COLORS` en `StepBranding.jsx` ahora son los 7 colores oficiales de la guía (Orange/Flame/Coral/Red/Crimson/Navy/Midnight); el `primaryColor` por defecto del formulario pasó de `#0A7BFF` a `#FD6016`. `LoginScreen.jsx`: el panel lateral usaba `var(--brand-primary)` (ahora Flame) como relleno sólido de fondo — la guía de marca es explícita en que el gradiente cálido es un acento, nunca un flood fill; se cambió a la misma base Midnight/Navy que ya usa el setup wizard, con los glows radiales en tono cálido como acento. Se agregó el tagline oficial "Business in motion." en el login (reemplazando "Conecta. Gestiona. Crece.") y en ambas variantes (desktop/móvil) del panel del setup wizard, junto al wordmark.

Verificado: `pnpm lint` y `pnpm --filter @runly/desktop build:web` limpios tras cada ronda; HMR del dev server aplicó los cambios sin errores (una invalidación de Fast Refresh esperada en `AppEntry.jsx` por sus exports no-componente, resuelta con reload completo del navegador, no un error).

**Tercera ronda de feedback (2026-09-13):** el usuario aclaró que quería la animación integrada de verdad en la app (como el loader de React que existía antes de Atlas), no aislada en un iframe — un iframe es una navegación separada dentro de la página, visualmente "de la app" pero técnicamente ajena. `AppLoader.jsx` se reescribió de nuevo: en vez de `<iframe src=...>`, hace `fetch()` del HTML fuente (cacheado en memoria por variante de tema para no repetir la descarga de 1.4MB en cada montaje), lo parsea con `DOMParser`, extrae el `<style>` y el `<div>` raíz de contenido, y los inyecta directo en el árbol de React vía `dangerouslySetInnerHTML` — literalmente en el mismo documento, no en un contexto de navegación separado. El `<script>` original (que resincroniza las animaciones `rl3-*` a un mismo ciclo) no se ejecuta al inyectarse por `innerHTML`, así que esa lógica se reimplementó en un `useEffect` idéntico al original; el mensaje contextual ahora se fija directamente por DOM (`textContent` sobre `#rl3-msg`) en vez de pasarse por query string (el soporte `?msg=` agregado a los HTML fuente en la ronda anterior queda sin usar por este camino, pero no estorba — sigue sirviendo si alguien abre el archivo directo en el navegador).

También se eliminó "Meridian Edition" de `LoginScreen.jsx` (3 apariciones: etiqueta bajo el logo del sidebar, sello de versión del footer, y label sobre el encabezado del formulario) y `SetupWizard.jsx` (footer del panel hero) — el usuario señaló que ya no tiene sentido, es un remanente de la era Atlas.

Por último, se investigó el reporte de "veo la página pública en / por unos segundos estando en /app". Causa raíz confirmada para el arranque en frío de la app nativa: `apps/desktop/src-tauri/tauri.conf.json` no declaraba una `url` para la ventana, así que Tauri cargaba la raíz `/` por defecto — que es exactamente la ruta de `PublicWebsiteEntry` (la página pública/sitio-builder), la cual muestra su propio loader (`PublicPageLoader`, deliberadamente sin marca Runly porque también la ven visitantes anónimos del sitio público de un cliente real) mientras resuelve si hay un sitio público configurado, y solo después redirige a `/app/login`. Se agregó `"url": "/app/login"` a la config de ventana de Tauri: esa ruta ya maneja los tres casos (instancia sin inicializar → redirige a `/app/setup`; sesión activa → redirige a `/app`; sin sesión → `LoginScreen`), así que la app nativa deja de pasar por la página pública en cada arranque. Esto no se ha podido verificar visualmente (requiere un build/arranque nativo real, no solo el dev server web) ni se confirmó si es exactamente el mismo escenario que el usuario reprodujo (reload de una URL `/app/...` ya profunda en una pestaña de navegador normal, no arranque en frío) — pendiente de confirmación del usuario tras probar.

### Task 3 — Paleta de color

`apps/desktop/src/styles.css` — nombres de variable sin cambios (para no romper consumidores no listados en el plan), solo valores hex:

| Variable | Antes | Ahora | Origen |
|---|---|---|---|
| `--atlas-navy` | `#0a1d44` | `#0c172d` | Midnight |
| `--atlas-navy-2` | `#102a5e` | `#132646` | Navy |
| `--atlas-navy-dark` | `#06152f` | `#070d18` | Fondo neutro oscuro Runly |
| `--atlas-blue` (usado como `--brand-primary-hover`) | `#0a7bff` | `#f6381a` | Red |
| `--atlas-cyan` (usado como `--brand-primary`) | `#21c7ff` | `#fd6016` | Flame |
| `--brand-soft` (light) | `rgba(33,199,255,.14)` | `rgba(253,96,22,.14)` | Flame @ 14% |
| `--brand-soft` (dark, `.dark` block) | `rgba(33,199,255,.18)` | `rgba(253,96,22,.20)` | Flame @ 20% |

Contraste verificado a mano (fórmula WCAG relative-luminance): `--brand-primary-foreground` (`--atlas-navy-dark` = `#070d18`, luminancia ≈0.003) sobre `--brand-primary` (`#fd6016`, luminancia ≈0.29) da un ratio ≈6.4:1 — pasa AA para texto normal. Se descartó texto blanco sobre `#fd6016` (ratio ≈3.1:1, falla AA para texto normal, solo pasa para texto grande).

`apps/desktop/index.html`: `<meta name="theme-color">` `#102A5E` → `#132646`.
`apps/desktop/public/site.webmanifest`: `background_color` `#0A1D44`→`#0C172D`, `theme_color` `#102A5E`→`#132646`.
`scripts/build-brand-assets.mjs`: mismos dos hex actualizados en el objeto `webManifest` que este script escribe (para que una futura ejecución no revierta el manifest a los colores viejos de Atlas).

**Límite explícito de alcance** (no tocado, fuera de las líneas listadas en el plan): los gradientes/acentos hardcodeados inline en `SetupWizard.jsx` (`#0A1D44`, `#102A5E`, `#21C7FF` en los glows/íconos del panel de branding) y en `PublicWebsiteEntry.jsx`'s `ComingSoonScreen`/`DraftViewScreen` (`#1B65F0`, `#6366f1`) no se cambiaron — el plan solo autorizaba las líneas de imagen (237/361 y 136) en esos archivos, no sus estilos decorativos inline. También `--ring` (actualmente HSL fijo, no derivado de `--atlas-cyan`) quedó sin tocar por no estar en la lista de variables del plan. Ambos son inconsistencias visuales residuales conocidas — recomendado como seguimiento.

### Task 4 — Favicons, PWA icons, iconos nativos

Copiados directamente desde `public/runly/web/` (assets ya en formato/tamaño correcto, exportados por el equipo de diseño):

```
public/runly/web/favicon.ico          -> apps/desktop/public/favicon.ico
public/runly/web/apple-touch-icon.png -> apps/desktop/public/apple-touch-icon.png
public/runly/web/icon-192.png         -> apps/desktop/public/icon-192.png
public/runly/web/icon-512.png         -> apps/desktop/public/icon-512.png
```

`favicon-32x32.png`: el set entregado en `public/runly/web/` no incluye este tamaño exacto (solo favicon.ico, apple-touch-icon, icon-192/512 y variantes maskable). Se generó ejecutando `pnpm exec tauri icon "public/runly/runly-app-icon-light.png" -o src-tauri/icons` (ver abajo) y copiando el `32x32.png` resultante — mismo patrón que ya usa `scripts/build-brand-assets.mjs` (`tauriIconsDir/32x32.png` → `publicDir/favicon-32x32.png`).

**Iconos nativos (`src-tauri/icons/`)**: el set entregado en `public/runly/{android,ios}/` no es un reemplazo directo archivo-por-archivo del set que Tauri espera — faltan `icon.icns`/`icon.ico` (no hay equivalentes Runly de esos formatos), y los nombres/bucket de densidades de Android e iOS no coinciden exactamente con los que Tauri genera (p. ej. Tauri espera `ic_launcher_round.png` y `values/ic_launcher_background.xml`, ausentes en el set entregado; el set entregado trae `ic_launcher_monochrome.png`, no usado por Tauri 2). Copiar manualmente habría dejado el set nativo incompleto/roto para un build real.

En su lugar se usó el generador oficial de Tauri (ya usado por `scripts/build-brand-assets.mjs` para Atlas), apuntándolo al PNG cuadrado 1254×1254 `runly-app-icon-light.png` (elegido porque ya incluye su propio fondo blanco redondeado, por lo que se ve bien tanto en taskbars claros como oscuros):

```
$ cd apps/desktop && pnpm exec tauri icon "public/runly/runly-app-icon-light.png" -o src-tauri/icons
        Appx Creating StoreLogo.png / Square*.png (Windows)
         ICNS Creating icon.icns
         ICO Creating icon.ico
         PNG Creating 32x32.png / 64x64.png / 128x128.png / 128x128@2x.png / icon.png
         iOS Creating AppIcon-*.png (18 archivos)
     Android Creating mipmap-*/ic_launcher*.png (16 archivos)
```

`git status --short apps/desktop/src-tauri/icons` confirma 35 archivos regenerados in-place con los nombres ya esperados por `tauri.conf.json` — no fue necesario editar el array `icon` de `tauri.conf.json`.

Validación JSON: `node -e "JSON.parse(...)"` sobre `site.webmanifest` y `tauri.conf.json` → ambos `OK`.

### Task 5 — Verificación

```
$ pnpm --filter @runly/desktop build:web
✓ built in 4.21s
(warnings preexistentes de chunk-size >500kB, no relacionados con este cambio)
```

```
$ pnpm eslint apps/desktop/src/auth/LoginScreen.jsx apps/desktop/src/components/Topbar.jsx \
    apps/desktop/src/setup/SetupWizard.jsx apps/desktop/src/shell/PublicWebsiteEntry.jsx \
    apps/desktop/src/modules/runly.chat/calls/guest/GuestCallScreen.jsx \
    apps/desktop/src/components/AtlasLogoLoader.jsx apps/desktop/src/components/AppLoader.jsx \
    apps/desktop/src/components/ApiErrorScreen.jsx
(sin salida — 0 errores, 0 warnings)
```

### Límites honestos (pendiente para el usuario)

- **No se hizo QA visual en navegador real.** Este incremento se ejecutó como subagente sin navegador interactivo disponible; la verificación se limitó a build exitoso + lint limpio + inspección de código/imágenes fuente. Falta la revisión manual explícita que exige `docs/ai-context/ui-screen-audit-checklist.md` y la política de QA responsive del proyecto: **390px y 1440px, light y dark**, en LoginScreen, Topbar, SetupWizard (ambos pasos), PublicWebsiteEntry (`ComingSoonScreen`), GuestCallScreen, ApiErrorScreen y el splash `AppLoader`/`AtlasLogoLoader` (forzar recarga para disparar el loader).
- **No se hizo build nativo.** `pnpm tauri build`/`pnpm tauri dev` no se ejecutaron — los iconos nativos se regeneraron en `src-tauri/icons/` pero no se empaquetó ni probó un `.exe`/`.app` real con ellos.
- **`scripts/build-brand-assets.mjs` sigue apuntando a fuentes Atlas** (`identity/atlas-erp_*.png`, `identity/atlas-erp_isotype.svg`) para su pipeline completo de regeneración (incluye `generate-transparent-brand-assets.py` y el enmascarado Android adaptativo en `build-native-brand-assets.mjs`). Solo se actualizaron los dos literales de color que este script escribe en `site.webmanifest`. Reescribir el pipeline completo para Runly requeriría un set de fuentes Runly con la misma forma que `identity/atlas-erp_*` (incluyendo un SVG vectorial del isotipo, que no existe todavía — los assets entregados en `public/runly/` son PNGs ya renderizados, no fuentes vectoriales) — se deja como seguimiento explícito, no se intentó una reescritura parcial que dejaría el script roto o inconsistente.
- **Inconsistencias de color fuera de alcance** (ver Task 3): colores inline hardcodeados en `SetupWizard.jsx` y `PublicWebsiteEntry.jsx` (fuera de las líneas de imagen autorizadas por el plan), y `--ring` (focus outline) sin remapear.
- **`docs/TASKS.md`**: no se encontró una sección específica de branding/assets en ese archivo para anotar este incremento aparte de esta entrada de evidencia; se documenta aquí como fuente de verdad de esta etapa.
