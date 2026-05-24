# Address Fields Upgrade + Identity Full Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `colony` address field to profiles and company, upgrade country/state/city to searchable comboboxes in the user profile screen, and give admins full profile editing in the identity user editor (including email).

**Architecture:** Three independent layers — DB migration first (adds `colony` to both models), then API changes (profile endpoints, company service, identity PATCH, setup initialize), then frontend (ProfileScreen comboboxes + colony, StepCompany colony, CompanyAddress colony, UserEditorScreen extended card).

**Tech Stack:** Prisma 7, Hono, Node.js built-in test runner, React + TanStack Query, `country-state-city` npm library (already installed), `ComboboxField` from `@atlas/ui` (already used in StepCompany and CompanyAddress).

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `colony String?` to `UserProfile` (after `city`) and `Company` (after `city`) |
| `packages/validators/src/index.js` | Add `colony` to `setupInitializeSchema` and `companyAddressSchema` |
| `apps/api/src/index.js` | `GET /profile/me` + `PUT /profile/me` + `GET /user/me` include `colony`; `POST /setup/initialize` parses + saves `colony`; `PATCH /identity/users/:id` extended (all fields + email) |
| `apps/api/src/services/company-service.js` | `getAddress` returns `colony`, `updateAddress` saves `colony` |
| `apps/desktop/src/app/ProfileScreen.jsx` | Replace country/state/city `TextField` with `ComboboxField`; add `colony` field; cascade resets |
| `apps/desktop/src/setup/StepCompany.jsx` | Add `colony` `TextField` after city block |
| `apps/desktop/src/setup/SetupWizard.jsx` | Add `colony: ""` to `formData` initial state |
| `apps/desktop/src/modules/atlas.company/screens/CompanyAddress.jsx` | Add `colony` to form state, API mapping, and UI |
| `apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx` | Add second card with all extended profile fields for admin editing |

---

## Task 1: DB Migration — add `colony` to UserProfile and Company

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Edit schema — add colony to UserProfile**

In `prisma/schema.prisma`, in the `UserProfile` model, add `colony String?` after `city String?`:

```prisma
model UserProfile {
  id String @id @default(uuid(7)) @db.Uuid
  authUserId String @unique @db.Uuid
  displayName  String
  firstName    String   @default("")
  lastName     String   @default("")
  email        String   @unique
  avatarFileId String? @db.Uuid
  birthDate    DateTime?
  gender       String?
  phone        String?
  country      String?
  state        String?
  city         String?
  colony       String?
  street       String?
  extNumber    String?
  intNumber    String?
  postalCode   String?
  bio          String?
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  // ... relations unchanged
```

- [ ] **Step 2: Edit schema — add colony to Company**

In the `Company` model, add `colony String?` after `city String?`:

```prisma
model Company {
  // ...
  country        String?
  state          String?
  city           String?
  colony         String?
  street         String?
  // ...
```

- [ ] **Step 3: Run migration and generate client**

```bash
pnpm db:migrate
# When prompted for a name, enter: add_colony_to_userprofile_and_company
pnpm db:generate
```

Expected: migration file created in `prisma/migrations/`, no errors.

- [ ] **Step 4: Verify schema compiles**

```bash
node --check apps/api/src/index.js
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add colony field to UserProfile and Company"
```

---

## Task 2: Validators — add `colony` to schemas

**Files:**
- Modify: `packages/validators/src/index.js`

- [ ] **Step 1: Add colony to setupInitializeSchema**

In `packages/validators/src/index.js`, add `colony: z.string().optional()` to `setupInitializeSchema` after `postalCode`:

```js
export const setupInitializeSchema = z.object({
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  companyName: z.string().min(2),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  legalName: z.string().optional(),
  rfc: z.string().optional(),
  companyType: z.string().optional(),
  companyTypeName: z.string().optional(),
  companyIndustryKey: z.string().optional(),
  companyIndustryName: z.string().optional(),
  companySize: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  colony: z.string().optional(),
  street: z.string().optional(),
  extNumber: z.string().optional(),
  intNumber: z.string().optional(),
  postalCode: z.string().optional(),
});
```

