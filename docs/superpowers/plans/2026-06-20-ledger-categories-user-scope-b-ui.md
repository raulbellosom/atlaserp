# Plan B (UI): Categorías por usuario — atlas.ledger

Spec: `docs/superpowers/specs/2026-06-20-ledger-categories-user-scope-design.md`
Depende de: Plan A (API) — ejecutar después de que la migración esté en prod.

## Tareas

### 1. Actualizar `CategoriesScreen.jsx`

El blueprint `CATEGORIES_TABLE` actualmente usa `AtlasCrudView`. Como el API ya devuelve
`is_system`, necesitamos personalizar la vista para:

**a) Ocultar botones Editar/Desactivar en filas de sistema**

Opción recomendada: reemplazar `AtlasCrudView` por una tabla manual (similar a TypesScreen)
o añadir soporte en `AtlasCrudView` para `rowActions` condicionales basadas en campo.

La forma más simple sin cambiar `AtlasCrudView`: añadir una columna `Tipo` que muestre
`Sistema` o `Personal` y dejar los rowActions sin restricción (el API ya rechazará la
edición con 404 para categorías de sistema).

**b) Mostrar indicador visual** de origen en la lista:

```jsx
// Columna adicional en CATEGORIES_TABLE.schema.columns:
{ field: 'is_system', label: 'Origen', type: 'badge',
  map: { true: { label: 'Sistema', variant: 'muted' }, false: { label: 'Personal', variant: 'default' } }
}
```

Si `AtlasCrudView` no soporta `type: 'badge'` condicional, renderizar la columna como
texto plano: `Sistema` vs vacío.

### 2. Actualizar `SpreadsheetRegister.jsx` (opcional, cosmético)

Agrupar opciones de categoría por origen en el `<select>`:

```jsx
<select ...>
  <option value="">—</option>
  <optgroup label="Sistema">
    {categories.filter(c => c.is_system).map(cat => (
      <option key={cat.id} value={cat.id}>{cat.name}</option>
    ))}
  </optgroup>
  {categories.some(c => !c.is_system) && (
    <optgroup label="Mis categorias">
      {categories.filter(c => !c.is_system).map(cat => (
        <option key={cat.id} value={cat.id}>{cat.name}</option>
      ))}
    </optgroup>
  )}
</select>
```

Hacer lo mismo en el renglón nuevo (`newRow` select).

### 3. Actualizar `use-ledger-queries.js` (si aplica)

Si el hook `useLedgerCategories` usa el cliente SQLite offline (`ledgerClient.listCategories`),
verificar que el cliente offline también devuelva `is_system`. Si la cache SQLite no tiene
la columna `owner_id`, añadirla al esquema de la cache local.

Esto solo aplica si el módulo ledger está habilitado en modo offline (Tauri).

### 4. Verificación UI

- [ ] `CategoriesScreen` muestra etiqueta `Sistema` en categorías base
- [ ] Botón Nueva categoría crea con el usuario actual como propietario
- [ ] La nueva categoría aparece bajo "Personal" (o sin etiqueta Sistema)
- [ ] En el SpreadsheetRegister, el select agrupa Sistema / Mis categorias
- [ ] Un segundo usuario no ve las categorías personales del primero en su lista

## Archivos a tocar

- `apps/desktop/src/modules/atlas.ledger/screens/CategoriesScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx`
- `apps/desktop/src/modules/atlas.ledger/hooks/use-ledger-queries.js` (si aplica offline)
