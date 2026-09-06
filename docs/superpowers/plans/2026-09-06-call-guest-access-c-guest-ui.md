# Guest access to calls — Plan C (Guest UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The public, unauthenticated `/p/call/:token` (and `/p/call` code-entry) page: a name gate → lobby wait → a stripped-down LiveKit call room with the ephemeral guest chat and a Leave button.

**Architecture:** One lazy default-export screen `GuestCallScreen` with a pure `guestCall.js` state reducer (`gate | lobby | room | ended | error`). A `useGuestCall` hook owns the guest token (in memory only), the join call, the state poll + heartbeat, and the LiveKit token fetch. `GuestCallRoom` reuses `CallRoomLayout`'s presentational primitives (participant tiles, control bar) in a trimmed arrangement + `RoomChatView` (from Plan B) bound to a guest transport.

**Tech Stack:** React 18, react-router, `livekit-client`, `@atlas/sdk`
(`atlas.calls.guest.*` from Plan A), `@atlas/ui`.

**Spec:** `docs/superpowers/specs/2026-09-06-call-guest-access-design.md` §6.2, §6.3.

**Depends on:** Plan A (guest endpoints) + Plan B (`RoomChatView`,
`lib/roomChat.js`). The two `/p/call` routes go in `AppEntry.jsx`, which is
currently clean.

---

## Task 1: Pure `guestCall.js` reducer + test

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/guest/lib/guestCall.js`
- Test: `apps/desktop/src/modules/atlas.chat/calls/guest/lib/__tests__/guestCall.test.js`

- [ ] **Step 1: Test**

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { guestPhase, GUEST_PHASES, buildGuestJoinUrl } from "../guestCall.js";

describe("guestPhase", () => {
  it("gate before a join", () => {
    assert.equal(guestPhase({ joined: false }), "gate");
  });
  it("waiting-for-call maps to lobby with a distinct note", () => {
    assert.equal(guestPhase({ joined: true, status: "waiting" }), "lobby");
  });
  it("LOBBY => lobby, ADMITTED => room", () => {
    assert.equal(guestPhase({ joined: true, status: "LOBBY" }), "lobby");
    assert.equal(guestPhase({ joined: true, status: "ADMITTED" }), "room");
  });
  it("DENIED / KICKED => ended", () => {
    assert.equal(guestPhase({ joined: true, status: "DENIED" }), "ended");
    assert.equal(guestPhase({ joined: true, status: "KICKED" }), "ended");
  });
  it("callEnded => ended even if ADMITTED", () => {
    assert.equal(guestPhase({ joined: true, status: "ADMITTED", callEnded: true }), "ended");
  });
  it("error flag wins", () => {
    assert.equal(guestPhase({ joined: true, status: "ADMITTED", error: "boom" }), "error");
  });
});

describe("buildGuestJoinUrl", () => {
  it("builds a code URL and an invite URL", () => {
    assert.equal(buildGuestJoinUrl({ origin: "https://a.test", code: "ABCD1234" }), "https://a.test/p/call?code=ABCD1234");
    assert.equal(buildGuestJoinUrl({ origin: "https://a.test", token: "t", invite: "i" }), "https://a.test/p/call/t?i=i");
  });
});

describe("GUEST_PHASES", () => {
  it("is the canonical list", () => {
    assert.deepEqual(GUEST_PHASES, ["gate", "lobby", "room", "ended", "error"]);
  });
});
```

- [ ] **Step 2: Implement**

```js
export const GUEST_PHASES = ["gate", "lobby", "room", "ended", "error"];

// s: { joined, status, callEnded, error }
//   status: "waiting" | "LOBBY" | "ADMITTED" | "LEFT" | "KICKED" | "DENIED"
export function guestPhase(s = {}) {
  if (!s.joined) return "gate";
  if (s.error) return "error";
  if (s.callEnded) return "ended";
  if (s.status === "DENIED" || s.status === "KICKED" || s.status === "LEFT") return "ended";
  if (s.status === "ADMITTED") return "room";
  return "lobby"; // "waiting" or "LOBBY"
}

export function endedReason(s = {}) {
  if (s.status === "DENIED") return "El anfitrión no te admitió a la llamada.";
  if (s.status === "KICKED") return "El anfitrión te sacó de la llamada.";
  return "La llamada terminó.";
}

export function buildGuestJoinUrl({ origin, token = null, code = null, invite = null }) {
  const base = String(origin ?? "").replace(/\/+$/, "");
  if (token) return `${base}/p/call/${token}${invite ? `?i=${invite}` : ""}`;
  return `${base}/p/call${code ? `?code=${code}` : ""}`;
}
```

