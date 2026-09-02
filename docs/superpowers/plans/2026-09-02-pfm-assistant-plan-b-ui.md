# PFM Assistant — Plan B (UI sidebar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A collapsible right-hand sidebar inside the `atlas.pfm` module where the user chats with the assistant, sees answers, and confirms a proposed movement — wired to the Plan A endpoints.

**Architecture:** One targeted branch in `ModuleOutlet.jsx` mounts `<PfmAssistantSidebar/>` next to the PFM screen so its state survives navigation between PFM screens. The sidebar composes small focused components (thread list, message list, message bubble, action card, composer) and TanStack Query hooks in `use-pfm-assistant.js`. Pure formatting helpers live in `lib/assistant-format.js` with their own tests. The "register" button on a proposed movement calls the existing `useCreateMovement` hook (the normal validated endpoint) — the assistant never writes.

**Tech Stack:** React 18, TanStack Query, `@atlas/ui`, `@atlas/sdk` (`atlas.pfm.assistant.*` from Plan A), lucide-react, Tailwind, `node --test` for the pure helpers.

**Depends on:** Plan A merged (`docs/superpowers/plans/2026-09-02-pfm-assistant-plan-a-api.md`).
**Spec:** `docs/superpowers/specs/2026-09-02-pfm-assistant-design.md` §6.

---

## File Structure

**Create (all under `apps/desktop/src/modules/atlas.pfm/`):**
- `lib/assistant-format.js` — `threadTitle(text)`, `renderRichText(text)` (safe minimal markdown → React nodes), `describeProposedAction(action)`. Pure. ~90 lines.
- `hooks/use-pfm-assistant.js` — `useAssistantStatus`, `useAssistantThreads`, `useAssistantThread(id)`, `useSendAssistantMessage`, `useDeleteAssistantThread`. ~110 lines.
- `components/PfmAssistantSidebar.jsx` — collapse/expand shell, holds current threadId, localStorage for collapsed state. ~150 lines.
- `components/AssistantThreadList.jsx` — thread switcher + new + delete (`ConfirmDialog`). ~90 lines.
- `components/AssistantMessageList.jsx` — scroll region, maps messages, renders the trailing `AssistantActionCard`. ~70 lines.
- `components/AssistantMessage.jsx` — one bubble (user / assistant / system-error). ~50 lines.
- `components/AssistantActionCard.jsx` — proposed movement card, Registrar / Descartar. ~110 lines.
- `components/AssistantComposer.jsx` — textarea + send. ~60 lines.
- `__tests__/assistant-format.test.js`.

**Modify:**
- `apps/desktop/src/app/ModuleOutlet.jsx` — wrap the final `<Suspense>` render for `moduleKey === "atlas.pfm"`.

---

## Task 1: Pure formatting helpers

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/lib/assistant-format.js`
- Test: `apps/desktop/src/modules/atlas.pfm/__tests__/assistant-format.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.pfm/__tests__/assistant-format.test.js`:

```js
// apps/desktop/src/modules/atlas.pfm/__tests__/assistant-format.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { threadTitle, renderRichText, describeProposedAction } from "../lib/assistant-format.js";

