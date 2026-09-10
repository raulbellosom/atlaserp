# Call Reactions + Raise-Hand — Plan A

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). Checkbox steps track progress.

**Goal:** In-call floating reactions (TikTok-style, 6 fixed emoji) and raise-hand (toggle + per-tile badge + host list), all over the LiveKit data channel, no API.

**Architecture:** A pure reducer module + a `useCallEphemeral` hook that adds its own `RoomEvent.DataReceived` listener. Three presentational components (overlay, reaction button, raised-hands bar) wired into both `CallRoomLayout` (members) and `GuestCallRoom` (external guests).

Spec: `docs/superpowers/specs/2026-09-09-call-reactions-raisehand-guest-panel-design.md`

---

### Task 1: Pure reducers + tests

**Files:** Create `apps/desktop/src/modules/atlas.chat/calls/lib/callEphemeral.js`, `apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callEphemeral.test.js`

- [ ] **Step 1: failing test**

```javascript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REACTION_CAP, applyDataPacket, raiseOrder } from "../callEphemeral.js";

const empty = () => ({ reactions: [], raisedHands: new Map() });

describe("applyDataPacket", () => {
  it("appends a reaction with an id and caps the list", () => {
    let s = empty();
    for (let i = 0; i < REACTION_CAP + 5; i++) s = applyDataPacket(s, { type: "reaction", emoji: "❤️", fromName: "A" }, "me");
    assert.equal(s.reactions.length, REACTION_CAP);
    assert.ok(s.reactions[0].id);
    assert.equal(s.reactions[0].emoji, "❤️");
  });

  it("ignores unknown packet types", () => {
    const s0 = empty();
    const s1 = applyDataPacket(s0, { type: "chat", body: "hi" }, "me");
    assert.equal(s1, s0);
  });

  it("raises, re-raises to the end, and lowers a hand", () => {
    let s = empty();
    s = applyDataPacket(s, { type: "hand", identity: "u1", name: "Uno", raised: true }, "me");
    s = applyDataPacket(s, { type: "hand", identity: "u2", name: "Dos", raised: true }, "me");
    assert.deepEqual(raiseOrder(s.raisedHands).map((h) => h.identity), ["u1", "u2"]);
    s = applyDataPacket(s, { type: "hand", identity: "u1", name: "Uno", raised: true }, "me");
    assert.deepEqual(raiseOrder(s.raisedHands).map((h) => h.identity), ["u2", "u1"]);
    s = applyDataPacket(s, { type: "hand", identity: "u2", name: "Dos", raised: false }, "me");
    assert.deepEqual(raiseOrder(s.raisedHands).map((h) => h.identity), ["u1"]);
    s = applyDataPacket(s, { type: "hand-lower", identity: "u1" }, "me");
    assert.equal(s.raisedHands.size, 0);
  });
});
```

- [ ] **Step 2: run — fails** (`node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callEphemeral.test.js` → Cannot find module)

- [ ] **Step 3: implement**

```javascript
// apps/desktop/src/modules/atlas.chat/calls/lib/callEphemeral.js
export const REACTION_CAP = 24;
export const REACTION_TTL_MS = 4000;
export const QUICK_REACTIONS = ["❤️", "👍", "😂", "🎉", "👏", "😮"];

let _seq = 0;
export function makeReactionEntry(emoji, fromName) {
  _seq += 1;
  return { id: `r${Date.now()}-${_seq}`, emoji, fromName: fromName ?? null, at: Date.now() };
}

// Pure: given the current { reactions, raisedHands(Map) } and an inbound packet,
// return the next state (same reference when the packet is a no-op).
export function applyDataPacket(state, packet, _selfIdentity) {
  if (!packet || typeof packet !== "object") return state;
  if (packet.type === "reaction") {
    const entry = makeReactionEntry(packet.emoji, packet.fromName);
    const reactions = [...state.reactions, entry].slice(-REACTION_CAP);
    return { ...state, reactions };
  }
  if (packet.type === "hand" && packet.identity) {
    const raisedHands = new Map(state.raisedHands);
    raisedHands.delete(packet.identity); // re-raise => move to the end
    if (packet.raised) raisedHands.set(packet.identity, { name: packet.name ?? null, at: Date.now() });
    return { ...state, raisedHands };
  }
  if (packet.type === "hand-lower" && packet.identity) {
    if (!state.raisedHands.has(packet.identity)) return state;
    const raisedHands = new Map(state.raisedHands);
    raisedHands.delete(packet.identity);
    return { ...state, raisedHands };
  }
  return state;
}

export function removeReaction(state, id) {
  const reactions = state.reactions.filter((r) => r.id !== id);
  return reactions.length === state.reactions.length ? state : { ...state, reactions };
}

export function dropIdentity(state, identity) {
  if (!state.raisedHands.has(identity)) return state;
  const raisedHands = new Map(state.raisedHands);
  raisedHands.delete(identity);
  return { ...state, raisedHands };
}

export function raiseOrder(map) {
  return [...map.entries()].map(([identity, v]) => ({ identity, ...v }));
}
```