- [ ] **Step 3: Run + commit**

```bash
node --test apps/desktop/src/modules/atlas.chat/calls/guest/lib/__tests__/guestCall.test.js
git add apps/desktop/src/modules/atlas.chat/calls/guest/lib/
git commit -m "$(cat <<'EOF'
feat(calls): pure guestPhase reducer for the public guest call page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `useGuestCall` hook

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/guest/useGuestCall.js`

- [ ] **Step 1: Implement**

```js
import { useCallback, useEffect, useRef, useState } from "react";
import { atlas } from "../../../../lib/atlas";
import { guestPhase } from "./lib/guestCall";

function unwrap(r) { return r?.data ?? r; }

// Owns the guest session token (memory only — never localStorage) and the
// state/heartbeat poll. `token`/`code`/`inviteToken` come from the URL.
export function useGuestCall({ token = null, code = null, inviteToken = null }) {
  const [guestToken, setGuestToken] = useState(null);
  const [state, setState] = useState({ joined: false, status: null, callEnded: false, error: null });
  const [call, setCall] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [guests, setGuests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [joining, setJoining] = useState(false);
  const pollRef = useRef(null);
  const hbRef = useRef(null);
  const gtRef = useRef(null);

  const join = useCallback(async ({ displayName, email }) => {
    setJoining(true);
    setState((s) => ({ ...s, error: null }));
    try {
      const res = unwrap(await atlas.calls.guest.join({ token, code, inviteToken, displayName, email }));
      if (res?.status === "waiting") {
        setState({ joined: true, status: "waiting", callEnded: false, error: null });
        return;
      }
      gtRef.current = res.guestToken;
      setGuestToken(res.guestToken);
      setState({ joined: true, status: res.status, callEnded: false, error: null });
      setCall({ id: res.callId });
    } catch (e) {
      setState({ joined: false, status: null, callEnded: false, error: e?.message || "No se pudo unir." });
    } finally {
      setJoining(false);
    }
  }, [token, code, inviteToken]);

  // Poll state once we have a guest token OR are in the "waiting" pre-call state
  useEffect(() => {
    const waiting = state.joined && state.status === "waiting";
    if (!gtRef.current && !waiting) return undefined;

    async function tick() {
      try {
        if (waiting && !gtRef.current) {
          // re-attempt the join; the call may have started
          const res = unwrap(await atlas.calls.guest.join({ token, code, inviteToken, displayName: "_retry_" }));
          // NB: displayName is required by the schema; the page re-calls join()
          // properly. This retry path is only reached if the page kept the form
          // values — handled in GuestCallScreen. Skip here.
          return;
        }
        const res = unwrap(await atlas.calls.guest.state(gtRef.current));
        setState((s) => ({ ...s, status: res.status, callEnded: !!res.callEnded }));
        setCall(res.call);
        setLivekitUrl(res.livekitUrl ?? null);
        setGuests(res.guests ?? []);
        setMessages(res.messages ?? []);
      } catch { /* transient */ }
    }
    tick();
    pollRef.current = setInterval(tick, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state.joined, state.status, token, code, inviteToken]);

  // Heartbeat while we hold a token
  useEffect(() => {
    if (!gtRef.current) return undefined;
    hbRef.current = setInterval(() => { atlas.calls.guest.heartbeat(gtRef.current).catch(() => {}); }, 20000);
    return () => { if (hbRef.current) clearInterval(hbRef.current); };
  }, [guestToken]);

  const fetchLivekitToken = useCallback(async () => {
    const res = unwrap(await atlas.calls.guest.token(gtRef.current));
    return res; // { livekitUrl, token }
  }, []);

  const sendMessage = useCallback(async (body) => {
    const res = unwrap(await atlas.calls.guest.sendMessage(gtRef.current, body));
    if (res?.message) setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
  }, []);

  const leave = useCallback(async () => {
    if (gtRef.current) await atlas.calls.guest.leave(gtRef.current).catch(() => {});
    setState((s) => ({ ...s, status: "LEFT" }));
  }, []);

  return {
    phase: guestPhase(state),
    state, call, livekitUrl, guests, messages, joining,
    join, fetchLivekitToken, sendMessage, leave,
  };
}
```

