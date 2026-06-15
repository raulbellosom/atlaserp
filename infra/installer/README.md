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
mkdir atlaserp -Force
cd atlaserp

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/docker-compose.yml" -OutFile "docker-compose.yml"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.mjs"   -OutFile "setup-local.mjs"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-local.mjs"    -OutFile "stop-local.mjs"

New-Item -ItemType Directory -Force -Path custom-modules | Out-Null

node .\setup-local.mjs
```

### Linux / macOS / Git Bash

```bash
mkdir -p ./atlaserp && cd ./atlaserp

curl -fsSLo docker-compose.yml       https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/docker-compose.yml
curl -fsSLo docker-compose.linux.yml https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/docker-compose.linux.yml
curl -fsSLo setup-local.mjs          https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.mjs
curl -fsSLo stop-local.mjs           https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-local.mjs
curl -fsSLo setup-local.sh           https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.sh
curl -fsSLo stop-local.sh            https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-local.sh
chmod +x setup-local.sh stop-local.sh

mkdir -p custom-modules

./setup-local.sh
# equivalente: node ./setup-local.mjs
```

> `docker-compose.linux.yml` es requerido en Linux: Docker Engine no inyecta
> `host.docker.internal` automaticamente y este override lo resuelve via `host-gateway`.
> En Windows y macOS Docker Desktop lo inyecta solo y este archivo se ignora.

### Que hace `setup-local.mjs`

1. Inicializa Supabase local en `.supabase-local/`.
2. Levanta Supabase sin `logflare` ni `vector`.
3. Genera `.env.local` automaticamente con las credenciales del stack local.
4. Descarga el Dev Kit AME3 a `custom-modules/_atlas-devkit/` (siempre actualizado
   desde main): `AGENTS.md`, docs de arquitectura, guias de modulos custom,
   `atlas-storefront-sdk.md`, `ame3-runtime-capabilities.md` y `TASKS.md`.
5. Hace `docker pull` de API, worker y web. Luego ejecuta `docker image prune -f`
   para eliminar layers huerfanos de versiones anteriores.
6. Ejecuta `pnpm db:migrate` y `pnpm db:seed` dentro del container API.
7. Levanta `docker compose --profile local up -d`.

### Opciones utiles

```bash
node ./setup-local.mjs --skip-compose-up  # solo inicializa Supabase, no levanta Atlas
node ./setup-local.mjs --skip-dev-kit     # omite descarga del Dev Kit AME3
node ./setup-local.mjs --skip-pull        # usa imagenes ya descargadas localmente
node ./setup-local.mjs --docs-only        # solo descarga el Dev Kit (sin Docker, sin Supabase)
```

---

## Modo `external` — Produccion (servidor Linux)

Para un servidor Linux con Supabase self-hosted o Supabase Cloud ya configurado.
**No requiere npx ni Supabase CLI** — solo Docker y Node.js 20+.

### Instalacion en servidor nuevo (Linux)

```bash
mkdir -p /opt/atlaserp && cd /opt/atlaserp

curl -fsSLo docker-compose.yml      https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/docker-compose.yml
curl -fsSLo setup-external.mjs      https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-external.mjs
curl -fsSLo stop-external.mjs       https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-external.mjs
curl -fsSLo setup-external.sh       https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-external.sh
curl -fsSLo stop-external.sh        https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-external.sh
curl -fsSLo .env.external.example   https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/.env.external.example
chmod +x setup-external.sh stop-external.sh

mkdir -p custom-modules

cp .env.external.example .env.external
nano .env.external   # completar con credenciales de Supabase

./setup-external.sh
# equivalente: node ./setup-external.mjs
```

### Que hace `setup-external.mjs`

1. Valida que `.env.external` existe y tiene las credenciales.
2. Valida que Docker Compose esta disponible.
3. Descarga el Dev Kit AME3 a `custom-modules/_atlas-devkit/` (siempre actualizado
   desde main): `AGENTS.md`, docs de arquitectura, guias de modulos custom,
   `atlas-storefront-sdk.md`, `ame3-runtime-capabilities.md` y `TASKS.md`.
4. Hace `docker pull` de API, worker y web. Luego ejecuta `docker image prune -f`
   para eliminar layers huerfanos de versiones anteriores y liberar espacio en disco.
5. Ejecuta `pnpm db:migrate` y `pnpm db:seed` dentro del container API.
6. Levanta `docker compose --profile external up -d`.

### Opciones utiles

```bash
node ./setup-external.mjs --skip-pull          # usa imagenes ya descargadas
node ./setup-external.mjs --skip-migrate       # omite migraciones (reinstalacion)
node ./setup-external.mjs --skip-dev-kit       # omite descarga del Dev Kit AME3
node ./setup-external.mjs --up-only            # solo docker compose up (todo ya configurado)
node ./setup-external.mjs --docs-only          # solo descarga el Dev Kit (sin Docker, sin migraciones)
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

## Iniciar / detener / resetear

Los scripts de stop ejecutan `docker image prune -f` automaticamente al terminar
para eliminar layers huerfanos sin tocar imagenes de otros proyectos en el mismo host.

### Local

| Accion | Comando |
|--------|---------|
| Primera instalacion o tras reset | `node ./setup-local.mjs` (o `./setup-local.sh`) |
| Detener (conserva datos) | `node ./stop-local.mjs` (o `./stop-local.sh`) |
| Reiniciar sin reinstalar | `docker compose --profile local up -d` |
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

Para documentacion completa: `custom-modules/_atlas-devkit/docs/03_custom_modules.md`

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
