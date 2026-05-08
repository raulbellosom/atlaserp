# RBAC Granular por Feature (Fase 2) - Diseño

Fecha: 2026-05-08  
Estado: Propuesto para implementación  
Alcance: Atlas API + manifests + seed + UI de roles/permisos + documentación

## 1) Contexto

La versión RBAC/ACL v1 ya está activa y server-authoritative:

- API valida JWT y permisos por request.
- Runtime de módulos/menús se filtra por permisos.
- Política fail-closed (sin permiso explícito no se expone acceso).

Hoy la mayoría de permisos son CRUD generales por módulo (ej. `finance.read`).  
La siguiente fase busca granularidad real por feature (estilo Odoo-lite) sin romper operación en producción.

## 2) Objetivo

Definir y desplegar un modelo de permisos granular donde:

1. Cada módulo declare permisos por feature.
2. Cada feature tenga CRUD explícito.
3. Acciones no-CRUD se declaren solo cuando aplique.
4. Roles se asignen en UI por módulo/feature/acción.
5. La transición sea compatible con permisos legacy por oleadas.

## 3) No objetivos

- No incluir reglas por registro (record-level) ni por campo.
- No mover autorización a RLS para este alcance.
- No rediseñar todo Auth de Supabase; solo autorización Atlas.

## 4) Convención oficial de permisos

Formato obligatorio:

- `module.access`
- `module.feature.read`
- `module.feature.create`
- `module.feature.update`
- `module.feature.delete`
- extras no-CRUD: `module.feature.<action>`

Ejemplo finanzas:

- `finance.access`
- `finance.ar.read|create|update|delete`
- `finance.entries.read|create|update|delete`
- `finance.applications.read|create|update|delete`
- `finance.applications.reverse`
- `finance.documents.reminder.send`

## 5) Contrato obligatorio por módulo

Cada módulo en `packages/maps` debe declarar:

1. `permissions[]` completo por feature.
2. `acl.module` (normalmente `module.access`).
3. `acl.actions` para cada endpoint/acción funcional.
4. `acl.models` para CRUD de modelos.
5. `navigation[].permissionKey` por item de menú.

Regla: si un endpoint/menu no tiene permiso mapeado, no se publica.

## 6) Estrategia de despliegue por oleadas

### Oleada A: core + identity + company

- Introducir convención granular en módulos base.
- Mantener fallback legacy temporal.
- Rediseñar Roles/Permisos para soportar agrupación módulo/feature.

### Oleada B: contacts + files

- Aplicar patrón granular completo.
- Migrar roles existentes con script idempotente.

### Oleada C: finance + hr

- Granularidad completa por feature.
- Agregar extras no-CRUD solo donde sea necesario.

### Cierre de transición

- Desactivar fallback legacy.
- Mantener solo permisos granulares como fuente oficial.

## 7) Rediseño de pantalla Roles/Permisos

La vista actual debe evolucionar a modelo jerárquico:

- Nivel 1: Módulo.
- Nivel 2: Feature.
- Nivel 3: Permisos (CRUD + extras).

Requisitos UX:

1. Toggle por permiso individual.
2. Toggle “todo” por feature.
3. Toggle “todo” por módulo.
4. Buscador por etiqueta y clave técnica.
5. Badges de transición: `Legacy` y `Granular`.
6. Modo lectura/escritura según `roles.*` y `permissions.*`.

## 8) Migración de roles legacy -> granular

Se agregará script idempotente por oleada:

- `module.read` -> todos los `module.<feature>.read`
- `module.create` -> todos los `module.<feature>.create`
- `module.update` -> todos los `module.<feature>.update`
- `module.delete` -> todos los `module.<feature>.delete`

Salida esperada del script:

- resumen por rol (agregados / no mapeados / conflictos)
- ejecución repetible sin duplicados

## 9) Reglas API y compatibilidad

1. Cada endpoint debe usar permiso granular explícito.
2. Durante transición:
   - aceptar permiso granular
   - fallback opcional a permiso legacy equivalente
3. Al cierre:
   - fallback OFF
   - solo permisos granulares

Observabilidad:

- distinguir claramente `401` (auth/token) de `403` (authz/permiso).

## 10) Seed, sync y catálogo de permisos

1. `prisma/seed.js` debe upsert de nuevos permisos granulares.
2. `syncAdminRolesPermissions` mantiene superuser total.
3. `permission-catalog` debe incluir nombre/descr/grupo/orden para nuevos permisos.
4. Agrupación UI por `module > feature`.

## 11) Pruebas de autorización (obligatorias)

Matriz mínima por oleada:

1. Rol vacío.
2. Rol con solo `read` de una feature.
3. Rol con `create` sin `update/delete`.
4. Rol admin.

Verificar:

- runtime módulos/menús visibles correctos
- acceso por URL directa
- respuesta API esperada (`200`, `401`, `403`)

## 12) Documentación obligatoria para módulos futuros

Actualizar:

- `docs/02_module_system.md`
- `docs/07_auth_permissions_strategy.md`
- `docs/TASKS.md` (checklist de módulo nuevo)

Checklist obligatorio para cada módulo nuevo:

1. Declarar `module.access`.
2. Declarar CRUD por feature.
3. Declarar extras no-CRUD cuando aplique.
4. Mapear `navigation[].permissionKey`.
5. Proteger rutas API con permisos granulares.
6. Incluir pruebas de autorización por matriz rol x endpoint.

## 13) Riesgos y mitigación

Riesgo: explosión de permisos y confusión operativa.  
Mitigación: convención fija, grupos por feature, toggles masivos y documentación.

Riesgo: romper roles existentes.  
Mitigación: fallback temporal + script de migración + rollout por oleadas.

Riesgo: divergencia manifiesto/API/UI.  
Mitigación: validaciones de manifiesto ACL y smoke tests por oleada.

## 14) Criterio de aceptación final

1. Todos los módulos en alcance declaran permisos por feature (CRUD + extras).
2. Roles se pueden configurar completamente desde UI nueva.
3. Endpoints sensibles usan permisos granulares.
4. Fallback legacy removido al finalizar oleada C.
5. Documentación de arquitectura y módulos futuros actualizada.

