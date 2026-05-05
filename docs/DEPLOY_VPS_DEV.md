# Deploy VPS — Dev Environment (dev-atlaserp.racoondevs.com)

> **Audiencia:** Desarrollador con acceso SSH al VPS (76.13.114.109).  
> **Objetivo:** Levantar Atlas ERP en modo dev detrás de un subdominio con HTTPS.  
> **Stack desplegado:** API (Hono) + Web preview (Vite build → Nginx) + Worker, todo via Docker Compose + Nginx reverse proxy + Certbot.

---

## Resumen del flujo

```
Internet
  → Nginx (host) :80/:443  →  SSL termination
    → dev-atlaserp.racoondevs.com/api/*  → Docker: atlas-api :4010
    → dev-atlaserp.racoondevs.com/       → Docker: atlas-web-preview :5173 (Nginx interno)
```

La base de datos sigue en el mismo VPS (Supabase self-hosted en Docker, `172.22.0.3:5432`).  
**No** necesitas SSH tunnel desde el VPS — es conexión local dentro de la red Docker.

---

## Requisitos previos en el VPS

| Componente                 | Versión mínima           |
| -------------------------- | ------------------------ |
| Docker + Docker Compose v2 | `docker compose version` |
| Nginx (host)               | `nginx -v`               |
| Certbot + plugin nginx     | `certbot --version`      |
| Git                        | `git --version`          |

```bash
# Instalar si falta
apt update && apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git
```

---

## Paso 1 — Clonar el repositorio en el VPS

```bash
cd /opt
git clone https://github.com/TU_ORG/atlaserp-v2.git atlaserp-dev
cd atlaserp-dev
```

> Si el repo es privado, usa un Deploy Key o un token personal con permisos `read`.

---

## Paso 2 — Crear el archivo `.env`

```bash
cp .env.example .env
nano .env
```

Valores mínimos a completar **en el VPS** (obténlos de `/opt/supabase-atlaserp/supabase/docker/.env`):

```dotenv
NODE_ENV=production

# Supabase — mismo host, red Docker interna
SUPABASE_URL=https://supabase.racoondevs.com
SUPABASE_ANON_KEY=<ANON_KEY del .env de Supabase>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY del .env de Supabase>
SUPABASE_JWT_SECRET=<JWT_SECRET del .env de Supabase>

# Prisma — sin tunnel SSH: acceso directo a la red Docker interna del mismo VPS
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@172.22.0.3:5432/postgres
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@172.22.0.3:5432/postgres

# API
ATLAS_API_PORT=4010
JWT_SECRET=<genera con: openssl rand -hex 32>
CORS_ORIGIN=https://dev-atlaserp.racoondevs.com

# Vite frontend
VITE_SUPABASE_URL=https://supabase.racoondevs.com
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
VITE_ATLAS_API_URL=https://dev-atlaserp.racoondevs.com/api
```

> **IMPORTANTE:** `VITE_ATLAS_API_URL` apunta al subdominio/api ya que el frontend se sirve desde Nginx —
> el browser debe alcanzar la API desde internet, no desde `localhost`.

Asegurar permisos:

```bash
chmod 600 .env
```

---

## Paso 3 — Actualizar docker-compose.yml para dev

El `docker-compose.yml` raíz es suficiente. Verifica que `web-preview` reciba el `VITE_ATLAS_API_URL`:

```yaml
# docker-compose.yml (ya incluye esto)
web-preview:
  build:
    context: .
    dockerfile: infra/docker/web.Dockerfile
  container_name: atlas-web-preview
  environment:
    VITE_ATLAS_API_URL: ${VITE_ATLAS_API_URL:-http://localhost:4010}
  ports:
    - "5173:80"
  restart: unless-stopped
```

> El `web.Dockerfile` hace `vite build` en tiempo de build, por lo que `VITE_ATLAS_API_URL` debe
> estar disponible como variable de entorno **en el momento del `docker compose build`**, no solo en runtime.
> El `environment:` block en compose no es suficiente para Vite — ver nota al pie.

### Solución: pasar el VITE\_ como build-arg

Actualiza el bloque `web-preview` en `docker-compose.yml`:

```yaml
web-preview:
  build:
    context: .
    dockerfile: infra/docker/web.Dockerfile
    args:
      VITE_ATLAS_API_URL: ${VITE_ATLAS_API_URL}
      VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
      VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY}
  container_name: atlas-web-preview
  ports:
    - "5173:80"
  restart: unless-stopped
```

Y en `infra/docker/web.Dockerfile` expón los args:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages packages
COPY apps/desktop apps/desktop

# Inyectar variables Vite en tiempo de build
ARG VITE_ATLAS_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_ATLAS_API_URL=$VITE_ATLAS_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN pnpm install
RUN pnpm --filter @atlas/desktop build:web

