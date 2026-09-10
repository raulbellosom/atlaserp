# Call Guest Panel Redesign + Safe Toast Action — Plan B

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps track progress.

**Goal:** Replace the cramped `max-h-48` guest roster strip with a proper bottom `Sheet`, and give the "X quiere unirse" toast a "Ver solicitudes" action that opens it **in place** without unmounting the call.

Spec: `docs/superpowers/specs/2026-09-09-call-reactions-raisehand-guest-panel-design.md`

---

### Task 1: `CallGuestSheet.jsx` (replaces `CallGuestRoster.jsx`)

**Files:** Create `apps/desktop/src/modules/atlas.chat/calls/CallGuestSheet.jsx`; delete `apps/desktop/src/modules/atlas.chat/calls/CallGuestRoster.jsx`

- [ ] **Step 1: write the component**

```jsx
import { useState } from "react";
import { Button, ConfirmDialog, EmptyState, Sheet, SheetContent, SheetHeader, SheetTitle } from "@atlas/ui";
import { Check, X, Mic, MicOff, UserX, Link2 } from "lucide-react";

function Initial({ name }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/25 text-sm font-semibold text-violet-100">
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

// Host-only. `guestsApi` = useCallGuests(). `onShare` opens CallShareDialog.
export function CallGuestSheet({ open, onOpenChange, guestsApi, onShare }) {
  const { lobby, admitted, admit, deny, kick, mute } = guestsApi;
  const [muted, setMuted] = useState({});
  const [confirmKick, setConfirmKick] = useState(null);
  const empty = lobby.length === 0 && admitted.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 bg-[hsl(var(--popover,var(--background)))]" style={{ zIndex: 10002 }}>
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2 text-sm">
            Invitados
            {lobby.length > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-amber-950">
                {lobby.length} en espera
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pb-2">
          {empty && (
            <EmptyState title="Sin invitados" description="Comparte el enlace para que se unan invitados externos." />
          )}

          {lobby.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Esperando aprobación
              </p>
              <ul className="space-y-1">
                {lobby.map((g) => (
                  <li key={g.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-[hsl(var(--muted))]">
                    <Initial name={g.displayName} />
                    <span className="min-w-0 flex-1 truncate text-sm">{g.displayName}</span>
                    <Button size="sm" className="h-8" onClick={() => admit(g.id)}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Admitir
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" title="Rechazar" onClick={() => deny(g.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {admitted.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                En la llamada
              </p>
              <ul className="space-y-1">
                {admitted.map((g) => {
                  const isMuted = !!muted[g.id];
                  return (
                    <li key={g.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-[hsl(var(--muted))]">
                      <Initial name={g.displayName} />
                      <span className="min-w-0 flex-1 truncate text-sm">{g.displayName}</span>
                      <Button
                        size="sm" variant="ghost" className="h-8 w-8 p-0"
                        title={isMuted ? "Reactivar micrófono" : "Silenciar"}
                        onClick={() => { setMuted((m) => ({ ...m, [g.id]: !isMuted })); mute(g.id, !isMuted); }}
                      >
                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" title="Expulsar" onClick={() => setConfirmKick(g)}>
                        <UserX className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
          <Button variant="outline" className="w-full" onClick={onShare}>
            <Link2 className="mr-2 h-4 w-4" /> Compartir enlace
          </Button>
        </div>

        <ConfirmDialog
          open={!!confirmKick}
          onOpenChange={(v) => !v && setConfirmKick(null)}
          title="Expulsar invitado"
          description={confirmKick ? `Se sacará a ${confirmKick.displayName} de la llamada.` : ""}
          confirmLabel="Expulsar"
          variant="destructive"
          onConfirm={() => { kick(confirmKick.id); setConfirmKick(null); }}
        />
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2:** `git rm apps/desktop/src/modules/atlas.chat/calls/CallGuestRoster.jsx` (and check no other importer: `grep -rn CallGuestRoster apps/desktop/src` → only `CallRoom.jsx`).
- [ ] **Step 3: lint** `npx eslint apps/desktop/src/modules/atlas.chat/calls/CallGuestSheet.jsx` — no errors.
- [ ] **Step 4: commit** — `git add -A && git commit -m "feat(calls): CallGuestSheet — guest approval as a bottom sheet"`

---

### Task 2: `CallRoom.jsx` — own the sheet, accept the nonce

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx`