- [ ] **Step 2: Add colony to companyAddressSchema**

```js
export const companyAddressSchema = z.object({
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  colony: z.string().optional(),
  street: z.string().optional(),
  extNumber: z.string().optional(),
  intNumber: z.string().optional(),
  postalCode: z.string().optional(),
});
```

- [ ] **Step 3: Verify syntax**

```bash
node --check packages/validators/src/index.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/validators/src/index.js
git commit -m "feat(validators): add colony to setup and company address schemas"
```

---

## Task 3: API — profile endpoints include `colony`

**Files:**
- Modify: `apps/api/src/index.js` (lines ~776–870)

- [ ] **Step 1: GET /profile/me — add colony to response**

In `GET /profile/me`, in the `return c.json({ data: { ... } })` block, add `colony` after `city`:

```js
return c.json({
  data: {
    id: context.profile.id,
    firstName: context.profile.firstName,
    lastName: context.profile.lastName,
    displayName: context.profile.displayName,
    email: context.profile.email,
    avatarUrl,
    birthDate: context.profile.birthDate,
    gender: context.profile.gender,
    phone: context.profile.phone,
    country: context.profile.country,
    state: context.profile.state,
    city: context.profile.city,
    colony: context.profile.colony,
    street: context.profile.street,
    extNumber: context.profile.extNumber,
    intNumber: context.profile.intNumber,
    postalCode: context.profile.postalCode,
    bio: context.profile.bio,
    role: context.roleKey,
  },
});
```

- [ ] **Step 2: PUT /profile/me — accept and save colony**

In `PUT /profile/me`, add `colony` to the prisma update `data` block (after `city`):

```js
const updated = await prisma.userProfile.update({
  where: { id: context.profile.id },
  data: {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    birthDate,
    gender: body.gender ? String(body.gender).trim() : null,
    phone: body.phone ? String(body.phone).trim() : null,
    country: body.country ? String(body.country).trim() : null,
    state: body.state ? String(body.state).trim() : null,
    city: body.city ? String(body.city).trim() : null,
    colony: body.colony ? String(body.colony).trim() : null,
    street: body.street ? String(body.street).trim() : null,
    extNumber: body.extNumber ? String(body.extNumber).trim() : null,
    intNumber: body.intNumber ? String(body.intNumber).trim() : null,
    postalCode: body.postalCode ? String(body.postalCode).trim() : null,
    bio: body.bio ? String(body.bio).trim() : null,
  },
});
```

And in the response after the update, add `colony: updated.colony` after `city`:

```js
return c.json({
  data: {
    id: updated.id,
    firstName: updated.firstName,
    lastName: updated.lastName,
    displayName: updated.displayName,
    email: updated.email,
    avatarUrl,
    birthDate: updated.birthDate,
    gender: updated.gender,
    phone: updated.phone,
    country: updated.country,
    state: updated.state,
    city: updated.city,
    colony: updated.colony,
    street: updated.street,
    extNumber: updated.extNumber,
    intNumber: updated.intNumber,
    postalCode: updated.postalCode,
    bio: updated.bio,
    role: context.roleKey,
  },
});
```

- [ ] **Step 3: GET /user/me — add colony to response**

In `GET /user/me` (around line 747), add `colony` after `city` in the response:

```js
return c.json({
  id: context.profile.id,
  firstName: context.profile.firstName,
  lastName: context.profile.lastName,
  displayName: context.profile.displayName,
  email: context.profile.email,
  avatarUrl,
  colony: context.profile.colony,
  role: context.roleKey,
  isAdmin: context.isAdmin,
  permissions: context.permissions,
});
```

Note: `/user/me` is the auth context endpoint used for the header/session — it only needs colony if it's used for display. Add it for completeness, it won't break anything.

- [ ] **Step 4: Verify syntax**

```bash
node --check apps/api/src/index.js
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(api): add colony to profile endpoints (GET/PUT /profile/me, GET /user/me)"
```

---

## Task 4: API — company service + endpoint include `colony`

**Files:**
- Modify: `apps/api/src/services/company-service.js`
- Modify: `apps/api/src/index.js` (company/address section ~line 1318)

- [ ] **Step 1: company-service.js — getAddress returns colony**

