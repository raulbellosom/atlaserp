# atlas.ledger — Colaboración, Grupos y Buscador de Usuarios

Date: 2026-06-05
Status: Proposed
Author: Claude Sonnet 4.6 (spec agent)
Spec file: docs/superpowers/specs/2026-06-05-ledger-collaboration-groups-design.md

---

## 1. Feature title

atlas.ledger — Cuentas personales por usuario, colaboración en cuentas individuales, grupos compartidos, buscador de usuarios y gestor de membresías

---

## 2. Context

El módulo `atlas.ledger` actualmente asocia todas las cuentas a `company_id`. Cualquier usuario con el permiso `ledger.accounts.read` ve todas las cuentas de la empresa. No existe concepto de propiedad por usuario ni de acceso granular.

Se requiere un modelo donde:
- Cada cuenta tenga un **dueño** (usuario que la creó).
- El dueño pueda invitar colaboradores a una cuenta individual con rol **Viewer** (solo ver/exportar) o **Editor** (ver, editar, exportar).
- Existan **grupos** como espacios compartidos tipo carpeta: el grupo tiene un nombre, miembros con roles (Viewer/Editor/Admin) y las cuentas creadas dentro del grupo pertenecen al grupo.
- Una cuenta pueda moverse libremente entre modo personal y cualquier grupo en cualquier momento.
- Las invitaciones se notifiquen en tiempo real usando el sistema de notificaciones existente y sean auto-aceptadas, pero el invitado puede rechazarlas o salirse. El dueño/admin puede revocar el acceso.
- Un buscador de usuarios por nombre/email permita encontrar compañeros de plataforma para invitarlos.

---

## 3. Problem

1. Todos los usuarios con permiso ven todas las cuentas — no hay privacidad ni propiedad individual.
2. No hay forma de colaborar en una cuenta específica sin dar acceso a todas.
3. No hay agrupación conceptual de cuentas para trabajo colaborativo en equipo.
4. No hay forma de buscar otros usuarios de la plataforma para invitarlos.

---

## 4. Goals

- G1: Cada cuenta tiene un `owner_id`. El dueño tiene control total sobre su cuenta.
- G2: El dueño puede compartir una cuenta individual con colaboradores (Viewer/Editor).
- G3: Grupos como espacios compartidos donde cualquier miembro Editor/Admin puede crear cuentas.
- G4: Las cuentas se pueden mover libremente entre modo personal y grupos.
- G5: Invitaciones automáticas (sin confirmación) con opción de rechazo y revocación.
- G6: Buscador de usuarios typeahead (nombre/email) dentro de la misma empresa.
- G7: Gestor "Mis membresías" para ver y salirse de grupos y cuentas compartidas.
- G8: Compatibilidad con cuentas existentes: las cuentas sin `owner_id` siguen visibles para todos los miembros de la empresa con permiso `ledger.accounts.read`.

---

## 5. Non-goals

- No se implementa chat o comentarios en cuentas.
- No se implementan permisos a nivel de transacción individual.
- No se permiten invitaciones a usuarios de otras empresas (solo misma `company_id`).
- No hay tokens de invitación de un solo uso ni URLs públicas de invitación.

---

## 6. Data model

### 6.1 `ledger_account` — columnas nuevas

```sql
ALTER TABLE ledger_account
  ADD COLUMN owner_id   uuid REFERENCES user_profile(id) ON DELETE SET NULL,
  ADD COLUMN group_id   uuid REFERENCES ledger_group(id)  ON DELETE SET NULL;
```

- `owner_id = null` → cuenta legacy (visible a todos los miembros con permiso de lectura).
- `owner_id = uuid` → cuenta personal del usuario.
- `group_id = null` → cuenta personal (acceso controlado por `owner_id` + `ledger_account_member`).
- `group_id = uuid` → cuenta pertenece al grupo (acceso controlado por `ledger_group_member`).
- Cuando `group_id` se asigna, todos los registros en `ledger_account_member` para esa cuenta se eliminan.

### 6.2 `ledger_group` — nueva tabla

```sql
CREATE TABLE ledger_group (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  company_id  uuid        NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_by  uuid        REFERENCES user_profile(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  enabled     boolean     NOT NULL DEFAULT true
);
CREATE INDEX ON ledger_group(company_id);
```

### 6.3 `ledger_group_member` — nueva tabla

```sql
CREATE TABLE ledger_group_member (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  group_id    uuid        NOT NULL REFERENCES ledger_group(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  invited_by  uuid        REFERENCES user_profile(id) ON DELETE SET NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  status      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected')),
  UNIQUE (group_id, user_id)
);
CREATE INDEX ON ledger_group_member(user_id);
```

- `created_by` del grupo se agrega automáticamente como `admin` al crear el grupo.
- `status = active` al crear la invitación — el usuario ya es miembro.
- `status = rejected` si el invitado rechaza antes de ver el grupo.

### 6.4 `ledger_account_member` — nueva tabla (solo cuentas personales)

