# Contacts Detail Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /contacts/:id` and a `/app/m/atlas.contacts/contacts/:id` URL that opens the existing edit sheet for that contact.

**Architecture:** One new service function + route + SDK method (backend). `ModuleOutlet.jsx` gains a route entry; `ContactsScreen.jsx` gains URL-awareness mirroring `HrScreen.jsx`'s existing wildcard-parsing pattern, reusing the existing `ContactFormSheet` rather than building a new detail UI.

**Tech Stack:** Node.js, Hono, Prisma, React, react-router-dom.

**Spec:** `docs/superpowers/specs/2026-08-27-contacts-detail-route-design.md`

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/services/contacts-service.js` | Modify | Add `getById` |
| `apps/api/src/services/__tests__/contacts-service.test.js` | Create | Test `getById`'s company scoping |
| `apps/api/src/index.js` | Modify | Add `GET /contacts/:id` route |
| `packages/sdk/src/index.js` | Modify | Add `contacts.getById` |
| `apps/desktop/src/app/ModuleOutlet.jsx` | Modify | Register `atlas.contacts:/contacts/:id` |
| `apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx` | Modify | URL-aware sheet open/close |

---

### Task 1: Backend — `getById`, route, SDK

**Files:**
- Modify: `apps/api/src/services/contacts-service.js`
- Create: `apps/api/src/services/__tests__/contacts-service.test.js`
- Modify: `apps/api/src/index.js`
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 1: Write the failing test first**

Create `apps/api/src/services/__tests__/contacts-service.test.js` (this service has no existing test file — first coverage for it):

```javascript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createContactsService, ContactsServiceError } from "../contacts-service.js";

function buildPrismaMock({ profile, membership, contact }) {
  return {
    userProfile: {
      findUnique: async () => profile,
    },
    membership: {
      findFirst: async () => membership,
    },
    contact: {
      findFirst: async ({ where }) => {
        if (contact && where.id === contact.id && where.companyId === contact.companyId) {
          return contact;
        }
        return null;
      },
    },
  };
}

