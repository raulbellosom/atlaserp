# Atlas ERP Architecture

Atlas ERP es una aplicación desktop-first con arquitectura full stack.

## Capas

```txt
Desktop App
React + Vite + Tauri
        ↓
Atlas SDK
        ↓
Atlas API
Node.js + Hono + Prisma
        ↓
Supabase Self-hosted
PostgreSQL + Auth + Storage + Realtime
```

## Responsabilidades

### Desktop

- UI
- Navegación
- Formularios
- Tablas
- Visualización de módulos
- Consumo de API

### Atlas API

- reglas de negocio
- validación
- permisos
- instalación de módulos
- auditoría
- acceso a Prisma
- integración con Supabase Admin

### Supabase

- PostgreSQL
- Auth
- Storage
- Realtime
- Studio

## Módulos core

Los módulos core son obligatorios y no desinstalables:

- `atlas.core`
- `atlas.identity`
- `atlas.files`
- `atlas.modules`

## Módulos feature iniciales

- `atlas.contacts`
- `atlas.finance`
- `atlas.purchases`
- `atlas.inventory`
- `atlas.hr`
- `atlas.fleet`
- `atlas.website`

## Regla principal

Atlas no debe depender de que todos los módulos existan. Cada módulo declara sus dependencias y el core resuelve qué puede cargarse.
