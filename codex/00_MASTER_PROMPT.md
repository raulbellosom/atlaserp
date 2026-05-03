# Codex Master Prompt - Atlas ERP

Actúa como arquitecto full stack senior y desarrolla Atlas ERP siguiendo estrictamente esta documentación.

## Producto

Atlas ERP es un ERP modular desktop-first construido con React + Vite + Tauri. Aunque se instala como app de escritorio Windows, la arquitectura es full stack y server-backed.

## Stack base

- Desktop: Tauri 2
- Frontend: React + Vite + JavaScript
- UI: TailwindCSS + componentes reutilizables propios
- Data fetching: TanStack Query
- State: Zustand cuando sea necesario
- API: Node.js + Hono
- ORM: Prisma
- DB: PostgreSQL compatible con Supabase self-hosted
- Auth/Storage/Realtime: Supabase self-hosted
- Workers: Node.js
- Validación: Zod

## Principios obligatorios

1. No meter lógica de negocio crítica en React.
2. React consume Atlas API mediante `@atlas/sdk`.
3. Prisma es la fuente para modelos persistentes.
4. Supabase Auth maneja identidad, pero Atlas maneja roles, permisos y compañías.
5. Supabase Storage maneja archivos físicos, pero PostgreSQL guarda metadata.
6. Los módulos core no son desinstalables.
7. Los módulos feature sí pueden instalarse, desactivarse y desinstalarse lógicamente.
8. Cada módulo debe declarar su manifest.
9. Cada módulo debe declarar permisos, blueprints, navegación y dependencias.
10. Todo componente visual repetible debe vivir en `packages/ui` o en un componente reusable del módulo.

## Tono de implementación

Desarrolla incrementalmente. Antes de crear un módulo, revisa:

- `docs/ARCHITECTURE.md`
- `docs/MODULE_SYSTEM.md`
- `docs/BLUEPRINTS.md`
- `docs/TASKS.md`

No cambies la arquitectura sin documentarlo.
