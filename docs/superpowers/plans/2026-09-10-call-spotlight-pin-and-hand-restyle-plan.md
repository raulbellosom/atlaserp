# Call: pin-to-spotlight + raise-hand restyle — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps track progress.

**Goal:** Restyle the raise-hand affordance (bare ✋ glyph in a soft circle; dark-glass host list) and add a local per-viewer "pin to spotlight" — the pinned participant fills the main area, everyone else in a side (desktop) / top scroll-x (mobile) strip.

Spec: `docs/superpowers/specs/2026-09-10-call-spotlight-pin-and-hand-restyle-design.md`

---

### Task 1: Pure layout helpers + tests

**Files:** Create `apps/desktop/src/modules/atlas.chat/calls/lib/callLayout.js`, `apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callLayout.test.js`

- [ ] **Step 1: failing test**

```javascript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePinnedEntry, spotlightStrip } from "../callLayout.js";

const p = (id, isLocal = false) => ({ participant: { identity: id, sid: id }, isLocal });
const parts = [p("me", true), p("a"), p("b")];

describe("resolvePinnedEntry", () => {
  it("returns the matching entry", () => {
    assert.equal(resolvePinnedEntry(parts, "a").participant.identity, "a");
  });
  it("null for an unknown or empty pin", () => {
    assert.equal(resolvePinnedEntry(parts, "ghost"), null);
    assert.equal(resolvePinnedEntry(parts, null), null);
  });
});

describe("spotlightStrip", () => {
  it("excludes the pinned entry from the strip", () => {
    const out = spotlightStrip({ participants: parts, pinnedIdentity: "a", screenShareEntry: null });
    assert.equal(out.mainEntry.participant.identity, "a");
    assert.deepEqual(out.others.map((e) => e.participant.identity), ["me", "b"]);
    assert.equal(out.showScreenTile, false);
  });
  it("shows a screen tile only when a screen exists and isn't the pinned one", () => {
    const screenB = p("b");
    assert.equal(spotlightStrip({ participants: parts, pinnedIdentity: "a", screenShareEntry: screenB }).showScreenTile, true);
    assert.equal(spotlightStrip({ participants: parts, pinnedIdentity: "b", screenShareEntry: screenB }).showScreenTile, false);
  });
  it("null main when the pin does not resolve", () => {
    const out = spotlightStrip({ participants: parts, pinnedIdentity: "ghost", screenShareEntry: null });
    assert.equal(out.mainEntry, null);
  });
});
```

- [ ] **Step 2: run — fails**

- [ ] **Step 3: implement**

```javascript
// apps/desktop/src/modules/atlas.chat/calls/lib/callLayout.js
export function resolvePinnedEntry(participants, pinnedIdentity) {
  if (!pinnedIdentity) return null;
  return (participants ?? []).find((e) => e.participant?.identity === pinnedIdentity) ?? null;
}

// Given the participant entries and the local pin, return the spotlight layout:
// the main tile, the strip (everyone else), and whether the screen share needs
// its own strip tile (present and not already the main).
export function spotlightStrip({ participants = [], pinnedIdentity = null, screenShareEntry = null }) {
  const mainEntry = resolvePinnedEntry(participants, pinnedIdentity);
  if (!mainEntry) return { mainEntry: null, others: [], showScreenTile: false };
  const mainId = mainEntry.participant?.identity;
  const others = participants.filter((e) => e.participant?.identity !== mainId);
  const mainIsSharing = Boolean(screenShareEntry && screenShareEntry.participant?.identity === mainId);
  return { mainEntry, others, showScreenTile: Boolean(screenShareEntry) && !mainIsSharing };
}
```

- [ ] **Step 4: run — passes**
- [ ] **Step 5: commit** — `git add apps/desktop/src/modules/atlas.chat/calls/lib/callLayout.js apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callLayout.test.js && git commit -m "feat(calls): pure resolvePinnedEntry / spotlightStrip helpers"`

---

