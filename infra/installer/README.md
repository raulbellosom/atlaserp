# Atlas ERP Docker Installer

Repositorio oficial:
- GitHub: `https://github.com/raulbellosom/atlaserp`
- Docker Hub: `https://hub.docker.com/r/raulbellosom/atlaserp`

Imagenes disponibles:
- API: `raulbellosom/atlaserp:api-latest`
- Worker: `raulbellosom/atlaserp:worker-latest`
- Web: `raulbellosom/atlaserp:web-latest`

La imagen web no lleva credenciales. Al arrancar el container, `web-entrypoint.sh`
inyecta `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `ATLAS_API_URL` desde las variables
de entorno del container en `/runtime-config.js`.

---

## Modos de instalacion

| Modo | Para que | Script |
|------|----------|--------|
| `local` | Desarrollo local con Supabase integrado | `setup-local.mjs` |
| `external` | Produccion contra Supabase externo/self-hosted | `setup-external.mjs` |

---

## Modo `local` — Desarrollo (Supabase integrado)

Requiere: Docker Desktop (o Docker Engine + Compose v2), Node.js 20+, npx.

### Windows (PowerShell)

```powershell
# Desde la carpeta donde quieras instalar Atlas ERP:
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/bootstrap-local.ps1" -OutFile ".\bootstrap-local.ps1"
powershell -ExecutionPolicy Bypass -File .\bootstrap-local.ps1
```

### Linux / macOS / Git Bash

```bash
# Desde la carpeta donde quieras instalar Atlas ERP:
curl -fsSLo bootstrap-local.sh https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/bootstrap-local.sh
chmod +x bootstrap-local.sh
./bootstrap-local.sh
```

> `docker-compose.linux.yml` es requerido en Linux: Docker Engine no inyecta
> `host.docker.internal` automaticamente y este override lo resuelve via `host-gateway`.
> En Windows y macOS Docker Desktop lo inyecta solo y este archivo se ignora.

### Que hace `setup-local.mjs`

1. Inicializa Supabase local en `.supabase-local/`.
2. Levanta Supabase sin `logflare` ni `vector`.
3. Genera `.env.local` automaticamente con las credenciales del stack local.
4. Descarga el Dev Kit AME3 exportado a `custom-modules/_atlas-devkit/` (siempre actualizado
   desde main) usando un `manifest.json` versionado. Incluye `AGENTS.md`,
   guias AME3, `capabilities.runtime.json`, `prompt-starter.txt`,
   `troubleshooting.md` y `golden-path-module/`.
5. Hace `docker pull` de API, worker y web (y de LiveKit + Redis cuando
   `LIVEKIT_MODE=embedded`). Luego ejecuta `docker image prune -f`
   para eliminar layers huerfanos de versiones anteriores.
6. Ejecuta `pnpm db:migrate` y `pnpm db:seed` dentro del container API.
7. Levanta `docker compose --profile local up -d`; agrega el perfil `livekit`
   automaticamente cuando se usa el modo integrado.

### Opciones utiles

```bash
npm run atlas:local       # instalacion / actualizacion completa
npm run atlas:local:docs  # solo descarga/refresca el Dev Kit
npm run atlas:local:quick # salta docker pull y reutiliza imagenes locales
node ./setup-local.mjs --skip-compose-up  # solo inicializa Supabase, no levanta Atlas
```

En PowerShell, si `npm` falla por `ExecutionPolicy`, usa `npm.cmd`:

```powershell
npm.cmd run atlas:local
npm.cmd run atlas:local:docs
npm.cmd run atlas:stop:local
```

### Comandos simples recomendados

```bash
npm run atlas:local
npm run atlas:local:docs
npm run atlas:stop:local
```

---

## Modo `external` — Produccion (servidor Linux)

Para un servidor Linux con Supabase self-hosted o Supabase Cloud ya configurado.
**No requiere npx ni Supabase CLI** — solo Docker y Node.js 20+.

### Instalacion en servidor nuevo (Linux)

```bash
curl -fsSLo bootstrap-external.sh https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/bootstrap-external.sh
chmod +x bootstrap-external.sh
./bootstrap-external.sh