FROM nginx:alpine
COPY --from=build /app/apps/desktop/dist /usr/share/nginx/html
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## Paso 4 — Build y levantado de contenedores

```bash
cd /opt/atlaserp-dev

# Build de imágenes (la primera vez tarda ~5 min)
docker compose build

# Levantar en background
docker compose up -d

# Verificar que los tres contenedores estén Up
docker compose ps

# Logs en vivo
docker compose logs -f api
```

Comprueba que la API responde dentro del VPS:

```bash
curl -s http://localhost:4010/health
# {"status":"ok"}
```

---

## Paso 5 — Certificado SSL con Certbot

```bash
# Asegúrate de que el DNS dev-atlaserp.racoondevs.com apunta a 76.13.114.109
# Luego obtén el certificado (el plugin nginx configura automáticamente)
certbot --nginx -d dev-atlaserp.racoondevs.com
```

Responde las preguntas interactivas (correo, aceptar ToS, redirect). Certbot escribe la config en
`/etc/nginx/sites-enabled/dev-atlaserp`.

---

## Paso 6 — Configurar Nginx como reverse proxy (host)

Crea `/etc/nginx/sites-available/dev-atlaserp.racoondevs.com`:

```nginx
server {
    listen 80;
    server_name dev-atlaserp.racoondevs.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name dev-atlaserp.racoondevs.com;

    ssl_certificate     /etc/letsencrypt/live/dev-atlaserp.racoondevs.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dev-atlaserp.racoondevs.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # Tamaño máximo de carga (archivos)
    client_max_body_size 50M;

    # API → Docker atlas-api
    location /api/ {
        proxy_pass         http://127.0.0.1:4010/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Frontend → Docker atlas-web-preview
    location / {
        proxy_pass         http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Activar y recargar:

```bash
ln -s /etc/nginx/sites-available/dev-atlaserp.racoondevs.com \
      /etc/nginx/sites-enabled/

nginx -t && systemctl reload nginx
```

---

## Paso 7 — Aplicar migraciones de Prisma

La API corre dentro de Docker pero Prisma `migrate deploy` puede ejecutarse directo desde el VPS
(sin tunnel SSH, porque Postgres está en la misma red Docker — accesible en `172.22.0.3:5432`).

```bash
cd /opt/atlaserp-dev

# Instalar dependencias node en host (solo para correr prisma CLI)
npm install -g pnpm
pnpm install --frozen-lockfile

# Aplicar migraciones (usando DATABASE_URL del .env)
export $(grep -v '^#' .env | xargs)
pnpm prisma:deploy

# Seed inicial (solo primera vez)
pnpm db:seed
```

Alternativamente, ejecuta dentro del contenedor API:

```bash
docker compose exec api pnpm prisma:deploy
docker compose exec api node prisma/seed.js
```

---

## Paso 8 — Actualizar el CORS_ORIGIN en `.env`

```dotenv
CORS_ORIGIN=https://dev-atlaserp.racoondevs.com
```

Reinicia el contenedor API para aplicar el cambio:

```bash
docker compose restart api
```

---

## Flujo de actualización (CD manual)

Cuando haya cambios en el repositorio:

```bash
cd /opt/atlaserp-dev
git pull origin main

# Si cambiaron dependencias o código
docker compose build

# Si cambiaron solo variables .env
docker compose restart

# Si hay nuevas migraciones
docker compose exec api pnpm prisma:deploy

# Subir todo con los nuevos contenedores
docker compose up -d
```

---

## Verificación final

| Check                 | Comando                                                   |
| --------------------- | --------------------------------------------------------- |
| API health            | `curl https://dev-atlaserp.racoondevs.com/api/health`     |
| Frontend carga        | Abrir `https://dev-atlaserp.racoondevs.com` en el browser |
| Logs API              | `docker compose logs -f api`                              |
| Logs frontend         | `docker compose logs -f web-preview`                      |
| Certificado SSL       | `certbot certificates`                                    |
| Renovación automática | `systemctl status certbot.timer`                          |

---

## Notas de seguridad para este entorno dev

- El `.env` en el VPS debe tener `chmod 600` y pertenecer a `root` o al usuario que corre Docker.
- `SUPABASE_SERVICE_ROLE_KEY` y `JWT_SECRET` nunca deben aparecer en variables `VITE_` ni en la respuesta de ningún endpoint.
- El puerto `4010` y `5173` **no deben estar abiertos en el firewall** del VPS — solo Nginx (80/443) debe ser público.
- Verifica las reglas UFW: `ufw status` — solo `22`, `80`, `443` deben estar `ALLOW`.

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw deny 4010
ufw deny 5173
ufw enable
```

---

## Arrancar contenedores y verificar que `.env` está siendo leído

### 1 — Verificar que el `.env` existe y tiene los valores correctos antes de arrancar

```bash
cd /opt/atlaserp-dev

