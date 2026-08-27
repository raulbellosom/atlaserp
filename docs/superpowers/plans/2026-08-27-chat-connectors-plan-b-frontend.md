# Chat Connectors — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI for the two connectors: mentioning `project`/`task`/`calendar_event` in chat messages, linking a channel to a project, scheduling a meeting from a channel, and a "próximos eventos" panel per channel.

**Architecture:** Extend existing components in place (`EntityReferencePicker`/`EntityReferenceCard`, `CreateChannelModal`, `ChannelGeneralTab`, `EventFormModal`, `ConversationProfilePanel`) following each file's existing patterns; add one new component (`ChannelEventsTab.jsx`, mirroring `ConversationMediaTab.jsx`'s section-panel shape) and one new picker sub-component (`TaskPickerCascade`, mirroring `EntityReferencePicker.jsx`'s existing `FilePickerGrid` precedent for a type that can't use the flat single-fetch `ComboboxField` path).

**Tech Stack:** React, TanStack Query, `@atlas/ui` (`ComboboxField`, `CreatableComboboxField`), react-router-dom.

**Reference spec:** `docs/superpowers/specs/2026-08-27-chat-projects-calendar-connectors-design.md`

**Depends on:** `docs/superpowers/plans/2026-08-27-chat-connectors-plan-a-backend.md` must be merged first — every task below calls an endpoint or schema field that plan introduces.

**Scope note (discovered during planning, not in the original spec text):** tasks are only listable per-project (`GET /projects/:id/tasks` — there is no cross-project task list endpoint), so the `task` entity-ref picker cannot use the same flat "fetch once by type" path as the other 6 types. Task 2 below adds a two-step (project → task) cascade instead. The "Agendar reunión" button and the "Próximos eventos" panel are scoped to `group`/`channel` conversations only (not 1:1 direct messages) — `ConversationProfilePanel.jsx` already branches its rendered sections on conversation type, so this follows the file's existing shape rather than adding a new branch.

---

### Task 1: SDK — `getLinkedChannel` + `listEvents` source filter

**Files:**
- Modify: `packages/sdk/src/domains/chat.js:51-54` (after `listChannelDirectory`)
- Modify: `packages/sdk/src/index.js:1485-1496` (`calendar.listEvents`)
- Test: `packages/sdk/src/__tests__/sdk-calendar.test.js`

- [ ] **Step 1: Write the failing test**

Append to `packages/sdk/src/__tests__/sdk-calendar.test.js` (mirrors the existing `calendar_ids` test right above it):

```js
  it('listEvents forwards source_module and source_entity_id as query params', async () => {
    const { client, fetchMock } = makeClient()
    await client.calendar.listEvents('tok', { start: '2026-01-01', end: '2026-01-31', source_module: 'atlas.chat', source_entity_id: 'conv-1' })
    const url = fetchMock.mock.calls[0][0]
    assert.ok(url.includes('source_module=atlas.chat'))
    assert.ok(url.includes('source_entity_id=conv-1'))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/sdk/src/__tests__/sdk-calendar.test.js`
Expected: FAIL — `url.includes('source_module=atlas.chat')` is `false` (current `listEvents` only reads `start`/`end`/`calendar_ids` off the query object).

- [ ] **Step 3: Implement**

In `packages/sdk/src/index.js`, replace:

```js
      listEvents: (token, query = {}) => {
        const params = new URLSearchParams();
        if (query.start) params.set("start", query.start);
        if (query.end) params.set("end", query.end);
        if (Array.isArray(query.calendar_ids)) {
          query.calendar_ids.forEach((id) => params.append("calendar_ids", id));
        }
        const qs = params.toString();
        return request(qs ? `/calendar/events?${qs}` : "/calendar/events", {
          headers: withAuthHeaders(token),
        });
      },
```

with:

```js
      listEvents: (token, query = {}) => {
        const params = new URLSearchParams();
        if (query.start) params.set("start", query.start);
        if (query.end) params.set("end", query.end);
        if (query.source_module) params.set("source_module", query.source_module);
        if (query.source_entity_id) params.set("source_entity_id", query.source_entity_id);
        if (Array.isArray(query.calendar_ids)) {
          query.calendar_ids.forEach((id) => params.append("calendar_ids", id));
        }
        const qs = params.toString();
        return request(qs ? `/calendar/events?${qs}` : "/calendar/events", {
          headers: withAuthHeaders(token),
        });
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/sdk/src/__tests__/sdk-calendar.test.js`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Add `getLinkedChannel` to the chat domain**

In `packages/sdk/src/domains/chat.js`, right after `listChannelDirectory` (before `joinChannel`), add:

