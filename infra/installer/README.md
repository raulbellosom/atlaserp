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
mkdir C:\atlaserp-installer -Force
cd C:\atlaserp-installer

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/docker-compose.yml" -OutFile "docker-compose.yml"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.mjs"   -OutFile "setup-local.mjs"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-local.mjs"    -OutFile "stop-local.mjs"

New-Item -ItemType Directory -Force -Path custom-modules | Out-Null

node .\setup-local.mjs
```

### Linux / macOS / Git Bash

```bash
mkdir -p ~/atlaserp-installer && cd ~/atlaserp-installer

curl -fsSLo docker-compose.yml  https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/docker-compose.yml
curl -fsSLo setup-local.mjs     https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.mjs
curl -fsSLo stop-local.mjs      https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-local.mjs
curl -fsSLo setup-local.sh      https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.sh
curl -fsSLo stop-local.sh       https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-local.sh
chmod +x setup-local.sh stop-local.sh

mkdir -p custom-modules

./setup-local.sh
# equivalente: node ./setup-local.mjs
```

### Que hace `setup-local.mjs`

1. Inicializa Supabase local en `.supabase-local/`.
2. Levanta Supabase sin `logflare` ni `vector`.
3. Genera `.env.local` automaticamente con las credenciales del stack local.
4. Descarga Dev Kit AME3 a `custom-modules/_atlas-devkit/`.
5. Hace `docker pull` de API, worker y web.
6. Ejecuta `pnpm db:migrate` y `pnpm db:seed` dentro del container API.
7. Levanta `docker compose --profile local up -d`.

### Opciones utiles

```bash
node ./setup-local.mjs --skip-compose-up  # solo inicializa Supabase, no levanta Atlas
node ./setup-local.mjs --skip-dev-kit     # omite descarga del Dev Kit AME3
node ./setup-local.mjs --skip-pull        # usa imagenes ya descargadas localmente
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
3. Descarga Dev Kit AME3 a `custom-modules/_atlas-devkit/`.
4. Hace `docker pull` de API, worker y web.
5. Ejecuta `pnpm db:migrate` y `pnpm db:seed` dentro del container API.
6. Levanta `docker compose --profile external up -d`.

### Opciones utiles

```bash
node ./setup-external.mjs --skip-pull          # usa imagenes ya descargadas
node ./setup-external.mjs --skip-migrate       # omite migraciones (reinstalacion)
node ./setup-external.mjs --skip-dev-kit       # omite descarga del Dev Kit AME3
node ./setup-external.mjs --up-only            # solo docker compose up (todo ya configurado)
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
No se requiere reconstruir la imagen web.

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

Forzar recompilacion del bundle tras editar componentes:

```bash
curl -X POST http://localhost:4010/modules/custom.mymodule/sync \
  -H "Authorization: Bearer $ATLAS_TOKEN"

# Verificar
curl http://localhost:4010/modules/custom.mymodule/bundle.js
```

Para documentacion completa: `custom-modules/_atlas-devkit/docs/03_custom_modules.md`

---

## Publicar una nueva version

```bash
# Desde la raiz del repositorio
docker build -f infra/docker/api.Dockerfile    -t raulbellosom/atlaserp:api-latest .
docker build -f infra/docker/worker.Dockerfile -t raulbellosom/atlaserp:worker-latest .
docker build -f infra/docker/web.Dockerfile    -t raulbellosom/atlaserp:web-latest .

docker push raulbellosom/atlaserp:api-latest
docker push raulbellosom/atlaserp:worker-latest
docker push raulbellosom/atlaserp:web-latest
```

Forzar tags personalizados en setup:

```bash
export ATLAS_API_IMAGE=raulbellosom/atlaserp:api-latest
export ATLAS_WORKER_IMAGE=raulbellosom/atlaserp:worker-latest
export ATLAS_WEB_EXTERNAL_IMAGE=raulbellosom/atlaserp:web-latest
node ./setup-external.mjs --skip-pull
```
