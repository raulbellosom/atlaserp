# atlas.calls — Invite panel close, access mode, restore-from-minimized fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Aún no hay nadie más" invite card dismissable, expose a "PIN (con aprobación) vs libre acceso" choice per-call and per-conversation, and fix restoring a minimized call on web.

**Architecture:** Frontend-only. The backend already has `callLink.requireLobby` (per-conversation, persistent) and `call-guest-service.js` already branches on it — so the access-mode work is purely surfacing that field in two React components. The invite-panel dismissal is a boolean on the `CallRoom` instance. The restore bug is a pointer-capture timing fix in `MiniCallBubble`.

**Tech Stack:** React 19, `@atlas/ui` (`SwitchField`), `@atlas/sdk` (`atlas.calls.getLink/createLink/updateLink`), TanStack Query, `lucide-react`, `sonner`. No backend, no Prisma, no validators.

---

## Deviations from the spec

The design doc named a `SelectField` for the per-call access control. During file
review the control was changed to fit each surface better:

- **`CallInvitePanel`** is a bespoke dark card (`bg-slate-900/90 text-slate-100`),
  not a themed surface. A themed `SelectField` dropped on it follows the app theme
  and clashes in light mode. Use a **two-button segmented toggle** styled with the
  card's own slate/violet palette (plain `<button>`s — not a native `<select>`,
  so the UI-first policy is satisfied; mirrors the card's existing styled copy
  buttons).
- **`ChannelGeneralTab`** renders on a themed dialog surface and already uses
  `SwitchField` for "Solo administradores pueden escribir". Use a **`SwitchField`**
  ("Libre acceso a las llamadas") right below it for consistency with the file.

Both still name the two modes explicitly, which was the spec's rationale for
`SelectField`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/calls/MiniCallBubble.jsx` | Floating minimized-call widget | Defer `setPointerCapture` until a drag actually starts; restore via `onClick` guarded by a "last gesture was a drag" ref |
| `apps/desktop/src/modules/atlas.chat/calls/CallInvitePanel.jsx` | The "Aún no hay nadie más" card | Add `onClose` prop + X button; add segmented access-mode toggle wired to `atlas.calls.updateLink` |
| `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx` | Call room container | `inviteDismissed` state; gate the `invitePanel` prop on it; pass `onClose` |
| `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx` | "General" tab of the channel settings panel | Add "Libre acceso a las llamadas" `SwitchField`, read via `getLink`, write via `updateLink` (create-on-first-write) |

No test files. `MiniCallBubble` and `CallInvitePanel` are pure DOM with no
extractable pure logic; the atlas.chat frontend has no component-test harness
(Node's built-in runner + jsdom is not wired for these). Verification is
`eslint` + a Vite production build + a manual QA checklist (Task 5).

---

## Task 1: Fix restore-from-minimized on web (`MiniCallBubble`)

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/MiniCallBubble.jsx`

Root cause: `onPointerDown` calls `nodeRef.current.setPointerCapture(pointerId)`
unconditionally. Once the container has captured the pointer, `pointerup` is
retargeted to the container, so the inner restore `<button>`'s `onPointerUp`
(which calls `onRestore`) never fires for a mouse on desktop.

Fix: only capture once the drag threshold is crossed, and trigger restore from the
DOM `click` event (which is hit-tested to the button regardless of capture),
guarded by a ref that records whether the just-finished gesture was a drag.

- [ ] **Step 1: Add the gesture-guard ref**

In the component body, next to `const dragRef = useRef(null);` (currently line 42),
add:

```jsx
  const dragRef = useRef(null);
  // Set by endDrag before it clears dragRef, read by the restore button's
  // onClick — a click that ends a drag must not restore the call.
  const lastGestureWasDrag = useRef(false);
```

- [ ] **Step 2: Rewrite `onPointerDown` / `onPointerMove` / `endDrag`, drop `wasDrag`**

Replace this block (currently lines 73–103):

```jsx
  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos ? pos.x : rect.left,
      originY: pos ? pos.y : rect.top,
      moved: false,
    };
    node.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > TAP_THRESHOLD_PX) d.moved = true;
    if (!d.moved) return;
    setPos(clamp(d.originX + dx, d.originY + dy));
  };
  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    nodeRef.current?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };
  const wasDrag = () => Boolean(dragRef.current?.moved);
```