```js
    // module: e.g. "atlas.projects". entityId: the linked record's id.
    // Returns { data: conversation | null } — used to decide "Crear canal"
    // vs. "Ir al canal" before the user clicks anything.
    getLinkedChannel: (module, entityId, token) =>
      request(`/chat/channels/linked${toQueryString({ module, entityId })}`, {
        headers: withAuthHeaders(token),
      }),
```

- [ ] **Step 6: Static check**

Run: `node --check packages/sdk/src/domains/chat.js && node --check packages/sdk/src/index.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/src/domains/chat.js packages/sdk/src/index.js packages/sdk/src/__tests__/sdk-calendar.test.js
git commit -m "feat(sdk): add chat.getLinkedChannel and forward source_module/source_entity_id in calendar.listEvents"
```

---

### Task 2: `EntityReferencePicker.jsx` — project, calendar_event, and cascading task

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/EntityReferencePicker.jsx`

- [ ] **Step 1: Add the 3 new types to `ENTITY_TYPES`**

Replace:

```js
const ENTITY_TYPES = [
  { value: "contact", label: "Contacto" },
  { value: "file", label: "Archivo" },
  { value: "ledger_account", label: "Cuenta contable" },
  { value: "hr_employee", label: "Colaborador" },
];
```

with:

```js
const ENTITY_TYPES = [
  { value: "contact", label: "Contacto" },
  { value: "file", label: "Archivo" },
  { value: "ledger_account", label: "Cuenta contable" },
  { value: "hr_employee", label: "Colaborador" },
  { value: "project", label: "Proyecto" },
  { value: "task", label: "Tarea" },
  { value: "calendar_event", label: "Evento" },
];
```

- [ ] **Step 2: Extend `fetchOptions` for `project` and `calendar_event`**

In `fetchOptions`, right before the final `return [];`, add:

```js
  if (entityType === "project") {
    const res = await atlas.projects.listProjects(token);
    return (res?.data ?? []).map((p) => ({ label: p.name, value: p.id }));
  }
  if (entityType === "calendar_event") {
    // A fixed 90-days-back / 365-days-ahead window — this is a "mention an
    // event you'd realistically want to reference," not the full calendar
    // history. listEvents requires start/end (calendar-event-service.js
    // throws 400 without them).
    const now = Date.now();
    const start = new Date(now - 90 * 86400000).toISOString();
    const end = new Date(now + 365 * 86400000).toISOString();
    const res = await atlas.calendar.listEvents(token, { start, end });
    return (res ?? []).map((e) => ({ label: e.title, value: e.id }));
  }
