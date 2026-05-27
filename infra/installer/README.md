# Atlas ERP Docker Installer

Repositorio oficial:
- GitHub: `https://github.com/raulbellosom/atlaserp`
- Docker Hub: `https://hub.docker.com/r/raulbellosom/atlaserp`

Este instalador soporta:
- `external`: Atlas ERP contra Supabase externo.
- `local`: Atlas ERP + Supabase local.
- Dev Kit AME3 automatico para custom modules en `custom-modules/_atlas-devkit/`.

Tags unificadas:
- API: `raulbellosom/atlaserp:api-latest` (local y external)
- Worker: `raulbellosom/atlaserp:worker-latest` (local y external)
- Web external: `raulbellosom/atlaserp:web-external-latest`
- Web local: `raulbellosom/atlaserp:web-local-latest`

## Prerrequisitos

- Docker Desktop (o Docker Engine + Compose v2)
- Node.js 20+

## Instalacion en PC nueva sin clonar repo (copy/paste)

### Windows (PowerShell)

```powershell
mkdir C:\atlaserp-installer -Force
cd C:\atlaserp-installer

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/docker-compose.yml" -OutFile "docker-compose.yml"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.mjs" -OutFile "setup-local.mjs"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.ps1" -OutFile "setup-local.ps1"

New-Item -ItemType Directory -Force -Path custom-modules | Out-Null

node .\setup-local.mjs
```

Si lo ejecutas desde Git Bash y quieres usar PowerShell wrapper:

```bash
powershell -ExecutionPolicy Bypass -File ./setup-local.ps1
```

### Linux / macOS (bash)

```bash
mkdir -p ~/atlaserp-installer && cd ~/atlaserp-installer

curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/docker-compose.yml
curl -fsSLo setup-local.mjs https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.mjs
curl -fsSLo setup-local.ps1 https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.ps1

mkdir -p custom-modules

node ./setup-local.mjs
```

## Que hace setup-local.mjs

1. Inicializa Supabase local en `.supabase-local/`.
2. Levanta Supabase sin `logflare` ni `vector`.
3. Genera `.env.local` automaticamente.
4. Descarga Dev Kit AME3 desde GitHub a `custom-modules/_atlas-devkit/` (AGENTS + guias de modulos + capacidades runtime disponibles).
5. Hace `docker pull` de API, worker y web. Si `web-local-latest` no existe, usa fallback a `web-external-latest`.
6. Ejecuta `pnpm db:migrate` y `pnpm db:seed` dentro de la imagen API.
7. Levanta `docker compose --profile local up -d`.

Opciones utiles:

```bash
node ./setup-local.mjs --skip-compose-up
node ./setup-local.mjs --skip-dev-kit
```

Override del repositorio de documentacion (opcional):

```bash
export ATLAS_DOCS_REPO_OWNER=raulbellosom
export ATLAS_DOCS_REPO_NAME=atlaserp
export ATLAS_DOCS_REPO_REF=main
node ./setup-local.mjs
```

## Iniciar / detener

Iniciar:

```bash
node ./setup-local.mjs
```

Detener:

```bash
docker compose --profile local down
npx --yes supabase stop --workdir ./.supabase-local
```

## Reset total (local)

### Linux / macOS (bash)

```bash
docker compose --profile local down --remove-orphans || true
npx --yes supabase stop --workdir ./.supabase-local --no-backup || true
docker ps -a --filter "name=supabase_" -q | xargs -r docker rm -f
docker network ls --format "{{.Name}}" | grep "^supabase_" | xargs -r docker network rm
docker volume ls --format "{{.Name}}" | grep "^supabase_" | xargs -r docker volume rm
rm -rf ./.supabase-local ./.env.local
```

### Windows (PowerShell)

```powershell
docker compose --profile local down --remove-orphans
npx --yes supabase stop --workdir ./.supabase-local --no-backup
docker ps -a --filter "name=supabase_" -q | ForEach-Object { docker rm -f $_ }
docker network ls --format "{{.Name}}" | Select-String "^supabase_" | ForEach-Object { docker network rm $_.Line }
docker volume ls --format "{{.Name}}" | Select-String "^supabase_" | ForEach-Object { docker volume rm $_.Line }
Remove-Item -Recurse -Force .\.supabase-local -ErrorAction SilentlyContinue
Remove-Item -Force .\.env.local -ErrorAction SilentlyContinue
```

Limpieza extra por label de Supabase CLI (PowerShell):

```powershell
docker ps -a --filter "label=com.supabase.cli.project=supabase-local" -q | ForEach-Object { docker rm -f $_ }
docker network ls --filter "label=com.supabase.cli.project=supabase-local" -q | ForEach-Object { docker network rm $_ }
docker volume ls --filter "label=com.supabase.cli.project=supabase-local" -q | ForEach-Object { docker volume rm $_ }
```

## Custom modules

- Carpeta host: `custom-modules/`
- Ruta en API/worker: `/app/modules/custom`

Sincronizar modulos:

```bash
curl -X POST http://localhost:4010/modules/sync -H "Authorization: Bearer <ATLAS_TOKEN>"
```

## Instalacion external

```bash
cp .env.external.example .env.external
# editar .env.external
docker compose --profile external up -d
```

## Nota sobre tags de imagen

Solo necesitas publicar dos variantes para web (`web-local-latest` y `web-external-latest`).
API y worker ya usan `api-latest` y `worker-latest` para ambos perfiles.

Si quieres forzar tags manualmente:

```bash
export ATLAS_API_LOCAL_IMAGE=raulbellosom/atlaserp:api-latest
export ATLAS_WORKER_LOCAL_IMAGE=raulbellosom/atlaserp:worker-latest
export ATLAS_WEB_LOCAL_IMAGE=raulbellosom/atlaserp:web-external-latest
node ./setup-local.mjs
```