describe("assistant-format", () => {
  it("threadTitle trims to 48 chars and collapses whitespace", () => {
    assert.equal(threadTitle("  hola   mundo  "), "hola mundo");
    assert.equal(threadTitle("x".repeat(80)).length, 48);
    assert.equal(threadTitle(""), "Nueva conversacion");
    assert.equal(threadTitle(null), "Nueva conversacion");
  });

  it("renderRichText returns plain segments and never raw HTML", () => {
    const out = renderRichText("hola <b>mundo</b> **fuerte**");
    // a flat array of {t, bold} tokens split into lines
    const flat = out.flat();
    assert.ok(flat.some((seg) => seg.text.includes("<b>mundo</b>")), "HTML is kept as literal text");
    assert.ok(flat.some((seg) => seg.bold && seg.text === "fuerte"));
  });

  it("renderRichText splits lines and marks bullets", () => {
    const out = renderRichText("Resumen:\n- uno\n- dos");
    assert.equal(out.length, 3);
    assert.equal(out[1].bullet, true);
    assert.equal(out[1].segments[0].text, "uno");
  });

  it("describeProposedAction summarizes a create_movement", () => {
    const s = describeProposedAction({
      type: "create_movement",
      walletName: "BBVA",
      direction: "EXPENSE",
      amount: 350,
      occurredOn: "2026-09-02",
      merchant: "Gasolina",
      categoryName: "Transporte",
    });
    assert.match(s, /Gasto/);
    assert.match(s, /\$350\.00/);
    assert.match(s, /BBVA/);
    assert.match(s, /Transporte/);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `node --test apps/desktop/src/modules/atlas.pfm/__tests__/assistant-format.test.js`
Expected: FAIL — `Cannot find module '../lib/assistant-format.js'`.

- [ ] **Step 3: Implement `assistant-format.js`**

Create `apps/desktop/src/modules/atlas.pfm/lib/assistant-format.js`:

```js
// apps/desktop/src/modules/atlas.pfm/lib/assistant-format.js
//
// Pure helpers for the PFM assistant UI. No React import here — renderRichText
// returns a plain data structure the bubble component turns into elements, so
// it stays testable under node --test and never emits raw HTML.
import { formatMoney } from "./format";

export function threadTitle(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Nueva conversacion";
  return clean.length > 48 ? clean.slice(0, 48) : clean;
}

// Minimal safe markup: lines -> { bullet, segments:[{text, bold}] }.
// Only **bold** is interpreted; everything else is literal text.
export function renderRichText(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  return lines.map((line) => {
    const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    const body = bulletMatch ? bulletMatch[1] : line;
    const segments = [];
    const parts = body.split("**");
    parts.forEach((part, i) => {
      if (part === "") return;
      segments.push({ text: part, bold: i % 2 === 1 });
    });
    if (segments.length === 0) segments.push({ text: "", bold: false });
    return { bullet: Boolean(bulletMatch), segments };
  });
}

const DIRECTION_LABEL = { EXPENSE: "Gasto", INCOME: "Ingreso" };

export function describeProposedAction(action) {
  if (!action || action.type !== "create_movement") return "";
  const kind = DIRECTION_LABEL[action.direction] ?? action.direction;
  const parts = [
    `${kind} de ${formatMoney(action.amount)}`,
    action.walletName ? `en ${action.walletName}` : null,
    action.merchant ? `· ${action.merchant}` : null,
    action.categoryName ? `· ${action.categoryName}` : null,
    action.occurredOn ? `· ${action.occurredOn}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}
```

Note: `renderRichText` in the test is accessed as `out[1].bullet` / `out[1].segments` and also `out.flat()` with `.text` — reconcile: the test's first assertion uses `out.flat()` expecting `{text,bold}` objects. Adjust the test OR the return. **Use this reconciled test instead** (replace the file written in Step 1 with this):

```js
// apps/desktop/src/modules/atlas.pfm/__tests__/assistant-format.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { threadTitle, renderRichText, describeProposedAction } from "../lib/assistant-format.js";

describe("assistant-format", () => {
  it("threadTitle trims to 48 chars and collapses whitespace", () => {
    assert.equal(threadTitle("  hola   mundo  "), "hola mundo");
    assert.equal(threadTitle("x".repeat(80)).length, 48);
    assert.equal(threadTitle(""), "Nueva conversacion");
    assert.equal(threadTitle(null), "Nueva conversacion");
  });

  it("renderRichText keeps HTML as literal text and marks **bold**", () => {
    const lines = renderRichText("hola <b>mundo</b> **fuerte**");
    const segs = lines.flatMap((l) => l.segments);
    assert.ok(segs.some((s) => s.text.includes("<b>mundo</b>")));
    assert.ok(segs.some((s) => s.bold && s.text === "fuerte"));
  });

  it("renderRichText splits lines and marks bullets", () => {
    const lines = renderRichText("Resumen:\n- uno\n- dos");
    assert.equal(lines.length, 3);
    assert.equal(lines[1].bullet, true);
    assert.equal(lines[1].segments[0].text, "uno");
  });

  it("describeProposedAction summarizes a create_movement", () => {
    const s = describeProposedAction({
      type: "create_movement",
      walletName: "BBVA",
      direction: "EXPENSE",
      amount: 350,
      occurredOn: "2026-09-02",
      merchant: "Gasolina",
      categoryName: "Transporte",
    });
    assert.match(s, /Gasto/);
    assert.match(s, /\$350\.00/);
    assert.match(s, /BBVA/);
    assert.match(s, /Transporte/);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test apps/desktop/src/modules/atlas.pfm/__tests__/assistant-format.test.js`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/lib/assistant-format.js apps/desktop/src/modules/atlas.pfm/__tests__/assistant-format.test.js
git commit -m "feat(pfm): assistant-format pure helpers (title, safe rich text, action summary)"
```

---

## Task 2: Query hooks

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-assistant.js`

- [ ] **Step 1: Implement the hooks**

Create `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-assistant.js`:

```js
// apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-assistant.js
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

const K = {
  status: ["pfm", "assistant", "status"],
  threads: ["pfm", "assistant", "threads"],
  thread: (id) => ["pfm", "assistant", "thread", id],
};

export function useAssistantStatus() {
  const token = useToken();
  return useQuery({
    queryKey: K.status,
    queryFn: () => atlas.pfm.assistant.status(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
    // 403 (no permission) or 503 (no key) -> unavailable, no error surfaced
    select: (res) => Boolean(res?.data?.available),
  });
}

export function useAssistantThreads(enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: K.threads,
    queryFn: () => atlas.pfm.assistant.listThreads(token),
    enabled: Boolean(token && enabled),
    select: (res) => res?.data ?? [],
  });
}

export function useAssistantThread(threadId) {
  const token = useToken();
  return useQuery({
    queryKey: K.thread(threadId),
    queryFn: () => atlas.pfm.assistant.getThread(threadId, token),
    enabled: Boolean(token && threadId),
    select: (res) => res?.data ?? null,
  });
}

export function useSendAssistantMessage(threadId) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content) => atlas.pfm.assistant.sendMessage(threadId, content, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.thread(threadId) });
      qc.invalidateQueries({ queryKey: K.threads });
    },
  });
}