```

`task` is deliberately NOT added here — see Step 3.

- [ ] **Step 3: Add the `TaskPickerCascade` sub-component**

Right before `export function EntityReferencePicker`, add:

```js
// `task` can't use the flat fetchOptions path: GET /projects/:id/tasks is
// per-project only, there's no cross-project task list endpoint. Mirrors
// FilePickerGrid's precedent just above (a type-specific sub-component
// instead of forcing every type through the same single ComboboxField).
function TaskPickerCascade({ token, onPick }) {
  const [projectId, setProjectId] = useState(null);

  const projectsQuery = useQuery({
    queryKey: ["chat-entity-ref-task-projects", token],
    queryFn: async () => {
      const res = await atlas.projects.listProjects(token);
      return (res?.data ?? []).map((p) => ({ label: p.name, value: p.id }));
    },
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const tasksQuery = useQuery({
    queryKey: ["chat-entity-ref-task-tasks", projectId, token],
    queryFn: async () => {
      const res = await atlas.projects.listTasks(projectId, {}, token);
      return (res?.data ?? []).map((t) => ({ label: t.title, value: t.id }));
    },
    enabled: Boolean(projectId && token),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-2">
      <ComboboxField
        label="Proyecto"
        options={projectsQuery.data ?? []}
        value={projectId}
        onChange={setProjectId}
        placeholder="Selecciona un proyecto..."
        emptyText={projectsQuery.isLoading ? "Cargando..." : "Sin resultados"}
      />
      {projectId && (
        <ComboboxField
          label="Tarea"
          options={tasksQuery.data ?? []}
          value={null}
          onChange={(recordId) => {
            const opt = (tasksQuery.data ?? []).find((o) => o.value === recordId);
            if (!opt) return;
            onPick(recordId, opt.label);
          }}
          placeholder="Buscar tarea..."
          emptyText={tasksQuery.isLoading ? "Cargando..." : "Sin tareas en este proyecto"}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire `TaskPickerCascade` into the picker's render branch**

Inside `export function EntityReferencePicker`, replace:

```js
  const [entityType, setEntityType] = useState(null);
  const isFileType = entityType === "file";
```

with:

```js
  const [entityType, setEntityType] = useState(null);
  const isFileType = entityType === "file";
  const isTaskType = entityType === "task";
```

Then replace:

```js
        {entityType && isFileType && (
          <FilePickerGrid
            options={optionsQuery.data ?? []}
            isLoading={optionsQuery.isLoading}
            maxSelect={maxSelect}
            onConfirm={handleConfirmFiles}
          />
        )}
        {entityType && !isFileType && (
```

with:

```js
        {entityType && isFileType && (
          <FilePickerGrid
            options={optionsQuery.data ?? []}
            isLoading={optionsQuery.isLoading}
            maxSelect={maxSelect}
            onConfirm={handleConfirmFiles}
          />
        )}
        {entityType && isTaskType && (
          <TaskPickerCascade token={token} onPick={handlePick} />
        )}
        {entityType && !isFileType && !isTaskType && (
```

Also update the `optionsQuery` hook (right below the `isFileType`/`isTaskType` declarations) so it doesn't fire a wasted fetch for `task` (which has no flat `fetchOptions` case):

Replace:

```js
  const optionsQuery = useQuery({
    queryKey: ["chat-entity-ref-options", entityType, token],
    queryFn: () => fetchOptions(entityType, token),
    enabled: Boolean(entityType && token),
    staleTime: 30_000,
  });
```

with:

```js
  const optionsQuery = useQuery({
    queryKey: ["chat-entity-ref-options", entityType, token],
    queryFn: () => fetchOptions(entityType, token),
    enabled: Boolean(entityType && token && entityType !== "task"),
    staleTime: 30_000,
  });
```

- [ ] **Step 5: Widen the popover for the task cascade (two stacked combobox fields need more room than `w-72`)**

Replace:

```js
      <PopoverContent side="top" align="start" className={["p-3 space-y-2", isFileType ? "w-96" : "w-72"].join(" ")}>
```

with:

```js
      <PopoverContent side="top" align="start" className={["p-3 space-y-2", isFileType ? "w-96" : "w-72", isTaskType ? "min-w-72" : ""].join(" ")}>
```

- [ ] **Step 6: Static check**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/EntityReferencePicker.jsx`

This file is JSX, so `node --check` will reject it (JSX is not valid Node.js syntax) — use the project's Vite build check instead:

Run: `pnpm --filter @atlas/desktop build`
Expected: build succeeds, no errors referencing `EntityReferencePicker.jsx`.

- [ ] **Step 7: Manual verification (per CLAUDE.md — UI changes need a real browser check)**

With `pnpm dev` running, open a channel, open the message composer's entity-reference picker, select "Proyecto" — confirm the combobox lists real projects and picking one closes the popover and adds a chip to the composer. Repeat for "Evento". For "Tarea", confirm the project combobox appears first, then the task combobox appears only after a project is picked, and picking a task adds the chip.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/EntityReferencePicker.jsx
git commit -m "feat(chat): add project/task/calendar_event to the entity reference picker"
```

---

### Task 3: `EntityReferenceCard.jsx` — render project/task/calendar_event

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx`

- [ ] **Step 1: Add icons for the 3 new types**

Replace:

```js
import { User, Paperclip, Landmark, IdCard, ExternalLink } from "lucide-react";
import { useFileRefSignedUrl } from "../hooks/useFileRefSignedUrl";

const ICON_BY_TYPE = { contact: User, file: Paperclip, ledger_account: Landmark, hr_employee: IdCard };
```

with:

```js
import { User, Paperclip, Landmark, IdCard, ExternalLink, SquareKanban, CheckSquare, CalendarDays } from "lucide-react";
import { useFileRefSignedUrl } from "../hooks/useFileRefSignedUrl";

const ICON_BY_TYPE = {
  contact: User, file: Paperclip, ledger_account: Landmark, hr_employee: IdCard,
  project: SquareKanban, task: CheckSquare, calendar_event: CalendarDays,
};
```

(`SquareKanban` matches the icon already used for the `atlas.projects` module manifest — see `apps/api/src/manifests/official/feature-modules.js:736`.)

No further changes are needed in this file: `project`/`task`/`calendar_event` references only ever carry `title` + optional `subtitle` (no photo, no balance), which the existing generic render path (the `<div className="min-w-0 flex-1">...</div>` block) already handles for every type that isn't `hr_employee`/`ledger_account`. `color`/`icon` (returned for `project` by the backend resolver) are not rendered on the card in this iteration — YAGNI: the title/subtitle/navigate-on-click behavior is what the spec's acceptance criteria (§9) actually requires.

- [ ] **Step 2: Manual verification**

Send a message with a project/task/event mention (from Task 2's picker) and confirm the rendered chip shows the correct icon, title, and navigates to the right detail screen on click.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx
git commit -m "feat(chat): render project/task/calendar_event entity reference cards"
```

---

### Task 4: `CreateChannelModal.jsx` — "Vincular a proyecto" field

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx`

- [ ] **Step 1: Import `ComboboxField` and the projects hook**

Replace:

```js
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Textarea, Switch, Label,
} from "@atlas/ui";
import { Hash } from "lucide-react";
import { useCreateChannel } from "../hooks/useChannels";
```

with:

```js
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Textarea, Switch, Label, ComboboxField,
} from "@atlas/ui";
import { Hash } from "lucide-react";
import { useCreateChannel } from "../hooks/useChannels";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useQuery } from "@tanstack/react-query";
```

- [ ] **Step 2: Add state + a projects query**

Replace:

```js
export function CreateChannelModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState(null);
  const { mutateAsync: createChannel, isPending } = useCreateChannel();
```

with:

```js
export function CreateChannelModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState(null);
  const [error, setError] = useState(null);
  const { mutateAsync: createChannel, isPending } = useCreateChannel();
  const { session } = useAuth();
  const token = session?.access_token;
  const projectsQuery = useQuery({
    queryKey: ["chat-create-channel-projects", token],
    queryFn: async () => {
      const res = await atlas.projects.listProjects(token);
      return (res?.data ?? []).map((p) => ({ label: p.name, value: p.id }));
    },
    enabled: Boolean(open && token),
    staleTime: 30_000,
  });
```

- [ ] **Step 3: Reset the new field, include it in the create payload**

Replace:

```js
  function reset() {
    setTitle("");
    setDescription("");
    setIsPublic(true);
    setSlug("");
    setSlugEdited(false);
    setError(null);
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setError(null);
    try {
      const result = await createChannel({
        title: title.trim(),
        description: description.trim() || undefined,
        isPublic,
        slug: effectiveSlug || undefined,
      });
```

with:

```js
  function reset() {
    setTitle("");
    setDescription("");
    setIsPublic(true);
    setSlug("");
    setSlugEdited(false);
    setLinkedProjectId(null);
    setError(null);
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setError(null);
    try {
      const result = await createChannel({
        title: title.trim(),
        description: description.trim() || undefined,
        isPublic,
        slug: effectiveSlug || undefined,
        linkedModule: linkedProjectId ? "atlas.projects" : undefined,
        linkedEntityId: linkedProjectId ?? undefined,
      });
```

- [ ] **Step 4: Add the field to the form**

Replace:

```js
          <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Canal publico</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Cualquiera en tu empresa puede encontrarlo y unirse.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
```

with:

```js
          <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Canal publico</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Cualquiera en tu empresa puede encontrarlo y unirse.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <div className="space-y-1.5">
            <Label>Proyecto vinculado (opcional)</Label>
            <ComboboxField
              options={projectsQuery.data ?? []}
              value={linkedProjectId}
              onChange={setLinkedProjectId}
              placeholder="Buscar proyecto..."
              emptyText={projectsQuery.isLoading ? "Cargando..." : "Sin resultados"}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
```

- [ ] **Step 5: Handle the 409 "already linked" error with a clear message**

Replace:

```js
    } catch (err) {
      setError(err?.message ?? "Error creando canal.");
    }
  }
```

with:

```js
    } catch (err) {
      setError(err?.status === 409 ? "Ese proyecto ya tiene un canal vinculado." : (err?.message ?? "Error creando canal."));
    }
  }
```

- [ ] **Step 6: Manual verification**

Build and open the app, create a channel with a linked project, confirm it succeeds; try creating a second channel linked to the same project and confirm the 409 message shows instead of a generic error.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx
git commit -m "feat(chat): link a project when creating a channel"
```

---

### Task 5: `ChannelGeneralTab.jsx` — link/unlink an existing channel to a project

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx`

- [ ] **Step 1: Import `ComboboxField` and add a projects query**

Replace:

```js
import { Button, Popover, PopoverTrigger, PopoverContent, ImageViewer } from "@atlas/ui";
```

with:

```js
import { Button, Popover, PopoverTrigger, PopoverContent, ImageViewer, ComboboxField, Label } from "@atlas/ui";
```

Then, right after the `const ownMember = ...` / `const canManage = ...` lines, add:

```js
  const isChannel = conversation?.type === "channel";
  const projectsQuery = useQuery({
    queryKey: ["chat-channel-tab-projects", token],
    queryFn: async () => {
      const res = await atlas.projects.listProjects(token);
      return (res?.data ?? []).map((p) => ({ label: p.name, value: p.id }));
    },
    enabled: Boolean(isChannel && token),
    staleTime: 30_000,
  });
```

- [ ] **Step 2: Add the link mutation (reuses the existing `updateMutation` shape but with its own error message)**

Right after the existing `updateMutation` block, add:

```js
  const linkMutation = useMutation({
    mutationFn: (linkedProjectId) => atlas.chat.updateConversation(conversationId, {
      linkedModule: linkedProjectId ? "atlas.projects" : null,
      linkedEntityId: linkedProjectId,
    }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: (err) => toast.error(err?.status === 409 ? "Ese proyecto ya tiene un canal vinculado." : "No se pudo vincular el proyecto."),
  });
```

- [ ] **Step 3: Render the field (channel-only, gated by `canManage` like the avatar controls above it)**

Right before the closing `</div>` of the component's root (after the existing `{!canManage && (...)}` block and before `<ImageViewer .../>`), add:

```js
      {isChannel && (
        <div className="space-y-1.5">
          <Label>Proyecto vinculado</Label>
          <ComboboxField
            options={projectsQuery.data ?? []}
            value={conversation?.linked_module === "atlas.projects" ? conversation.linked_entity_id : null}
            onChange={(projectId) => linkMutation.mutate(projectId)}
            placeholder="Buscar proyecto..."
            emptyText={projectsQuery.isLoading ? "Cargando..." : "Sin resultados"}
            disabled={!canManage || linkMutation.isPending}
          />
          {conversation?.linked_module === "atlas.projects" && canManage && (
            <button
              type="button"
              onClick={() => linkMutation.mutate(null)}
              disabled={linkMutation.isPending}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
            >
              Quitar vinculo
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 4: Manual verification**

Open a channel's General settings, link it to a project, confirm the combobox reflects the selection after a refetch; click "Quitar vinculo" and confirm it clears. Try linking two different channels to the same project and confirm the second one shows the 409 toast.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
git commit -m "feat(chat): link/unlink an existing channel to a project from channel settings"
```

---

### Task 6: `EventFormModal.jsx` — pre-filled attendees + source linking

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/components/EventFormModal.jsx`

- [ ] **Step 1: Accept the new props**

Replace:

```js
export default function EventFormModal({
  event,
  defaultDate,
  defaultCalendarId,
  onClose,
  onSaved,
}) {
```

with:

```js
export default function EventFormModal({
  event,
  defaultDate,
  defaultCalendarId,
  // Opened-from-chat context (Spec A §5 "Agendar reunión"): fixed, non-editable
  // for this iteration (YAGNI — no attendee-editing UI is added here, only
  // pass-through of what the caller already knows). sourceModule/sourceEntityId
  // only apply to NEW events; they're not sent on update.
  initialAttendeeIds,
  sourceModule,
  sourceEntityId,
  onClose,
  onSaved,
}) {
```

- [ ] **Step 2: Include `attendeeIds`/`sourceModule`/`sourceEntityId` in the create payload**

Replace:

```js
    if (!isEdit && form.reminderMinutes && form.reminderMinutes !== "NONE") {
      payload.reminderMinutes = [Number(form.reminderMinutes)];
    }
```

with:

```js
    if (!isEdit && form.reminderMinutes && form.reminderMinutes !== "NONE") {
      payload.reminderMinutes = [Number(form.reminderMinutes)];
    }
    if (!isEdit && initialAttendeeIds?.length) {
      payload.attendeeIds = initialAttendeeIds;
    }
    if (!isEdit && sourceModule && sourceEntityId) {
      payload.sourceModule = sourceModule;
      payload.sourceEntityId = sourceEntityId;
    }
```

- [ ] **Step 3: Show a read-only note when opened with fixed attendees**

Right after the `<DialogDescription>`-less header (i.e. right after `<DialogHeader>...</DialogHeader>`, before the first form field — find the exact insertion point by locating the opening `<form onSubmit={handleSubmit}>` or first `<TextField` for `title`), add:

```jsx
        {!isEdit && initialAttendeeIds?.length > 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] px-1">
            Se invitará a los {initialAttendeeIds.length} miembros de esta conversación.
          </p>
        )}
```

(Insert this as a sibling right before the first form field, inside whatever wrapping element already holds `title`'s `TextField` — match the existing JSX indentation at that point rather than the 8-space example above.)

- [ ] **Step 4: Manual verification**

Confirm editing an existing event still works unchanged (no `attendeeIds`/`sourceModule` sent, no note shown). This full flow is exercised end-to-end in Task 7's manual check below.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/EventFormModal.jsx
git commit -m "feat(calendar): EventFormModal accepts initialAttendeeIds/sourceModule/sourceEntityId for new events"
```

---

### Task 7: `ChannelEventsTab.jsx` + "Agendar reunión" wiring

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ChannelEventsTab.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx` (the "Agendar reunión" button)
- Modify: `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx` (wire the new tab section)

- [ ] **Step 1: Create `ChannelEventsTab.jsx`**

```jsx
// apps/desktop/src/modules/atlas.chat/components/ChannelEventsTab.jsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@atlas/ui";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// Same source-filter idea as EntityReferencePicker's calendar_event case:
// listEvents requires start/end, so this uses a fixed 90-days-back /
// 365-days-ahead window rather than the calendar screen's own navigable range.
function useChannelEventsWindow() {
  const now = Date.now();
  return {
    start: new Date(now - 90 * 86400000).toISOString(),
    end: new Date(now + 365 * 86400000).toISOString(),
  };
}

function EventRow({ event }) {
  const date = new Date(event.startAt);
  const label = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[hsl(var(--border))] last:border-0">
      <CalendarDays className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{event.title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      </div>
    </div>
  );
}

export function ChannelEventsTab({ conversationId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { start, end } = useState(useChannelEventsWindow)[0];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["channel-events", conversationId],
    queryFn: () => atlas.calendar.listEvents(token, {
      start, end, source_module: "atlas.chat", source_entity_id: conversationId,
    }),
    enabled: Boolean(token && conversationId),
    staleTime: 30_000,
  });

  const events = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 py-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  if (isError) {
    return <ErrorState description="No se pudieron cargar los eventos." onRetry={refetch} />;
  }

  if (!events.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Sin eventos"
        description="Las reuniones agendadas desde este canal apareceran aqui."
      />
    );
  }

  return (
    <div className="flex flex-col">
      {events.map((event) => <EventRow key={event.id} event={event} />)}
    </div>
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

There is no dedicated test file for `ConversationMediaTab.jsx` (the pattern this mirrors), so this component follows suit — verified via Step 6's build check and Step 7's manual check instead of a unit test.

- [ ] **Step 3: Add the "Agendar reunión" button to `ChannelGeneralTab.jsx`**

In `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx`, import the modal and add state:

Replace:

```js
import { useRef, useState } from "react";
```

with:

```js
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import EventFormModal from "../../atlas.calendar/components/EventFormModal";
```

Add state and a navigate hook right after `const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);`:

```js
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const navigate = useNavigate();
```

Add the button inside the `{isChannel && (...)}` block from Task 5 Step 3, right after the "Quitar vinculo" button's closing `)}`:

```js
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1"
            onClick={() => setScheduleOpen(true)}
          >
            Agendar reunion
          </Button>
```

Add the modal right before the closing `<ImageViewer .../>` render:

```jsx
      {scheduleOpen && (
        <EventFormModal
          initialAttendeeIds={(conversation?.members ?? []).map((m) => m.userId)}
          sourceModule="atlas.chat"
          sourceEntityId={conversationId}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => {
            setScheduleOpen(false);
            queryClient.invalidateQueries({ queryKey: ["channel-events", conversationId] });
          }}
        />
      )}
```

- [ ] **Step 4: Wire the new section into `ConversationProfilePanel.jsx`**

In `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`, replace the import block's calendar-related line (add a new import) — replace:

```js
import { ConversationMediaTab } from "./ConversationMediaTab";
```

with:

```js
import { ConversationMediaTab } from "./ConversationMediaTab";
import { ChannelEventsTab } from "./ChannelEventsTab";
```

Also add `Calendar` to the lucide-react import (there's already a `Calendar` icon imported for something else — check first: this file currently imports `{ ArrowLeft, Info, FolderOpen, Users, Bell, Settings, Shield }`, no `Calendar`, so add it):

Replace:

```js
import { ArrowLeft, Info, FolderOpen, Users, Bell, Settings, Shield } from "lucide-react";
```

with:

```js
import { ArrowLeft, Info, FolderOpen, Users, Bell, Settings, Shield, CalendarDays } from "lucide-react";
```

Then, in the "group / channel" render branch, add the new section right after the `media` section and before `notifications`:

Replace:

```js
        <div data-section="media">
          <SectionHeader icon={FolderOpen} label="Multimedia" />
          <ConversationMediaTab messages={messages} isLoading={isLoadingMessages} preview onShowAll={onShowAllFiles} />
        </div>
        <div data-section="notifications">
          <SectionHeader icon={Bell} label="Notificaciones" />
          <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
        </div>
      </div>
      {avatarViewer}
    </>
  );
}
```

(this is the group/channel branch — the direct-conversation branch above it also has a `media`/`notifications` pair, do NOT touch that one) with:

```js
        <div data-section="media">
          <SectionHeader icon={FolderOpen} label="Multimedia" />
          <ConversationMediaTab messages={messages} isLoading={isLoadingMessages} preview onShowAll={onShowAllFiles} />
        </div>
        <div data-section="events">
          <SectionHeader icon={CalendarDays} label="Eventos" />
          <ChannelEventsTab conversationId={conversationId} />
        </div>
        <div data-section="notifications">
          <SectionHeader icon={Bell} label="Notificaciones" />
          <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
        </div>
      </div>
      {avatarViewer}
    </>
  );
}
```

- [ ] **Step 5: Static/build check**

Run: `pnpm --filter @atlas/desktop build`
Expected: build succeeds, no errors referencing `ChannelEventsTab.jsx`, `ChannelGeneralTab.jsx`, or `ConversationProfilePanel.jsx`.

- [ ] **Step 6: Manual verification (per CLAUDE.md — this is a UI change, must be checked in a real browser)**

With `pnpm dev` running:
1. Open a channel's profile panel, scroll to "Eventos" — confirm it shows the empty state initially.
2. In "General", click "Agendar reunion" — confirm the modal opens with the note "Se invitará a los N miembros de esta conversación" and no attendee-editing UI.
3. Fill title/date, save — confirm the modal closes and the new event appears in the "Eventos" section after the query refetches.
4. Reload the page and confirm the event is still listed (data actually persisted with the right `sourceModule`/`sourceEntityId`, not just optimistic UI).
5. Screenshot both 390px and 1440px viewports per the responsive-QA checklist (`docs/ai-context/ui-screen-audit-checklist.md`).

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChannelEventsTab.jsx apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx
git commit -m "feat(chat): add ChannelEventsTab and 'Agendar reunion' action to channel settings"
```

---

### Task 8: `ProjectsScreen.jsx` — "Crear canal de chat" / "Ir al canal"

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx`

- [ ] **Step 1: Add imports and a linked-channel query**

Add to the existing lucide-react import (currently `Plus, LayoutGrid, List, Calendar, Settings2, Users, Menu, X, SlidersHorizontal, Download`):

Replace:

```js
import {
  Plus,
  LayoutGrid,
  List,
  Calendar,
  Settings2,
  Users,
  Menu,
  X,
  SlidersHorizontal,
  Download,
} from "lucide-react";
import { Button, Badge, EmptyState, ErrorState, LoadingState } from "@atlas/ui";
import { useProjects, useWorkspaceUsers } from "../hooks/useProjectsData";
import { useProjectRealtime } from "../hooks/useProjectRealtime";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";
import { toast } from "sonner";
```

with:

```js
import {
  Plus,
  LayoutGrid,
  List,
  Calendar,
  Settings2,
  Users,
  Menu,
  X,
  SlidersHorizontal,
  Download,
  MessageSquare,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, Badge, EmptyState, ErrorState, LoadingState } from "@atlas/ui";
import { useProjects, useWorkspaceUsers } from "../hooks/useProjectsData";
import { useProjectRealtime } from "../hooks/useProjectRealtime";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";
import { toast } from "sonner";
```

(`useNavigate`/`useQuery`/`useMutation`/`useQueryClient` may already be imported elsewhere in this 850+-line file under a different name grouping — if so, merge into the existing import statements instead of duplicating them; check with `grep -n "from \"react-router-dom\"\|from \"@tanstack/react-query\"" apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx` before editing.)

- [ ] **Step 2: Add state + query + mutation inside the component**

Right after the existing `const { session } = useAuth();`-equivalent line (this screen calls `atlas.*` directly with a token — find where `token` is obtained; if not already present, add `const { session } = useAuth(); const token = session?.access_token;` near the top of the component body, right after the existing hook calls), add:

```js
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selectedProject = (projects?.data ?? projects ?? []).find((p) => p.id === selectedId) ?? null;

  const linkedChannelQuery = useQuery({
    queryKey: ["project-linked-channel", selectedId],
    queryFn: async () => {
      const res = await atlas.chat.getLinkedChannel("atlas.projects", selectedId, token);
      return res?.data ?? null;
    },
    enabled: Boolean(selectedId && token),
    staleTime: 30_000,
  });

  const createChannelMutation = useMutation({
    mutationFn: async () => {
      const membersRes = await atlas.projects.listMembers(selectedId, token);
      const memberUserIds = (membersRes?.data ?? []).map((m) => m.userId).filter(Boolean);
      return atlas.chat.createChannel({
        title: selectedProject?.name ?? "Proyecto",
        linkedModule: "atlas.projects",
        linkedEntityId: selectedId,
        memberUserIds,
      }, token);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["project-linked-channel", selectedId] });
      const conversationId = res?.data?.id;
      if (conversationId) navigate(`/app/m/atlas.chat/chat/inbox/${conversationId}`);
    },
    onError: () => toast.error("No se pudo crear el canal."),
  });

  function handleChatChannelClick() {
    const existing = linkedChannelQuery.data;
    if (existing?.id) {
      navigate(`/app/m/atlas.chat/chat/inbox/${existing.id}`);
    } else {
      createChannelMutation.mutate();
    }
  }