```sql
CREATE TABLE ledger_account_member (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  account_id  uuid        NOT NULL REFERENCES ledger_account(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('viewer', 'editor')),
  invited_by  uuid        REFERENCES user_profile(id) ON DELETE SET NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  status      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected')),
  UNIQUE (account_id, user_id)
);
CREATE INDEX ON ledger_account_member(user_id);
```

---

## 7. Reglas de acceso

| Situación | Quién puede leer la cuenta |
|---|---|
| `owner_id = null` (legacy) | Cualquier usuario con `ledger.accounts.read` en la empresa |
| `owner_id = X`, `group_id = null` | `owner_id` + miembros activos en `ledger_account_member` |
| `owner_id = X`, `group_id = G` | Todos los miembros activos de `ledger_group_member` para el grupo G |

| Rol | Puede ver | Puede editar/crear tx | Puede crear cuentas en grupo | Puede invitar miembros |
|---|---|---|---|---|
| Viewer | Sí | No | No | No |
| Editor | Sí | Sí | Sí (en grupos) | No |
| Admin (solo grupos) | Sí | Sí | Sí | Sí |
| Owner (cuentas personales) | Sí | Sí | — | Sí |

**Mover una cuenta:**
- Solo el `owner_id` puede mover su cuenta a un grupo o de vuelta a personal.
- Al mover a un grupo: se eliminan todos los `ledger_account_member` de esa cuenta.
- Un admin del grupo puede mover cuentas del grupo de vuelta a su dueño.

---

## 8. API endpoints

Todos bajo `apps/api/src/routes/ledger/`. Sin modificar `apps/api/src/index.js`.

### 8.1 Grupos

```
POST   /ledger/groups                          — crear grupo (requiere ledger.groups.write)
GET    /ledger/groups                          — mis grupos (owner o miembro activo)
GET    /ledger/groups/:id                      — detalle: grupo + miembros + cuentas
PATCH  /ledger/groups/:id                      — renombrar (solo admin/created_by)
DELETE /ledger/groups/:id                      — soft-delete (solo created_by)
```

### 8.2 Miembros de grupo

```
POST   /ledger/groups/:id/members              — invitar usuario { user_id, role }
PATCH  /ledger/groups/:id/members/:uid         — cambiar rol { role }
DELETE /ledger/groups/:id/members/:uid         — remover miembro
```

### 8.3 Cuentas — nuevas acciones

```
PATCH  /ledger/accounts/:id/group              — mover { group_id: uuid | null }
POST   /ledger/accounts/:id/members            — invitar a cuenta personal { user_id, role }
PATCH  /ledger/accounts/:id/members/:uid       — cambiar rol { role }
DELETE /ledger/accounts/:id/members/:uid       — remover colaborador
```

### 8.4 Membresías del usuario autenticado

```
GET    /ledger/memberships                     — grupos + cuentas compartidas conmigo (activos)
DELETE /ledger/memberships/groups/:id          — salirse de un grupo
DELETE /ledger/memberships/accounts/:id        — salirse de una cuenta compartida
POST   /ledger/invitations/groups/:id/reject   — rechazar invitación de grupo
POST   /ledger/invitations/accounts/:id/reject — rechazar invitación de cuenta
```

### 8.5 Búsqueda de usuarios

```
GET    /users/search?q=&limit=                 — typeahead, misma company_id
```

Respuesta: `[{ id, display_name, email, avatar_url }]`

Parámetros:
- `q`: mínimo 2 caracteres, busca en `display_name ILIKE` y `email ILIKE` con `%q%`
- `limit`: 1–20, default 10
- Excluye al usuario autenticado del resultado
- Solo busca dentro de la misma `company_id`

---

## 9. Notificaciones

Se usa el endpoint existente `POST /notifications/publish` internamente desde los servicios del ledger.

### Tipos de payload

**Invitación a grupo:**
```json
{
  "type": "ledger.group_invite",
  "target_user_id": "...",
  "title": "Te invitaron al grupo \"Finanzas Q2\"",
  "body": "Rol asignado: Editor",
  "payload": {
    "resource_type": "group",
    "resource_id": "...",
    "resource_name": "Finanzas Q2",
    "role": "editor",
    "invited_by_name": "Ana López"
  }
}
```

**Invitación a cuenta individual:**
```json
{
  "type": "ledger.account_invite",
  "target_user_id": "...",
  "title": "Te compartieron la cuenta \"BBVA Nómina\"",
  "body": "Rol asignado: Viewer",
  "payload": {
    "resource_type": "account",
    "resource_id": "...",
    "resource_name": "BBVA Nómina",
    "role": "viewer",
    "invited_by_name": "Carlos Ruiz"
  }
}
```

**Acceso revocado:**
```json
{
  "type": "ledger.access_revoked",
  "target_user_id": "...",
  "title": "Se revocó tu acceso",
  "body": "Ya no tienes acceso al grupo \"Finanzas Q2\"",
  "payload": {
    "resource_type": "group",
    "resource_name": "Finanzas Q2"
  }
}
```

