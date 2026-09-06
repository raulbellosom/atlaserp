# Guest access to calls — Plan B (Host UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a call host (initiator or conversation admin) create/revoke a guest link + short code, invite by email, admit/deny/kick/mute guests from within the call room, and — whenever a call has any guest — switch the in-call chat panel to the ephemeral call-room chat so members and guests can talk without writing to the org conversation.

**Architecture:** New `CallShareDialog` + `CallGuestRoster` components opened from the call header. A shared `RoomChatView` (plain-text list + composer) wrapped by `CallRoomChat` (member transport: `GET/POST /calls/:callId/messages` + LiveKit data channel). `CallRoom` derives `hasGuests` from a guests poll, wires a `RoomEvent.DataReceived` handler, and passes `roomMode` to `CallChatPanel`, which renders `CallRoomChat` instead of `ChatWindow` when guests are present. `CallsProvider` surfaces guest realtime events + a `pendingGuestCount`.

**Tech Stack:** React 18, TanStack Query, `@atlas/ui`, `@atlas/sdk` (`atlas.calls.*` from Plan A), `livekit-client` data channel.

**Spec:** `docs/superpowers/specs/2026-09-06-call-guest-access-design.md` §6.1, §6.3.

**Depends on:** Plan A merged (endpoints live). **Blocked by:** any uncommitted
work in `CallsProvider.jsx` — commit/stash it before Task 6.

---

## Conventions

- `atlas` client from `apps/desktop/src/lib/atlas.js`; auth token from
  `useAuth().session?.access_token`.
- Every form control from `@atlas/ui` (`TextField`, `TextareaField`,
  `CheckboxField`, `NumberField`, `DateField`, `Dialog`, `ConfirmDialog`,
  `Button`, `EmptyState`). No native `<select>`/`<input>`/`window.confirm`.
- All UI strings Spanish; code/comments English.
- Poll intervals via `setInterval` in a `useEffect` with cleanup; never leak.

---

## Task 1: `useCallGuests` hook + `useCallRoomLink` hook

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/hooks/useCallGuests.js`

- [ ] **Step 1: Implement**

```js
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../auth/AuthProvider";
import { atlas } from "../../../../lib/atlas";

function unwrap(r) { return r?.data ?? r; }

