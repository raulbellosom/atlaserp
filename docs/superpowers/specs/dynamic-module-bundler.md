# Spec: Dynamic Module Bundler (Atlas Plugin Runtime)

## Contexto y motivación

Atlas ERP usa AME3 (Atlas Module Engine v3) donde los módulos custom viven en
`modules/custom/<moduleKey>/`. Hoy en día:

- El **API** (Node.js) carga rutas de módulos dinámicamente al arrancar — ya funciona en Docker.
- El **frontend** (React/Vite) requiere que los componentes JSX de los módulos estén presentes
  en build-time para que Vite los compile. Esto significa que una imagen Docker pre-compilada
  **no puede** cargar componentes React de módulos instalados post-build.

El objetivo de esta fase es replicar el patrón de **Odoo asset bundles**: cuando se instala un
módulo, el servidor compila sus componentes en runtime y los sirve al frontend como un bundle
independiente. Esto permite que:

1. El ERP se distribuya como imagen Docker.
2. Los usuarios monten su carpeta de módulos como volumen.
3. Instalen módulos vía `POST /modules/:key/install` sin reconstruir la imagen.
4. El frontend cargue los componentes del módulo dinámicamente.

---

## Restricción crítica: dependencias en runtime

### API (Node.js)
Los módulos custom del API **solo pueden usar paquetes que ya estén en `node_modules`** de la
imagen Docker. No se puede ejecutar `npm install` en producción. La imagen define la "stdlib"
disponible (exceljs, pdfkit, sharp, hono, prisma, etc.).

Patrón establecido: acceder a deps del API via `createRequire` apuntando a `apps/api/package.json`.

### Frontend (esbuild en runtime)
Dos fuentes de dependencias disponibles para componentes de módulos:

1. **Externos pre-cargados**: React, ReactDOM, TanStack Query, Zustand, y cualquier paquete ya
   en el bundle principal son marcados como `external` en esbuild — no se re-bundlean.
2. **ESM CDN imports**: el módulo puede importar desde `https://esm.sh/<pkg>` directamente en
   su JSX. El browser los descarga en runtime. No requieren estar en `node_modules`.

```js
// Permitido en componentes de módulos custom
import { useState } from 'react'                          // external, ya cargado
import { useQuery } from '@tanstack/react-query'          // external, ya cargado
import confetti from 'https://esm.sh/canvas-confetti'     // CDN, descargado por el browser
```

Lo que NO es posible: importar un paquete npm arbitrario que no esté en `node_modules` ni en CDN.

---

## Arquitectura propuesta

```
modules/custom/custom.financia/
  components/
    index.js          ← entry point del bundle (export named de todos los componentes)
    AccountScreen.jsx
    ExportButton.jsx
  api/
    index.js          ← rutas Hono (ya funciona hoy)
  views/              ← blueprints JSON (ya funciona hoy)
  models/             ← Atlas ORM (ya funciona hoy)
```

### Flujo de instalación

```
POST /modules/custom.financia/install
  → module-lifecycle-service (existente)
  → [nuevo] module-bundler-service detecta components/index.js
  → esbuild.build({ entryPoints, bundle: true, format: 'esm', external: [...] })
  → bundle guardado en DB (tabla ModuleBundle) o en filesystem /bundles/
  → registro en AtlasModule: { bundle_url: '/modules/custom.financia/bundle.js' }
```

### Flujo de carga en el frontend

```
App arranca → GET /blueprints (ya existente, devuelve módulos instalados)
  → [nuevo campo] cada módulo incluye bundle_url si tiene componentes
  → ModuleLoader inyecta <script type="module" src={bundle_url}> por cada módulo
  → Los componentes se registran en un ComponentRegistry global
  → Las rutas/blueprints del módulo referencian componentes por nombre
  → React Router / blueprint renderer los resuelve desde el registry
```

---

## Componentes a implementar

### 1. `module-bundler-service.js` (apps/api/src/services/)

Responsabilidades:
- Detectar si un módulo tiene `components/index.js`
- Invocar `esbuild.build()` con la configuración correcta
- Almacenar el bundle resultante
- Exponer el bundle vía HTTP

Configuración de esbuild:
```js
await esbuild.build({
  entryPoints: [`modules/custom/${moduleKey}/components/index.js`],
  bundle: true,
  format: 'esm',
  outfile: `dist/bundles/${moduleKey}.js`,
  external: [
    'react', 'react-dom', 'react/jsx-runtime',
    '@tanstack/react-query',
    'zustand',
    '@atlas/ui',
    // todos los paquetes que el frontend ya carga
  ],
  jsx: 'automatic',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  // Permite imports https:// (ESM CDN) — esbuild los pasa through
  plugins: [externalCdnPlugin],
})
```

