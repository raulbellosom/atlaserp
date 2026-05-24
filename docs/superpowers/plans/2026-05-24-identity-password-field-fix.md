# Identity Password Field Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain password `TextField` in `UserCreateScreen` with `PasswordField` (eye toggle + strength bar), add password confirmation, and reorganize the form grid layout.

**Architecture:** Single-file change in `UserCreateScreen.jsx`. `PasswordField` already exists in `@atlas/ui` and is fully capable — no changes to shared components needed. The confirmation field is frontend-only; the API payload is unchanged.

**Tech Stack:** React, `@atlas/ui` (`PasswordField`, `TextField`, `SelectField`), TanStack Query, Lucide icons, Tailwind CSS.

---

## File Map

| Action | File |
|--------|------|
| Modify | `apps/desktop/src/modules/atlas.identity/screens/UserCreateScreen.jsx` |

---

### Task 1: Update `UserCreateScreen` — imports, state, layout, validation

**Files:**
- Modify: `apps/desktop/src/modules/atlas.identity/screens/UserCreateScreen.jsx`

**Context:** The current file imports `TextField` and passes `type="password"` to it directly. `PasswordField` is already exported from `@atlas/ui` (see `packages/ui/src/index.js:27`). The `PasswordField` component lives in `packages/ui/src/components/FormFields.jsx:210` and already supports `showStrength`, eye toggle, and a `validate` prop for inline error messages.

---

- [ ] **Step 1: Add `PasswordField` to the `@atlas/ui` import**

In `apps/desktop/src/modules/atlas.identity/screens/UserCreateScreen.jsx`, update the import block (lines 4–12):

```jsx
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PasswordField,
  SelectField,
  TextField,
} from "@atlas/ui";
```

---

- [ ] **Step 2: Add `confirmPassword` to the form state**

In the same file, update the `useState` initializer (lines 37–43):

```jsx
const [form, setForm] = useState({
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  roleId: NO_ROLE_VALUE,
});
```

---

- [ ] **Step 3: Update `isValid` to require matching passwords**

Replace the current `isValid` block (lines 86–90):

```jsx
const isValid =
  form.firstName.trim().length > 0 &&
  form.lastName.trim().length > 0 &&
  form.email.trim().length > 0 &&
  form.password.length >= 8 &&
  form.confirmPassword.length >= 8 &&
  form.password === form.confirmPassword;
```

---

- [ ] **Step 4: Reorganize the form grid and replace password fields**

Replace the entire `<div className="grid md:grid-cols-2 gap-4">` block (lines 126–175) with:

```jsx
<div className="grid md:grid-cols-2 gap-4">
  <TextField
    icon={UserRound}
    label="Nombre"
    value={form.firstName}
    onChange={(e) =>
      setForm((prev) => ({ ...prev, firstName: e.target.value }))
    }
    placeholder="Juan"
  />
  <TextField
    icon={UserRound}
    label="Apellidos"
    value={form.lastName}
    onChange={(e) =>
      setForm((prev) => ({ ...prev, lastName: e.target.value }))
    }
    placeholder="García López"
  />
  <TextField
    icon={Mail}
    label="Correo electrónico"
    type="email"
    value={form.email}
    onChange={(e) =>
      setForm((prev) => ({ ...prev, email: e.target.value }))
    }
    placeholder="usuario@empresa.com"
  />
  <SelectField
    icon={Shield}
    label="Rol"
    value={form.roleId}
    options={roleOptions}
    placeholder="Seleccionar rol"
    onValueChange={(value) =>
      setForm((prev) => ({ ...prev, roleId: value }))
    }
    disabled={!canReadRoles}
  />
  <PasswordField
    icon={KeyRound}
    label="Contraseña"
    showStrength
    value={form.password}
    onChange={(e) =>
      setForm((prev) => ({ ...prev, password: e.target.value }))
    }
    placeholder="Mínimo 8 caracteres"
  />
  <PasswordField
    icon={KeyRound}
    label="Confirmar contraseña"
    value={form.confirmPassword}
    onChange={(e) =>
      setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
    }
    placeholder="Repite la contraseña"
    validate={(v) =>
      v && v !== form.password ? "Las contraseñas no coinciden" : null
    }
  />
</div>
```

Grid result:
```
Row 1: [ Nombre        ]  [ Apellidos        ]
Row 2: [ Email         ]  [ Rol              ]
Row 3: [ Contraseña ⚡ ]  [ Confirmar contr. ]
```

---

- [ ] **Step 5: Run syntax check**

```bash
node --check apps/desktop/src/modules/atlas.identity/screens/UserCreateScreen.jsx
```

Expected: no output (clean).

---

- [ ] **Step 6: Start the dev server and verify manually**

```bash
pnpm dev
```

Open `http://localhost:5173`, navigate to **Identidad → Usuarios → Nuevo usuario** and verify:

- [ ] Row 1: Nombre / Apellidos
- [ ] Row 2: Correo electrónico / Rol
- [ ] Row 3: Contraseña (with eye toggle and strength bar) / Confirmar contraseña (with eye toggle)
- [ ] Typing different values in both password fields shows "Las contraseñas no coinciden" under the confirmation field after blur
- [ ] "Crear usuario" button is disabled while passwords are empty, < 8 chars, or do not match
- [ ] "Crear usuario" button enables once both fields match and are ≥ 8 characters
- [ ] Successfully creating a user navigates back to the users list

---

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.identity/screens/UserCreateScreen.jsx
git commit -m "fix(identity): add password visibility toggle and confirmation to user creation form"
```
