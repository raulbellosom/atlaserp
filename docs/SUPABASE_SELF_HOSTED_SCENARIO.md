# Best Scenario with Supabase Self-hosted

## Objetivo

Usar Supabase self-hosted como plataforma de datos e infraestructura base, pero mantener Atlas API como capa empresarial.

## Componentes

```txt
Atlas Desktop
React + Tauri
    ↓
Atlas API
Node + Hono + Prisma
    ↓
Supabase Self-hosted
PostgreSQL + Auth + Storage + Realtime
```

## Qué usar de Supabase

- Auth para identidad base.
- PostgreSQL para datos ERP.
- Storage para archivos.
- Realtime para cambios en vivo.
- Studio como panel técnico.

## Qué NO delegar por completo a Supabase

- reglas empresariales
- instalación de módulos
- permisos por compañía
- workflows complejos
- auditoría de operaciones críticas
- integraciones internas

Eso vive en Atlas API.

## Prisma

Prisma apunta al PostgreSQL de Supabase.

## RLS

Se puede usar RLS más adelante, pero no debe ser la única línea de defensa. Atlas API también debe validar permisos.