In `getAddress()`, add `colony: company?.colony ?? ""` after `city`:

```js
async getAddress() {
  const companyId = await getCompanyId();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });
  return {
    companyId,
    country: company?.country ?? "",
    state: company?.state ?? "",
    city: company?.city ?? "",
    colony: company?.colony ?? "",
    street: company?.street ?? "",
    extNumber: company?.extNumber ?? "",
    intNumber: company?.intNumber ?? "",
    postalCode: company?.postalCode ?? "",
  };
},
```

- [ ] **Step 2: company-service.js — updateAddress saves colony**

Find the `updateAddress` function (reads `fields.country`, etc.) and add `colony: fields.colony || null` after `city`:

```js
async updateAddress(fields) {
  const companyId = await getCompanyId();
  await prisma.company.update({
    where: { id: companyId },
    data: {
      country: fields.country || null,
      state: fields.state || null,
      city: fields.city || null,
      colony: fields.colony || null,
      street: fields.street || null,
      extNumber: fields.extNumber || null,
      intNumber: fields.intNumber || null,
      postalCode: fields.postalCode || null,
    },
  });
},
```

- [ ] **Step 3: setup/initialize — parse and save colony for Company**

In `apps/api/src/index.js`, in `POST /setup/initialize`, add `colony` to the body parsing block (after `postalCode`):

```js
const fields = setupInitializeSchema.parse({
  // ... existing fields ...
  colony: body.colony || undefined,
  // ...
});
```

And in `tx.company.create({ data: { ... } })`, add `colony: fields.colony || null` after `city`:

```js
const company = await tx.company.create({
  data: {
    name: fields.companyName,
    slug,
    legalName: fields.legalName,
    rfc: fields.rfc,
    companyType: fields.companyType,
    companyTypeName: fields.companyTypeName,
    industryKey: fields.companyIndustryKey,
    industryName: fields.companyIndustryName,
    companySize: fields.companySize,
    contactEmail: fields.contactEmail || null,
    phone: fields.phone || null,
    website: fields.website || null,
    country: fields.country,
    state: fields.state,
    city: fields.city,
    colony: fields.colony || null,
    street: fields.street,
    extNumber: fields.extNumber,
    intNumber: fields.intNumber,
    postalCode: fields.postalCode,
  },
});
```

- [ ] **Step 4: Verify syntax**

```bash
node --check apps/api/src/services/company-service.js
node --check apps/api/src/index.js
```