with:

```jsx
  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    lastGestureWasDrag.current = false;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos ? pos.x : rect.left,
      originY: pos ? pos.y : rect.top,
      moved: false,
      captured: false,
    };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > TAP_THRESHOLD_PX) d.moved = true;
    if (!d.moved) return;
    // Capture only now that this is really a drag. Capturing on pointerdown
    // retargets pointerup away from the restore <button> and breaks
    // click-to-restore with a mouse.
    if (!d.captured) {
      nodeRef.current?.setPointerCapture?.(e.pointerId);
      d.captured = true;
    }
    setPos(clamp(d.originX + dx, d.originY + dy));
  };
  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    lastGestureWasDrag.current = d.moved;
    if (d.captured) nodeRef.current?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };
```

- [ ] **Step 3: Restore on `click`, not `pointerup`**

Replace the restore button's opening tag (currently lines 122–126):

```jsx
      <button
        type="button"
        onPointerUp={(e) => { if (!wasDrag()) onRestore?.(); endDrag(e); }}
        title="Volver a la llamada"
        className="relative block aspect-video w-full bg-slate-950"
      >
```

with:

```jsx
      <button
        type="button"
        onPointerUp={endDrag}
        onClick={() => { if (!lastGestureWasDrag.current) onRestore?.(); }}
        title="Volver a la llamada"
        className="relative block aspect-video w-full bg-slate-950"
      >
```

(The container already has `onPointerUp={endDrag}`; a plain click runs the
button's `endDrag` first — recording `moved: false` — then `onClick` restores.
A drag ends on the captured container, sets `lastGestureWasDrag.current = true`,
so the trailing `click` is ignored.)

- [ ] **Step 4: Lint the file**

Run: `pnpm exec eslint apps/desktop/src/modules/atlas.chat/calls/MiniCallBubble.jsx`
Expected: no errors. (`wasDrag` is gone — confirm no "unused" or "not defined".)

