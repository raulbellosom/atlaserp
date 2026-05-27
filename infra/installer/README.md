# Atlas ERP Docker Installer

Este instalador tiene dos perfiles:

- `external`: Atlas ERP contra un Supabase externo (Cloud o self-hosted).
- `local`: Atlas ERP contra un Supabase local levantado con Supabase CLI (`supabase start`).

## Ruta para custom modules

Los modulos custom del usuario se montan en:

- Host: `infra/installer/custom-modules/`
- Contenedor API/worker: `/app/modules/custom`

Esto mantiene el core dentro de la imagen y deja extensiones en la ruta de modulos.

## Prerrequisitos

- Docker + Docker Compose
- Imagenes publicadas en Docker Hub:
  - `raulbellosom/atlaserp:api-latest`
  - `raulbellosom/atlaserp:worker-latest`
  - `raulbellosom/atlaserp:web-external-latest`

## Perfil external

1. Copia variables:

```powershell
Copy-Item .env.external.example .env.external
```

2. Edita `.env.external` con tus claves de Supabase y `DATABASE_URL`.

3. Levanta Atlas:

```powershell
docker compose --profile external up -d
```

## Perfil local

1. Ejecuta instalacion automatica (no requiere Supabase CLI global):

```powershell
powershell.exe -ExecutionPolicy Bypass -File ./setup-local.ps1
```

Este script hace todo:

- Inicializa un proyecto local de Supabase en `infra/installer/.supabase-local/`
- Ejecuta `supabase start` via `npx` excluyendo `logflare` y `vector` (evita fallas de red frecuentes en Docker Desktop Windows)
- Genera `infra/installer/.env.local` con claves y URLs reales
- Construye imagenes locales (`atlaserp-api-local:dev`, `atlaserp-worker-local:dev`, `atlaserp-web-local:dev`)
- Ejecuta migraciones y seed Prisma en la BD local antes de arrancar API (evita error `public.atlas_module does not exist`)
- Levanta Atlas ERP con `docker compose --profile local up -d`

## Sincronizar modulos custom

Despues de agregar o modificar modulos en `custom-modules`, ejecuta:

```powershell
curl -X POST http://localhost:4010/modules/sync -H "Authorization: Bearer <ATLAS_TOKEN>"
```

## Notas

- Levanta un solo perfil por entorno (`external` o `local`), no ambos al mismo tiempo.
- El frontend web en Vite usa variables en build-time. Por eso se separan etiquetas `web-external` y `web-local`.
- `SUPABASE_JWT_SECRET` se obtiene de Supabase (Cloud: Settings -> API; local: `supabase status -o env`).
- `JWT_SECRET` (Atlas) hoy puede usar el mismo valor que `SUPABASE_JWT_SECRET`.

## Detener local

```powershell
docker compose --profile local down
npx.cmd --yes supabase stop --workdir ./.supabase-local
```