- [ ] **Step 4: run — passes**
- [ ] **Step 5: commit** — `git add ...calls/lib/callEphemeral.js ...lib/__tests__/callEphemeral.test.js && git commit -m "feat(calls): pure reducers for ephemeral in-call reactions + raise-hand"`

---

### Task 2: `useCallEphemeral` hook

**Files:** Create `apps/desktop/src/modules/atlas.chat/calls/hooks/useCallEphemeral.js`

- [ ] **Step 1: implement**

```javascript
import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent } from "livekit-client";
import { applyDataPacket, removeReaction, dropIdentity, makeReactionEntry, REACTION_TTL_MS } from "../lib/callEphemeral.js";

// Ephemeral (data-channel only) reactions + raise-hand. Adds its OWN
// DataReceived listener so the chat's handler is untouched.
export function useCallEphemeral({ room, publishData, selfIdentity, selfName, isHost = false }) {
  const [state, setState] = useState(() => ({ reactions: [], raisedHands: new Map() }));
  const lastReactAt = useRef(0);

  useEffect(() => {
    if (!room) return undefined;
    const onData = (payload) => {
      let packet;
      try { packet = JSON.parse(new TextDecoder().decode(payload)); } catch { return; }
      if (!packet || (packet.type !== "reaction" && packet.type !== "hand" && packet.type !== "hand-lower")) return;
      setState((prev) => applyDataPacket(prev, packet, selfIdentity));
      if (packet.type === "reaction") {
        // schedule removal of whatever just landed at the tail
        setTimeout(() => setState((prev) => (prev.reactions.length ? removeReaction(prev, prev.reactions[prev.reactions.length - 1]?.id) : prev)), REACTION_TTL_MS);
      }
    };
    const onLeft = (participant) => setState((prev) => dropIdentity(prev, participant?.identity));
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
    };
  }, [room, selfIdentity]);

  const sendReaction = useCallback((emoji) => {
    const now = Date.now();
    if (now - lastReactAt.current < 350) return;
    lastReactAt.current = now;
    publishData?.({ type: "reaction", emoji, fromName: selfName });
    const entry = makeReactionEntry(emoji, selfName);
    setState((prev) => ({ ...prev, reactions: [...prev.reactions, entry].slice(-24) }));
    setTimeout(() => setState((prev) => removeReaction(prev, entry.id)), REACTION_TTL_MS);
  }, [publishData, selfName]);

  const myHandRaised = state.raisedHands.has(selfIdentity);

  const toggleHand = useCallback(() => {
    const next = !state.raisedHands.has(selfIdentity);
    publishData?.({ type: "hand", identity: selfIdentity, name: selfName, raised: next });
    setState((prev) => applyDataPacket(prev, { type: "hand", identity: selfIdentity, name: selfName, raised: next }, selfIdentity));
  }, [publishData, selfIdentity, selfName, state.raisedHands]);

  const lowerHand = useCallback((identity) => {
    if (!isHost && identity !== selfIdentity) return;
    publishData?.({ type: "hand-lower", identity });
    setState((prev) => dropIdentity(prev, identity));
  }, [publishData, isHost, selfIdentity]);

  return {
    reactions: state.reactions,
    raisedHands: state.raisedHands,
    myHandRaised,
    sendReaction,
    toggleHand,
    lowerHand,
  };
}
```

