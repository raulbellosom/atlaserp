# Fleet Expansion — Design Spec

**Date:** 2026-05-25  
**Module:** `custom.fleet`  
**Status:** Approved

## Context

`custom.fleet` está en v0.4.3 con 13 modelos AME3, 41 vistas, API completa con reportes v2, catálogos, documentos y permisos granulares. El objetivo es cerrar la brecha entre "módulo demo AME3" y "módulo operativo de producción" que sirva de patrón para futuros módulos.

Tres problemas concretos:
1. El modelo legacy `fleet.maintenance` (y sus satélites) convive con reportes v2 sin propósito — genera confusión y deuda técnica.
2. No existe gestión de pólizas de seguro — un campo clave en operación real de flota.
3. Hay gaps de UX (cascading pickers, columnas confusas) y edge cases de validación sin cerrar.

**Criterio de terminado:** Fleet funciona end-to-end en operación real, sin modelos legacy, con seguros operativos y UX consistente. Sirve de base para el Module Scaffolder.

---

## Área 1: Legacy Cleanup

### Qué se elimina

**Modelos (quitar de manifest + drop de tablas en instalación actual):**
- `fleet.maintenance` → tabla `fleet_maintenance`
- `fleet.maintenance_document` → tabla `fleet_maintenance_document`
- `fleet.maintenance_type` → tabla `fleet_maintenance_type`

**Vistas (eliminar archivos):**
- `modules/custom/custom.fleet/views/maintenance.table.js`
- `modules/custom/custom.fleet/views/maintenance.form.js`
- `modules/custom/custom.fleet/views/maintenance.detail.js`
- `modules/custom/custom.fleet/views/catalog.maintenance-types.table.js`
- `modules/custom/custom.fleet/views/catalog.maintenance-types.form.js`
- `modules/custom/custom.fleet/views/catalog.maintenance-types.page.js`

**API (eliminar archivos):**
- `modules/custom/custom.fleet/api/maintenance-routes.js`
- `modules/custom/custom.fleet/api/maintenance-service.js`

**Manifest — cambios en `module.manifest.js`:**
- Quitar de `models`: maintenance, maintenance_document, maintenance_type
- Quitar de `navigation`: entrada legacy de mantenimiento y tipos de mantenimiento en Catálogos
- Quitar de `ownedEntities`: fleet_maintenance, fleet_maintenance_document, fleet_maintenance_type
- Quitar de `acl.models`: Maintenance, MaintenanceDocument, MaintenanceType
- Quitar de `permissions`: permisos legacy de maintenance si existen aparte de reports

**Validators — `validators/index.js`:**
- Eliminar `createMaintenanceSchema`, `updateMaintenanceSchema` y schemas legacy de maintenance

**Limpieza de tablas en instalación actual:**
- Script one-shot (NO migración Prisma): `scripts/fleet-legacy-cleanup.mjs`
  ```sql
  DROP TABLE IF EXISTS fleet_maintenance_document;
  DROP TABLE IF EXISTS fleet_maintenance;
  DROP TABLE IF EXISTS fleet_maintenance_type;
  ```
- Se ejecuta una vez y se descarta. No se commitea como migración.
- En instalaciones nuevas: los modelos no están en el manifest → Atlas ORM no los crea → no hay nada que dropear.

---

## Área 2: Insurance Policy — nueva entidad

### Modelo `fleet.insurance_policy`

Archivo: `modules/custom/custom.fleet/models/insurance-policy.model.js`

```js
defineModel({
  key: 'insurance_policy',
  name: 'fleet.insurance_policy',
  tableName: 'fleet_insurance_policy',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'vehicle_id',        type: 'relation', relatedModel: 'fleet.vehicle', required: true },
    { name: 'insurer_name',      type: 'text',     required: true, maxLength: 100 },
    { name: 'policy_number',     type: 'text',     required: true, maxLength: 50 },
    { name: 'coverage_type',     type: 'select',   options: ['basic','comprehensive','third_party','other'] },
    { name: 'start_date',        type: 'date',     required: true },
    { name: 'expiry_date',       type: 'date',     required: true },
    { name: 'premium',           type: 'decimal' },
    { name: 'currency',          type: 'text',     default: 'MXN', maxLength: 3 },
    { name: 'notes',             type: 'textarea' },
    { name: 'document_asset_id', type: 'file' },
  ],
  indexes: [
    { fields: ['company_id', 'vehicle_id'] },
    { fields: ['company_id', 'policy_number'], unique: true },
    { fields: ['company_id', 'expiry_date'] },
  ],
})
```

