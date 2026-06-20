# Plan A (API + DB): Categorías por usuario — atlas.ledger

Spec: `docs/superpowers/specs/2026-06-20-ledger-categories-user-scope-design.md`

## Tareas

### 1. Migración de base de datos

Crear `prisma/migrations/<timestamp>_ledger_category_owner/migration.sql`:

```sql
-- Add owner_id to ledger_category (NULL = system category, visible to all)
ALTER TABLE ledger_category
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL
  REFERENCES "UserProfile"(id) ON DELETE SET NULL;

-- Index for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_ledger_category_owner
  ON ledger_category(owner_id)
  WHERE owner_id IS NOT NULL;

-- Partial unique index for system categories (name unique per company, no owner)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_category_system_name
  ON ledger_category(company_id, name)
  WHERE owner_id IS NULL;
```

Ejecutar con `pnpm db:migrate`.

### 2. Actualizar `categories-service.js`

**`listCategories({ companyId, actorId })`** — añadir `actorId` al filtro:
```js
WHERE company_id = ${companyId}::uuid
  AND enabled = true
  AND (owner_id IS NULL OR owner_id = ${actorId}::uuid)
ORDER BY owner_id NULLS FIRST, name
```

Añadir campo derivado `is_system` mapeando `owner_id IS NULL`.

**`createCategory({ companyId, actorId, data })`** — insertar con `owner_id = actorId`:
```sql
INSERT INTO ledger_category (company_id, owner_id, name, color, kind, enabled)
VALUES (:companyId, :actorId, :name, :color, :kind, true)
```

**`updateCategory({ companyId, categoryId, actorId, data })`** — verificar ownership:
```sql
WHERE id = :categoryId AND company_id = :companyId AND owner_id = :actorId
```
Si no hay filas → 404 (incluye el caso de intentar editar categoría de sistema).

**`setCategoryEnabled({ companyId, categoryId, actorId, enabled })`** — igual, añadir
`AND owner_id = :actorId` al WHERE.

### 3. Actualizar `categories-routes.js`

Pasar `actorId: c.get('userId')` (o el claim equivalente del JWT) a todos los métodos
del servicio que lo requieren.

Verificar que el middleware de auth ya inyecta `userId` en el contexto Hono. Si no,
extraerlo del token JWT.

### 4. Actualizar `seed.js`

Añadir sección de categorías de sistema después del bloque de tipos:

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
try {
  const allCompanies = await prisma.company.findMany({ select: { id: true } })
  for (const company of allCompanies) {
    for (const cat of LEDGER_SYSTEM_CATEGORIES) {
      await prisma.$queryRaw`
        INSERT INTO ledger_category (company_id, owner_id, name, color, kind, enabled)
        VALUES (${company.id}::uuid, NULL, ${cat.name}, ${cat.color}, ${cat.kind}, true)
        ON CONFLICT (company_id, name) WHERE owner_id IS NULL DO NOTHING
      `
    }
  }
} catch { /* tabla no existe aún, skip */ }
```

### 5. Verificación

```bash
# Migración
pnpm db:migrate

# Seed
pnpm db:seed

# Smoke test manual con curl (requiere TOKEN)
curl -H "Authorization: Bearer $TOKEN" $API/ledger/categories
# Debe devolver categorías de sistema (is_system: true) + personales del usuario

curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test","color":"#123456","kind":"both"}' \
  $API/ledger/categories
# Debe crear con owner_id = actorId, is_system: false

# Test de aislamiento: con otro usuario, verificar que no ve la categoría anterior
```

## Archivos a tocar

- `prisma/migrations/<nuevo>/migration.sql` (nuevo)
- `apps/api/src/routes/ledger/categories-service.js`
- `apps/api/src/routes/ledger/categories-routes.js`
- `prisma/seed.js`