**Simplify the "waiting" retry:** delete the half-baked retry block inside
`tick()`. Instead, in `GuestCallScreen`, when `phase === "lobby"` and
`state.status === "waiting"`, keep a `setInterval` that re-invokes `join()`
with the same form values every 4 s until `status` becomes `LOBBY`/`ADMITTED`.
Keep `useGuestCall` free of the form values.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/guest/useGuestCall.js
git commit -m "$(cat <<'EOF'
feat(calls): useGuestCall — guest token, state poll, heartbeat, leave

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `GuestRoomChat` + `GuestCallRoom`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/guest/GuestRoomChat.jsx`
- Create: `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallRoom.jsx`

- [ ] **Step 1: `GuestRoomChat`**

```jsx
import { RoomChatView } from "../RoomChatView";
import { mergeRoomMessages } from "../lib/roomChat";

// Guest-side wrapper. `polled` = messages from useGuestCall state;
// `liveIncoming` = LiveKit data-channel messages accumulated by GuestCallRoom.
export function GuestRoomChat({ polled, liveIncoming, onSend, myName }) {
  return (
    <RoomChatView
      messages={mergeRoomMessages(polled, liveIncoming)}
      onSend={onSend}
      currentName={myName}
      notice="Chat de la llamada — solo visible aquí."
    />
  );
}
```

- [ ] **Step 2: `GuestCallRoom`**

A trimmed LiveKit room. Reuse the participant-tile rendering approach from
`CallRoomLayout` (either import shared bits if they are exported, or inline a
minimal `<video>` grid — `CallRoomLayout` keeps `ParticipantTile` private, so
inline a compact version here; keep it < 200 lines).

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Button } from "@atlas/ui";
import { Mic, MicOff, Camera, CameraOff, MonitorUp, PhoneOff, MessageSquare } from "lucide-react";
import { GuestRoomChat } from "./GuestRoomChat";

function Tile({ participant, mirror }) {
  const ref = useRef(null);
  const camPub = participant?.getTrackPublication?.(Track.Source.Camera);
  const screenPub = participant?.getTrackPublication?.(Track.Source.ScreenShare);
  const pub = (screenPub?.track && !screenPub.isMuted) ? screenPub : camPub;
  const track = pub?.track && !pub.isMuted ? pub.track : null;
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return undefined;
    track.attach(el);
    return () => track.detach(el);
  }, [track]);
  const name = participant?.name || participant?.identity || "Participante";
  return (
    <div className="relative min-h-0 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
      {track ? (
        <video ref={ref} autoPlay playsInline muted={participant?.isLocal}
          className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`} />
      ) : (
        <div className="flex h-full items-center justify-center text-2xl font-semibold text-violet-100">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{name}</span>
    </div>
  );
}