```

- [ ] **Step 3: Add the button**

Find the toolbar button group that already renders `Settings2`/`Users`-icon buttons (search for `<Users` in this file to locate the "Miembros" button, since that's the closest existing sibling action) and add, right next to it:

```jsx
      {selectedId && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleChatChannelClick}
          disabled={createChannelMutation.isPending || linkedChannelQuery.isLoading}
          title={linkedChannelQuery.data?.id ? "Ir al canal" : "Crear canal de chat"}
        >
          <MessageSquare className="h-4 w-4 mr-1.5" />
          {linkedChannelQuery.data?.id ? "Ir al canal" : "Crear canal"}
        </Button>
      )}
```

(Match this button's exact size/variant/spacing to whatever the neighboring `Users`/`Settings2` buttons in this toolbar already use — read the surrounding JSX before inserting, since this 850+-line screen's toolbar markup wasn't fully quoted in this plan; keep the visual language identical to its siblings rather than introducing a new button style.)

- [ ] **Step 4: Build check**

Run: `pnpm --filter @atlas/desktop build`
Expected: build succeeds, no errors referencing `ProjectsScreen.jsx`.

- [ ] **Step 5: Manual verification**

Open a project with no linked channel, click "Crear canal" — confirm it navigates to a new chat channel whose members match the project's members. Go back to that same project, confirm the button now reads "Ir al canal" and clicking it navigates straight there without creating a duplicate.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx
git commit -m "feat(projects): add 'Crear canal de chat' / 'Ir al canal' action to project toolbar"
```