- [ ] **Step 1:** Replace `import { CallGuestRoster } from "./CallGuestRoster";` with `import { CallGuestSheet } from "./CallGuestSheet";`
- [ ] **Step 2:** Component signature gains a prop: `guestPanelNonce = 0` (added to the destructure of `CallRoom`'s props).
- [ ] **Step 3:** Add state next to `const [shareOpen, setShareOpen] = useState(false);`:
  ```javascript
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  useEffect(() => { if (guestPanelNonce) setGuestSheetOpen(true); }, [guestPanelNonce]);
  ```
- [ ] **Step 4:** In the `chat={{ ... }}` object passed to `<CallRoomLayout>`, replace
  `roster: isInitiator ? <CallGuestRoster guestsApi={guestsApi} /> : null,`
  with
  `onOpenGuests: isInitiator ? () => setGuestSheetOpen(true) : null,`
- [ ] **Step 5:** After `<CallShareDialog ... />` (inside the `{isInitiator && (...)}` block or as a sibling), add:
  ```jsx
      {isInitiator && (
        <CallGuestSheet
          open={guestSheetOpen}
          onOpenChange={setGuestSheetOpen}
          guestsApi={guestsApi}
          onShare={() => { setGuestSheetOpen(false); setShareOpen(true); }}
        />
      )}
  ```
- [ ] **Step 6: syntax** `node --check` won't parse JSX — rely on the Task 4 build.

---

### Task 3: `CallRoomLayout.jsx` — drop the strip, rewire the header button

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx`

- [ ] **Step 1:** In the `chat` destructure, replace `roster = null,` with `onOpenGuests = null,`. Keep `pendingLobby`, `canShare`, `hasGuests`, `onShare`.
- [ ] **Step 2:** Delete the `const showRoster = canShare && (hasGuests || pendingLobby > 0);` line and the whole `{showRoster && (<div className="max-h-48 ...">{roster}</div>)}` block.
- [ ] **Step 3:** The header guests button (currently `{canShare && (<button onClick={onShare} ...>` with the `pendingLobby` badge): change `onClick={onShare}` → `onClick={onOpenGuests ?? onShare}`. Keep its icon `Users` + the badge. Update its `title` to "Invitados".
- [ ] **Step 4: build** `pnpm --filter @atlas/desktop build` → clean.
- [ ] **Step 5: commit** — `git add apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx && git commit -m "feat(calls): open the guest sheet from the header button + toast nonce"`

---

### Task 4: `CallsProvider.jsx` — nonce + toast action

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/CallsProvider.jsx`

- [ ] **Step 1:** Add state near `const [pendingGuestCount, setPendingGuestCount] = useState(0);`:
  ```javascript
  const [guestPanelNonce, setGuestPanelNonce] = useState(0);
  ```
- [ ] **Step 2:** In the guest-lobby `useEffect`, change the toast:
  ```javascript
  toast.message(`${p?.name ?? "Un invitado"} quiere unirse a la llamada.`, {
    action: {
      label: "Ver solicitudes",
      // Only bumps state — never navigates, never unmounts the call room.
      onClick: () => setGuestPanelNonce((n) => n + 1),
    },
  });
  ```
- [ ] **Step 3:** In the `useEffect(() => { if (!activeSession) { setPendingGuestCount(0); setMinimized(false); } }, [activeSession])` block, also add `setGuestPanelNonce(0);`.
- [ ] **Step 4:** Pass the prop to `<CallRoom ...>`: add `guestPanelNonce={guestPanelNonce}`.
- [ ] **Step 5: build + full call tests**
  `pnpm --filter @atlas/desktop build` → clean.
  `node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/*.test.js apps/desktop/src/modules/atlas.chat/lib/__tests__/*.test.js` → pass.
  `npx eslint apps/desktop/src/modules/atlas.chat/calls/CallsProvider.jsx apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx apps/desktop/src/modules/atlas.chat/calls/CallGuestSheet.jsx` → no errors.
- [ ] **Step 6: commit** — `git commit -m "feat(calls): 'Ver solicitudes' toast action opens the guest sheet in place"`

---

## Self-review

- Spec B1 (bottom sheet, two sections, share button, empty state) → Task 1. ✓
- B2 (`guestSheetOpen` + `guestPanelNonce` + render) → Task 2. ✓
- B3 (drop strip, header button opens sheet) → Task 3. ✓
- B4 (nonce + toast action that never navigates) → Task 4. ✓
- Types: `guestPanelNonce` is a `number`, bumped in `CallsProvider`, watched by `CallRoom`'s effect. `guestsApi` shape unchanged (`useCallGuests`). `onShare` / `onOpenGuests` are `() => void`. ✓
- `CallGuestRoster.jsx` deleted; only importer was `CallRoom.jsx` (Task 2 step 1). ✓