Expected: no output for both.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/company-service.js apps/api/src/index.js
git commit -m "feat(api): add colony to company address service and setup endpoint"
```

---

## Task 5: API — PATCH /identity/users/:id extended

**Files:**
- Modify: `apps/api/src/index.js` (lines ~2075–2109)

- [ ] **Step 1: Extend the PATCH handler**

Replace the existing `PATCH /identity/users/:id` handler body with:

```js
app.patch(
  "/identity/users/:id",
  authMiddleware,
  requirePermission("identity.users.update"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const patch = {};

      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (typeof body.firstName === "string") patch.firstName = body.firstName.trim();
      if (typeof body.lastName === "string") patch.lastName = body.lastName.trim();
      if (patch.firstName !== undefined || patch.lastName !== undefined) {
        patch.displayName = `${patch.firstName ?? ""} ${patch.lastName ?? ""}`.trim();
      }

      // Extended personal fields
      if (typeof body.phone === "string") patch.phone = body.phone.trim() || null;
      if (body.phone === null) patch.phone = null;
      if (typeof body.bio === "string") patch.bio = body.bio.trim() || null;
      if (body.bio === null) patch.bio = null;
      if (typeof body.gender === "string") patch.gender = body.gender.trim() || null;
      if (body.gender === null) patch.gender = null;
      if (typeof body.birthDate === "string") {
        const d = body.birthDate ? new Date(body.birthDate) : null;
        patch.birthDate = d && !Number.isNaN(d.getTime()) ? d : null;
      }
      if (body.birthDate === null) patch.birthDate = null;

      // Address fields
      if (typeof body.country === "string") patch.country = body.country.trim() || null;
      if (body.country === null) patch.country = null;
      if (typeof body.state === "string") patch.state = body.state.trim() || null;
      if (body.state === null) patch.state = null;
      if (typeof body.city === "string") patch.city = body.city.trim() || null;
      if (body.city === null) patch.city = null;
      if (typeof body.colony === "string") patch.colony = body.colony.trim() || null;
      if (body.colony === null) patch.colony = null;
      if (typeof body.street === "string") patch.street = body.street.trim() || null;
      if (body.street === null) patch.street = null;
      if (typeof body.extNumber === "string") patch.extNumber = body.extNumber.trim() || null;
      if (body.extNumber === null) patch.extNumber = null;
      if (typeof body.intNumber === "string") patch.intNumber = body.intNumber.trim() || null;
      if (body.intNumber === null) patch.intNumber = null;
      if (typeof body.postalCode === "string") patch.postalCode = body.postalCode.trim() || null;
      if (body.postalCode === null) patch.postalCode = null;

      const user = await prisma.userProfile.update({
        where: { id },
        data: patch,
      });

      // Email update — requires both DB and Supabase auth update
      if (typeof body.email === "string" && body.email.trim()) {
        const newEmail = body.email.trim().toLowerCase();
        const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(
          user.authUserId,
          { email: newEmail }
        );
        if (authEmailError) {
          return c.json({ error: "No se pudo actualizar el correo del usuario." }, 500);
        }
        await prisma.userProfile.update({
          where: { id },
          data: { email: newEmail },
        });
        user.email = newEmail;
      }

      // Membership / role update
      if (body.membershipId && body.roleId) {
        await prisma.membership.update({
          where: { id: body.membershipId },
          data: { roleId: body.roleId },
        });
      }

      // Bust user context cache so the next GET /user/me reflects changes
      cacheDel(`user_ctx:${user.authUserId}`);

      return c.json({ data: user });
    } catch {
      return c.json({ error: "No se pudo actualizar el usuario." }, 500);
    }
  },
);
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/api/src/index.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(api): extend PATCH /identity/users/:id for full profile + email editing"
```

---

## Task 6: Frontend — ProfileScreen comboboxes + colony

**Files:**
- Modify: `apps/desktop/src/app/ProfileScreen.jsx`

- [ ] **Step 1: Add imports and update EMPTY_FORM**

Add `Country`, `State`, `City` and `ComboboxField` imports at the top of `ProfileScreen.jsx`. Add `colony` to `EMPTY_FORM`:

```js
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Avatar, AvatarFallback, AvatarImage,
  Button, Card, ComboboxField, DateField, ImageViewer,
  PageHeader, PasswordField, PhoneField, SelectField,
  Skeleton, TextField, TextareaField,
} from "@atlas/ui";
import { Country, State, City } from "country-state-city";
// ... lucide imports unchanged ...
```

Update `EMPTY_FORM`:

```js
const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  birthDate: "",
  gender: "",
  phone: "",
  country: "",
  state: "",
  city: "",
  colony: "",
  street: "",
  extNumber: "",
  intNumber: "",
  postalCode: "",
  bio: "",
};
```

- [ ] **Step 2: Add useMemo hooks for address options**

Inside `ProfileScreen()`, after the `profileQuery` declaration, add:

```js
const countryOptions = useMemo(
  () => Country.getAllCountries().map((c) => ({ value: c.isoCode, label: c.name })),
  []
);

const stateOptions = useMemo(
  () =>
    form.country
      ? State.getStatesOfCountry(form.country).map((s) => ({ value: s.isoCode, label: s.name }))
      : [],
  [form.country]
);

const cityOptions = useMemo(
  () =>
    form.country && form.state
      ? City.getCitiesOfState(form.country, form.state).map((c) => ({ value: c.name, label: c.name }))
      : [],
  [form.country, form.state]
);
```

- [ ] **Step 3: Add cascade reset handlers**

After the `useMemo` hooks add:

```js
function handleCountryChange(val) {
  setForm((f) => ({ ...f, country: val, state: "", city: "", colony: "" }));
}