---

### Task 9: Full frontend verification

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: no new errors in any file touched by this plan.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: succeeds for `apps/desktop`, `packages/sdk`, `packages/validators`.

- [ ] **Step 3: Full manual pass through the spec's acceptance criteria**

Re-run every "Manual verification" step from Tasks 2, 3, 4, 5, 7, and 8 in one sitting against a fresh `pnpm dev` session, at both 390px and 1440px viewport widths per `docs/ai-context/ui-screen-audit-checklist.md`.

- [ ] **Step 4: Confirm no touched file exceeds the 1000-line soft limit**

Run: `wc -l apps/desktop/src/modules/atlas.chat/components/EntityReferencePicker.jsx apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx apps/desktop/src/modules/atlas.calendar/components/EventFormModal.jsx`
Expected: all well under 1000 (none of these were near the limit before this plan; the additions in each task are small).

---

## Plan Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-08-27-chat-projects-calendar-connectors-design.md`):
- §5 "Menciones" → Tasks 2, 3.
- §5 "Vínculo canal↔proyecto" (crear desde Proyectos, crear con vínculo desde Chat, vincular canal existente) → Tasks 4, 5, 8.
- §5 "Agendar reunión desde el chat" → Tasks 6, 7.
- §5 "Panel de próximos eventos" → Task 7.
- §11 "Fuera de alcance" (no calling UI) → respected; no task in this plan adds any call-related affordance.

**Placeholder scan:** none, except two explicitly-flagged spots where this plan tells the implementer to read the actual surrounding file before inserting (Task 8 Steps 1/3, and Task 6 Step 3) — these are not vague instructions to "figure it out," they're precise insertion points in files too large to fully quote here (`ProjectsScreen.jsx` is 850+ lines), paired with an exact code block to insert and an exact anchor to find it by.

**Type/name consistency:** `atlas.chat.getLinkedChannel(module, entityId, token)` (Task 1) is called with that exact argument order in Task 8. `atlas.chat.createChannel({..., linkedModule, linkedEntityId})` (Task 4, Task 8) and `atlas.chat.updateConversation(id, {linkedModule, linkedEntityId}, token)` (Task 5) match Plan A's `chatCreateChannelSchema`/`chatUpdateConversationSchema` field names exactly. `EventFormModal`'s new props (`initialAttendeeIds`, `sourceModule`, `sourceEntityId`) are named identically in Task 6 (definition) and Task 7 (usage).
