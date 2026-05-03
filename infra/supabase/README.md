# Supabase Self-hosted para Atlas ERP

Este bundle no copia el `docker-compose.yml` oficial completo de Supabase porque cambia con frecuencia. La forma recomendada es mantenerlo como infraestructura externa versionada dentro de `infra/supabase/runtime`.

## Opción recomendada

```bash
cd infra/supabase
./bootstrap-supabase.sh
```

El script descarga/clona el repositorio oficial de Supabase y copia la carpeta `docker` a `runtime`.

Después debes configurar el archivo `.env` de Supabase según el README oficial.

## Variables que Atlas necesita

En el `.env` raíz de Atlas:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres?schema=public"
SUPABASE_URL="http://localhost:8000"
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
ATLAS_STORAGE_DRIVER="supabase"
```

## Rol de Supabase en Atlas

- PostgreSQL: datos estructurados del ERP.
- Auth: identidad y sesiones base.
- Storage: archivos físicos.
- Realtime: actualizaciones en vivo.
- Studio: panel técnico.
- PostgREST: APIs automáticas para casos controlados.

## Rol de Atlas API

Atlas API mantiene las reglas de negocio:

- permisos empresariales
- instalación de módulos
- validaciones de dominio
- auditoría
- workflows
- integraciones

No conectes toda la app desktop directamente a Supabase para operaciones críticas.