La notificación de invitación incluye dos acciones en el payload: `view` (navegar al recurso) y `reject` (llamar al endpoint de rechazo correspondiente).

---

## 10. UI — pantallas

### 10.1 `AccountsScreen` (modificar)

Cambia de lista plana a tres pestañas:
- **Mis cuentas** — `owner_id = actorId`, `group_id = null`
- **Compartidas conmigo** — cuentas donde soy `account_member` activo
- **Grupos** — lista de `ledger_group` donde soy miembro activo o `created_by`

En cada tarjeta de cuenta: badge con cantidad de colaboradores (si tiene `account_member` o está en un grupo).

### 10.2 `AccountScreen` (modificar)

Agrega tab **"Acceso"** junto a Registro/Resumen:

- Si `group_id = null` y `owner_id = actorId`:
  - Lista de colaboradores actuales con rol y botón de remover
  - Botón "Invitar colaborador" → abre `UserSearchModal` con rol Viewer/Editor
  - Botón "Mover a grupo" → selector de grupos donde soy admin/owner
- Si `group_id != null`:
  - Muestra nombre del grupo con enlace
  - Botón "Mover fuera del grupo" (solo si `owner_id = actorId` o soy admin del grupo)
- Si `owner_id != actorId` (colaborador): solo lectura, muestra mi rol y botón "Salirse"

### 10.3 `GroupsScreen` (nueva)

Ruta: `/app/m/atlas.ledger/groups`

Lista de grupos en cards: nombre, cantidad de miembros, cantidad de cuentas, mi rol en el grupo.
Botón "Nuevo grupo" → inline o modal con campo nombre.

### 10.4 `GroupScreen` (nueva)

Ruta: `/app/m/atlas.ledger/groups/:id`

Dos tabs:
- **Cuentas**: lista de cuentas del grupo con saldo. Botón "Nueva cuenta" (Editor/Admin). Botón mover cuenta fuera del grupo (Admin/owner de la cuenta).
- **Miembros**: lista con nombre, email, avatar, rol. Botón "Invitar" (Admin) → `UserSearchModal` con rol Viewer/Editor/Admin. Cambiar rol inline. Remover con `ConfirmDialog`.

### 10.5 `MembershipsScreen` (nueva)

Ruta: `/app/m/atlas.ledger/memberships`

Dos secciones:
- **Grupos**: tabla con nombre del grupo, mi rol, fecha de invitación, botón "Salirse" con `ConfirmDialog`
- **Cuentas compartidas**: tabla con nombre de cuenta, dueño, mi rol, botón "Salirse"

### 10.6 `UserSearchModal` (nuevo componente reutilizable)

Ubicación: `packages/ui/src/components/UserSearchModal.jsx` + export en `packages/ui/src/index.js`

Props: `open`, `onClose`, `onConfirm(userId, role)`, `roles` (array de opciones), `excludeUserIds`

Comportamiento:
- Input de texto con debounce 300ms → `GET /users/search?q=...`
- Resultados en lista: avatar + nombre + email
- Selección marca el usuario; aparece selector de rol debajo
- Botón "Confirmar" llama `onConfirm(userId, role)`
- Estado vacío si `q.length < 2`; estado de carga mientras busca

---

## 11. Migración de datos

Las cuentas existentes (`owner_id = null`) no se modifican. El query de `listAccounts` incluirá:

```sql
WHERE a.company_id = $companyId
  AND a.enabled = true
  AND (
    a.owner_id IS NULL                          -- legacy: visible a todos
    OR a.owner_id = $actorId                    -- mis cuentas
    OR EXISTS (                                  -- compartidas conmigo (activas)
      SELECT 1 FROM ledger_account_member m
      WHERE m.account_id = a.id AND m.user_id = $actorId AND m.status = 'active'
    )
    OR EXISTS (                                  -- cuentas de grupos donde soy miembro
      SELECT 1 FROM ledger_group_member gm
      WHERE gm.group_id = a.group_id AND gm.user_id = $actorId AND gm.status = 'active'
    )
  )
```

---

## 12. Permisos nuevos

Agregar al catálogo de permisos existente de `atlas.ledger`:

| Key | Descripción |
|---|---|
| `ledger.groups.read` | Ver grupos propios y donde es miembro |
| `ledger.groups.write` | Crear y gestionar grupos |
| `ledger.members.write` | Invitar/remover colaboradores en cuentas y grupos |

---

## 13. Estrategia de implementación

Esta feature se divide en dos planes:

- **Plan A (API)**: migraciones SQL, servicios, endpoints, búsqueda de usuarios, publicación de notificaciones.
- **Plan B (UI)**: modificar `AccountsScreen` y `AccountScreen`, crear `GroupsScreen`, `GroupScreen`, `MembershipsScreen`, `UserSearchModal`.

---

## 14. Open questions

Ninguna — todas las decisiones de diseño fueron validadas con el usuario.