function handleStateChange(val) {
  setForm((f) => ({ ...f, state: val, city: "", colony: "" }));
}
```

- [ ] **Step 4: Map colony when loading profile data**

In the `useEffect` that reads `profileQuery.data`, add `colony`:

```js
const loaded = {
  firstName: data.firstName ?? "",
  lastName: data.lastName ?? "",
  birthDate: toDateInputValue(data.birthDate),
  gender: data.gender ?? "",
  phone: data.phone ?? "",
  country: data.country ?? "",
  state: data.state ?? "",
  city: data.city ?? "",
  colony: data.colony ?? "",
  street: data.street ?? "",
  extNumber: data.extNumber ?? "",
  intNumber: data.intNumber ?? "",
  postalCode: data.postalCode ?? "",
  bio: data.bio ?? "",
};
```

- [ ] **Step 5: Replace address TextFields with ComboboxFields + add colony**

Find the `/* Address */` section inside the `<div>` that contains the `Dirección` label. Replace the existing country/state/city `TextField` components with comboboxes and add the colony field. The new address block should look like:

```jsx
<div>
  <p className="text-[13px] font-medium text-[hsl(var(--foreground))]/80 mb-3 flex items-center gap-1.5">
    <MapPin className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
    Dirección
  </p>
  <div className="grid md:grid-cols-2 gap-4">
    <ComboboxField
      label="País"
      options={countryOptions}
      value={form.country}
      onChange={handleCountryChange}
      placeholder="Seleccionar país..."
      searchPlaceholder="Buscar país..."
    />
    {stateOptions.length > 0 ? (
      <ComboboxField
        label="Estado / Provincia"
        options={stateOptions}
        value={form.state}
        onChange={handleStateChange}
        placeholder="Seleccionar estado..."
        searchPlaceholder="Buscar estado..."
      />
    ) : (
      <TextField
        label="Estado / Provincia"
        icon={MapPin}
        value={form.state}
        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
      />
    )}
    {form.country && cityOptions.length > 0 ? (
      <ComboboxField
        label="Ciudad / Municipio"
        options={cityOptions}
        value={form.city}
        onChange={(val) => setForm((f) => ({ ...f, city: val }))}
        placeholder="Seleccionar ciudad..."
        searchPlaceholder="Buscar ciudad..."
        minSearchLength={2}
      />
    ) : (
      <TextField
        label="Ciudad / Municipio"
        icon={MapPin}
        value={form.city}
        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
      />
    )}
    <TextField
      label="Colonia / Fraccionamiento"
      icon={MapPin}
      value={form.colony}
      onChange={(e) => setForm((f) => ({ ...f, colony: e.target.value }))}
    />
    <TextField
      label="Calle"
      icon={MapPin}
      value={form.street}
      onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
    />
    <TextField
      label="Número exterior"
      value={form.extNumber}
      onChange={(e) => setForm((f) => ({ ...f, extNumber: e.target.value }))}
    />
    <TextField
      label="Número interior"
      value={form.intNumber}
      onChange={(e) => setForm((f) => ({ ...f, intNumber: e.target.value }))}
    />
    <TextField
      label="Código postal"
      value={form.postalCode}
      onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
    />
  </div>
</div>
```

Remove the `Landmark` icon import if it's no longer used (it was on the old country TextField — check before removing).

- [ ] **Step 6: Verify syntax**

```bash
node --check apps/desktop/src/app/ProfileScreen.jsx
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/app/ProfileScreen.jsx
git commit -m "feat(profile): combobox for country/state/city and add colony field"
```

---

## Task 7: Frontend — StepCompany + SetupWizard colony

**Files:**
- Modify: `apps/desktop/src/setup/StepCompany.jsx`
- Modify: `apps/desktop/src/setup/SetupWizard.jsx`

- [ ] **Step 1: StepCompany — add colony TextField after city block**

In `StepCompany.jsx`, find the city section (the `{data.state && cityOptions.length === 0 && ...}` block). After the entire city section (after the closing `}` of that conditional), add:

```jsx
<TextField
  id="colony"
  label="Colonia / Fraccionamiento"
  value={data.colony || ""}
  onChange={(e) => onChange({ colony: e.target.value })}
  placeholder="Col. Centro"