// Polls the host guest roster for a live call. Returns { guests, lobby,
// admitted, refresh, admit, deny, kick, mute }. `enabled` gates the polling
// (pass false when there is no call / user is not a manager).
export function useCallGuests(callId, { enabled = true, intervalMs = 3000 } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [guests, setGuests] = useState([]);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    if (!callId || !token || !enabled) return;
    try {
      const res = unwrap(await atlas.calls.listGuests(callId, token));
      setGuests(res?.guests ?? []);
      setError(null);
    } catch (e) {
      // 403 => not a manager; stop trying, surface nothing
      setError(e);
    }
  }, [callId, token, enabled]);

  useEffect(() => {
    if (!callId || !token || !enabled) { setGuests([]); return undefined; }
    refresh();
    timer.current = setInterval(refresh, intervalMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [callId, token, enabled, intervalMs, refresh]);

  const act = useCallback(async (fn) => { await fn(); await refresh(); }, [refresh]);

  return {
    guests,
    lobby: guests.filter((g) => g.status === "LOBBY"),
    admitted: guests.filter((g) => g.status === "ADMITTED"),
    error,
    refresh,
    admit: (guestId) => act(() => atlas.calls.admitGuest(callId, guestId, token)),
    deny: (guestId) => act(() => atlas.calls.denyGuest(callId, guestId, token)),
    kick: (guestId) => act(() => atlas.calls.kickGuest(callId, guestId, token)),
    mute: (guestId, muted) => act(() => atlas.calls.muteGuest(callId, guestId, muted, token)),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/hooks/useCallGuests.js
git commit -m "$(cat <<'EOF'
feat(calls): useCallGuests hook — poll + moderate the guest roster

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `CallShareDialog`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/CallShareDialog.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, TextField, TextareaField, CheckboxField, NumberField, ConfirmDialog,
} from "@atlas/ui";
import { Copy, Check, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function unwrap(r) { return r?.data ?? r; }

export function CallShareDialog({ open, onOpenChange, conversationId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState("");
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!open || !conversationId || !token) return;
    setLoading(true);
    atlas.calls.createLink(conversationId, token)
      .then((r) => setLink(unwrap(r)?.link ?? null))
      .catch((e) => toast.error(e?.message || "No se pudo generar el enlace."))
      .finally(() => setLoading(false));
  }, [open, conversationId, token]);

  async function patch(next) {
    try {
      const r = await atlas.calls.updateLink(conversationId, next, token);
      setLink(unwrap(r)?.link ?? link);
    } catch (e) { toast.error(e?.message || "No se pudo actualizar."); }
  }

  async function regenerate() {
    setLoading(true);
    try {
      await atlas.calls.revokeLink(conversationId, token);
      const r = await atlas.calls.createLink(conversationId, token);
      setLink(unwrap(r)?.link ?? null);
      toast.success("Enlace regenerado.");
    } catch (e) { toast.error(e?.message || "No se pudo regenerar."); }
    finally { setLoading(false); }
  }

  async function revoke() {
    try {
      await atlas.calls.revokeLink(conversationId, token);
      setLink(null);
      setConfirmRevoke(false);
      toast.success("Enlace revocado.");
    } catch (e) { toast.error(e?.message || "No se pudo revocar."); }
  }

  async function sendInvites() {
    const list = emails.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    try {
      const r = unwrap(await atlas.calls.sendInvites(conversationId, list, token));
      setInviteResult(r);
      setEmails("");
      const n = (r?.invited?.length ?? 0) + (r?.matchedUsers?.length ?? 0);
      if (n) toast.success(`${n} invitación(es) enviadas.`);
      if (r?.pendingManual?.length) toast.message("Algunas quedaron pendientes de envío — copia el enlace.");
    } catch (e) { toast.error(e?.message || "No se pudieron enviar."); }
  }

  function copy(value, key) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Invitar a la llamada</DialogTitle></DialogHeader>

        {loading && !link ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Generando enlace...</p>
        ) : !link ? (
          <div className="py-6 text-center">
            <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">No hay un enlace activo.</p>
            <Button onClick={regenerate}>Generar enlace</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Enlace</label>
              <div className="flex gap-2">
                <input readOnly value={link.url} className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm" />
                <Button variant="secondary" size="icon" onClick={() => copy(link.url, "url")} title="Copiar enlace">
                  {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Código</label>
              <div className="flex gap-2">
                <input readOnly value={link.code} className="w-40 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 font-mono text-lg tracking-widest" />
                <Button variant="secondary" size="icon" onClick={() => copy(link.code, "code")} title="Copiar código">
                  {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={regenerate} title="Regenerar" disabled={loading}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <CheckboxField
              label="Requiere aprobación del anfitrión (sala de espera)"
              checked={link.requireLobby}
              onChange={(v) => patch({ requireLobby: typeof v === "boolean" ? v : v?.target?.checked })}
            />
            <NumberField
              label="Máximo de usos (opcional)"
              value={link.maxUses ?? ""}
              onChange={(v) => {
                const n = Number(v?.target?.value ?? v);
                patch({ maxUses: Number.isFinite(n) && n > 0 ? n : null });
              }}
              min={1}
            />

            <div>
              <TextareaField
                label="Invitar por correo"
                placeholder="ana@empresa.com, luis@otra.com"
                value={emails}
                onChange={(e) => setEmails(e?.target?.value ?? e)}
                rows={2}
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={sendInvites} disabled={!emails.trim()}>Enviar invitaciones</Button>
              </div>
              {inviteResult?.matchedUsers?.length > 0 && (
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {inviteResult.matchedUsers.length} ya tienen cuenta — agrégalos como miembros y llámalos normalmente.
                </p>
              )}
              {inviteResult?.pendingManual?.map((p) => (
                <div key={p.inviteId} className="mt-2 flex items-center gap-2 text-xs">
                  <span className="truncate text-[hsl(var(--muted-foreground))]">{p.email}: envío pendiente</span>
                  <button type="button" className="underline" onClick={() => copy(p.url, p.inviteId)}>
                    {copied === p.inviteId ? "copiado" : "copiar enlace"}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between border-t border-[hsl(var(--border))] pt-3">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{link.useCount} uso(s)</span>
              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setConfirmRevoke(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Revocar enlace
              </Button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmRevoke}
          onOpenChange={setConfirmRevoke}
          title="Revocar enlace"
          description="El enlace y el código dejarán de funcionar. Los invitados conectados serán expulsados."
          confirmLabel="Revocar"
          variant="destructive"
          onConfirm={revoke}
        />
      </DialogContent>
    </Dialog>
  );
}
```

**Verify** the exact `@atlas/ui` prop contracts for `TextareaField` /
`CheckboxField` / `NumberField` against an existing usage (e.g. in a PFM or
finance screen) and adjust the `onChange` unwrapping to match — the code above
tolerates both `e.target.value` and a bare value.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallShareDialog.jsx
git commit -m "$(cat <<'EOF'
feat(calls): CallShareDialog — guest link, code, options, email invites, revoke

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `CallGuestRoster`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/CallGuestRoster.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useState } from "react";
import { Button, ConfirmDialog, EmptyState } from "@atlas/ui";
import { Check, X, MicOff, Mic, UserX } from "lucide-react";

// `guestsApi` is the object returned by useCallGuests(). Rendered inside the
// call room (host only).
export function CallGuestRoster({ guestsApi }) {
  const { lobby, admitted, admit, deny, kick, mute } = guestsApi;
  const [muted, setMuted] = useState({}); // guestId -> bool (optimistic)
  const [confirmKick, setConfirmKick] = useState(null);

  const empty = lobby.length === 0 && admitted.length === 0;

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {empty && (
        <EmptyState title="Sin invitados" description="Comparte el enlace para que se unan invitados externos." />
      )}

      {lobby.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Esperando aprobación
          </p>
          <ul className="space-y-1.5">
            {lobby.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1.5">
                <span className="flex-1 truncate">{g.displayName}</span>
                <Button size="sm" className="h-7 px-2" onClick={() => admit(g.id)}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Admitir
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500" onClick={() => deny(g.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {admitted.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            En la llamada
          </p>
          <ul className="space-y-1.5">
            {admitted.map((g) => {
              const isMuted = !!muted[g.id];
              return (
                <li key={g.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5">
                  <span className="flex-1 truncate">{g.displayName}</span>
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    title={isMuted ? "Reactivar micrófono" : "Silenciar"}
                    onClick={() => { setMuted((m) => ({ ...m, [g.id]: !isMuted })); mute(g.id, !isMuted); }}
                  >
                    {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                    title="Expulsar" onClick={() => setConfirmKick(g)}
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmKick}
        onOpenChange={(v) => !v && setConfirmKick(null)}
        title="Expulsar invitado"
        description={confirmKick ? `Se sacará a ${confirmKick.displayName} de la llamada.` : ""}
        confirmLabel="Expulsar"
        variant="destructive"
        onConfirm={() => { kick(confirmKick.id); setConfirmKick(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallGuestRoster.jsx
git commit -m "$(cat <<'EOF'
feat(calls): CallGuestRoster — admit/deny lobby + mute/kick admitted guests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `RoomChatView` + `useCallRoomMessages` + `CallRoomChat`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/RoomChatView.jsx`
- Create: `apps/desktop/src/modules/atlas.chat/calls/hooks/useCallRoomMessages.js`
- Create: `apps/desktop/src/modules/atlas.chat/calls/CallRoomChat.jsx`
- Create: `apps/desktop/src/modules/atlas.chat/calls/lib/roomChat.js` + `__tests__/roomChat.test.js`

- [ ] **Step 1: Pure merge helper + test**

`lib/roomChat.js`:

```js
// Merge polled DB messages with live LiveKit-data-channel messages, deduped by
// id, sorted by createdAt then id. Live messages that lack a real id (optimistic
// echoes) use `local:<nonce>` and are dropped once a DB row with matching body
// + sender + close timestamp arrives.
export function mergeRoomMessages(dbMessages = [], liveMessages = []) {
  const byId = new Map();
  for (const m of dbMessages) byId.set(m.id, m);
  for (const m of liveMessages) {
    if (m.id && byId.has(m.id)) continue;
    if (m.id) { byId.set(m.id, m); continue; }
    // optimistic: keep only if no db row already covers it
    const dup = dbMessages.some(
      (d) => d.body === m.body && d.senderName === m.senderName
        && Math.abs(new Date(d.createdAt).getTime() - new Date(m.createdAt).getTime()) < 15000,
    );
    if (!dup) byId.set(m.localId ?? `local:${m.createdAt}:${m.body}`, m);
  }
  return [...byId.values()].sort((a, b) => {
    const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return t !== 0 ? t : String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}
```

`__tests__/roomChat.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeRoomMessages } from "../roomChat.js";

describe("mergeRoomMessages", () => {
  it("dedupes by id and sorts by time", () => {
    const db = [{ id: "b", body: "2", createdAt: "2026-09-06T10:00:02Z" }, { id: "a", body: "1", createdAt: "2026-09-06T10:00:01Z" }];
    const out = mergeRoomMessages(db, [{ id: "a", body: "1", createdAt: "2026-09-06T10:00:01Z" }]);
    assert.deepEqual(out.map((m) => m.id), ["a", "b"]);
  });
  it("keeps an optimistic live message until a matching db row lands", () => {
    const live = [{ body: "hola", senderName: "Ana", createdAt: "2026-09-06T10:00:05Z" }];
    const before = mergeRoomMessages([], live);
    assert.equal(before.length, 1);
    const after = mergeRoomMessages([{ id: "x", body: "hola", senderName: "Ana", createdAt: "2026-09-06T10:00:06Z" }], live);
    assert.deepEqual(after.map((m) => m.id), ["x"]);
  });
});
```

Run: `node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/roomChat.test.js` → PASS.

- [ ] **Step 2: `useCallRoomMessages`**

```js
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../auth/AuthProvider";
import { atlas } from "../../../../lib/atlas";
import { mergeRoomMessages } from "../lib/roomChat";

function unwrap(r) { return r?.data ?? r; }

// Member transport for the ephemeral call-room chat. `publishData` is the
// LiveKit room.localParticipant.publishData bound by CallRoom; `liveIncoming`
// is the array CallRoom accumulates from RoomEvent.DataReceived.
export function useCallRoomMessages(callId, { enabled, liveIncoming = [], publishData }) {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const [dbMessages, setDbMessages] = useState([]);
  const sinceRef = useRef(null);
  const timer = useRef(null);

  const poll = useCallback(async () => {
    if (!callId || !token || !enabled) return;
    try {
      const res = unwrap(await atlas.calls.listMessages(callId, sinceRef.current, token));
      const incoming = res?.messages ?? [];
      if (incoming.length) {
        setDbMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
          sinceRef.current = merged[merged.length - 1]?.id ?? sinceRef.current;
          return merged;
        });
      }
    } catch { /* transient */ }
  }, [callId, token, enabled]);

  useEffect(() => {
    if (!enabled) { setDbMessages([]); sinceRef.current = null; return undefined; }
    poll();
    timer.current = setInterval(poll, 3000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [enabled, poll]);

  const send = useCallback(async (body) => {
    const text = String(body ?? "").trim();
    if (!text || !token) return;
    // optimistic over data channel
    const echo = { body: text, senderName: userProfile?.displayName ?? "Tú", senderKind: "user", createdAt: new Date().toISOString(), mine: true };
    publishData?.({ type: "chat", ...echo });
    try {
      const res = unwrap(await atlas.calls.sendMessage(callId, text, token));
      if (res?.message) setDbMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    } catch { /* the poll will still pick it up */ }
  }, [callId, token, userProfile?.displayName, publishData]);

  return { messages: mergeRoomMessages(dbMessages, liveIncoming), send };
}
```

- [ ] **Step 3: `RoomChatView`**

```jsx
import { useEffect, useRef, useState } from "react";
import { Button } from "@atlas/ui";
import { Send } from "lucide-react";

function timeLabel(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

// Presentational plain-text room chat. No markdown, no mentions, no HTML.
export function RoomChatView({ messages, onSend, notice, currentName }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  function submit(e) {
    e?.preventDefault?.();
    const t = draft.trim();
    if (!t) return;
    onSend(t);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[hsl(var(--background))]">
      {notice && (
        <p className="shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
          {notice}
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m, i) => {
          const mine = m.mine || m.senderName === currentName;
          return (
            <div key={m.id ?? `l${i}`} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {m.senderName}{m.senderKind === "guest" ? " · invitado" : ""} · {timeLabel(m.createdAt)}
              </span>
              <span className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "bg-[hsl(var(--muted))]"}`}>
                {m.body}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-[hsl(var(--border))] p-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
          rows={1}
          placeholder="Mensaje..."
          className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
```

(The bare `<textarea>` here is acceptable — it is a chat composer, the same
pattern `MessageComposer` uses internally; there is no `@atlas/ui` chat-composer
primitive. Keep it minimal.)

- [ ] **Step 4: `CallRoomChat`**

```jsx
import { useAuth } from "../../../auth/AuthProvider";
import { RoomChatView } from "./RoomChatView";
import { useCallRoomMessages } from "./hooks/useCallRoomMessages";

// Member-side wrapper: ephemeral call-room chat shown in CallChatPanel whenever
// the call has guests.
export function CallRoomChat({ callId, liveIncoming, publishData }) {
  const { userProfile } = useAuth();
  const { messages, send } = useCallRoomMessages(callId, { enabled: !!callId, liveIncoming, publishData });
  return (
    <RoomChatView
      messages={messages}
      onSend={send}
      currentName={userProfile?.displayName}
      notice="Chat temporal de la llamada — no se guarda en la conversación."
    />
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/RoomChatView.jsx apps/desktop/src/modules/atlas.chat/calls/CallRoomChat.jsx apps/desktop/src/modules/atlas.chat/calls/hooks/useCallRoomMessages.js apps/desktop/src/modules/atlas.chat/calls/lib/roomChat.js apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/roomChat.test.js
git commit -m "$(cat <<'EOF'
feat(calls): RoomChatView + member transport for the ephemeral call-room chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `CallChatPanel` `roomMode`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallChatPanel.jsx`

- [ ] **Step 1: Add the `roomMode` branch**

`CallChatPanel` currently always renders `<ChatWindow ... />`. Give it new
props `roomMode` (`"conversation" | "call"`, default `"conversation"`),
`callId`, `liveIncoming`, `publishData`. When `roomMode === "call"` render
`<CallRoomChat callId={callId} liveIncoming={liveIncoming} publishData={publishData} />`
inside the same themed shell instead of the conversation-detail fetch +
`ChatWindow`.

```jsx
// ...imports + add:
import { CallRoomChat } from "./CallRoomChat";

export function CallChatPanel({ conversationId, onClose, roomMode = "conversation", callId = null, liveIncoming = [], publishData = null }) {
  return (
    <ChatPreferencesProvider>
      <CallChatPanelInner
        conversationId={conversationId}
        onClose={onClose}
        roomMode={roomMode}
        callId={callId}
        liveIncoming={liveIncoming}
        publishData={publishData}
      />
    </ChatPreferencesProvider>
  );
}

function CallChatPanelInner({ conversationId, onClose, roomMode, callId, liveIncoming, publishData }) {
  const { prefs } = useChatPreferences();
  const isRoom = roomMode === "call";
  const { data, isLoading, isError } = useChatConversationDetail(isRoom ? null : conversationId);
  const conversation = unwrap(data);

  return (
    <div className="chat-glass-theme flex h-full w-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]" style={chatPreferencesStyle(prefs)}>
      {isRoom ? (
        <CallRoomChat callId={callId} liveIncoming={liveIncoming} publishData={publishData} />
      ) : isLoading ? (
        /* ...existing spinner... */ null
      ) : isError || !conversation ? (
        /* ...existing error... */ null
      ) : (
        <ChatWindow conversation={conversation} embedded="call" onCollapse={onClose} />
      )}
    </div>
  );
}
```

Keep the existing spinner / error JSX where the `null` placeholders are.
`useChatConversationDetail(null)` must be a no-op — it already guards on
`Boolean(token && conversationId)`, so passing `null` disables the query.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallChatPanel.jsx
git commit -m "$(cat <<'EOF'
feat(calls): CallChatPanel roomMode — ephemeral call-room chat when guests present

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `CallsProvider` guest events + `pendingGuestCount`

> **Do not start until the working tree's `CallsProvider.jsx` changes are
> committed or stashed.**

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallsProvider.jsx`

- [ ] **Step 1: Subscribe to guest realtime events**

In `CallsProvider`, alongside the existing `useCallSynchronization` /
realtime `on(...)` wiring, add a `pendingGuestCount` state and an effect that
subscribes (via the same `on` from `useRealtimeContext()`) to
`chat.call.guest_waiting`, `chat.call.guest_joined`, `chat.call.guest_left`,
`chat.call.guest_admitted`, `chat.call.guest_denied`, `chat.call.guest_kicked`.

```js
const [pendingGuestCount, setPendingGuestCount] = useState(0);

useEffect(() => {
  if (!on) return undefined;
  const bump = () => setPendingGuestCount((n) => n + 1);
  const clear = () => setPendingGuestCount((n) => Math.max(0, n - 1));
  const subs = [
    on("chat.call.guest_waiting", (p) => {
      bump();
      if (activeRef.current?.call?.id === p?.callId) {
        toast.message(`${p?.name ?? "Un invitado"} quiere unirse a la llamada.`);
      }
    }),
    on("chat.call.guest_joined", () => {}),
    on("chat.call.guest_admitted", clear),
    on("chat.call.guest_denied", clear),
    on("chat.call.guest_left", () => {}),
    on("chat.call.guest_kicked", () => {}),
  ];
  return () => subs.forEach((u) => u?.());
}, [on]);
```

Reset `pendingGuestCount` to 0 in `finishLocalCall` / `leaveActive`.

Add `pendingGuestCount` to the context `value` memo + its dependency array.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallsProvider.jsx
git commit -m "$(cat <<'EOF'
feat(calls): CallsProvider — guest lobby realtime events + pendingGuestCount

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire `CallRoom` + `CallRoomLayout`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx`

- [ ] **Step 1: `CallRoom` — guests poll, data channel, roomMode**

In `CallRoom`:

1. Import `useCallGuests`, `CallGuestRoster`.
2. `const isManager = isInitiator; // roster/share are hidden for non-managers; the API is the real gate`
   (a member without `channel.manage` who is not the initiator will get 403
   from the roster poll — `useCallGuests` swallows it and shows nothing).
3. `const guestsApi = useCallGuests(session.call.id, { enabled: isManager });`
4. `const hasGuests = guestsApi.guests.some((g) => g.status === "ADMITTED" || g.status === "LOBBY");`
5. **LiveKit data channel** — in the existing `RoomEvent` effect, add:
   ```js
   const [liveMessages, setLiveMessages] = useState([]);
   // inside the effect's handler registration:
   const handleData = (payload, participant) => {
     try {
       const text = new TextDecoder().decode(payload);
       const msg = JSON.parse(text);
       if (msg?.type === "chat") {
         setLiveMessages((prev) => [...prev.slice(-199), {
           body: msg.body, senderName: msg.senderName,
           senderKind: msg.senderKind ?? (participant?.identity?.startsWith?.("guest_") ? "guest" : "user"),
           createdAt: msg.createdAt ?? new Date().toISOString(),
         }]);
       }
     } catch { /* ignore non-chat data */ }
   };
   room.on(RoomEvent.DataReceived, handleData);
   // cleanup: room.off(RoomEvent.DataReceived, handleData);
   ```
6. `const publishData = useCallback((obj) => {
     try { room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true }); } catch {}
   }, [room]);`
7. Build the `chatPanelNode` for **roomMode** when `hasGuests`:
   ```js
   const chatPanelNode =
     !isMobile || mobileView === "chat"
       ? (
         <CallChatPanel
           conversationId={conversationId}
           onClose={handleChatClose}
           roomMode={hasGuests ? "call" : "conversation"}
           callId={session.call.id}
           liveIncoming={liveMessages}
           publishData={publishData}
         />
       )
       : null;
   ```
8. Pass `guestsApi` + `hasGuests` + `isManager` into the `chat` prop object
   sent to `CallRoomLayout` (add `roster: <CallGuestRoster guestsApi={guestsApi} />`,
   `hasGuests`, `canShare: isManager`, `onShare: () => setShareOpen(true)`),
   and render `<CallShareDialog open={shareOpen} onOpenChange={setShareOpen}
   conversationId={conversationId} />` as a sibling of `<CallRoomLayout>`.

- [ ] **Step 2: `CallRoomLayout` — "Compartir" button + roster slot**

In `CallRoomLayout`, from the `chat` prop also destructure
`hasGuests = false, canShare = false, onShare = () => {}, roster = null`.

1. Add a **"Compartir"** button to the `<header>` (next to the "Videollamada"
   badge), shown only when `canShare`:
   ```jsx
   {canShare && (
     <button type="button" onClick={onShare}
       className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 hover:text-white">
       <UserPlus className="h-3.5 w-3.5" /> Invitar
     </button>
   )}
   ```
   (`import { UserPlus } from "lucide-react"`.)
2. Render the **roster**: desktop — as a collapsible block above/below the
   participant grid inside `<main>` when `hasGuests || roster` should show
   (only render `roster` when `canShare`); mobile — behind a small roster
   button in the header that toggles a bottom `Sheet` (`@atlas/ui`) holding
   `{roster}`. Keep it simple: desktop always shows `{roster}` in a
   `max-h-48 overflow-y-auto border-t border-white/10` strip at the bottom of
   `<main>` when `canShare && (hasGuests || pendingLobby)`.
3. When `hasGuests`, the in-call panel already renders room-mode chat (Task 5)
   — no layout change needed there; the header notice line comes from
   `CallRoomChat`.

- [ ] **Step 3: Build + lint**

```bash
pnpm --filter @atlas/desktop build:web
pnpm lint
node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/roomChat.test.js
```
Expected: build clean, lint clean, test green.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx
git commit -m "$(cat <<'EOF'
feat(calls): wire guest roster, share dialog, data-channel + room-mode chat into the call room

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verification

- [ ] `pnpm --filter @atlas/desktop build:web` — clean.
- [ ] `pnpm lint` — clean.
- [ ] `node --test` on both calls pure-helper test dirs — green.
- [ ] Manual smoke (needs Plan C for the guest side; until then, verify with
      two member browsers): "Invitar" opens the dialog, link + code appear,
      toggles persist, "Revocar" works; with no guests the in-call panel is
      unchanged (`ChatWindow`); simulate a guest via curl (`POST
      /calls/guest/join` with the token) → roster shows the lobby entry →
      Admitir → the panel flips to room-mode chat for the member. 390 + 1440
      screenshots of the dialog + roster.

---

## Self-review

- **Spec §6.1:** share dialog (T2), roster admit/deny/mute/kick (T1+T3+T7),
  room-mode panel (T4+T5+T7), `CallsProvider` events + count (T6),
  `CallRoom`/`CallRoomLayout` wiring incl. data channel (T7).
- **Spec §6.3:** `RoomChatView` shared shell (T4); member transport (T4);
  SDK already done in Plan A.
- **Placeholder scan:** the `null` markers in T5/T7 explicitly say "keep the
  existing JSX"; no TBD.
- **Type consistency:** `useCallGuests` returns `{ guests, lobby, admitted,
  admit, deny, kick, mute, refresh }` — consumed by `CallGuestRoster`
  (`guestsApi`) and `CallRoom`. `mergeRoomMessages(db, live)` signature matches
  its test and `useCallRoomMessages`. `CallChatPanel` new props
  (`roomMode`, `callId`, `liveIncoming`, `publishData`) set by `CallRoom`,
  read by `CallChatPanelInner`.
- **Not changed:** the conversation `ChatWindow` path when there are no guests.