export function GuestCallRoom({ fetchLivekitToken, messages, onSendMessage, onLeave, myName }) {
  const room = useMemo(() => new Room({ adaptiveStream: true, dynacast: true }), []);
  const [, force] = useState(0);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(false);
  const [screen, setScreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [live, setLive] = useState([]);
  const refresh = useCallback(() => force((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const onData = (payload, participant) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === "chat") {
          setLive((p) => [...p.slice(-199), {
            body: msg.body, senderName: msg.senderName,
            senderKind: participant?.identity?.startsWith?.("guest_") ? "guest" : "user",
            createdAt: msg.createdAt ?? new Date().toISOString(),
          }]);
        }
      } catch { /* ignore */ }
    };
    [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected]
      .forEach((e) => room.on(e, refresh));
    room.on(RoomEvent.DataReceived, onData);
    (async () => {
      try {
        const { livekitUrl, token } = await fetchLivekitToken();
        if (cancelled) return;
        await room.connect(livekitUrl, token);
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.startAudio().catch(() => {});
        refresh();
      } catch { /* surfaced by the parent poll (KICKED / not live) */ }
    })();
    return () => {
      cancelled = true;
      room.off(RoomEvent.DataReceived, onData);
      room.disconnect();
    };
  }, [room, fetchLivekitToken, refresh]);

  const remote = Array.from(room.remoteParticipants.values());
  const tiles = [room.localParticipant, ...remote];

  const publishChat = useCallback((body) => {
    const echo = { type: "chat", body, senderName: myName, senderKind: "guest", createdAt: new Date().toISOString() };
    try { room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(echo)), { reliable: true }); } catch {}
    onSendMessage(body);
  }, [room, myName, onSendMessage]);

  async function toggleMic() { const n = !mic; await room.localParticipant.setMicrophoneEnabled(n); setMic(n); }
  async function toggleCam() { const n = !cam; await room.localParticipant.setCameraEnabled(n); setCam(n); refresh(); }
  async function toggleScreen() {
    try { const n = !screen; await room.localParticipant.setScreenShareEnabled(n); setScreen(n); refresh(); } catch {}
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white">
      <main className="relative min-h-0 flex-1 p-2 sm:p-4">
        {showChat ? (
          <GuestRoomChat polled={messages} liveIncoming={live} onSend={publishChat} myName={myName} />
        ) : (
          <div className={`mx-auto grid h-full max-w-5xl gap-2 ${tiles.length <= 1 ? "grid-cols-1" : tiles.length === 2 ? "sm:grid-cols-2" : "grid-cols-2"}`}>
            {tiles.map((p, i) => <Tile key={p.sid || p.identity || i} participant={p} mirror={p?.isLocal && cam} />)}
          </div>
        )}
      </main>
      <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-black/30 p-3">
        <Button variant={mic ? "secondary" : "destructive"} size="icon" className="h-11 w-11 rounded-full" onClick={toggleMic}>
          {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button variant={cam ? "secondary" : "destructive"} size="icon" className="h-11 w-11 rounded-full" onClick={toggleCam}>
          {cam ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
        </Button>
        <Button variant={screen ? "default" : "secondary"} size="icon" className="h-11 w-11 rounded-full" onClick={toggleScreen}>
          <MonitorUp className="h-5 w-5" />
        </Button>
        <Button variant={showChat ? "default" : "secondary"} size="icon" className="h-11 w-11 rounded-full" onClick={() => setShowChat((v) => !v)}>
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button variant="destructive" size="icon" className="h-11 w-11 rounded-full sm:w-auto sm:px-6" onClick={onLeave}>
          <PhoneOff className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Salir</span>
        </Button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/guest/GuestRoomChat.jsx apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallRoom.jsx
git commit -m "$(cat <<'EOF'
feat(calls): GuestCallRoom + GuestRoomChat — trimmed LiveKit room for guests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `GuestCallScreen`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button, TextField } from "@atlas/ui";
import { Loader2 } from "lucide-react";
import { useGuestCall } from "./useGuestCall";
import { endedReason } from "./lib/guestCall";
import { GuestCallRoom } from "./GuestCallRoom";

export default function GuestCallScreen() {
  const { token = null } = useParams();
  const [sp] = useSearchParams();
  const inviteToken = sp.get("i");
  const urlCode = sp.get("code");

  // Force light, chromeless (same pattern as PublicNoteScreen)
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (hadDark) html.classList.add("dark"); };
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(urlCode ?? "");
  const gc = useGuestCall({ token, code: token ? null : code, inviteToken });
  const formRef = useRef({ name: "", email: "" });
  const waitTimer = useRef(null);

  // Re-attempt join while waiting for the call to start
  useEffect(() => {
    if (gc.phase === "lobby" && gc.state.status === "waiting") {
      waitTimer.current = setInterval(() => {
        gc.join({ displayName: formRef.current.name, email: formRef.current.email || undefined });
      }, 4000);
      return () => { if (waitTimer.current) clearInterval(waitTimer.current); };
    }
    return undefined;
  }, [gc.phase, gc.state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function submitGate(e) {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return;
    formRef.current = { name: n, email: email.trim() };
    gc.join({ displayName: n, email: email.trim() || undefined });
  }

  if (gc.phase === "room") {
    return (
      <GuestCallRoom
        fetchLivekitToken={gc.fetchLivekitToken}
        messages={gc.messages}
        onSendMessage={gc.sendMessage}
        onLeave={gc.leave}
        myName={formRef.current.name || name}
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        {gc.phase === "gate" && (
          <form onSubmit={submitGate} className="space-y-4">
            <h1 className="text-lg font-semibold text-gray-900">Unirte a la llamada</h1>
            <TextField label="Tu nombre" value={name} onChange={(e) => setName(e?.target?.value ?? e)} autoFocus required />
            {!inviteToken && (
              <TextField label="Correo (opcional)" type="email" value={email} onChange={(e) => setEmail(e?.target?.value ?? e)} />
            )}
            {inviteToken && <p className="text-xs text-gray-500">Invitación por correo verificada.</p>}
            {!token && (
              <TextField label="Código de la llamada" value={code} onChange={(e) => setCode((e?.target?.value ?? e).toUpperCase())} required />
            )}
            {gc.state.error && <p className="text-sm text-red-600">{gc.state.error}</p>}
            <Button type="submit" className="w-full" disabled={gc.joining || name.trim().length < 2}>
              {gc.joining ? "Conectando..." : "Entrar"}
            </Button>
          </form>
        )}

        {gc.phase === "lobby" && (
          <div className="space-y-3 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            <p className="text-sm text-gray-700">
              {gc.state.status === "waiting"
                ? "La llamada aún no ha comenzado. Te uniremos automáticamente."
                : "Esperando a que el anfitrión te admita..."}
            </p>
          </div>
        )}

        {gc.phase === "ended" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-700">{endedReason(gc.state)}</p>
            <Button variant="secondary" className="w-full" onClick={() => window.location.reload()}>Volver a intentar</Button>
          </div>
        )}

        {gc.phase === "error" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-red-600">{gc.state.error || "Algo salió mal."}</p>
            <Button variant="secondary" className="w-full" onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx
git commit -m "$(cat <<'EOF'
feat(calls): GuestCallScreen — public name gate, lobby, guest call room

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Routes in `AppEntry.jsx`

**Files:**
- Modify: `apps/desktop/src/app/AppEntry.jsx`

- [ ] **Step 1: Lazy import + routes**

Near the other screen imports:

```jsx
const GuestCallScreen = lazy(() => import("../modules/atlas.chat/calls/guest/GuestCallScreen.jsx"));
```

(If `AppEntry.jsx` does not already `import { lazy, Suspense } from "react"`,
add it, and wrap the element in `<Suspense fallback={null}>`.)

Inside **both** `<Route path="/p" element={<PublicShell />}>` and
`<Route path="/app/p" element={<PublicShell />}>` groups, **before** any
`path="*"` catch-all, add:

```jsx
<Route path="call/:token" element={<Suspense fallback={null}><GuestCallScreen /></Suspense>} />
<Route path="call" element={<Suspense fallback={null}><GuestCallScreen /></Suspense>} />
```

The `/p` group currently ends with `<Route path="*" element={<PublicModuleOutlet />} />`
— the two `call` routes must come **above** it.

- [ ] **Step 2: Build + lint**

```bash
pnpm --filter @atlas/desktop build:web
pnpm lint
node --test apps/desktop/src/modules/atlas.chat/calls/guest/lib/__tests__/guestCall.test.js
```
Expected: clean + green.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/app/AppEntry.jsx
git commit -m "$(cat <<'EOF'
feat(calls): public /p/call/:token and /p/call routes for guest join

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: End-to-end verification

- [ ] `pnpm --filter @atlas/desktop build:web` — clean, guest chunk resolves
      `livekit-client`.
- [ ] `pnpm lint` — clean.
- [ ] All three calls pure-helper test dirs green.
- [ ] Manual smoke (needs `LIVEKIT_*` + a member browser + a private window):
  1. Member starts a call, opens **Invitar**, copies the link.
  2. Private window → paste link → name → **Entrar**.
  3. Member's roster shows the lobby entry → **Admitir**.
  4. Guest lands in `GuestCallRoom`; two-way audio; guest opens chat, sends a
     message; member's in-call panel (now room-mode) shows it and vice versa.
  5. Member **Expulsar** → guest sees "El anfitrión te sacó de la llamada."
  6. Code path: `/p/call` → type the code → same flow.
  7. `require_lobby` off → guest joins straight into the room.
  8. Member ends the call → guest sees "La llamada terminó."
  9. 390 + 1440 screenshots of the gate, lobby, and guest room.

---

## Self-review

- **Spec §6.2:** public routes (T5), `GuestCallScreen` gate/lobby/room/ended
  (T4), `GuestCallRoom` trimmed controls + chat (T3), `useGuestCall` token in
  memory + poll + heartbeat + leave (T2), light/chromeless (T4), invite-token
  read-only email (T4).
- **Spec §6.3:** `RoomChatView` reused via `GuestRoomChat` (T3);
  `mergeRoomMessages` reused (T3).
- **Placeholder scan:** the `useGuestCall` "waiting retry" half-block is
  explicitly deleted in T2 Step 1's note and replaced by the interval in
  `GuestCallScreen` (T4). No TBD.
- **Type consistency:** `guestPhase(state)` ↔ its test ↔ `useGuestCall`;
  `useGuestCall` returns `{ phase, state, call, livekitUrl, guests, messages,
  joining, join, fetchLivekitToken, sendMessage, leave }` — all consumed by
  `GuestCallScreen`. `fetchLivekitToken()` → `{ livekitUrl, token }` consumed
  by `GuestCallRoom`. `atlas.calls.guest.*` names match Plan A's SDK.
- **Security:** guest token only in React state/refs, never persisted; page
  never imports `AuthProvider` or any authed hook; `PublicShell` has no
  `CallsProvider`.
