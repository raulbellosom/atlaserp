# Spec: Identity Password Field Fix & Confirmation

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** `apps/desktop/src/modules/atlas.identity/screens/UserCreateScreen.jsx`

---

## Problem

`UserCreateScreen` uses a plain `TextField` with `type="password"` instead of the
shared `PasswordField` component. This means:

1. No eye toggle to show/hide the password.
2. No password strength indicator.
3. No password confirmation field — the admin can accidentally set the wrong password
   with no feedback.

All other password inputs in the app (`LoginScreen`, `ProfileScreen`, `StepAdmin`)
already use `PasswordField` correctly. This is the only outlier.

---

## Goals

- Every password input in the app shows the eye toggle (visibility toggle). This is a
  global UX rule going forward.
- The "Nuevo usuario" form requires password confirmation before the user can submit.
- The form layout groups related fields together for better visual hierarchy.

---

## Out of Scope

- `UserEditorScreen` — password editing is intentionally absent from the edit screen
  (admin sets a new password through a separate reset flow, not inline editing).
- Any backend changes — the API endpoint already accepts `password` as a plain string;
  the confirmation field is purely a frontend concern.
- Changes to `PasswordField` itself — the component already satisfies all requirements.

---

## Solution

### Affected file

`apps/desktop/src/modules/atlas.identity/screens/UserCreateScreen.jsx`

### Layout reorganization

Current grid (5 fields, last one orphaned):

```
[ Nombre        ]  [ Apellidos   ]
[ Email         ]  [ Contraseña  ]   ← plain TextField, no eye
[ Rol           ]
```

New grid (3 balanced rows):

```
[ Nombre        ]  [ Apellidos        ]
[ Email         ]  [ Rol              ]
[ Contraseña ⚡ ]  [ Confirmar contr. ]
```

Password and confirmation are always on the same row so the relationship is visually
obvious. Rol moves up to sit next to Email (both are "account metadata").

### Form state changes

Add `confirmPassword: ""` to the initial form state object.

### Field component change

Replace:
```jsx
<TextField
  icon={KeyRound}
  label="Contraseña"
  type="password"
  value={form.password}
  onChange={...}
  placeholder="Mínimo 8 caracteres"
/>
```

With:
```jsx
<PasswordField
  icon={KeyRound}
  label="Contraseña"
  showStrength
  value={form.password}
  onChange={...}
  placeholder="Mínimo 8 caracteres"
/>
<PasswordField
  icon={KeyRound}
  label="Confirmar contraseña"
  value={form.confirmPassword}
  onChange={...}
  placeholder="Repite la contraseña"
  validate={(v) => (v && v !== form.password ? "Las contraseñas no coinciden" : null)}
/>
```

### Validation changes

Update `isValid` to also require:
- `form.confirmPassword.length >= 8`
- `form.confirmPassword === form.password`

### Imports

- Remove `KeyRound` from the `TextField` import (no longer used as `type="password"`).
- Add `PasswordField` to the `@atlas/ui` import.

---

## Global password input rule

From this change forward: **no `TextField` may use `type="password"`.** All password
inputs must use `PasswordField` from `@atlas/ui`. This is enforced by convention, not
by a lint rule, but the codebase is now fully consistent.

---

## Testing checklist

- [ ] Eye toggle shows/hides password text in both fields.
- [ ] Strength bar appears under the "Contraseña" field as the user types.
- [ ] "Las contraseñas no coinciden" error appears under the confirmation field when
      values diverge (on blur).
- [ ] Submit button is disabled when passwords are empty, < 8 chars, or do not match.
- [ ] Submitting with matching passwords creates the user and navigates back to the
      users list.
- [ ] Rol field is now in row 2 (next to Email) and password fields occupy row 3.