/>
```

- [ ] **Step 2: SetupWizard — add colony to formData**

In `SetupWizard.jsx`, find the `formData` initial state object and add `colony: ""` after `city`:

```js
const [formData, setFormData] = useState({
  // ...
  country: "",
  state: "",
  city: "",
  colony: "",
  street: "",
  // ...
});
```

- [ ] **Step 3: Verify syntax**

```bash
node --check apps/desktop/src/setup/StepCompany.jsx
node --check apps/desktop/src/setup/SetupWizard.jsx
```

Expected: no output for both.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/setup/StepCompany.jsx apps/desktop/src/setup/SetupWizard.jsx
git commit -m "feat(setup): add colony field to company address step"
```

---

## Task 8: Frontend — CompanyAddress colony

**Files:**
- Modify: `apps/desktop/src/modules/atlas.company/screens/CompanyAddress.jsx`

- [ ] **Step 1: Add colony to form state**

In `CompanyAddress.jsx`, add `colony: ""` to the `useState` initial value after `city`:

```js
const [form, setForm] = useState({
  country: "",
  state: "",
  city: "",
  colony: "",
  street: "",
  extNumber: "",
  intNumber: "",
  postalCode: "",
});
```

- [ ] **Step 2: Map colony from API data in useEffect**

In the `useEffect` that reads `data?.data`, add `colony`:

```js
useEffect(() => {
  if (data?.data) {
    setForm({
      country: data.data.country ?? "",
      state: data.data.state ?? "",
      city: data.data.city ?? "",
      colony: data.data.colony ?? "",
      street: data.data.street ?? "",
      extNumber: data.data.extNumber ?? "",
      intNumber: data.data.intNumber ?? "",
      postalCode: data.data.postalCode ?? "",
    });
  }
}, [data]);
```

- [ ] **Step 3: Add colony TextField in the Domicilio card**

In the "Domicilio" card, after the Ciudad `ComboboxField` in the "Ubicacion" card and before the "Calle" field in the "Domicilio" card. Add a `colony` TextField as the first field in the Domicilio grid (before "Calle"):

```jsx
<div className="sm:col-span-2">
  <TextField
    label="Colonia / Fraccionamiento"
    value={form.colony}
    onChange={(v) => handleChange("colony", v)}
    disabled={disabled}
    placeholder="Ej. Col. Doctores"
    icon={MapPin}
  />
</div>
<div className="sm:col-span-2">
  <TextField
    label="Calle"
    // ... existing
  />
</div>
```

- [ ] **Step 4: Verify syntax**

```bash
node --check apps/desktop/src/modules/atlas.company/screens/CompanyAddress.jsx
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.company/screens/CompanyAddress.jsx
git commit -m "feat(company): add colony field to company address screen"
```

---

## Task 9: Frontend — UserEditorScreen extended admin fields

**Files:**
- Modify: `apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx`

- [ ] **Step 1: Add imports**

Add the following imports to `UserEditorScreen.jsx`:

```js
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle,
  ComboboxField, ConfirmDialog, DateField, PhoneField,
  SelectField, Skeleton, SwitchField, TextField, TextareaField,
} from "@atlas/ui";
import {
  ArrowLeft, CalendarDays, Mail, MapPin, Phone,
  Shield, Trash2, UserRound, VenusAndMars,
} from "lucide-react";
import { Country, State, City } from "country-state-city";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
```

- [ ] **Step 2: Update effective object and draft to include all profile fields**

Replace the `effective` object declaration:

```js
const effective = {
  firstName: draft?.firstName ?? user?.firstName ?? "",
  lastName: draft?.lastName ?? user?.lastName ?? "",
  email: draft?.email ?? user?.email ?? "",
  enabled: draft?.enabled ?? user?.enabled ?? false,
  roleId: draft?.roleId ?? membership?.roleId ?? NO_ROLE_VALUE,
  phone: draft?.phone ?? user?.phone ?? "",
  birthDate: draft?.birthDate ?? (user?.birthDate ? new Date(user.birthDate).toISOString().slice(0, 10) : ""),
  gender: draft?.gender ?? user?.gender ?? "",
  bio: draft?.bio ?? user?.bio ?? "",
  country: draft?.country ?? user?.country ?? "",
  state: draft?.state ?? user?.state ?? "",
  city: draft?.city ?? user?.city ?? "",
  colony: draft?.colony ?? user?.colony ?? "",
  street: draft?.street ?? user?.street ?? "",
  extNumber: draft?.extNumber ?? user?.extNumber ?? "",
  intNumber: draft?.intNumber ?? user?.intNumber ?? "",
  postalCode: draft?.postalCode ?? user?.postalCode ?? "",
};
```