### Task 2: `RaisedHandsBar.jsx` — dark glass

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/RaisedHandsBar.jsx`

- [ ] **Step 1:** Replace the amber pill markup with:

```jsx
  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[70%] flex-col gap-0.5 rounded-xl bg-black/55 p-1.5 backdrop-blur">
      {hands.map((h, i) => (
        <div key={h.identity} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-white hover:bg-white/10">
          <Hand className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="min-w-0 max-w-[9rem] truncate">{i + 1}. {h.name ?? "Participante"}</span>
          <button
            type="button"
            onClick={() => onLower?.(h.identity)}
            title="Bajar la mano"
            className="ml-0.5 shrink-0 rounded p-0.5 text-white/55 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
```

- [ ] **Step 2: lint** `npx eslint apps/desktop/src/modules/atlas.chat/calls/RaisedHandsBar.jsx`
- [ ] **Step 3: commit** — `git commit -m "feat(calls): raised-hands bar as dark glass"`

---

### Task 3: `ParticipantTile` — hand badge restyle + pin button

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx`

- [ ] **Step 1:** `lucide-react` import: add `Pin`, `PinOff`. `@atlas/ui` import (line 2): `import { Button, useCoarsePointer } from "@atlas/ui";`
- [ ] **Step 2:** `ParticipantTile` signature: add `pinned = false, onPin = null,`. First line of the body: `const coarse = useCoarsePointer();`
- [ ] **Step 3:** Root `<div>`: add `group/tile` to its className.
- [ ] **Step 4:** Replace the `{handRaised && (...)}` block with:

```jsx
      {handRaised && (
        <div className="absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 shadow-lg backdrop-blur-sm">
          <Hand className="h-5 w-5 text-amber-300" />
        </div>
      )}
      {onPin && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPin(participant?.identity); }}
          title={pinned ? "Quitar de destacado" : "Destacar"}
          className={[
            "absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white/90 shadow-lg backdrop-blur-sm transition hover:bg-black/65",
            pinned || coarse ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100",
          ].join(" ")}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
      )}
```

- [ ] **Step 5: lint** the file.
- [ ] **Step 6: commit** — `git commit -m "feat(calls): tile pin button + subtle raise-hand badge"`

---

### Task 4: `SpotlightLayout` + wire pin into every branch

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx`

- [ ] **Step 1:** Add `import { resolvePinnedEntry } from "./lib/callLayout";` near the other `./` imports.
- [ ] **Step 2:** In the `view` destructure add `pinnedIdentity = null, myLocalIdentity = null,`.
- [ ] **Step 3:** After the `cameraPips` const, add:
  `const pinnedEntry = resolvePinnedEntry(participants, pinnedIdentity);`
- [ ] **Step 4:** New local component (place it above `CallRoomLayout`, after `OutgoingCallTone`):

```jsx
function SpotlightLayout({ mainEntry, others, screenShareEntry, isMobile, raisedHands, myHandRaised, myLocalIdentity, mirrorLocalCamera, onPin }) {
  const mainId = mainEntry.participant?.identity;
  const mainIsSharing = Boolean(screenShareEntry && screenShareEntry.participant?.identity === mainId);
  const showScreenTile = Boolean(screenShareEntry) && !mainIsSharing;
  const tileCls = isMobile ? "relative aspect-video h-full shrink-0" : "relative aspect-video w-full shrink-0";
  const handFor = (id) => (id === myLocalIdentity ? myHandRaised : raisedHands.has(id));
  return (
    <div className={`flex h-full gap-2 ${isMobile ? "flex-col" : "flex-row"}`}>
      <div className="relative min-h-0 flex-1">
        <ParticipantTile
          participant={mainEntry.participant}
          isLocal={mainEntry.isLocal}
          handRaised={handFor(mainId)}
          preferSource={mainIsSharing ? "screen" : "auto"}
          pinned
          onPin={onPin}
          mirrorLocalCamera={mirrorLocalCamera}
          className="rounded-[1.5rem]"
          fit="contain"
        />
      </div>
      <div className={`flex shrink-0 gap-2 ${isMobile ? "order-first h-24 flex-row overflow-x-auto" : "w-44 flex-col overflow-y-auto"}`}>
        {showScreenTile && (
          <div className={tileCls}>
            <ParticipantTile
              participant={screenShareEntry.participant}
              isLocal={screenShareEntry.isLocal}
              preferSource="screen"
              onPin={onPin}
              className="rounded-xl bg-black"
              fit="contain"
            />
          </div>
        )}
        {others.map(({ participant, isLocal }) => (
          <div key={participant.sid || participant.identity} className={tileCls}>
            <ParticipantTile
              participant={participant}
              isLocal={isLocal}
              handRaised={handFor(participant?.identity)}
              preferSource="camera"
              onPin={onPin}
              mirrorLocalCamera={mirrorLocalCamera}
              className="rounded-xl"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5:** In `<main>`, wrap the existing screen-share / focus / grid chain
  so `pinnedEntry` wins first:

  ```jsx
        {pinnedEntry ? (
          <SpotlightLayout
            mainEntry={pinnedEntry}
            others={participants.filter((p) => p.participant?.identity !== pinnedIdentity)}
            screenShareEntry={screenShareEntry}
            isMobile={isMobile}
            raisedHands={raisedHands}
            myHandRaised={myHandRaised}
            myLocalIdentity={myLocalIdentity}
            mirrorLocalCamera={mirrorLocalCamera}
            onPin={actions.setPinned}
          />
        ) : (!isMobile || mobileView === "screen") && screenShareEntry ? (
          ...unchanged...
  ```
  (i.e. change the opening `{(!isMobile || mobileView === "screen") && screenShareEntry ? (` to `{pinnedEntry ? ( <SpotlightLayout .../> ) : (!isMobile || mobileView === "screen") && screenShareEntry ? (` and add one extra `)` at the end of the chain, before `</>`.)

- [ ] **Step 6:** Add `onPin={actions.setPinned}` to:
  - each PiP `<ParticipantTile>` in the screen-share branch,
  - the two `<ParticipantTile>` in the `useFocusLayout` branch,
  - each `<ParticipantTile>` in the grid branch.
  (`pinned` stays default `false` there — you can't be pinned while unpinned.)

- [ ] **Step 7: build** `pnpm --filter @atlas/desktop build` → clean.
- [ ] **Step 8: lint** the file.
- [ ] **Step 9: commit** — `git commit -m "feat(calls): pin a participant to spotlight; strip layout (side on desktop, top on mobile)"`

---

### Task 5: `CallRoom.jsx` — pin state

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx`

- [ ] **Step 1:** Near `const [guestSheetOpen, setGuestSheetOpen] = useState(false);` add:
  ```javascript
  const [pinnedIdentity, setPinnedIdentity] = useState(null);
  const setPinned = useCallback(
    (id) => setPinnedIdentity((cur) => (id && cur === id ? null : id || null)),
    [],
  );
  ```
- [ ] **Step 2:** After `const participants = [localEntry, ...remoteEntries];`:
  ```javascript
  useEffect(() => {
    if (pinnedIdentity && !participants.some((p) => p.participant?.identity === pinnedIdentity)) {
      setPinnedIdentity(null);
    }
  }, [pinnedIdentity, participants]);
  ```
- [ ] **Step 3:** In the `<CallRoomLayout view={{ ... }}>` object add
  `pinnedIdentity, myLocalIdentity: room.localParticipant?.identity,`.
  In `actions={{ ... }}` add `setPinned,`.
- [ ] **Step 4: build + tests**
  `pnpm --filter @atlas/desktop build` → clean.
  `node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/*.test.js` → pass.
- [ ] **Step 5: commit** — `git commit -m "feat(calls): local per-viewer pinnedIdentity state + auto-clear"`

---

### Task 6: `GuestCallRoom.jsx` — hand badge restyle

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallRoom.jsx`

- [ ] **Step 1:** In `Tile`, replace the `{handRaised && (...)}` amber pill with:
  ```jsx
      {handRaised && (
        <div className="absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 shadow-lg backdrop-blur-sm">
          <Hand className="h-5 w-5 text-amber-300" />
        </div>
      )}
  ```
- [ ] **Step 2: build** → clean. **lint** → no errors.
- [ ] **Step 3: commit** — `git commit -m "feat(calls): subtle raise-hand badge in the guest room"`

---

## Self-review

- Spec "hand restyle both rooms" → Task 3 (member) + Task 6 (guest); host bar → Task 2. ✓
- Spec "pin local per-viewer, pin button on tile, strip side/top" → Tasks 4 + 5; helper Task 1. ✓
- "no pin → unchanged" → Task 4 step 5 keeps the screen-share / focus / grid branches; only adds `onPin`. ✓
- "pinned participant leaves → auto clear" → Task 5 step 2. ✓
- Types: `pinnedIdentity` string|null; `setPinned(id)` toggles; `resolvePinnedEntry(participants, id) → entry|null`; `SpotlightLayout` props match Task 4 step 4 & step 5. `handFor(id)` uses `myHandRaised` for the local id (the map may not include self since `toggleHand` updates the map too — but `myHandRaised` is the authoritative local value). ✓
- No placeholders.