- [ ] **Step 2: syntax** `node --check apps/desktop/src/modules/atlas.chat/calls/hooks/useCallEphemeral.js` (JSX-free — should pass)
- [ ] **Step 3: commit** — `git commit -m "feat(calls): useCallEphemeral hook (data-channel reactions + raise-hand)"`

---

### Task 3: Presentational components

**Files:** Create `CallReactionsOverlay.jsx`, `CallReactionButton.jsx`, `RaisedHandsBar.jsx` under `apps/desktop/src/modules/atlas.chat/calls/`

- [ ] **Step 1: `CallReactionsOverlay.jsx`**

```jsx
// Floats each reaction from the bottom center up ~70vh with a small drift.
export function CallReactionsOverlay({ reactions }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <style>{`
        @keyframes call-reaction-float {
          0%   { transform: translateY(0) translateX(0) scale(0.6); opacity: 0; }
          12%  { transform: translateY(-8vh) translateX(calc(var(--drift) * 0.2)) scale(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(-70vh) translateX(var(--drift)) scale(1); opacity: 0; }
        }
      `}</style>
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-16 select-none text-3xl will-change-transform"
          style={{
            left: `calc(50% + ${((Number(r.id.slice(-3)) % 60) - 30)}%)`,
            "--drift": `${((Number(r.id.slice(-2)) % 80) - 40)}px`,
            animation: "call-reaction-float 4s ease-out forwards",
          }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `CallReactionButton.jsx`**

```jsx
import { Button, Popover, PopoverTrigger, PopoverContent } from "@atlas/ui";
import { SmilePlus } from "lucide-react";
import { QUICK_REACTIONS } from "./lib/callEphemeral.js";

export function CallReactionButton({ onReact, disabled = false }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" size="icon" disabled={disabled} className="h-11 w-11 rounded-full disabled:opacity-40" title="Reaccionar">
          <SmilePlus className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-auto rounded-full p-1.5" style={{ zIndex: 60 }}>
        <div className="flex items-center gap-0.5">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onReact(e)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:scale-110 hover:bg-[hsl(var(--muted))] active:scale-95"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: `RaisedHandsBar.jsx`**

```jsx
import { Hand, X } from "lucide-react";
import { raiseOrder } from "./lib/callEphemeral.js";

// Host-only chip stack, top-left of the video area.
export function RaisedHandsBar({ raisedHands, onLower }) {
  const hands = raiseOrder(raisedHands);
  if (hands.length === 0) return null;
  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[70%] flex-col gap-1">
      {hands.map((h, i) => (
        <div key={h.identity} className="flex items-center gap-1.5 rounded-full bg-amber-400/95 px-2.5 py-1 text-xs font-medium text-amber-950 shadow">
          <Hand className="h-3.5 w-3.5" />
          <span className="max-w-[9rem] truncate">{i + 1}. {h.name ?? "Participante"}</span>
          <button type="button" onClick={() => onLower(h.identity)} title="Bajar la mano" className="ml-0.5 rounded-full p-0.5 hover:bg-amber-950/15">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: lint** `npx eslint` the three new files — no errors
- [ ] **Step 5: commit** — `git commit -m "feat(calls): reactions overlay, reaction button, raised-hands bar"`

---

### Task 4: Wire into `CallRoom` + `CallRoomLayout`

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx`, `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx`

- [ ] **Step 1: `CallRoom.jsx` — instantiate the hook**

After `const publishData = useCallback(...)` add:

```javascript
  const ephemeral = useCallEphemeral({
    room,
    publishData,
    selfIdentity: room.localParticipant?.identity,
    selfName: userProfile?.displayName ?? "Tú",
    isHost: isInitiator,
  });
```

(import: `import { useCallEphemeral } from "./hooks/useCallEphemeral";` — check `userProfile` is already in scope via `useAuth()`; if not, add it.)

- [ ] **Step 2: `CallRoom.jsx` — pass to layout**

In the `<CallRoomLayout view={{ ... }}>` object add:
`reactions: ephemeral.reactions, raisedHands: ephemeral.raisedHands, myHandRaised: ephemeral.myHandRaised, isHost: isInitiator,`

In `actions={{ ... }}` add:
`sendReaction: ephemeral.sendReaction, toggleHand: ephemeral.toggleHand, lowerHand: ephemeral.lowerHand,`

- [ ] **Step 3: `CallRoomLayout.jsx` — destructure + overlay + bar**

Add to the `view` destructure: `reactions = [], raisedHands = new Map(), myHandRaised = false, isHost = false,`.
Add to `actions` usage: `actions.sendReaction`, `actions.toggleHand`, `actions.lowerHand`.

Inside `<main>` (right after the `{invitePanel && ...}` block), add:
```jsx
        <CallReactionsOverlay reactions={reactions} />
        {isHost && <RaisedHandsBar raisedHands={raisedHands} onLower={actions.lowerHand} />}
```
(imports at top: `import { CallReactionsOverlay } from "./CallReactionsOverlay"; import { RaisedHandsBar } from "./RaisedHandsBar"; import { CallReactionButton } from "./CallReactionButton";` and add `Hand` to the existing `lucide-react` import.)

- [ ] **Step 4: `CallRoomLayout.jsx` — footer buttons**

In the `<footer>` control cluster, immediately before the screen-share `<Button>`:
```jsx
        <CallReactionButton onReact={actions.sendReaction} disabled={!engineReady} />
        <Button type="button" variant={myHandRaised ? "default" : "secondary"} size="icon" disabled={!engineReady} className="h-11 w-11 rounded-full disabled:opacity-40" onClick={actions.toggleHand} title={myHandRaised ? "Bajar la mano" : "Levantar la mano"}>
          <Hand className="h-5 w-5" />
        </Button>
```

- [ ] **Step 5: `CallRoomLayout.jsx` — tile badge**

`ParticipantTile` gains a `handRaised` prop; inside its root `<div className="relative ...">` add:
```jsx
      {handRaised && (
        <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[11px] font-semibold text-amber-950">
          <Hand className="h-3 w-3" /> Mano
        </div>
      )}
```
At each `<ParticipantTile .../>` call site, pass `handRaised={raisedHands.has(participant?.identity)}` (the local tile: `raisedHands.has(localEntry.participant?.identity)` — also `myHandRaised` as a shortcut).

- [ ] **Step 6: build + tests**

`node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/*.test.js` → pass.
`pnpm --filter @atlas/desktop build` → Vite build clean.

- [ ] **Step 7: commit** — `git commit -m "feat(calls): wire reactions + raise-hand into the member call room"`

---

### Task 5: Wire into `GuestCallRoom`

**Files:** Modify `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallRoom.jsx`

- [ ] **Step 1:** Bind a `publishData` helper (mirror `publishChat`): `const publishSignal = useCallback((obj) => { try { room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true }); } catch {} }, [room]);`
- [ ] **Step 2:** `const ephemeral = useCallEphemeral({ room, publishData: publishSignal, selfIdentity: room.localParticipant?.identity, selfName: myName, isHost: false });`
- [ ] **Step 3:** In `<main>` add `<CallReactionsOverlay reactions={ephemeral.reactions} />`. Pass `handRaised` to each `<Tile>` (`ephemeral.raisedHands.has(p?.identity)`), and add the same amber badge markup to `Tile`.
- [ ] **Step 4:** In the guest `<footer>` add `<CallReactionButton onReact={ephemeral.sendReaction} />` and the ✋ toggle `<Button ... onClick={ephemeral.toggleHand}>`.
- [ ] **Step 5:** `pnpm --filter @atlas/desktop build` clean.
- [ ] **Step 6: commit** — `git commit -m "feat(calls): reactions + raise-hand for external guests"`

---

## Self-review

- Spec "shared hook" → Task 2. "reactions overlay/button" → Task 3+4+5. "raise-hand badge + host list" → Task 3 (bar) + Task 4 step 5 (badge). "guests can send" → Task 5. ✓
- Types: packet shapes `{type:"reaction"|"hand"|"hand-lower", ...}` identical across `callEphemeral.js`, the hook, and both room wirings. `raisedHands` is always a `Map<identity,{name,at}>`. `reactions` entries `{id,emoji,fromName,at}`. ✓
- No placeholders — every step has code or an exact command.