- [ ] **Step 3: Add address option memos**

After `effective`, add:

```js
const countryOptions = useMemo(
  () => Country.getAllCountries().map((c) => ({ value: c.isoCode, label: c.name })),
  []
);

const stateOptions = useMemo(
  () =>
    effective.country
      ? State.getStatesOfCountry(effective.country).map((s) => ({ value: s.isoCode, label: s.name }))
      : [],
  [effective.country]
);

const cityOptions = useMemo(
  () =>
    effective.country && effective.state
      ? City.getCitiesOfState(effective.country, effective.state).map((c) => ({ value: c.name, label: c.name }))
      : [],
  [effective.country, effective.state]
);
```

- [ ] **Step 4: Update saveChanges to send all fields**

Replace the `saveChanges` function:

```js
function saveChanges() {
  if (!user) return;
  const payload = {
    firstName: effective.firstName,
    lastName: effective.lastName,
    enabled: effective.enabled,
    email: effective.email,
    phone: effective.phone || null,
    birthDate: effective.birthDate || null,
    gender: effective.gender || null,
    bio: effective.bio || null,
    country: effective.country || null,
    state: effective.state || null,
    city: effective.city || null,
    colony: effective.colony || null,
    street: effective.street || null,
    extNumber: effective.extNumber || null,
    intNumber: effective.intNumber || null,
    postalCode: effective.postalCode || null,
  };
  if (membership) {
    payload.membershipId = membership.id;
    payload.roleId = effective.roleId === NO_ROLE_VALUE ? null : effective.roleId;
  }
  updateUserMutation.mutate(payload, {
    onSuccess: () => toast.success("Usuario actualizado"),
    onError: () => toast.error("No se pudo actualizar el usuario"),
  });
}
```

- [ ] **Step 5: Make email editable in the first card**

In the first `Card` (existing one), change the email `TextField` from `disabled` to editable by admin:

```jsx
<TextField
  icon={Mail}
  label="Correo"
  value={effective.email}
  disabled={!canManageUsers}
  onChange={(e) =>
    setDraft((prev) => ({ ...(prev ?? {}), email: e.target.value }))
  }
/>
```

- [ ] **Step 6: Add second Card with personal + address fields**

Replace the existing `{canReadUsers && user && !rolesQuery.isLoading && ( <Card>...</Card> )}` block with a fragment that holds both cards:

