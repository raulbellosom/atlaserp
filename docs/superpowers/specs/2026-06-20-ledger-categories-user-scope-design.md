---
id: 2026-06-20-ledger-categories-user-scope
title: atlas.ledger — Categorías por usuario con colección base
status: approved
date: 2026-06-20
---

## Contexto y motivación

Actualmente `ledger_category` solo tiene `company_id`, por lo que todas las categorías
son compartidas entre todos los usuarios de la empresa. Esto genera ruido: un usuario ve
las categorías que otro creó y no le son útiles.

Los **tipos de movimiento** ya se resolvieron como sistema predefinido (seed, sin gestión
en UI). Las **categorías** sí requieren personalización, por lo que el modelo correcto es:

- **Categorías de sistema** (`owner_id IS NULL`): colección base, visibles para todos los
  usuarios de la empresa. Se gestionan vía seed o admin.
- **Categorías personales** (`owner_id = userId`): creadas por el propio usuario,
  visibles solo para él.

El usuario puede crear categorías personales libremente desde la pantalla de Categorías.
Las de sistema son de solo lectura para usuarios regulares.

## Alcance

| Capa | Cambio |
|---|---|
| DB | Nueva columna `owner_id UUID NULL` en `ledger_category` |
| API | `listCategories` devuelve sistema + propias; `createCategory` fija `owner_id = actorId` |
| Seed | Categorías de sistema base sembradas para toda empresa |
| Frontend | `CategoriesScreen` distingue visualmente sistema vs personal; sin cambios de ruta |

Fuera de alcance:
- Compartir categorías entre usuarios (no requerido)
- Migrar categorías existentes a un propietario (quedan como `owner_id = NULL`, es decir, sistema)

## Modelo de datos

```sql
ALTER TABLE ledger_category
  ADD COLUMN owner_id UUID NULL REFERENCES "UserProfile"(id) ON DELETE SET NULL;

CREATE INDEX idx_ledger_category_owner ON ledger_category(owner_id)
  WHERE owner_id IS NOT NULL;
```

Existentes: `owner_id = NULL` → quedan automáticamente como sistema.

## API

### `GET /ledger/categories`

Devuelve categorías donde:
```sql
WHERE company_id = :companyId
  AND enabled = true
  AND (owner_id IS NULL OR owner_id = :actorId)
ORDER BY owner_id NULLS FIRST, name
```

Response añade campo `is_system: boolean` derivado de `owner_id IS NULL`.

### `POST /ledger/categories`

Acepta `name`, `color`, `kind`. Siempre crea con `owner_id = actorId`. No permite crear
categorías de sistema desde la API pública (son exclusivas del seed).

### `PATCH /ledger/categories/:id`

Solo permite editar si `owner_id = actorId` (no puede editar categorías de sistema).

### `PATCH /ledger/categories/:id/enabled`

Solo puede desactivar las propias. Las de sistema son inmutables desde la API pública.

## Seed de categorías de sistema

```js
const LEDGER_SYSTEM_CATEGORIES = [
  { name: 'Alimentacion',    color: '#f59e0b', kind: 'expense' },
  { name: 'Transporte',      color: '#3b82f6', kind: 'expense' },
  { name: 'Renta',           color: '#8b5cf6', kind: 'expense' },
  { name: 'Servicios',       color: '#06b6d4', kind: 'expense' },
  { name: 'Salud',           color: '#ef4444', kind: 'expense' },
  { name: 'Entretenimiento', color: '#ec4899', kind: 'expense' },
  { name: 'Educacion',       color: '#6366f1', kind: 'expense' },
  { name: 'Ahorro',          color: '#10b981', kind: 'income'  },
  { name: 'Ingreso',         color: '#22c55e', kind: 'income'  },
  { name: 'Transferencia',   color: '#64748b', kind: 'both'    },
  { name: 'Otros',           color: '#94a3b8', kind: 'both'    },
]
```

Se insertan con `owner_id = NULL` y `ON CONFLICT (company_id, name) WHERE owner_id IS NULL DO NOTHING`.

Requiere índice único parcial:
```sql
CREATE UNIQUE INDEX idx_ledger_category_system_name
  ON ledger_category(company_id, name)
  WHERE owner_id IS NULL;
```

## Frontend

### CategoriesScreen (sin cambios de ruta ni componentes)

- La columna "Nombre" puede mostrar un badge `Sistema` (muted) en categorías con `is_system = true`
- Los botones Editar/Desactivar se ocultan para `is_system = true`
- El botón "Nueva categoria" siempre visible (crea categoría personal)

### SpreadsheetRegister

El `<select>` de categorías ya muestra todas las que devuelve el API (sistema + propias).
Optionalmente se puede agrupar: `<optgroup label="Sistema">` y `<optgroup label="Mis categorías">`.
Esto es cosmético y puede hacerse en la misma iteración.

## Criterios de aceptación

- [ ] Migración corrida en Supabase sin errores
- [ ] `GET /ledger/categories` devuelve sistema + propias, ninguna de otro usuario
- [ ] `POST /ledger/categories` crea con `owner_id = actorId` verificado con JWT
- [ ] Usuario A no ve categorías creadas por usuario B
- [ ] Categorías de sistema visibles para todos los usuarios
- [ ] CategoriesScreen oculta Editar/Desactivar en categorías de sistema
- [ ] `pnpm db:seed` siembra categorías de sistema para toda empresa existente
- [ ] Categorías existentes (antes de la migración) quedan como `owner_id = NULL` (sistema)