export function useCreateAssistantThread() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => atlas.pfm.assistant.createThread(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.threads }),
  });
}

export function useDeleteAssistantThread() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => atlas.pfm.assistant.deleteThread(id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.threads }),
  });
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-assistant.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-assistant.js
git commit -m "feat(pfm): use-pfm-assistant query/mutation hooks"
```

---

## Task 3: `AssistantMessage` + `AssistantMessageList`

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/AssistantMessage.jsx`
- Create: `apps/desktop/src/modules/atlas.pfm/components/AssistantMessageList.jsx`

- [ ] **Step 1: Implement `AssistantMessage.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/AssistantMessage.jsx
import { renderRichText } from "../lib/assistant-format";

export function AssistantMessage({ role, content }) {
  const isUser = role === "USER";
  const isError = role === "ERROR";
  const lines = renderRichText(content);
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : isError
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
        ].join(" ")}
      >
        {lines.map((line, i) => (
          <p key={i} className={line.bullet ? "flex gap-1.5" : undefined}>
            {line.bullet && <span aria-hidden>·</span>}
            <span>
              {line.segments.map((seg, j) =>
                seg.bold ? <strong key={j}>{seg.text}</strong> : <span key={j}>{seg.text}</span>,
              )}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `AssistantMessageList.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/AssistantMessageList.jsx
import { useEffect, useRef } from "react";
import { EmptyState } from "@atlas/ui";
import { Sparkles } from "lucide-react";
import { AssistantMessage } from "./AssistantMessage";
import { AssistantActionCard } from "./AssistantActionCard";