- [ ] **Step 5: Type-check via a web build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds (exit 0). This is the compile check for JSX — `node --check` cannot parse JSX.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/MiniCallBubble.jsx
git commit -m "fix(calls): restore a minimized call on web — defer pointer capture to real drags

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Make the invite panel closable

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallInvitePanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx`

- [ ] **Step 1: Import the `X` icon in `CallInvitePanel`**

Change (currently line 3):

```jsx
import { Copy, Check, Send, Users } from "lucide-react";
```

to:

```jsx
import { Copy, Check, Send, Users, X } from "lucide-react";
```

- [ ] **Step 2: Accept an `onClose` prop**

Change (currently line 18):

```jsx
export function CallInvitePanel({ conversationId }) {
```

to:

```jsx
export function CallInvitePanel({ conversationId, onClose }) {
```

- [ ] **Step 3: Add the X button to the header row**

Replace the header (currently lines 63–65):

```jsx
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-slate-400" /> Aún no hay nadie más
      </div>
```

with:

```jsx
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-slate-400" />
        <span className="flex-1">Aún no hay nadie más</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
```

- [ ] **Step 4: Add `inviteDismissed` state in `CallRoom`**

In `CallRoom.jsx`, next to the other `useState` calls (e.g. after
`const [hasRemoteJoined, setHasRemoteJoined] = useState(false);`, currently line 57),
add:

```jsx
  // The host can dismiss the "add people" card; it stays gone for the rest of
  // this call (a new call gets a fresh CallRoom).
  const [inviteDismissed, setInviteDismissed] = useState(false);
```

- [ ] **Step 5: Gate the `invitePanel` prop on it**

Replace (currently lines 525–527):

```jsx
        invitePanel: isInitiator && isAlone
          ? <CallInvitePanel conversationId={conversationId} />
          : null,
```

with:

```jsx
        invitePanel: isInitiator && isAlone && !inviteDismissed
          ? <CallInvitePanel conversationId={conversationId} onClose={() => setInviteDismissed(true)} />
          : null,
```

- [ ] **Step 6: Lint both files**

Run: `pnpm exec eslint apps/desktop/src/modules/atlas.chat/calls/CallInvitePanel.jsx apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx`
Expected: no errors.

- [ ] **Step 7: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallInvitePanel.jsx apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx
git commit -m "feat(calls): let the host dismiss the invite card for the rest of the call

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Per-call access mode in `CallInvitePanel`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallInvitePanel.jsx`

`link` (from `atlas.calls.createLink`) already carries `requireLobby`. Add a
segmented toggle; on change call `atlas.calls.updateLink` and keep local state in
sync, reverting on failure.

- [ ] **Step 1: Add the `changeAccess` handler**

In the component body, after the `send` function (currently ends line 59), add:

```jsx
  async function changeAccess(mode) {
    const requireLobby = mode === "lobby";
    if (!link || requireLobby === link.requireLobby) return;
    const prev = link;
    setLink({ ...link, requireLobby });
    try {
      const r = await atlas.calls.updateLink(conversationId, { requireLobby }, token);
      setLink(unwrap(r)?.link ?? { ...prev, requireLobby });
    } catch (e) {
      setLink(prev);
      toast.error(e?.message || "No se pudo cambiar el acceso.");
    }
  }
```

- [ ] **Step 2: Render the toggle**

Directly after the closing `)}` of the `{link ? ( ... ) : ( ... )}` block
(currently line 94, the line with `)}` right before `<TagsField`), insert:

```jsx
      {link ? (
        <div className="mb-4">
          <span className="mb-1.5 block text-xs text-slate-400">Acceso</span>
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            {[
              { v: "lobby", label: "Con aprobación (PIN)" },
              { v: "open", label: "Libre acceso" },
            ].map((opt) => {
              const active = (link.requireLobby ? "lobby" : "open") === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => changeAccess(opt.v)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {link.requireLobby
              ? "Apruebas a cada persona antes de que entre."
              : "Cualquiera con el enlace o el código entra directo."}
          </p>
        </div>
      ) : null}
```

- [ ] **Step 3: Lint**

Run: `pnpm exec eslint apps/desktop/src/modules/atlas.chat/calls/CallInvitePanel.jsx`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallInvitePanel.jsx
git commit -m "feat(calls): PIN vs libre acceso toggle in the invite card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Per-conversation default in `ChannelGeneralTab`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx`

`SwitchField`, `useQuery`, `useMutation`, `useQueryClient`, `atlas`, `toast` are
all already imported in this file. No new imports.

- [ ] **Step 1: Add the query + mutation**

After the `uploadMutation` block (currently ends line 120), add:

```jsx
  // atlas.calls guest-link access mode. The CallLink row is unique + persistent
  // per conversation, so requireLobby here IS the per-conversation default that
  // the in-call toggle also writes. getLink only needs membership; updateLink
  // needs channel.manage, so the control is gated on canManage.
  const callLinkQuery = useQuery({
    queryKey: ["chat-channel-call-link", conversationId],
    queryFn: async () => {
      const res = await atlas.calls.getLink(conversationId, token);
      return res?.data?.link ?? res?.link ?? null;
    },
    enabled: Boolean(conversationId && token && canManage && conversation?.type !== "direct"),
    staleTime: 30_000,
    retry: false,
  });
  const callLink = callLinkQuery.data ?? null;
  // No link yet -> backend seeds requireLobby:true on first create, so the
  // default shown is "with approval" (switch off).
  const callAccessOpen = callLink ? !callLink.requireLobby : false;

  const callAccessMutation = useMutation({
    mutationFn: async (nextOpen) => {
      if (!callLink) {
        await atlas.calls.createLink(conversationId, token);
      }
      const res = await atlas.calls.updateLink(conversationId, { requireLobby: !nextOpen }, token);
      return res?.data?.link ?? res?.link ?? null;
    },
    onSuccess: (link) => {
      if (link) queryClient.setQueryData(["chat-channel-call-link", conversationId], link);
      else queryClient.invalidateQueries({ queryKey: ["chat-channel-call-link", conversationId] });
    },
    onError: () => toast.error("No se pudo cambiar el acceso a las llamadas."),
  });
```

- [ ] **Step 2: Render the `SwitchField`**

Directly after the existing "Solo administradores pueden escribir" `SwitchField`
block (currently lines 270–278, the `{memberRole && canManageRoles && ( ... )}`
block), insert:

```jsx
      {canManage && conversation?.type !== "direct" && !callLinkQuery.isError && (
        <SwitchField
          label="Libre acceso a las llamadas"
          description="Cualquiera con el enlace o el código entra directo. Si lo desactivas, tú admites a cada persona (PIN)."
          checked={callAccessOpen}
          onChange={(next) => callAccessMutation.mutate(next)}
          disabled={callAccessMutation.isPending || callLinkQuery.isLoading}
        />
      )}
```

- [ ] **Step 3: Lint**

Run: `pnpm exec eslint apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
git commit -m "feat(calls): per-conversation call access mode in channel settings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Full verification + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Full lint**

Run: `pnpm lint`
Expected: exit 0. If pre-existing unrelated errors appear, confirm they are not in
any of the four files touched here.

- [ ] **Step 2: Full web build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: exit 0, no new warnings referencing the touched files.

- [ ] **Step 3: Run the calls unit tests (regression guard for the backend flag)**

Run: `node --test apps/api/src/routes/calls/__tests__/`
Expected: all pass (unchanged — confirms `requireLobby` handling still green).

- [ ] **Step 4: Manual QA — restore from minimized (web, mouse)**

1. `pnpm dev`, open the web app at 1440px, start a call in a conversation.
2. Minimize it (Minimize button in the call bar). The floating bubble appears.
3. Single-click the bubble's video area → the full call comes back.
4. Minimize again, press-drag the bubble > 4px → it moves; release → it does NOT
   restore.
5. On the bubble, click the mic button and the hang-up button → they act, and do
   not move or restore the bubble.

- [ ] **Step 5: Manual QA — restore from minimized (mobile emulation, 390px)**

Repeat Step 4 at 390px with touch emulation: tap restores, drag moves and does not
restore. Bubble stays within the viewport after a rotate/resize.

- [ ] **Step 6: Manual QA — closable invite panel**

1. Start a call as the host in a channel with no one else. The "Aún no hay nadie
   más" card shows with an X.
2. Click X → the card disappears; the call stage is unobstructed.
3. Have nobody join, wait — the card does not reappear.
4. Open the invite/share button in the call bar → `CallShareDialog` still opens
   with the link, code and email invite.

- [ ] **Step 7: Manual QA — access mode, per call**

1. In the invite card, toggle "Libre acceso" → helper text updates.
2. In another browser/incognito, open the guest link → lands straight in the call
   (no lobby wait).
3. Toggle back to "Con aprobación (PIN)" → a new guest link visitor waits in the
   lobby and the host sees the admit prompt.
4. Kill the network briefly and toggle → the toast error shows and the toggle
   snaps back.

- [ ] **Step 8: Manual QA — access mode, per conversation**

1. Open the channel settings → General tab (as a manager). "Libre acceso a las
   llamadas" switch reflects the current link state.
2. Flip it → start a fresh call → the invite card's toggle shows the same value.
3. As a non-manager, the switch is absent.
4. In a direct (1:1) conversation, the switch is absent.

- [ ] **Step 9: Screenshots**

Capture 390px and 1440px of: the minimized bubble, the invite card with the X and
the access toggle, and the channel-settings switch. Attach to the summary.

- [ ] **Step 10: Final commit (if any QA fixups were needed)**

```bash
git add -A
git commit -m "fix(calls): QA fixups for invite panel + restore

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Change 1 (closable panel, "queda cerrado toda la llamada") → Task 2. ✓
- Change 2a (per-call PIN/free) → Task 3. ✓
- Change 2b (per-conversation default, "Ambos") → Task 4; same `requireLobby` field
  as Task 3 so last-write-wins persistence gives the "default + override" behaviour
  with no new storage. ✓
- Change 3 (restore on web, keep mobile working) → Task 1. ✓
- Spec "files expected to change" list (4 files) → matches the four tasks exactly. ✓
- Spec "no backend/validator/SDK/Prisma changes" → honoured; only reads of existing
  SDK methods. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command
has an expected result. ✓

**Type/name consistency:** `requireLobby` (boolean) used identically in Tasks 3 and
4. `lastGestureWasDrag` ref name consistent across Task 1 steps 1/2/3. `callLink`,
`callAccessOpen`, `callAccessMutation`, `callLinkQuery` names consistent within
Task 4. SDK shape `res?.data?.link ?? res?.link` used consistently. ✓

**Deviation note:** `SelectField` → segmented toggle (`CallInvitePanel`) /
`SwitchField` (`ChannelGeneralTab`); documented above with rationale; the spec's
intent (name both modes) is preserved.