describe("contacts-service — getById", () => {
  it("returns the contact when it belongs to the caller's company", async () => {
    const contact = { id: "contact-1", companyId: "company-1", name: "Ada Lovelace" };
    const prisma = buildPrismaMock({
      profile: { id: "profile-1" },
      membership: { companyId: "company-1" },
      contact,
    });
    const service = createContactsService({ prisma });
    const result = await service.getById({ authUserId: "auth-1", id: "contact-1" });
    assert.deepEqual(result, contact);
  });

  it("throws 404 when the contact belongs to a different company", async () => {
    const contact = { id: "contact-1", companyId: "company-OTHER", name: "Ada Lovelace" };
    const prisma = buildPrismaMock({
      profile: { id: "profile-1" },
      membership: { companyId: "company-1" },
      contact,
    });
    const service = createContactsService({ prisma });
    await assert.rejects(
      () => service.getById({ authUserId: "auth-1", id: "contact-1" }),
      (err) => err instanceof ContactsServiceError && err.status === 404,
    );
  });

  it("throws 404 when the contact id doesn't exist", async () => {
    const prisma = buildPrismaMock({
      profile: { id: "profile-1" },
      membership: { companyId: "company-1" },
      contact: null,
    });
    const service = createContactsService({ prisma });
    await assert.rejects(
      () => service.getById({ authUserId: "auth-1", id: "does-not-exist" }),
      (err) => err instanceof ContactsServiceError && err.status === 404,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/services/__tests__/contacts-service.test.js`
Expected: FAIL — `getById` doesn't exist yet.

- [ ] **Step 3: Implement `getById`**

In `apps/api/src/services/contacts-service.js`, add inside the returned object (near `update`/`delete`, which share the same `getCompanyContext` + company-scoped lookup shape):

```javascript
    async getById({ authUserId, id }) {
      const companyId = await getCompanyContext(authUserId);
      const contact = await prisma.contact.findFirst({ where: { id, companyId } });
      if (!contact) {
        throw new ContactsServiceError("Contacto no encontrado.", 404);
      }
      return contact;
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/services/__tests__/contacts-service.test.js`
Expected: PASS (3/3).

- [ ] **Step 5: Add the route**

In `apps/api/src/index.js`, add `GET /contacts/:id` next to the existing `PATCH /contacts/:id` (search for `"/contacts/:id"` — it appears at the existing `PATCH` and `DELETE` routes; add this alongside them for locality, same file section):

```javascript
app.get(
  "/contacts/:id",
  authMiddleware,
  requirePermission("contacts.contacts.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const contact = await contactsService.getById({ authUserId, id });
      return c.json({ data: contact });
    } catch (err) {
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo cargar el contacto." }, 500);
    }
  },
);
```

Read the file first to confirm the exact existing `PATCH /contacts/:id`/`DELETE /contacts/:id` handlers' error-handling shape (shown above mirrors `GET /contacts`' own try/catch pattern already in this file) before inserting — match whichever convention is actually used at that exact location, don't guess.

- [ ] **Step 6: Add the SDK method**

In `packages/sdk/src/index.js`, inside the `contacts: { ... }` object, add near `update`/`delete`:

```javascript
      getById: (id, token) =>
        request(`/contacts/${encodeURIComponent(id)}`, {
          headers: withAuthHeaders(token),
        }),
```

- [ ] **Step 7: Build and test check**

```bash
pnpm build
node --test apps/api/src/services/__tests__/contacts-service.test.js
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/contacts-service.js apps/api/src/services/__tests__/contacts-service.test.js apps/api/src/index.js packages/sdk/src/index.js
git commit -m "feat(contacts): add GET /contacts/:id endpoint"
```

---

### Task 2: Frontend — route + URL-aware sheet

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`
- Modify: `apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx`

- [ ] **Step 1: Read `HrScreen.jsx`'s wildcard-parsing pattern first (required)**

`apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx:95-106` — `useParams()`'s `{ "*": wildcard }`, then a regex match against it. This task mirrors that exact pattern for Contact, which is structurally simpler (no separate edit-vs-detail distinction needed — Contact only ever opens the one sheet).

- [ ] **Step 2: Register the route in `ModuleOutlet.jsx`**

In `SCREEN_MAP`, add next to the existing `"atlas.contacts:/contacts"` entry:

```javascript
  "atlas.contacts:/contacts/:id": lazy(
    () => import("../modules/atlas.contacts/screens/ContactsScreen.jsx"),
  ),
```

In `resolveScreen()`, add a branch (place it near the `atlas.files`/`atlas.hr` branches, same file, same function):

```javascript
  if (moduleKey === "atlas.contacts" && subPath.startsWith("/contacts/")) {
    return SCREEN_MAP["atlas.contacts:/contacts/:id"] ?? null;
  }
```

- [ ] **Step 3: Read `ContactsScreen.jsx`'s current `openEdit`/sheet-close/imports in full first (required)**

Confirm the exact current line numbers for `openEdit` (around line 124), the `ContactFormSheet`'s `onOpenChange` handler (around line 301), and the top-of-file imports — before editing, since this plan's snippets show intent, not necessarily byte-exact surrounding context.

- [ ] **Step 4: Add URL-awareness**

Add imports:

```javascript
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query"; // confirm not already imported — this file likely already uses useQuery for blueprintsQuery; if so, don't re-import
```

Inside `ContactsScreen()`, near the top (after the existing `useState` declarations):

```javascript
  const { "*": wildcard } = useParams();
  const navigate = useNavigate();
  const urlContactMatch = wildcard?.match(/^contacts\/([^/]+)$/);
  const urlContactId = urlContactMatch?.[1] ?? null;

  // A URL-referenced contact may not be in the currently-loaded list page
  // (pagination) — always fetch it independently by id (spec edge case 2),
  // never assume it's already among the loaded rows.
  const urlContactQuery = useQuery({
    queryKey: ["contact", urlContactId, authUserId],
    queryFn: () => atlas.contacts.getById(urlContactId, token),
    enabled: Boolean(urlContactId && token),
  });
```

Add an effect that opens the sheet once the URL-referenced contact resolves, and closes it (with a toast) if it fails:

```javascript
  useEffect(() => {
    if (!urlContactId) return;
    if (urlContactQuery.data?.data) {
      setEditingContact(urlContactQuery.data.data);
      setSheetOpen(true);
    } else if (urlContactQuery.isError) {
      toast.error("No se pudo cargar el contacto.");
      navigate("/app/m/atlas.contacts/contacts");
    }
  }, [urlContactId, urlContactQuery.data, urlContactQuery.isError, navigate]);
```

Confirm `useEffect` is already imported from `"react"` at the top of this file (it very likely is, given the file's size) — add it to the existing React import if not.

- [ ] **Step 5: Make `openEdit` and the sheet's close handler URL-aware**

Change `openEdit` to also navigate:

```javascript
  function openEdit(contact) {
    setEditingContact(contact);
    setSheetOpen(true);
    navigate(`/app/m/atlas.contacts/contacts/${contact.id}`);
  }
```

Change the `ContactFormSheet`'s `onOpenChange` (currently `(v) => { setSheetOpen(v); if (!v) setEditingContact(null); }`) to also navigate back on close, but only when closing an EDIT (not when closing the create sheet, which never had a `:id` in the URL to begin with):

```javascript
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) {
            setEditingContact(null);
            if (urlContactId) navigate("/app/m/atlas.contacts/contacts");
          }
        }}
```

- [ ] **Step 6: Build check**

Run: `pnpm --filter @atlas/desktop exec vite build`

- [ ] **Step 7: Self-review**

Trace explicitly: (a) does `openCreate` (unrelated, existing) still work unchanged — it doesn't call `openEdit`, so it shouldn't navigate anywhere, confirm this holds; (b) if a user clicks a row while ALREADY viewing a different contact via URL (edit sheet open, `urlContactId` set), does `openEdit`'s new `navigate()` call correctly update the URL to the newly-clicked contact's id without any stale-state flash; (c) confirm `urlContactQuery` is disabled (doesn't fire) when there's no `:id` in the URL, so normal list browsing doesn't trigger an extra unnecessary request.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/app/ModuleOutlet.jsx apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx
git commit -m "feat(contacts): open a contact from its own URL, reusing the existing edit sheet"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 covers Section 12/13 (API + SDK). Task 2 covers Section 9 (route) and Sections 23 edge cases 1-3.
- **No placeholders** except the explicitly-flagged "confirm exact current line numbers/imports before editing" directives (Task 1 Step 5, Task 2 Steps 1/3) — read-the-real-code directives, matching this session's established plan convention, not gaps in this plan's own logic.
- **Non-goal discipline**: no new detail-page component was designed or scaffolded (Non-goal 1) — the plan reuses `ContactFormSheet` exactly as it exists today.