export function AssistantMessageList({ messages, pending, proposedAction, onProposalDone }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending, proposedAction]);

  if (messages.length === 0 && !pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <EmptyState
          icon={Sparkles}
          variant="compact"
          title="Pregunta sobre tus finanzas"
          description="Ej: cuanto tengo en total, hazme un resumen del mes, en que gaste mas."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {messages.map((m, i) => (
        <AssistantMessage key={i} role={m.role} content={m.content} />
      ))}
      {proposedAction && (
        <AssistantActionCard action={proposedAction} onDone={onProposalDone} />
      )}
      {pending && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
            Pensando...
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
```

- [ ] **Step 3: Syntax check both**

Run:
```bash
node --check apps/desktop/src/modules/atlas.pfm/components/AssistantMessage.jsx
```
Expected: exit 0. (`AssistantMessageList.jsx` imports `AssistantActionCard`, created in Task 4 — its `--check` waits until then; do the list check at the end of Task 4.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/AssistantMessage.jsx apps/desktop/src/modules/atlas.pfm/components/AssistantMessageList.jsx
git commit -m "feat(pfm): assistant message bubble + message list"
```

---

## Task 4: `AssistantActionCard` — confirm a proposed movement

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/AssistantActionCard.jsx`

- [ ] **Step 1: Implement it**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/AssistantActionCard.jsx
import { useState } from "react";
import { Button, Badge } from "@atlas/ui";
import { Check, X } from "lucide-react";
import { useCreateMovement } from "../hooks/use-pfm-queries";
import { describeProposedAction } from "../lib/assistant-format";

// Renders a `proposedAction` from the assistant and lets the user register it
// through the NORMAL movement endpoint (the assistant never writes).
export function AssistantActionCard({ action, onDone }) {
  const createMut = useCreateMovement();
  const [state, setState] = useState("idle"); // idle | done | discarded | error

  if (!action || action.type !== "create_movement") return null;

  async function register() {
    setState("idle");
    try {
      await createMut.mutateAsync({
        walletId: action.walletId,
        direction: action.direction,
        amount: Number(action.amount),
        occurredOn: action.occurredOn,
        categoryId: action.categoryId ?? null,
        merchant: action.merchant ?? null,
        note: action.note ?? null,
        status: "POSTED",
      });
      setState("done");
      onDone?.("done");
    } catch {
      setState("error");
    }
  }

  const locked = state === "done" || state === "discarded";

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-[hsl(var(--foreground))]">Registrar movimiento</span>
        {state === "done" && <Badge variant="success">Registrado</Badge>}
        {state === "discarded" && <Badge variant="outline">Descartado</Badge>}
      </div>
      <p className="text-[hsl(var(--muted-foreground))]">{describeProposedAction(action)}</p>
      {state === "error" && (
        <p className="mt-1 text-red-600 dark:text-red-400">No se pudo registrar. Intenta desde la cartera.</p>
      )}
      {!locked && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={register} disabled={createMut.isPending}>
            <Check className="mr-1 h-3.5 w-3.5" /> Registrar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setState("discarded");
              onDone?.("discarded");
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Descartar
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Syntax check the list + card**

Run:
```bash
node --check apps/desktop/src/modules/atlas.pfm/components/AssistantActionCard.jsx
node --check apps/desktop/src/modules/atlas.pfm/components/AssistantMessageList.jsx
```
Expected: exit 0 for both.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/AssistantActionCard.jsx
git commit -m "feat(pfm): assistant action card (confirm proposed movement via normal endpoint)"
```

---

## Task 5: `AssistantComposer` + `AssistantThreadList`

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/AssistantComposer.jsx`
- Create: `apps/desktop/src/modules/atlas.pfm/components/AssistantThreadList.jsx`

- [ ] **Step 1: Implement `AssistantComposer.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/AssistantComposer.jsx
import { useState } from "react";
import { Textarea, Button } from "@atlas/ui";
import { Send } from "lucide-react";

export function AssistantComposer({ onSend, disabled }) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className="border-t border-[hsl(var(--border))] p-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Pregunta sobre tus finanzas..."
          className="max-h-32 min-h-[42px] flex-1 resize-none"
          disabled={disabled}
        />
        <Button size="icon" aria-label="Enviar" onClick={submit} disabled={disabled || !value.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `AssistantThreadList.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/AssistantThreadList.jsx
import { useState } from "react";
import { Button, ConfirmDialog } from "@atlas/ui";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import {
  useAssistantThreads,
  useCreateAssistantThread,
  useDeleteAssistantThread,
} from "../hooks/use-pfm-assistant";
import { threadTitle } from "../lib/assistant-format";

export function AssistantThreadList({ activeId, onSelect }) {
  const { data: threads = [] } = useAssistantThreads();
  const createMut = useCreateAssistantThread();
  const deleteMut = useDeleteAssistantThread();
  const [removeTarget, setRemoveTarget] = useState(null);

  return (
    <div className="border-b border-[hsl(var(--border))] p-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={async () => {
            const res = await createMut.mutateAsync();
            onSelect(res?.data?.id ?? res?.id ?? null);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Nueva
        </Button>
      </div>
      {threads.length > 0 && (
        <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className={[
                  "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs",
                  t.id === activeId
                    ? "bg-[hsl(var(--muted))] font-medium"
                    : "hover:bg-[hsl(var(--muted))]",
                ].join(" ")}
              >
                <MessageSquare className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                <span className="truncate">{threadTitle(t.title)}</span>
              </button>
              <button
                type="button"
                aria-label="Borrar"
                onClick={() => setRemoveTarget(t)}
                className="shrink-0 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title="Borrar conversacion"
        description="Se elimina esta conversacion y sus mensajes."
        confirmLabel="Borrar"
        onConfirm={async () => {
          await deleteMut.mutateAsync(removeTarget.id);
          if (removeTarget.id === activeId) onSelect(null);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Syntax check both**

Run:
```bash
node --check apps/desktop/src/modules/atlas.pfm/components/AssistantComposer.jsx
node --check apps/desktop/src/modules/atlas.pfm/components/AssistantThreadList.jsx
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/AssistantComposer.jsx apps/desktop/src/modules/atlas.pfm/components/AssistantThreadList.jsx
git commit -m "feat(pfm): assistant composer + thread list"
```

---

## Task 6: `PfmAssistantSidebar` — the shell

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/PfmAssistantSidebar.jsx`

- [ ] **Step 1: Implement it**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/PfmAssistantSidebar.jsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@atlas/ui";
import { Sparkles, X } from "lucide-react";
import {
  useAssistantStatus,
  useAssistantThread,
  useSendAssistantMessage,
  useCreateAssistantThread,
} from "../hooks/use-pfm-assistant";
import { AssistantThreadList } from "./AssistantThreadList";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantComposer } from "./AssistantComposer";

const LS_KEY = "pfm.assistant.collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(LS_KEY) !== "0";
  } catch {
    return true;
  }
}
function writeCollapsed(v) {
  try {
    localStorage.setItem(LS_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function PfmAssistantSidebar() {
  const { data: available, isLoading } = useAssistantStatus();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [threadId, setThreadId] = useState(null);
  // local echo of the current turn: user msg shown immediately, then reply/proposal
  const [pendingUser, setPendingUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [proposal, setProposal] = useState(null);

  const { data: thread } = useAssistantThread(threadId);
  const sendMut = useSendAssistantMessage(threadId);
  const createMut = useCreateAssistantThread();

  useEffect(() => writeCollapsed(collapsed), [collapsed]);

  // don't render anything if the assistant is unavailable or still checking
  if (isLoading) return null;
  if (!available) return null;

  const messages = useMemo(() => {
    const base = (thread?.messages ?? []).map((m) => ({ role: m.role, content: m.content }));
    if (pendingUser) base.push({ role: "USER", content: pendingUser });
    if (errorMsg) base.push({ role: "ERROR", content: errorMsg });
    return base;
  }, [thread?.messages, pendingUser, errorMsg]);

  async function handleSend(text) {
    setErrorMsg(null);
    setProposal(null);
    setPendingUser(text);
    let id = threadId;
    try {
      if (!id) {
        const res = await createMut.mutateAsync();
        id = res?.data?.id ?? res?.id ?? null;
        setThreadId(id);
      }
      const res = await sendMutFor(id, text);
      setProposal(res?.data?.proposedAction ?? null);
    } catch (err) {
      setErrorMsg(errText(err));
    } finally {
      setPendingUser(null);
    }
  }

  // sendMut is bound to threadId; when we just created a thread we need a fresh call
  async function sendMutFor(id, text) {
    if (id === threadId) return sendMut.mutateAsync(text);
    const { atlas } = await import("../../../lib/atlas");
    const { data: session } = { data: null }; // token comes from the hook path normally
    // fall back: use the hook after threadId updates on next render is unreliable,
    // so call the SDK directly with the same token the hook would use.
    return sendViaSdk(id, text);
  }

  return (
    <>
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1 rounded-l-lg bg-[hsl(var(--primary))] px-2 py-3 text-[hsl(var(--primary-foreground))] shadow-lg"
          aria-label="Abrir asistente"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      ) : (
        <aside className="flex h-full w-full shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] md:w-[360px]">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" /> Asistente
            </span>
            <Button size="icon" variant="ghost" aria-label="Cerrar" onClick={() => setCollapsed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <AssistantThreadList activeId={threadId} onSelect={(id) => { setThreadId(id); setProposal(null); setErrorMsg(null); }} />
          <AssistantMessageList
            messages={messages}
            pending={sendMut.isPending || Boolean(pendingUser)}
            proposedAction={proposal}
            onProposalDone={() => setProposal(null)}
          />
          <AssistantComposer onSend={handleSend} disabled={sendMut.isPending || Boolean(pendingUser)} />
        </aside>
      )}
    </>
  );
}

function errText(err) {
  const m = String(err?.message ?? "");
  if (m.includes("429")) return "Vas muy rapido, espera un momento.";
  if (m.includes("503")) return "El asistente no esta disponible ahora.";
  if (m.includes("502")) return "El asistente no respondio, intenta de nuevo.";
  return "Algo salio mal, intenta de nuevo.";
}
```

**Reconcile the "new thread then send" race:** the two-call dance above is fragile. Replace `handleSend` / `sendMutFor` / `sendViaSdk` with a single clean path that always uses the SDK directly for the send (the hook's cache invalidation is still wired via `useSendAssistantMessage` for the common case, but here we call the SDK so the freshly-created thread id is used immediately):

```jsx
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useQueryClient } from "@tanstack/react-query";
// ...
export function PfmAssistantSidebar() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  // ...(status, collapsed, threadId, pendingUser, errorMsg, proposal, thread as above; drop sendMut/sendMutFor/sendViaSdk)
  const createMut = useCreateAssistantThread();

  async function handleSend(text) {
    setErrorMsg(null);
    setProposal(null);
    setPendingUser(text);
    try {
      let id = threadId;
      if (!id) {
        const res = await createMut.mutateAsync();
        id = res?.data?.id ?? res?.id ?? null;
        setThreadId(id);
      }
      const res = await atlas.pfm.assistant.sendMessage(id, text, token);
      setProposal(res?.data?.proposedAction ?? null);
      qc.invalidateQueries({ queryKey: ["pfm", "assistant", "thread", id] });
      qc.invalidateQueries({ queryKey: ["pfm", "assistant", "threads"] });
    } catch (err) {
      setErrorMsg(errText(err));
    } finally {
      setPendingUser(null);
    }
  }
  const sending = Boolean(pendingUser);
  // pass `pending={sending}` and `disabled={sending}` to the list/composer.
}
```

Use this second version. Remove the `useSendAssistantMessage` import from the sidebar (keep it exported from the hooks file — harmless, and useful later).

- [ ] **Step 2: Syntax check**

Run: `node --check apps/desktop/src/modules/atlas.pfm/components/PfmAssistantSidebar.jsx`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/PfmAssistantSidebar.jsx
git commit -m "feat(pfm): PfmAssistantSidebar shell (collapse, threads, send, proposal)"
```

---

## Task 7: Mount in `ModuleOutlet`

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx` (the final `return` with `<Suspense>`, ~line 754-760)

- [ ] **Step 1: Add the lazy import near the other module lazies**

In the `SCREEN_MAP` region is only for screens; instead add a plain lazy near the top-level imports. After line 5 (`import { BlueprintCrudScreen } ...`), add:

```jsx
const PfmAssistantSidebar = lazy(() =>
  import("../modules/atlas.pfm/components/PfmAssistantSidebar.jsx").then((m) => ({
    default: m.PfmAssistantSidebar,
  })),
);
```

- [ ] **Step 2: Wrap the final render for atlas.pfm**

Replace:

```jsx
  const Screen = resolveScreen(moduleKey, subPath);

  return (
    <Suspense fallback={<LoadingFallback />}>
      {Screen ? <Screen /> : <ModulePlaceholder module={module} />}
    </Suspense>
  );
}
```

with:

```jsx
  const Screen = resolveScreen(moduleKey, subPath);
  const screenNode = (
    <Suspense fallback={<LoadingFallback />}>
      {Screen ? <Screen /> : <ModulePlaceholder module={module} />}
    </Suspense>
  );

  if (moduleKey === "atlas.pfm") {
    return (
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">{screenNode}</div>
        <Suspense fallback={null}>
          <PfmAssistantSidebar />
        </Suspense>
      </div>
    );
  }

  return screenNode;
}
```

- [ ] **Step 3: Verify the build**

Run:
```bash
cd apps/desktop && pnpm build:web && cd ../..
```
Expected: `✓ built in ...` with no errors. Warnings about chunk size are pre-existing and fine.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(pfm): mount the assistant sidebar alongside PFM screens"
```