nano .env.external
npm run atlas:external
```

### Windows (PowerShell)

```powershell
# Desde la carpeta donde quieras instalar Atlas ERP:
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/bootstrap-external.ps1" -OutFile ".\bootstrap-external.ps1"
powershell -ExecutionPolicy Bypass -File .\bootstrap-external.ps1

notepad .\.env.external
npm.cmd run atlas:external
```

### Que hace `setup-external.mjs`

1. Valida que `.env.external` existe y tiene las credenciales.
2. Valida que Docker Compose esta disponible.
3. Descarga el Dev Kit AME3 exportado a `custom-modules/_atlas-devkit/` (siempre actualizado
   desde main) usando un `manifest.json` versionado. Incluye `AGENTS.md`,
   guias AME3, `capabilities.runtime.json`, `prompt-starter.txt`,
   `troubleshooting.md` y `golden-path-module/`.
4. Hace `docker pull` de API, worker y web (y de LiveKit + Redis cuando
   `LIVEKIT_MODE=embedded`). Luego ejecuta `docker image prune -f`
   para eliminar layers huerfanos de versiones anteriores y liberar espacio en disco.
5. Ejecuta `pnpm db:migrate` y `pnpm db:seed` dentro del container API.
6. Levanta `docker compose --profile external up -d`; agrega el perfil `livekit`
   automaticamente cuando se usa el modo integrado.

### Opciones utiles

```bash
npm run atlas:external        # instalacion / actualizacion completa
npm run atlas:external:docs   # solo descarga/refresca el Dev Kit
npm run atlas:external:quick  # reinicio rapido sin pull ni migraciones
node ./setup-external.mjs --skip-dev-kit       # omite descarga del Dev Kit AME3
```

### Comandos simples recomendados

```bash
npm run atlas:external
npm run atlas:external:docs
npm run atlas:stop:external
```

### Variables en `.env.external`

```bash
# Ejemplo con Supabase self-hosted
SUPABASE_URL=https://supabase.tudominio.com
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_JWT_SECRET=<jwt_secret>
JWT_SECRET=<jwt_secret>                          # mismo valor que SUPABASE_JWT_SECRET
DATABASE_URL=postgresql://postgres:<pass>@<host>:5432/postgres
DIRECT_URL=postgresql://postgres:<pass>@<host>:5432/postgres
VITE_SUPABASE_URL=https://supabase.tudominio.com
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_ATLAS_API_URL=http://localhost:4010
CORS_ORIGIN=http://localhost:5173
```

> Si la base de datos esta en el mismo servidor Linux, usa `host.docker.internal`
> en lugar de `localhost` en `DATABASE_URL` y `DIRECT_URL`.

---

## Atlas Calls / LiveKit

La configuración principal vive en `.env.local` o `.env.external`. Los scripts no
solicitan datos que ya estén definidos ahí y persisten las claves generadas para
que una actualización no invalide instalaciones existentes:

```bash
LIVEKIT_MODE=embedded
LIVEKIT_DOMAIN=
LIVEKIT_TLS_MODE=managed
LIVEKIT_URL=
LIVEKIT_INTERNAL_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

| Modo | Comportamiento |
|------|----------------|
| `embedded` | Valor predeterminado. Genera credenciales, configuración y levanta LiveKit + Redis. |
| `external` | Atlas usa un servidor LiveKit existente; URL interna y credenciales deben corresponder a ese servidor. |
| `disabled` | Opción explícita que oculta los controles y desactiva la API de llamadas. |

En desarrollo local no se requiere dominio: `setup-local.mjs` genera
`LIVEKIT_URL=ws://localhost:7880`. En Linux la URL interna se deriva como
`http://host.docker.internal:7880`; en Docker Desktop se usa la red privada de
Compose. Hono siempre usa `LIVEKIT_INTERNAL_URL`, mientras el navegador recibe
únicamente `LIVEKIT_URL` y un token temporal.

En producción embedded el único dato RTC público obligatorio es el dominio:

```bash
LIVEKIT_MODE=embedded
LIVEKIT_DOMAIN=rtc.example.com
LIVEKIT_TLS_MODE=managed
```

