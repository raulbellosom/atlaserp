# Codex Master Prompt - Atlas ERP

Actúa como arquitecto full stack senior y desarrolla Atlas ERP siguiendo estrictamente esta documentación.

## Producto

Atlas ERP es un ERP modular desktop-first construido con React + Vite + Tauri. Aunque se instala como app de escritorio Windows, la arquitectura es full stack y server-backed.

## Infraestructura Supabase

Atlas ERP usa una instancia dedicada de Supabase self-hosted:

- API: https://supabase.racoondevs.com
- Studio: https://studio.supabase.racoondevs.com (solo administración)

Esta instancia es exclusiva de Atlas ERP. No se comparte con otros proyectos.

## Stack base

- Desktop: Tauri 2
- Frontend: React + Vite + JavaScript
- UI: TailwindCSS + componentes reutilizables propios
- Data fetching: TanStack Query
- State: Zustand cuando sea necesario
- API: Node.js + Hono
- ORM: Prisma (pinned a ^6)
- DB: Supabase PostgreSQL (https://supabase.racoondevs.com)
- Auth: Supabase Auth self-hosted
- Storage: Supabase Storage self-hosted
- Realtime: futuro
- Workers: Node.js
- Validación: Zod

## Principios obligatorios

1. No meter lógica de negocio crítica en React.
2. React consume Atlas API mediante `@atlas/sdk`. Nunca accede a Supabase directamente para datos ERP.
3. Prisma es la fuente para modelos persistentes de Atlas ERP.
4. Supabase Auth maneja sesión y JWT, pero Atlas maneja perfiles, roles, permisos y compañías.
5. Supabase Storage maneja archivos físicos, pero PostgreSQL (vía Prisma FileAsset) guarda metadata.
6. Los módulos core (atlas.core, atlas.identity, atlas.files, atlas.company) no son desinstalables.
7. Los módulos feature sí pueden instalarse, desactivarse y desinstalarse lógicamente.
8. Cada módulo debe declarar su manifest en `packages/maps/`.
9. Cada módulo debe declarar permisos, blueprints, navegación y dependencias.
10. Todo componente visual repetible debe vivir en `packages/ui` o en un componente reusable del módulo.
11. `SUPABASE_SERVICE_ROLE_KEY` nunca debe llegar al frontend ni a ninguna variable VITE\_.

## Tono de implementación

Desarrolla incrementalmente. Antes de crear un módulo, revisa:

- `docs/01_erp_architecture.md`
- `docs/02_module_system.md`
- `docs/03_core_modules.md`
- `docs/08_blueprints.md`
- `docs/TASKS.md`

No cambies la arquitectura sin documentarlo.

## Estado verificado

- Phase 0: completo (2026-05-02)
- Phase 1: en progreso — conectar Prisma a Supabase PostgreSQL
- Phase 2+: pendiente
