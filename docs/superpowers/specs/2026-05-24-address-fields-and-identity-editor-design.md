# Spec: Address Fields Upgrade + Identity Full Editor

**Date:** 2026-05-24
**Branch:** fix/fleet-reports-7-bugs (to be cherry-picked or included in next feature branch)
**Status:** Approved for implementation

---

## Problem

1. **ProfileScreen** uses plain `TextField` for País, Estado, and Ciudad, while the Setup wizard already uses `ComboboxField` (country-state-city library) with searchable dropdowns. Inconsistent UX.
2. Both `UserProfile` and `Company` models lack a `colony` (Colonia / Fraccionamiento) field that is standard in Mexican addresses.
3. The Identity user editor (`UserEditorScreen`) only exposes 4 fields to admins (firstName, lastName, email read-only, role). Admins cannot edit the extended personal data (phone, bio, birthDate, gender, full address) of other users. Nor can they update a user's email.

---

## Scope

Three independent areas:

1. **DB migration** — add `colony` to `UserProfile` and `Company`
2. **Address upgrade** — comboboxes + colony in ProfileScreen and StepCompany
3. **Identity full editor** — extended admin-editable fields in UserEditorScreen

---

## Area 1: DB Migration

### Changes

Add `colony String?` to `UserProfile`:
```prisma
colony       String?
```
Position: after `city`, before `street`.

Add `colony String?` to `Company`:
```prisma
colony       String?
```
Position: after `city`, before `street`.

Single forward migration — never edit existing migrations.

---

## Area 2: Address Fields Upgrade

### ProfileScreen (`apps/desktop/src/app/ProfileScreen.jsx`)

**Form state:** add `colony: ""` to `EMPTY_FORM`.

**Cascade resets on country change:** reset `state`, `city`, `colony`.
**Cascade resets on state change:** reset `city`, `colony`.

**ComboboxField usage** (identical pattern to StepCompany):
- `country`: always a `ComboboxField` with all countries
- `state`: `ComboboxField` if `stateOptions.length > 0`, else `TextField`
- `city`: `ComboboxField` if `cityOptions.length > 0` (with `minSearchLength={2}`), else `TextField` when state selected + no options
- `colony`: plain `TextField` (no library data available; free text) — label "Colonia / Fraccionamiento"

**Field order in address section:**
1. País
2. Estado
3. Ciudad
4. Colonia / Fraccionamiento ← new
5. Calle
6. Número exterior / Número interior (grid)
7. Código postal

**useMemo hooks:** `countryOptions`, `stateOptions`, `cityOptions` — same as StepCompany.

**API:** `PUT /profile/me` passes `colony` in the request body. `GET /profile/me` response includes `colony`. No new endpoint needed.

### StepCompany (`apps/desktop/src/setup/StepCompany.jsx`)

Add `colony` field (plain `TextField`, label "Colonia / Fraccionamiento") after city/ciudad block, before the street row.

**SetupWizard formData** (`apps/desktop/src/setup/SetupWizard.jsx`): add `colony: ""` to initial state.

**Setup API `/setup/initialize`:** passes `colony` when creating the Company record.

---

## Area 3: Identity Full Editor

### UserEditorScreen (`apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx`)

Adds a second `Card` below the existing one, visible only when `canManageUsers && user`. Title: "Datos personales".

**Fields (all disabled when `!canManageUsers`):**

| Field | Component | Notes |
|-------|-----------|-------|
| Correo | TextField | Now editable by admin (was read-only) |
| Teléfono | PhoneField | |
| Fecha de nacimiento | DateField | |
| Sexo | SelectField | Same options as ProfileScreen |
| Biografía | TextareaField | maxLength 500 |
| País | ComboboxField | country-state-city |
| Estado | ComboboxField / TextField | conditional |
| Ciudad | ComboboxField / TextField | conditional |
| Colonia / Fraccionamiento | TextField | free text |
| Calle | TextField | |
| Número exterior | TextField | |
| Número interior | TextField | |
| Código postal | TextField | |

**Draft state:** extend `draft` object to include all new fields. `effective` object mirrors the same shape.

**Save flow:** same `updateUserMutation` but with extended payload.

**Email change:** requires calling a new or extended API endpoint since email lives in both `UserProfile` and Supabase Auth.

### API: `PATCH /identity/users/:id`

Extend to accept and persist:
- `email` (String) — updates both `UserProfile.email` and Supabase auth via `supabaseAdmin.auth.admin.updateUserById`
- `phone` (String | null)
- `birthDate` (String ISO date | null)
- `gender` (String | null)
- `bio` (String | null)
- `country` (String | null)
- `state` (String | null)
- `city` (String | null)
- `colony` (String | null)
- `street` (String | null)
- `extNumber` (String | null)
- `intNumber` (String | null)
- `postalCode` (String | null)

Email update flow: call `supabaseAdmin.auth.admin.updateUserById(authUserId, { email })` then update `UserProfile.email`. If Supabase update fails, return 500 without updating the DB.

Cache invalidation: `cacheDel(\`user_ctx:${authUserId}\`)` after any update (email change invalidates the cached context). Requires looking up `authUserId` from the profile's `id`.

### API: `PUT /profile/me`

Already accepts arbitrary body fields. Add `colony` to the update block (same pattern as existing fields).

### API: `GET /profile/me` and `GET /user/me`

Include `colony` in response alongside other profile fields.

---

## Data Flow Summary

```
Admin edits user in UserEditorScreen
  → PATCH /identity/users/:id (extended payload)
    → prisma.userProfile.update (all fields)
    → supabaseAdmin.auth.admin.updateUserById (email only, if changed)
    → cacheDel(user_ctx:<authUserId>)
  → queryClient.invalidateQueries(["identity-users"])
  → UI reflects new data
```

---

## Out of Scope

- Email confirmation flow for admin-initiated email changes (admin changes are immediate)
- Avatar upload in the identity editor
- Password reset from identity editor (already exists via separate flow)
- Validation of email format beyond what the API already does

---

## Constraints

- No TypeScript — JavaScript only
- All UI labels in Spanish
- Tailwind only, no CSS modules
- Follow existing combobox pattern from `StepCompany` exactly
- `colony` field is free text (no external library for colonias)
- Migrations are forward-only; never edit existing migration SQL
- File size limit: no file may exceed 1000 lines after changes