El instalador deriva `LIVEKIT_URL=wss://rtc.example.com`, genera y persiste las
claves, configura `host-gateway`, inicia Caddy y espera un certificado público
válido antes de continuar. El DNS debe apuntar previamente a la VPS y los puertos
`80/tcp`, `443/tcp`, `443/udp`, `7881/tcp` y `7882/udp` deben estar permitidos.

Con `LIVEKIT_TLS_MODE=external` Atlas no inicia Caddy, no modifica Nginx, no emite
certificados y no asume rutas de archivos TLS. El administrador conserva por
completo la configuración del proxy existente y debe dirigir el dominio de
LiveKit a `http://127.0.0.1:7880` con soporte WebSocket. El instalador únicamente
exige que `wss://LIVEKIT_DOMAIN` tenga TLS válido antes de declarar la instalación
lista.

En Linux, LiveKit usa `network_mode: host`; Redis escucha exclusivamente en
`127.0.0.1:6380` y no se expone públicamente. Antes de imprimir `ready`, el
instalador valida DNS, TLS, Redis, el endpoint de LiveKit y la conexión desde Hono,
y crea y elimina una sala temporal. Redes muy restrictivas pueden requerir TURN.

Nunca expongas `LIVEKIT_API_SECRET` al frontend. Atlas solo entrega tokens de
sala de corta duracion desde la API.

---

## Iniciar / detener / resetear

Los scripts de stop ejecutan `docker image prune -f` automaticamente al terminar
para eliminar layers huerfanos sin tocar imagenes de otros proyectos en el mismo host.

### Local

| Accion | Comando |
|--------|---------|
| Primera instalacion o tras reset | `node ./setup-local.mjs` (o `./setup-local.sh`) |
| Detener (conserva datos) | `node ./stop-local.mjs` (o `./stop-local.sh`) |
| Reiniciar sin reinstalar | `docker compose --profile local --profile livekit --profile livekit-tls up -d` |
| Reset total (borra todo) | `node ./stop-local.mjs --reset` |

### External / Produccion

| Accion | Comando |
|--------|---------|
| Primera instalacion | `node ./setup-external.mjs` (o `./setup-external.sh`) |
| Actualizar a la ultima version | `./setup-external.sh` (pull + prune + recreate automatico) |
| Detener (conserva datos) | `node ./stop-external.mjs` (o `./stop-external.sh`) |
| Reiniciar rapido | `node ./setup-external.mjs --skip-pull --skip-migrate --up-only` |
| Reset (borra .env.external) | `node ./stop-external.mjs --reset` |

---

## Custom modules

Carpeta host: `custom-modules/`
Ruta en API/worker: `/app/modules/custom`

### Workflow basico

```bash
# Obtener token de sesion primero desde la UI o via API

# Sincronizar manifests y blueprints
curl -X POST http://localhost:4010/modules/sync \
  -H "Authorization: Bearer $ATLAS_TOKEN"

# Instalar un modulo desde el catalogo
curl -X POST http://localhost:4010/modules/custom.mymodule/install \
  -H "Authorization: Bearer $ATLAS_TOKEN"
```

### Validacion rapida en la UI

Para validar que AME3 quedo bien actualizado en un workspace installer-mode:

1. Ejecuta `node .\setup-local.mjs` (o `node ./setup-external.mjs` en external mode).
2. Abre `http://localhost:5173`.
3. En la app, entra a Modulos y usa `Sincronizar modulos`.
4. Instala tu modulo custom desde el catalogo.
5. Si el modulo usa una vista `CUSTOM`, abre su ruta y confirma que no aparece `Componente de modulo no disponible`.
6. Si falla un import, revisa primero `custom-modules/_atlas-devkit/troubleshooting.md` y `capabilities.runtime.json`.

### Componentes React en modulos (dynamic bundle)

Los modulos pueden incluir componentes React compilados en el momento de instalacion.
No se requiere reconstruir la imagen web cuando solo cambias archivos dentro de
`custom-modules/<moduleKey>/`.

Estructura:

