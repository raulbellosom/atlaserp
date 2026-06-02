# Atlas ERP Docker Installer

Repositorio oficial:
- GitHub: `https://github.com/raulbellosom/atlaserp`
- Docker Hub: `https://hub.docker.com/r/raulbellosom/atlaserp`

Este instalador soporta:
- `external`: Atlas ERP contra Supabase externo.
- `local`: Atlas ERP + Supabase local.
- Dev Kit AME3 automatico para custom modules en `custom-modules/_atlas-devkit/`.

Tags de imagen:
- API: `raulbellosom/atlaserp:api-latest`
- Worker: `raulbellosom/atlaserp:worker-latest`
- Web: `raulbellosom/atlaserp:web-latest` (una sola imagen para local y external)

La imagen web es generica: no lleva credenciales quemadas. Al iniciar el container,
`web-entrypoint.sh` inyecta `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `ATLAS_API_URL`
en `/runtime-config.js` desde las variables de entorno del container.

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
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-local.mjs" -OutFile "stop-local.mjs"
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
curl -fsSLo stop-local.mjs https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/stop-local.mjs
curl -fsSLo setup-local.ps1 https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer/setup-local.ps1

mkdir -p custom-modules

node ./setup-local.mjs
```

## Que hace setup-local.mjs

1. Inicializa Supabase local en `.supabase-local/`.
2. Levanta Supabase sin `logflare` ni `vector`.
3. Genera `.env.local` automaticamente.
4. Descarga Dev Kit AME3 desde GitHub a `custom-modules/_atlas-devkit/` (AGENTS + guias de modulos + capacidades runtime disponibles).
5. Hace `docker pull` de API, worker y web (`web-latest`). Genera `.env` con la URL de Supabase accesible por el browser para interpolacion de Docker Compose.
6. Ejecuta `pnpm db:migrate` y `pnpm db:seed` dentro de la imagen API.
7. Levanta `docker compose --profile local up -d`.

Opciones utiles:

```bash
node ./setup-local.mjs --skip-compose-up  # solo inicializa Supabase, no levanta Atlas
node ./setup-local.mjs --skip-dev-kit     # omite la descarga del Dev Kit AME3
node ./setup-local.mjs --skip-pull        # usa imagenes ya descargadas, no hace docker pull
```

Si el pull falla por timeout de red, el script reintenta automaticamente hasta 3 veces.
Si falla igualmente, descarga las imagenes a mano y vuelve a ejecutar con `--skip-pull`:

```bash
docker pull raulbellosom/atlaserp:api-latest
docker pull raulbellosom/atlaserp:worker-latest
docker pull raulbellosom/atlaserp:web-latest
node ./setup-local.mjs --skip-pull
```

Override del repositorio de documentacion (opcional):

```bash
export ATLAS_DOCS_REPO_OWNER=raulbellosom
export ATLAS_DOCS_REPO_NAME=atlaserp
export ATLAS_DOCS_REPO_REF=main
node ./setup-local.mjs
```

## Iniciar / detener / resetear

Iniciar (primera vez o tras un reset):

```bash
node ./setup-local.mjs
```

Detener (conserva datos — para el dia siguiente):

```bash
node ./stop-local.mjs
```

Reset total (borra todos los contenedores, volumenes y archivos generados):

```bash
node ./stop-local.mjs --reset
```


## Custom modules

- Carpeta host: `custom-modules/`
- Ruta en API/worker: `/app/modules/custom`

### Workflow basico

```bash
# Sincronizar manifests y blueprints
curl -X POST http://localhost:4010/modules/sync \
  -H "Authorization: Bearer $ATLAS_TOKEN"

# Instalar un modulo desde el catalogo
curl -X POST http://localhost:4010/modules/custom.mymodule/install \
  -H "Authorization: Bearer $ATLAS_TOKEN"
```

### Componentes React en modulos (dynamic bundle)

Los modulos pueden incluir componentes React compilados en el momento de instalacion. No se requiere reconstruir la imagen web.

Estructura:

```
custom-modules/
  custom.mymodule/
    components/
      index.js          ← entrada del bundle, exporta register()
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

Despues de editar componentes, forzar recompilacion:

```bash
curl -X POST http://localhost:4010/modules/custom.mymodule/sync \
  -H "Authorization: Bearer $ATLAS_TOKEN"

# Verificar que el bundle existe
curl http://localhost:4010/modules/custom.mymodule/bundle.js
```

El bundle se compila automaticamente en install, sync y reset. En el arranque del API, los bundles faltantes se restauran desde Supabase Storage.

Para documentacion completa: `custom-modules/_atlas-devkit/docs/03_custom_modules.md`
Para inventario de componentes UI disponibles: `custom-modules/_atlas-devkit/docs/ai-context/ame3-runtime-capabilities.md`

## Instalacion external

```bash
cp .env.external.example .env.external
# editar .env.external
docker compose --profile external up -d
```

## Nota sobre tags de imagen

Solo hay una imagen web (`web-latest`) para ambos perfiles. La configuracion de
Supabase y la URL del API se inyectan en runtime via variables de entorno del container.

Para publicar una nueva version:

```bash
docker build -f infra/docker/api.Dockerfile -t raulbellosom/atlaserp:api-latest .
docker build -f infra/docker/worker.Dockerfile -t raulbellosom/atlaserp:worker-latest .
docker build -f infra/docker/web.Dockerfile -t raulbellosom/atlaserp:web-latest .

docker push raulbellosom/atlaserp:api-latest
docker push raulbellosom/atlaserp:worker-latest
docker push raulbellosom/atlaserp:web-latest
```

Para forzar tags manualmente en el setup:

```bash
export ATLAS_API_LOCAL_IMAGE=raulbellosom/atlaserp:api-latest
export ATLAS_WORKER_LOCAL_IMAGE=raulbellosom/atlaserp:worker-latest
export ATLAS_WEB_LOCAL_IMAGE=raulbellosom/atlaserp:web-latest
node ./setup-local.mjs
```