---

## Task 8: Verification

- [ ] **Step 1: Run the PFM desktop tests**

Run: `node --test "apps/desktop/src/modules/atlas.pfm/__tests__/*.test.js"`
Expected: all green (format + assistant-format).

- [ ] **Step 2: Lint**

Run: `npx eslint apps/desktop/src/modules/atlas.pfm/ apps/desktop/src/app/ModuleOutlet.jsx`
Expected: exit 0. Fix any issues, re-run.

- [ ] **Step 3: Full web build**

Run: `cd apps/desktop && pnpm build:web && cd ../..`
Expected: green.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A apps/desktop/src/modules/atlas.pfm/ apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "chore(pfm): lint + build fixes for the assistant sidebar" || echo "nothing to commit"
```

- [ ] **Step 5: Update the backlog**

In `docs/superpowers/plans/2026-08-30-module-audit-backlog.md`, under the `atlas.pfm` section, add:

```markdown
- [ ] **PFM-8 — Browser QA of the assistant sidebar** at 390px + 1440px:
  collapse/expand, ask a question, thread switching, delete, and the
  propose-movement confirm card. Needs `GROQ_API_KEY` in the env.
```

Commit:
```bash
git add docs/superpowers/plans/2026-08-30-module-audit-backlog.md
git commit -m "docs(backlog): PFM-8 assistant sidebar browser QA"
```

---

## Self-Review

**Spec coverage (§6):**
- Mount via one `ModuleOutlet` branch, state survives navigation → Task 7 (the sidebar is a sibling of the screen node, stays mounted while `moduleKey === "atlas.pfm"`).
- `PfmAssistantSidebar` collapse/expand, ~40px tab vs ~360px panel, `localStorage` in try/catch → Task 6.
- `AssistantThreadList` (list + new + delete via `ConfirmDialog`) → Task 5.
- `AssistantMessageList` + `AssistantMessage`, minimal safe markdown, no raw HTML → Tasks 1 + 3 (`renderRichText` returns data, bubble maps to `<strong>`/`<span>`).
- `AssistantActionCard` (wallet/amount/type/date/category/merchant, Registrar/Descartar, calls `useCreateMovement`, disables after use, refreshes PFM queries) → Task 4 (`useCreateMovement.onSuccess` already invalidates `["pfm"]`).
- `AssistantComposer` (Enter sends, Shift+Enter newline, disabled while pending) → Task 5.
- Hooks in `use-pfm-assistant.js` → Task 2.
- `available === false` → sidebar not rendered; no `pfm.assistant.use` → `status` 403 → `select` returns false → not rendered → Task 2 + Task 6.
- Error bubbles for 429/502/503 without breaking the thread → Task 6 `errText` + `ERROR` role bubble.
- One active thread; "nueva" creates and focuses → Tasks 5 + 6.
- UI-first: `Button`, `Textarea`, `ConfirmDialog`, `EmptyState`, `Badge` from `@atlas/ui`; icons from lucide → all tasks.
- Responsive QA deferred → PFM-8 (Task 8 Step 5).

**Placeholder scan:** Task 6 deliberately shows a first (fragile) version then a "use this second version" replacement — the engineer implements the second. No TBD/TODO left in the shipped code.

**Type consistency:** `proposedAction` shape (`type`, `walletId`, `walletName`, `direction`, `amount`, `occurredOn`, `categoryId`, `categoryName`, `merchant`, `note`) matches Plan A Task 2 `__proposedAction` exactly. `describeProposedAction` reads `walletName`/`categoryName`/`merchant`/`direction`/`amount`/`occurredOn` — all present. Message role values `USER` / `ASSISTANT` from the API plus UI-only `ERROR`, handled in `AssistantMessage`. `atlas.pfm.assistant.sendMessage(id, content, token)` signature matches Plan A Task 8 SDK.

**Gaps:** none — every §6 element maps to a task. Backend contract consumed here is defined in Plan A.