```
custom-modules/
  custom.mymodule/
    components/
      index.js          <- entrada del bundle, exporta register()
      MyScreen.jsx
    views/
      my-screen.custom.js
    api/
      index.js
    module.manifest.js
```

Contrato de `components/index.js`:

```js
export async function register(registry) {
  if (typeof window === 'undefined') return
  const { default: MyScreen } = await import('./MyScreen.jsx')
  registry.register('custom.mymodule:MyScreen', MyScreen)
}
```

Reglas importantes:

- Usa el runtime JSX automatico normal del proyecto. No agregues
  `/** @jsxRuntime classic */`, `/** @jsx createElement */` ni
  `import { createElement } from 'react'` en componentes del modulo.
- Si cambias solo `custom-modules/<moduleKey>/components/*`, basta con sincronizar o
  reinstalar el modulo para regenerar el bundle.
- Si cambias el runtime compartido del host en `apps/desktop`
  (por ejemplo `src/shims/*`, importmap, externals) debes publicar una nueva imagen
  `web` y recrear `atlas-web-local`.
- Si cambias CORS o autenticacion cross-origin en `apps/api`, debes publicar una nueva
  imagen `api` y recrear `atlas-api-local`.

Forzar recompilacion del bundle tras editar componentes:

```bash
curl -X POST http://localhost:4010/modules/custom.mymodule/sync \
  -H "Authorization: Bearer $ATLAS_TOKEN"

# Verificar
curl http://localhost:4010/modules/custom.mymodule/bundle.js
```

### Troubleshooting rapido

- `The requested module 'react/jsx-runtime' does not provide an export named 'jsx'`
  - La imagen `web` publicada no trae el shim/runtime correcto.
  - Solucion: publicar nueva imagen `web`, hacer `docker compose pull atlas-web-local`
    y recrear el contenedor.
- `Cannot read properties of null (reading 'useContext')`
  - El host esta resolviendo externals por rutas inconsistentes y termina cargando
    dos copias de React/React Query.
  - Solucion: publicar nueva imagen `web` con importmap/shims alineados al mismo
    base path del host y limpiar datos del sitio en el navegador.
- `blocked by CORS policy` con `credentials mode is 'include'`
  - La API responde sin `Access-Control-Allow-Credentials: true`.
  - Solucion: publicar nueva imagen `api`, hacer `docker compose pull atlas-api-local`
    y recrear el contenedor.

Empieza aqui:
- `custom-modules/_atlas-devkit/README.md`
- `custom-modules/_atlas-devkit/docs/ai-context/ame3-modules.md`
- `custom-modules/_atlas-devkit/docs/ai-context/ame3-runtime-capabilities.md`
- `custom-modules/_atlas-devkit/capabilities.runtime.json`

---

## Publicar una nueva version

Desde la raiz del repositorio (requiere `docker login` y Rust/Buildx para arm64):

```bash
# Publicar las tres imagenes (multi-platform: linux/amd64 + linux/arm64)
pnpm docker:release

# Publicar solo la imagen que cambio
pnpm docker:release:api
pnpm docker:release:worker
pnpm docker:release:web

# Build local sin push (para pruebas en tu maquina)
pnpm docker:build
pnpm docker:build --api
```

Los Dockerfiles usan multi-stage build: el stage `builder` hace el install completo
y genera el cliente Prisma; el stage `runner` solo instala dependencias de produccion
(`--prod`), lo que reduce el tamano final de las imagenes.

Despues de un build local (`pnpm docker:build`), el script elimina automaticamente
los layers huerfanos del build anterior con `docker image prune -f`.

Si el cambio solo afecta al runtime web compartido, publica solo `web`. Si el cambio
solo afecta CORS/autenticacion/rutas del API, publica solo `api`. No hace falta subir
`worker` para fixes exclusivos del frontend del modulo.

Forzar tags personalizados en setup:

```bash
export ATLAS_API_IMAGE=raulbellosom/atlaserp:api-latest
export ATLAS_WORKER_IMAGE=raulbellosom/atlaserp:worker-latest
export ATLAS_WEB_EXTERNAL_IMAGE=raulbellosom/atlaserp:web-latest
node ./setup-external.mjs --skip-pull
```