**Lógica de "activa":** calculada en servicio — `enabled = true AND expiry_date >= TODAY`. No se persiste como campo.

### Vistas (4 archivos nuevos)

- `insurance-policy.table.js` — columnas: placa del vehículo, aseguradora, número de póliza, cobertura, vigencia desde/hasta, badge activa/vencida
- `insurance-policy.form.js` — secciones: datos de póliza, vigencia y costos, adjunto (certificado PDF)
- `insurance-policy.detail.js` — read-only + panel de adjunto
- `insurance-policy.page.js` — ruta `/app/m/custom.fleet/insurance`

### Navegación

```js
{ label: 'Seguros', path: '/app/m/custom.fleet/insurance', icon: 'ShieldCheck', permissionKey: 'fleet.insurance.read' }
```

### Permisos (4 nuevos)

```js
{ key: 'fleet.insurance.read',   name: 'Ver pólizas de seguro' },
{ key: 'fleet.insurance.create', name: 'Crear pólizas de seguro' },
{ key: 'fleet.insurance.update', name: 'Editar pólizas de seguro' },
{ key: 'fleet.insurance.delete', name: 'Desactivar pólizas de seguro' },
```

### API

**`insurance-routes.js`:**
- `GET    /fleet/insurance`                     — lista con paginación, filtros `vehicle_id`, `active`
- `POST   /fleet/insurance`                     — crear (valida uniqueness de policy_number por company)
- `GET    /fleet/insurance/:id`                 — detalle
- `PATCH  /fleet/insurance/:id`                 — editar
- `PATCH  /fleet/insurance/:id/enabled`         — soft-delete
- `GET    /fleet/vehicles/:vehicleId/insurance` — pólizas de un vehículo

**`insurance-service.js`:**
- `listPolicies({ companyId, vehicleId?, active?, page, pageSize })`
- `createPolicy({ companyId, data })` — verifica unicidad de policy_number antes de insert
- `getPolicy({ companyId, id })`
- `updatePolicy({ companyId, id, data })`
- `disablePolicy({ companyId, id })`
- `listVehiclePolicies({ companyId, vehicleId })`
- `getActivePolicyForVehicle({ companyId, vehicleId })`

### Validators

```js
createInsurancePolicySchema = z.object({
  vehicle_id:          z.string().uuid(),
  insurer_name:        z.string().min(1).max(100),
  policy_number:       z.string().min(1).max(50),
  coverage_type:       z.enum(['basic','comprehensive','third_party','other']).optional(),
  start_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiry_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  premium:             z.number().positive().optional(),
  currency:            z.string().length(3).default('MXN'),
  notes:               z.string().optional(),
  document_asset_id:   z.string().uuid().optional(),
}).refine(d => d.expiry_date >= d.start_date, {
  message: 'La fecha de vencimiento debe ser posterior al inicio',
  path: ['expiry_date'],
})
```

---

## Área 3: Integración en vehículo

### Tabla de vehículos

- `fleet-service.js`: query lateral al listar vehículos → campo `insurance_status: 'active' | 'expired' | 'none'`
- `vehicle.table.js`: columna `insurance_status` con componente `custom.fleet:InsuranceBadgeCell`
  - "Con póliza" (verde), "Vencida" (amarillo), "Sin póliza" (gris)
- Nuevo componente: `InsuranceBadgeCell.jsx`

### Detalle de vehículo

- `fleet-service.js`: `getVehicle` incluye `active_insurance_policy` (insurer_name, policy_number, coverage_type, expiry_date)
- `vehicle.detail.js`: dos secciones nuevas:
  1. `relation-card` "Póliza activa" — aseguradora, número, cobertura, vencimiento. Estado vacío con CTA "Agregar póliza".
  2. `relation-list` "Historial de pólizas" — lista vía `GET /fleet/vehicles/:id/insurance`
