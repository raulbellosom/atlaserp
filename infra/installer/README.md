# Atlas ERP Docker Installer

Este instalador soporta dos perfiles:

- `external`: Atlas ERP contra Supabase externo.
- `local`: Atlas ERP + Supabase local (cross-platform).

El objetivo del perfil `local` es replicar la instalación en otros equipos sin compilar el repo: descarga imágenes publicadas + levanta Supabase local + ejecuta migraciones/seed.

## Ruta de custom modules

- Host: `infra/installer/custom-modules/`
- Contenedor API/worker: `/app/modules/custom`

## Prerrequisitos

- Docker Desktop / Docker Engine con Compose v2
- Node.js 20+ (para ejecutar `setup-local.mjs`)
- Acceso a Docker Hub para descargar imágenes:
  - `raulbellosom/atlaserp:api-local-latest`
  - `raulbellosom/atlaserp:worker-local-latest`
  - `raulbellosom/atlaserp:web-local-latest`
  - `raulbellosom/atlaserp:api-latest`
  - `raulbellosom/atlaserp:worker-latest`
  - `raulbellosom/atlaserp:web-external-latest`

## Instalación local (Windows, Linux, macOS)

Desde `infra/installer`:

```bash
node ./setup-local.mjs
```

El script hace automáticamente:

1. Inicializa Supabase local en `.supabase-local/` (si no existe).
2. Levanta Supabase (`supabase start`) excluyendo `logflare` y `vector`.
3. Genera `.env.local` con claves/URLs runtime.
4. Descarga imágenes `api-local/worker-local/web-local` desde Docker Hub.
5. Ejecuta `db:migrate` y `db:seed` dentro de la imagen API.
6. Levanta `docker compose --profile local up -d`.

## Instalación sin clonar el repo (solo instalador)

Puedes descargar únicamente los archivos del instalador y ejecutar desde ahí.

### Linux / macOS (bash)

```bash
mkdir -p atlaserp-installer && cd atlaserp-installer
curl -fsSLO https://raw.githubusercontent.com/<ORG_O_USUARIO>/<REPO>/<TAG_O_BRANCH>/infra/installer/docker-compose.yml
curl -fsSLO https://raw.githubusercontent.com/<ORG_O_USUARIO>/<REPO>/<TAG_O_BRANCH>/infra/installer/setup-local.mjs
mkdir -p custom-modules
node ./setup-local.mjs
```

### Windows (PowerShell)

```powershell
mkdir atlaserp-installer
cd atlaserp-installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/<ORG_O_USUARIO>/<REPO>/<TAG_O_BRANCH>/infra/installer/docker-compose.yml" -OutFile "docker-compose.yml"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/<ORG_O_USUARIO>/<REPO>/<TAG_O_BRANCH>/infra/installer/setup-local.mjs" -OutFile "setup-local.mjs"
New-Item -ItemType Directory -Force -Path custom-modules | Out-Null
node .\setup-local.mjs
```

En este modo también puedes usar `custom-modules/` para tus módulos AME3.

### Wrapper para PowerShell (opcional)

```powershell
powershell.exe -ExecutionPolicy Bypass -File ./setup-local.ps1
```

### Solo preparar `.env.local` (sin arrancar contenedores)

```bash
node ./setup-local.mjs --skip-compose-up
```

## Instalación external

1. Copia variables:

```bash
cp .env.external.example .env.external
```

2. Edita `.env.external` con tus claves de Supabase y `DATABASE_URL`.
3. Levanta Atlas:

```bash
docker compose --profile external up -d
```

## Detener local

```bash
docker compose --profile local down
npx --yes supabase stop --workdir ./.supabase-local
```

## Reset limpio local (desde cero)

```bash
docker compose --profile local down --remove-orphans || true
npx --yes supabase stop --workdir ./.supabase-local --no-backup || true
docker ps -a --filter "name=supabase_" -q | xargs -r docker rm -f
docker network ls --format "{{.Name}}" | rg "^supabase_" | xargs -r docker network rm
docker volume ls --format "{{.Name}}" | rg "^supabase_" | xargs -r docker volume rm
rm -rf ./.supabase-local
rm -f ./.env.local
```

## Sincronizar custom modules

Después de agregar o modificar módulos en `custom-modules`:

```bash
curl -X POST http://localhost:4010/modules/sync -H "Authorization: Bearer <ATLAS_TOKEN>"
```

## Publicar imágenes para nuevas instalaciones

Si quieres versionar e instalar en otros dispositivos de forma estable, publica tags versionados además de `latest`.

Ejemplo (multi-arch):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -f infra/docker/api.Dockerfile -t raulbellosom/atlaserp:api-local-v1 --push .
docker buildx build --platform linux/amd64,linux/arm64 -f infra/docker/worker.Dockerfile -t raulbellosom/atlaserp:worker-local-v1 --push .
docker buildx build --platform linux/amd64,linux/arm64 -f infra/docker/web.Dockerfile -t raulbellosom/atlaserp:web-local-v1 --push .
```

Luego, en la máquina destino, puedes fijar imágenes por variable:

```bash
export ATLAS_API_LOCAL_IMAGE=raulbellosom/atlaserp:api-local-v1
export ATLAS_WORKER_LOCAL_IMAGE=raulbellosom/atlaserp:worker-local-v1
export ATLAS_WEB_LOCAL_IMAGE=raulbellosom/atlaserp:web-local-v1
node ./setup-local.mjs
```

## Notas

- Levanta un solo perfil por entorno (`external` o `local`), no ambos.
- `JWT_SECRET` de Atlas puede reutilizar el `SUPABASE_JWT_SECRET` en local.
- Para Linux/macOS usa `npx`; en Windows también puedes usar `npx.cmd`.