```jsx
{canReadUsers && user && !rolesQuery.isLoading && (
  <Card>
    <CardHeader>
      <CardTitle>Datos personales</CardTitle>
    </CardHeader>
    <CardContent className="pt-0 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <PhoneField
          label="Teléfono"
          icon={Phone}
          value={effective.phone}
          disabled={!canManageUsers}
          onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), phone: e.target.value }))}
        />
        <DateField
          label="Fecha de nacimiento"
          icon={CalendarDays}
          value={effective.birthDate}
          disabled={!canManageUsers}
          onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), birthDate: e.target.value }))}
        />
        <SelectField
          icon={VenusAndMars}
          label="Sexo"
          value={effective.gender}
          placeholder="Seleccionar"
          disabled={!canManageUsers}
          options={[
            { value: "masculino", label: "Masculino" },
            { value: "femenino", label: "Femenino" },
            { value: "no_binario", label: "No binario" },
            { value: "prefiero_no_decir", label: "Prefiero no decir" },
          ]}
          onValueChange={(value) => setDraft((prev) => ({ ...(prev ?? {}), gender: value }))}
        />
      </div>

      <TextareaField
        label="Biografía"
        value={effective.bio}
        maxLength={500}
        disabled={!canManageUsers}
        onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), bio: e.target.value }))}
      />

      <p className="text-[13px] font-medium text-[hsl(var(--foreground))]/80 flex items-center gap-1.5 pt-2">
        <MapPin className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        Dirección
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <ComboboxField
          label="País"
          options={countryOptions}
          value={effective.country}
          disabled={!canManageUsers}
          onChange={(val) =>
            setDraft((prev) => ({ ...(prev ?? {}), country: val, state: "", city: "", colony: "" }))
          }
          placeholder="Seleccionar país..."
          searchPlaceholder="Buscar país..."
        />
        {stateOptions.length > 0 ? (
          <ComboboxField
            label="Estado / Provincia"
            options={stateOptions}
            value={effective.state}
            disabled={!canManageUsers}
            onChange={(val) =>
              setDraft((prev) => ({ ...(prev ?? {}), state: val, city: "", colony: "" }))
            }
            placeholder="Seleccionar estado..."
            searchPlaceholder="Buscar estado..."
          />
        ) : (
          <TextField
            label="Estado / Provincia"
            icon={MapPin}
            value={effective.state}
            disabled={!canManageUsers}
            onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), state: e.target.value }))}
          />
        )}
        {effective.country && cityOptions.length > 0 ? (
          <ComboboxField
            label="Ciudad / Municipio"
            options={cityOptions}
            value={effective.city}
            disabled={!canManageUsers}
            onChange={(val) => setDraft((prev) => ({ ...(prev ?? {}), city: val }))}
            placeholder="Seleccionar ciudad..."
            searchPlaceholder="Buscar ciudad..."
            minSearchLength={2}
          />
        ) : (
          <TextField
            label="Ciudad / Municipio"
            icon={MapPin}
            value={effective.city}
            disabled={!canManageUsers}
            onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), city: e.target.value }))}
          />
        )}
        <TextField
          label="Colonia / Fraccionamiento"
          icon={MapPin}
          value={effective.colony}
          disabled={!canManageUsers}
          onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), colony: e.target.value }))}
        />
        <TextField
          label="Calle"
          icon={MapPin}
          value={effective.street}
          disabled={!canManageUsers}
          onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), street: e.target.value }))}
        />
        <TextField
          label="Número exterior"
          value={effective.extNumber}
          disabled={!canManageUsers}
          onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), extNumber: e.target.value }))}
        />
        <TextField
          label="Número interior"
          value={effective.intNumber}
          disabled={!canManageUsers}
          onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), intNumber: e.target.value }))}
        />
        <TextField
          label="Código postal"
          value={effective.postalCode}
          disabled={!canManageUsers}
          onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), postalCode: e.target.value }))}
        />
      </div>

      {!canManageUsers && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Modo lectura: necesitas permiso identity.users.update para editar.
        </p>
      )}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 7: Verify syntax**

```bash
node --check apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx
git commit -m "feat(identity): add full profile editing card in user editor for admins"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full syntax check**

```bash
node --check apps/api/src/index.js
node --check apps/api/src/services/company-service.js
node --check packages/validators/src/index.js
node --check apps/desktop/src/app/ProfileScreen.jsx
node --check apps/desktop/src/setup/StepCompany.jsx
node --check apps/desktop/src/setup/SetupWizard.jsx
node --check apps/desktop/src/modules/atlas.company/screens/CompanyAddress.jsx
node --check apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx
```

Expected: no output for all.

- [ ] **Step 2: Run existing tests**

```bash
node --test packages/module-engine/src/__tests__/
node --test apps/api/src/services/__tests__/
```

Expected: all tests pass.

- [ ] **Step 3: Start dev server and verify manually**

```bash
pnpm dev
```

Check the following flows in the browser at http://localhost:5173:
1. **Mi perfil** — País/Estado/Ciudad show as searchable comboboxes; Colonia field appears between Ciudad and Calle; saving a profile with a colony value works.
2. **Setup wizard (if accessible)** — Colonia field visible in company address step.
3. **Empresa > Dirección** — Colonia field visible in company address form.
4. **Identity > Editar usuario** — Second card with all personal fields visible; admin can edit email, phone, address; comboboxes work for country/state/city.