# Ver qué variables están definidas (sin mostrar sus valores)
grep -v '^#' .env | grep -v '^$' | cut -d= -f1
```

Debes ver todas estas claves listadas:

```
NODE_ENV
ATLAS_API_PORT
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
DATABASE_URL
DIRECT_URL
JWT_SECRET
CORS_ORIGIN
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_ATLAS_API_URL
```

Si alguna falta, edítala antes de continuar:

```bash
nano .env
```

### 2 — Arrancar los contenedores

```bash
# Primera vez (construye imágenes + arranca)
docker compose up -d --build

# Siguientes veces (solo arranca si las imágenes ya existen)
docker compose up -d
```

### 3 — Confirmar que los tres contenedores están corriendo

```bash
docker compose ps
```

Salida esperada:

```
NAME                  IMAGE                    STATUS          PORTS
atlas-api             atlaserp-dev-api         Up X seconds    0.0.0.0:4010->4010/tcp
atlas-worker          atlaserp-dev-worker      Up X seconds
atlas-web-preview     atlaserp-dev-web-...     Up X seconds    0.0.0.0:5173->80/tcp
```

Si alguno aparece como `Exit` o `Restarting`, revisa su log:

```bash
docker compose logs api       # o worker / web-preview
```

### 4 — Verificar que el `.env` se leyó dentro del contenedor API

Docker pasa el `.env` al contenedor `api` y `worker` mediante `env_file: .env`.
Para confirmar que las variables llegaron correctamente:

```bash
# Ver TODAS las variables de entorno del contenedor (incluye secretos — solo en VPS privado)
docker compose exec api printenv | sort

# Verificar variables específicas sin exponer secretos
docker compose exec api printenv NODE_ENV
docker compose exec api printenv ATLAS_API_PORT
docker compose exec api printenv SUPABASE_URL
docker compose exec api printenv CORS_ORIGIN

# Confirmar que los secretos están definidos (sin mostrar su valor)
docker compose exec api sh -c '[ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && echo "SERVICE_ROLE_KEY: OK" || echo "SERVICE_ROLE_KEY: VACIO"'
docker compose exec api sh -c '[ -n "$JWT_SECRET" ] && echo "JWT_SECRET: OK" || echo "JWT_SECRET: VACIO"'
docker compose exec api sh -c '[ -n "$DATABASE_URL" ] && echo "DATABASE_URL: OK" || echo "DATABASE_URL: VACIO"'
```

### 5 — Verificar que las variables Vite quedaron bakeadas en el frontend

Las variables `VITE_*` se inyectan en tiempo de `vite build` (dentro del Dockerfile), no en runtime.
Para confirmar que llegaron al bundle:

```bash
# Buscar la URL de la API dentro del HTML/JS generado
docker compose exec web-preview grep -r "VITE_ATLAS_API_URL\|racoondevs\|4010" /usr/share/nginx/html --include="*.js" -l

# Ver el valor exacto que quedó bakeado
docker compose exec web-preview grep -r "https://dev-atlaserp" /usr/share/nginx/html --include="*.js" | head -c 300
```

Si no aparece la URL correcta (por ejemplo aparece `http://localhost:4010`), significa que las variables
no fueron pasadas al `docker compose build`. Solución:

```bash
# Reconstruir pasando las variables explícitamente
docker compose build --no-cache web-preview
docker compose up -d web-preview
```

### 6 — Verificar conectividad a la base de datos desde el contenedor API

```bash
# El health endpoint de la API hace una query simple a Prisma
curl -s http://localhost:4010/health
# Esperado: {"status":"ok"}

# Si falla, ver el error completo en los logs
docker compose logs api --tail 50
```

Errores comunes en los logs:

| Error en log                                     | Causa                                            | Solución                                                            |
| ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------- |
| `Can't reach database server at 172.22.0.3:5432` | La red Docker de Supabase no es accesible        | Verificar que Supabase está corriendo: `docker ps \| grep supabase` |
| `password authentication failed`                 | `POSTGRES_PASSWORD` incorrecto en `DATABASE_URL` | Corregir en `.env`, reconstruir con `docker compose restart api`    |
| `SUPABASE_SERVICE_ROLE_KEY is required`          | Variable vacía en `.env`                         | Completar `.env` y reiniciar                                        |

### 7 — Detener y limpiar contenedores

```bash
# Detener sin borrar imágenes
docker compose down

# Detener y borrar imágenes (fuerza rebuild completo la próxima vez)
docker compose down --rmi local

# Ver imágenes construidas
docker images | grep atlaserp
```