- `vehicles-routes.js`: nuevo endpoint `GET /fleet/vehicles/:vehicleId/insurance`

---

## Área 4: UX Polish + Validaciones

### Cascading picker de modelo de vehículo
- `catalogs-routes.js`: `GET /fleet/catalogs/vehicle-models?brand_id=&type_id=` filtra resultados
- `vehicle.form.js`: `vehicle_model_id` declara `dependsOn: ['vehicle_brand_id', 'vehicle_type_id']`

### Número económico combinado
- `fleet-service.js`: campo `economic_number` computado como `"{group}-{individual}"` en respuesta de lista
- `vehicle.table.js`: columna "No. Económico" usando `economic_number`

### Estados vacíos en relation-cards
- `vehicle.detail.js` + `driver.detail.js`: mensajes explícitos en español + CTA cuando la relation-card no tiene datos

### Fix validación de financiamiento
- `validators/index.js`: `updateVehicleSchema` — cuando `is_financed = true`, requerir y validar fechas de financiamiento correctamente en update

---

## Archivos

### Nuevos
```
modules/custom/custom.fleet/models/insurance-policy.model.js
modules/custom/custom.fleet/views/insurance-policy.table.js
modules/custom/custom.fleet/views/insurance-policy.form.js
modules/custom/custom.fleet/views/insurance-policy.detail.js
modules/custom/custom.fleet/views/insurance-policy.page.js
modules/custom/custom.fleet/api/insurance-routes.js
modules/custom/custom.fleet/api/insurance-service.js
modules/custom/custom.fleet/components/InsuranceBadgeCell.jsx
scripts/fleet-legacy-cleanup.mjs
```

### Modificados
```
modules/custom/custom.fleet/module.manifest.js
modules/custom/custom.fleet/validators/index.js
modules/custom/custom.fleet/api/fleet-service.js
modules/custom/custom.fleet/api/vehicles-routes.js
modules/custom/custom.fleet/api/catalogs-routes.js
modules/custom/custom.fleet/api/index.js
modules/custom/custom.fleet/views/vehicle.table.js
modules/custom/custom.fleet/views/vehicle.detail.js
modules/custom/custom.fleet/views/vehicle.form.js
modules/custom/custom.fleet/components/index.js
```

### Eliminados
```
modules/custom/custom.fleet/models/maintenance.model.js
modules/custom/custom.fleet/models/maintenance-type.model.js
modules/custom/custom.fleet/models/maintenance-document.model.js
modules/custom/custom.fleet/views/maintenance.table.js
modules/custom/custom.fleet/views/maintenance.form.js
modules/custom/custom.fleet/views/maintenance.detail.js
modules/custom/custom.fleet/views/catalog.maintenance-types.table.js
modules/custom/custom.fleet/views/catalog.maintenance-types.form.js
modules/custom/custom.fleet/views/catalog.maintenance-types.page.js
modules/custom/custom.fleet/api/maintenance-routes.js
modules/custom/custom.fleet/api/maintenance-service.js
```

---

## Orden de implementación

1. Legacy cleanup (eliminar archivos, actualizar manifest/validators/index → script one-shot)
2. Insurance model + API (model, service, routes, validators, manifest)
3. Insurance views (table, form, detail, page)
4. Vehicle integration (InsuranceBadgeCell, fleet-service enriquecimiento, vehicle.table/detail, vehicles-routes)
5. UX polish (cascading picker, economic number, empty states, financing fix)

---

## Verificación

1. `pnpm build` — sin errores
2. `node --check` en todos los archivos modificados/nuevos
3. `POST /modules/sync` → custom.fleet redescubierto sin errores, rutas de maintenance no aparecen
4. `GET /fleet/insurance` → 200 con lista vacía
5. `POST /fleet/insurance` → valida uniqueness y expiry >= start
6. `GET /fleet/vehicles` → campo `insurance_status` presente
7. `GET /fleet/vehicles/:id` → campo `active_insurance_policy` presente
8. Browser QA: badge de seguro en tabla de vehículos; relation-card en detalle
9. Browser QA: picker de modelo filtra por marca y tipo
10. `node --test` → tests existentes pasan