Storage del bundle:
- **Opción A**: filesystem en `apps/api/dist/bundles/<moduleKey>.js` (simple, se pierde al reiniciar si es efímero)
- **Opción B**: columna `bundle_blob` en tabla `AtlasModule` (persiste en DB, portable)
- **Opción C**: Supabase Storage bucket `module-bundles` (recomendado para producción)

### 2. Endpoint `GET /modules/:key/bundle.js` (apps/api/src/routes/modules.js)

Sirve el bundle compilado con `Content-Type: application/javascript`.
Responde 404 si el módulo no tiene componentes o no está instalado.

### 3. `ModuleLoader` (apps/desktop/src/components/)

Componente React que:
- Lee la lista de módulos instalados con `bundle_url`
- Inyecta `<script type="module">` para cada bundle
- Provee un `ComponentRegistry` context con `register(name, Component)` y `resolve(name)`

```jsx
// Patrón de auto-registro en el bundle del módulo
import { registerAtlasComponent } from '@atlas/ui'
import AccountScreen from './AccountScreen.jsx'
registerAtlasComponent('custom.financia.AccountScreen', AccountScreen)
```

### 4. `ComponentRegistry` (packages/ui/src/)

Context + hook para que el blueprint renderer resuelva componentes por nombre string:
```js
const Component = useComponentRegistry('custom.financia.AccountScreen')
```

Permite que blueprints referencien componentes sin un import estático.

### 5. Re-bundling en módulo update/reset

`POST /modules/:key/reset` y `POST /modules/:key/sync` deben invalidar y regenerar el bundle.
`POST /modules/:key/uninstall` debe eliminar el bundle almacenado.

---

## Tabla de base de datos: ModuleBundle (opcional si se usa DB storage)

```sql
-- Nueva migración Prisma
model ModuleBundle {
  id          String   @id @default(dbgenerated("uuidv7()"))
  module_key  String   @unique
  bundle_js   Bytes    -- blob del bundle compilado
  bundle_hash String   -- checksum para cache
  built_at    DateTime @default(now())
  esbuild_version String
}
```

Alternativa: agregar campos al modelo `AtlasModule` existente en lugar de tabla nueva.

---

## Dependencias nuevas

```json
// apps/api/package.json
"esbuild": "^0.25.0"   // ya presente como dep de Vite en devDeps del frontend
```

esbuild no requiere paquetes nativos adicionales — tiene binarios pre-compilados para
linux/amd64, linux/arm64, darwin, win32. Funciona en el contenedor Docker sin configuración.

---

## Limitaciones conocidas y decisiones pendientes

| Pregunta | Opciones |
|---|---|
| ¿Dónde guardar el bundle? | Filesystem (simple) / DB blob / Supabase Storage |
| ¿Cache invalidation? | Hash del source + versión del módulo |
| ¿Hot reload en dev? | Watch mode de esbuild + WebSocket al frontend |
| ¿Soporte TypeScript en módulos? | esbuild lo soporta nativamente, solo añadir loader |
| ¿Sourcemaps en dev? | `sourcemap: 'inline'` en esbuild cuando `NODE_ENV=development` |
| ¿Seguridad: qué puede importar un módulo? | Sandboxing no incluido — confianza implícita en el autor del módulo |

---

## Lo que NO cambia

- `modules/custom/*/api/index.js` — sigue igual, route-loader lo monta dinámicamente
- `modules/custom/*/views/` — blueprints siguen funcionando sin bundle
- `modules/custom/*/models/` — Atlas ORM sin cambios
- `prisma/schema.prisma` — no se modifica para tablas de módulos AME3
- Módulos que no tienen `components/` — sin cambios, funcionan igual que hoy

---

## Fases de implementación sugeridas

**Fase 1 — Infraestructura del bundler**
- `module-bundler-service.js` con esbuild
- Endpoint `GET /modules/:key/bundle.js`
- Storage en filesystem (temporal)
- Trigger en `install` y `uninstall`

**Fase 2 — Carga dinámica en frontend**
- `ComponentRegistry` context en `@atlas/ui`
- `ModuleLoader` en `apps/desktop`
- Auto-registro desde bundles de módulos

**Fase 3 — Integración con blueprint renderer**
- `AtlasDetail`, `AtlasForm`, `AtlasCrudView` resuelven componentes custom via registry
- Soporte para `component` field type en blueprints

**Fase 4 — Storage persistente**
- Migrar de filesystem a Supabase Storage o DB blob
- Soporte multi-tenant (bundle por tenant si aplica)
