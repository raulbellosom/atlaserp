# MeridIAn Spec 1 — Plan B (frontend: direct-chat UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the MeridIAn conversation in the chat UI — pinned at the top with a bot avatar and an "IA" badge, a slimmed-down `ChatWindow` (no calls, no member management, an assistant-aware subtitle), a MeridIAn "typing…" indicator, a disabled-composer state when the assistant is not configured, and a small intro/examples block — all by reusing the existing chat components with surgical edits.

**Architecture:** The direct MeridIAn chat is an ordinary conversation (`type === 'meridian'`), so `ChatScreen` / `ChatSidebar` / `ChatWindow` / `ChatMessageList` render it already. This plan adds a pure `lib/meridian.js` helper module, a `hooks/useMeridian.js` data hook pair, and narrow `isMeridian` branches in `ChatConversationItem`, `ChatScreen`, `ChatWindow` (+ its `ChatHeader`), and `ChatMessageBubble`. No new routing. New reusable bits (`MeridianIntro`) live in the chat module, not `@atlas/ui` (they are chat-specific).

**Tech Stack:** React, TanStack Query, `@atlas/sdk` (`chat.meridian.*` from Plan A Task 10), `@atlas/ui` (`Button`, `EmptyState`, lucide `Sparkles`), `node --test` for the pure helpers.

**Depends on:** Plan A merged (endpoints `GET /chat/meridian`, `GET /chat/meridian/status`; `sender_type='assistant'` messages; the server typing broadcast `{ userId: "meridian", isTyping }` on `chat:presence:<id>`).

**Reference:**
- `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-assistant.js` — hook style for an AI status/query pair.
- `apps/desktop/src/modules/atlas.chat/lib/chatUtils.js` — where pure chat helpers live; `getConversationDisplayName`.
- `apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx` / `ChatWindow.jsx` / `components/ChatMessageList.jsx` — the surfaces to branch.

---

## Conventions for every task

- Run pure-helper tests: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/`
- Web build gate: `pnpm --filter @atlas/desktop build:web`
- Full build gate (run once at the end): `pnpm build`
- Commit after each task with the message in its final step.
- All user-facing strings in Spanish; code/comments in English.
- UI-first: only `@atlas/ui` components + lucide icons. No native form elements, no `window.*` dialogs.

---

## Task 1: `lib/meridian.js` — pure helpers + tests

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/lib/meridian.js`
- Test: `apps/desktop/src/modules/atlas.chat/lib/__tests__/meridian.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/desktop/src/modules/atlas.chat/lib/__tests__/meridian.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  isMeridianConversation,
  MERIDIAN_NAME,
  MERIDIAN_SUBTITLE,
  MERIDIAN_EXAMPLE_PROMPTS,
  isAssistantMessage,
  mapTypingNames,
} from "../meridian.js";

test("isMeridianConversation matches on type", () => {
  assert.equal(isMeridianConversation({ type: "meridian" }), true);
  assert.equal(isMeridianConversation({ type: "direct" }), false);
  assert.equal(isMeridianConversation(null), false);
  assert.equal(isMeridianConversation(undefined), false);
});

test("isAssistantMessage matches sender_type", () => {
  assert.equal(isAssistantMessage({ sender_type: "assistant" }), true);
  assert.equal(isAssistantMessage({ sender_type: "user" }), false);
  assert.equal(isAssistantMessage({}), false);
});

test("mapTypingNames swaps the meridian sentinel for the display name, leaves others", () => {
  assert.deepEqual(mapTypingNames(["meridian"]), [MERIDIAN_NAME]);
  assert.deepEqual(mapTypingNames(["abc", "meridian"]), ["abc", MERIDIAN_NAME]);
  assert.deepEqual(mapTypingNames([]), []);
  assert.deepEqual(mapTypingNames(undefined), []);
});

test("constants are the expected shape", () => {
  assert.equal(MERIDIAN_NAME, "MeridIAn");
  assert.match(MERIDIAN_SUBTITLE, /solo t[uú] ves/i);
  assert.equal(MERIDIAN_EXAMPLE_PROMPTS.length, 3);
  for (const p of MERIDIAN_EXAMPLE_PROMPTS) assert.equal(typeof p, "string");
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/meridian.test.js`
Expected: FAIL — cannot find module `../meridian.js`.

- [ ] **Step 3: Implement `lib/meridian.js`**

```js
// apps/desktop/src/modules/atlas.chat/lib/meridian.js
//
// Pure helpers for the MeridIAn AI assistant surfaces in atlas.chat (Spec 1).
// No React, no network — safe to unit-test with node --test.

export const MERIDIAN_NAME = "MeridIAn";
export const MERIDIAN_SUBTITLE = "Asistente de IA · solo tú ves este chat";

// Server broadcasts typing as { userId: "meridian", isTyping } on the
// conversation's presence channel — this sentinel is not a real user id.
export const MERIDIAN_TYPING_SENTINEL = "meridian";

export const MERIDIAN_EXAMPLE_PROMPTS = [
  "Resume los mensajes que reenvié aquí",
  "¿Qué archivos e imágenes he compartido en el chat esta semana?",
  "Explícame el último mensaje que me reenviaron",
];

export function isMeridianConversation(conversation) {
  return Boolean(conversation && conversation.type === "meridian");
}

export function isAssistantMessage(message) {
  return Boolean(message && message.sender_type === "assistant");
}

// Replace the typing sentinel with the display name; pass everything else
// through unchanged so real users' typing labels are untouched.
export function mapTypingNames(list) {
  return (list ?? []).map((x) => (x === MERIDIAN_TYPING_SENTINEL ? MERIDIAN_NAME : x));
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/meridian.test.js`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/lib/meridian.js apps/desktop/src/modules/atlas.chat/lib/__tests__/meridian.test.js
git commit -m "feat(chat): pure helpers for the MeridIAn UI surfaces"
```

---

## Task 2: `hooks/useMeridian.js` — status + ensure hooks

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useMeridian.js`

- [ ] **Step 1: Confirm the client/token pattern**

`useChatConversations.js` uses a **singleton** client, not a hook: `import { atlas } from "../../../lib/atlas";` and `const { session } = useAuth(); const token = session?.access_token;`. This hook uses the same. (`atlas.chat.meridian.*` comes from Plan A Task 10.)

- [ ] **Step 2: Implement `useMeridian.js`**

```js
// apps/desktop/src/modules/atlas.chat/hooks/useMeridian.js
import { useQuery } from "@tanstack/react-query";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

// Is MeridIAn available in this environment (GROQ_API_KEY present) AND does the
// caller have chat.meridian.use? A 403/404 → treat as unavailable, no toast.
export function useMeridianStatus() {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery({
    queryKey: ["chat-meridian-status"],
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        const res = await atlas.chat.meridian.status(token);
        return { available: Boolean(res?.data?.available) };
      } catch (err) {
        if (err?.status === 403 || err?.status === 404) return { available: false, forbidden: err?.status === 403 };
        throw err;
      }
    },
  });
}

// Ensure the MeridIAn conversation exists for this user. Called once when the
// chat module opens; the backend also self-heals in GET /chat/conversations.
export function useEnsureMeridianConversation({ enabled = true } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery({
    queryKey: ["chat-meridian-ensure"],
    enabled: enabled && Boolean(token),
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      try {
        const res = await atlas.chat.meridian.ensure(token);
        return { conversationId: res?.data?.conversationId ?? null };
      } catch (err) {
        if (err?.status === 403) return { conversationId: null };
        throw err;
      }
    },
  });
}
```

- [ ] **Step 3: Syntax check**

Run: `node --check apps/desktop/src/modules/atlas.chat/hooks/useMeridian.js`
Expected: no error. (Import paths get validated by the build in later tasks.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useMeridian.js
git commit -m "feat(chat): useMeridianStatus + useEnsureMeridianConversation hooks"
```

---

## Task 3: `ChatScreen` — ensure the conversation + keep MeridIAn pinned first

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx`

- [ ] **Step 1: Call the ensure hook**

In `ChatScreenInner`, after `const { data, isLoading } = useChatConversations();`:
```js
  // Make sure the user's MeridIAn conversation exists (backend also self-heals
  // in GET /chat/conversations). Fire-and-forget; the row shows up on the next
  // conversations refetch.
  useEnsureMeridianConversation();
```
Add the import: `import { useEnsureMeridianConversation } from "../hooks/useMeridian";`

- [ ] **Step 2: Pin MeridIAn to the very top**

`ChatSidebar` already sorts `is_pinned` first. The MeridIAn row is pinned server-side, but to guarantee it sits above every other pinned row, sort it explicitly. In `ChatScreenInner`, replace `const conversations = data?.data ?? [];` with:
```js
  const conversations = useMemo(() => {
    const list = data?.data ?? [];
    return list.slice().sort((a, b) => {
      const am = a.type === "meridian" ? 1 : 0;
      const bm = b.type === "meridian" ? 1 : 0;
      return bm - am; // MeridIAn first; stable for everything else
    });
  }, [data]);
```
(`useMemo` is already imported.)

- [ ] **Step 3: Build the web app**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds (validates the `useMeridian` import path — fix it if the build complains).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx
git commit -m "feat(chat): ensure MeridIAn conversation on chat open + pin it first"
```

---

## Task 4: `ChatConversationItem` — bot avatar + "IA" badge

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx`

- [ ] **Step 1: Branch the display for a MeridIAn row**

At the top of `ChatConversationItem`, add:
```js
  const isMeridian = conversation.type === "meridian";
```
Then:
- Force the label: `const displayName = isMeridian ? "MeridIAn" : (conversation.title ?? otherMember?.displayName ?? (conversation.type === "group" ? "Grupo" : "Conversacion directa"));`
- `const titleLabel = isMeridian ? "MeridIAn" : (conversation.type === "channel" ? \`#${displayName}\` : displayName);`

- [ ] **Step 2: Render the bot avatar + badge**

In the `Avatar` component, add an `isBot` prop; when set, render a `Sparkles` glyph on the brand-primary circle instead of initials, and a small "IA" pill in place of `ConversationTypeBadge`:
```js
import { AtSign, Pin, Sparkles } from "lucide-react";
// ...
function Avatar({ name, avatarUrl, avatarEmoji, type, size = "md", online = false, isBot = false }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  if (isBot) {
    return (
      <div className="relative shrink-0">
        <div
          className={`${sizeClass} rounded-full flex items-center justify-center`}
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[hsl(var(--background))] px-1 text-[9px] font-bold leading-tight text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary)/0.4)]">
          IA
        </span>
      </div>
    );
  }
  // ...existing body unchanged...
}
```
Pass it through where `<Avatar ... />` is rendered in `ChatConversationItem`:
```js
        <Avatar name={displayName} avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} type={conversation.type} online={isOnline} isBot={isMeridian} />
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx
git commit -m "feat(chat): MeridIAn conversation row — Sparkles avatar + IA badge"
```

---

## Task 5: `ChatWindow` + `ChatHeader` — slim assistant layout

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

Keep edits minimal — `ChatWindow.jsx` is ~1053 lines (near the CLAUDE.md 1000-line soft limit). Do NOT add large blocks; branch with one boolean and small conditionals.

- [ ] **Step 1: Compute `isMeridian` + status once in `ChatWindow`**

Near the other derived flags (`isChannelOrGroupType`, ~line 423):
```js
  const isMeridian = conversation?.type === "meridian";
  const { data: meridianStatus } = useMeridianStatus();
  const meridianAvailable = !isMeridian || meridianStatus?.available !== false;
```
Imports: `import { useMeridianStatus } from "../hooks/useMeridian";` and `import { MERIDIAN_SUBTITLE, mapTypingNames } from "../lib/meridian";`

- [ ] **Step 2: Map the typing list so "meridian" renders as "MeridIAn"**

Where `typingUsers={typingUsersList}` is passed to `ChatMessageList` (~line 915), change to:
```js
              typingUsers={mapTypingNames(typingUsersList)}
```

- [ ] **Step 3: Pass `isMeridian` into `ChatHeader` and branch it**

- Add `isMeridian` to the `<ChatHeader ... />` props (~line 860) and to the `ChatHeader({ ... })` destructure (~line 55).
- In `ChatHeader`, gate the call buttons: change `{!embedded && callsEnabled && conversation?.type !== "external_support" && (` to also require `&& !isMeridian`.
- Gate member UI: the `conversation?.type === "group" || conversation?.type === "channel"` subtitle branch is already skipped for `meridian`. Add an explicit `meridian` subtitle branch right after the `direct` one:
```js
          {isMeridian ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{MERIDIAN_SUBTITLE}</p>
          ) : conversation?.type === "direct" ? (
            /* ...existing direct block... */
```
- In the three-dots `DropdownMenuContent` (~line 337), wrap the "Ver miembros/Ver perfil" item and the "Añadir miembros" / archive / delete items so they don't render when `isMeridian` (MeridIAn has nothing to manage). Keep "Buscar mensajes" and the pinned toggle. The delete-conversation item must be hidden — the backend rejects it anyway (Plan A Task 9), but don't offer it.

- [ ] **Step 4: Disable the composer when MeridIAn is not configured**

At the `<MessageComposer ... />` (~line 968):
```js
          disabled={!meridianAvailable}
          placeholder={
            isMeridian && !meridianAvailable
              ? "MeridIAn no está configurado en este entorno"
              : isMeridian
                ? "Escribe a MeridIAn..."
                : canSendMessages
                  ? "Escribe un mensaje..."
                  : "Solo un administrador puede escribir en este canal"
          }
```
(If `MessageComposer` already receives a `disabled` prop from elsewhere, OR it together: `disabled={existingDisabled || !meridianAvailable}`.)

- [ ] **Step 5: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): MeridIAn chat window — no calls/members, assistant subtitle, gated composer"
```

---

## Task 6: `ChatMessageBubble` — render assistant messages with the MeridIAn identity

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 1: Inspect current sender rendering**

Read how the bubble picks the sender name/avatar for non-own messages (search `sender?.displayName`, `avatarUrl`, `isOwn`). Assistant messages already come through as "not own" (their `sender_user_id` is the bot profile). They will render with the bot's `display_name` ("MeridIAn") and no avatar URL — acceptable, but make it explicit + branded.

- [ ] **Step 2: Add a minimal assistant branch**

Add near the top of the component:
```js
import { Sparkles } from "lucide-react"; // if not already imported
// ...
const isAssistant = message?.sender_type === "assistant";
```
Where the non-own avatar is rendered, if `isAssistant` render the same `Sparkles`-on-brand circle used in `ChatConversationItem` (copy the 6-line block; it is small and local — do NOT extract to `@atlas/ui` for one more use). Where the sender name label is rendered for non-own messages, force `"MeridIAn"` when `isAssistant`. Do not change bubble colors/alignment — left-aligned "other" styling is correct.

- [ ] **Step 3: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "feat(chat): render MeridIAn (assistant) messages with the Sparkles identity"
```

---

## Task 7: `MeridianIntro` — welcome + example prompts

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MeridianIntro.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx` (expose a prefill method)

- [ ] **Step 1: Give `MessageComposer` an imperative prefill**

`MessageComposer` is `forwardRef` with `useImperativeHandle` (see its imports). Find the `useImperativeHandle(ref, () => ({ ... }))` call and add a method:
```js
    prefill: (text) => {
      setBody((prev) => (prev?.trim() ? prev : String(text ?? "")));
      // focus so the user can edit/send
      requestAnimationFrame(() => textareaRef.current?.focus?.());
    },
```
(Match the real state setter name — likely `setBody` — and the textarea ref name used elsewhere in the file.)

- [ ] **Step 2: Implement `MeridianIntro.jsx`**

```jsx
// apps/desktop/src/modules/atlas.chat/components/MeridianIntro.jsx
import { Sparkles } from "lucide-react";
import { MERIDIAN_EXAMPLE_PROMPTS } from "../lib/meridian";

// Shown at the top of the MeridIAn conversation while it is still short.
// Clicking a chip prefills the composer (does not send).
export function MeridianIntro({ onPickPrompt }) {
  return (
    <div className="mx-auto my-6 max-w-md px-4 text-center">
      <div
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}
      >
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold">MeridIAn</p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
        Puedo resumir mensajes, explicarte un mensaje o un archivo, y responder preguntas sobre tus chats.
        Reenvíame mensajes de otra conversación y pregúntame sobre ellos.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {MERIDIAN_EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPickPrompt?.(p)}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 text-left text-xs hover:bg-[hsl(var(--muted))] transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render it in `ChatWindow`**

In the message-body area, just before `<ChatMessageList ... />` (the non-`filesView` branch, ~line 909), add:
```jsx
              {isMeridian && !isLoading && (messages?.length ?? 0) <= 1 && (
                <MeridianIntro onPickPrompt={(text) => composerRef.current?.prefill?.(text)} />
              )}
```
Import: `import { MeridianIntro } from "./MeridianIntro";`
(`composerRef` already exists — it is passed to `<MessageComposer ref={composerRef} />`. `messages` and `isLoading` are already in scope.)

- [ ] **Step 4: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MeridianIntro.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx
git commit -m "feat(chat): MeridIAn intro block with example prompts + composer prefill"
```

---

## Task 8: Full build + responsive QA

**Files:** none (verification)

- [ ] **Step 1: Pure helper tests + full build**

Run:
```bash
node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/
pnpm --filter @atlas/desktop build:web
pnpm build
pnpm lint
```
Expected: all green.

- [ ] **Step 2: Manual QA at 390px and 1440px (per feedback_responsive_qa)**

With `pnpm dev` and `GROQ_API_KEY` set, in a browser at **both** 390px and 1440px:
1. Open Chat → the **MeridIAn** row is pinned at the top with the Sparkles avatar + "IA" badge.
2. Open it → header shows "MeridIAn" + "Asistente de IA · solo tú ves este chat"; **no** call buttons; the three-dots menu has no member/delete items.
3. The intro block with 3 example chips shows; clicking a chip fills the composer without sending.
4. Send "Hola, ¿qué puedes hacer?" → your message appears instantly; a **"MeridIAn está escribiendo"** indicator shows; within ~5–20s the assistant reply arrives (left-aligned, Sparkles avatar).
5. Forward a message from another conversation into MeridIAn (existing forward flow) → ask "resume esto" → coherent reply.
6. Attach an image → ask "¿qué dice esta imagen?" → a description comes back.
7. Try to swipe-delete / archive the MeridIAn row → it is not offered (or backend rejects with a toast).
8. Unset `GROQ_API_KEY`, restart API → the MeridIAn row still lists; opening it shows the composer disabled with "MeridIAn no está configurado en este entorno".

Capture screenshots at both widths for steps 1, 2, 4.

- [ ] **Step 3: Commit (verification note)**

```bash
git commit --allow-empty -m "chore(chat): MeridIAn UI verification — build + lint green, responsive QA at 390/1440"
```

---

## Self-review notes (already reconciled in this plan)

- **Spec §8.1 conversation list** → Tasks 3 (pin first + ensure), 4 (bot avatar + IA badge). `isMeridianConversation` helper in Task 1.
- **Spec §8.2 ChatWindow branch** → Task 5: no calls, no member management, assistant subtitle, gated composer; Task 6: assistant bubble identity; Task 7: intro + examples. Typing indicator: server sends `{ userId: "meridian" }` (Plan A Task 7, 3s refresh), `mapTypingNames` (Task 1) renders it as "MeridIAn" (Task 5 Step 2), `useChatPresence`'s existing 4s auto-clear covers gaps.
- **Spec §8.3 hooks** → Task 2 (`useMeridianStatus`, `useEnsureMeridianConversation`).
- **Spec §8.4 UI-first** → only `@atlas/ui` + lucide; `MeridianIntro` chips are styled buttons, not native selects; no `window.*`.
- **Spec §8 forward-to-MeridIAn path** → no code needed; the existing `ForwardMessageModal` lists the MeridIAn conversation because it is an ordinary conversation. Called out in Task 8 QA step 5.
- **Type consistency:** `isMeridian` boolean derived identically (`conversation?.type === "meridian"`) in Tasks 4, 5, 6, 7. `mapTypingNames` / `MERIDIAN_SUBTITLE` / `MERIDIAN_EXAMPLE_PROMPTS` imported from `../lib/meridian` everywhere. `composerRef.current.prefill(text)` defined in Task 7 Step 1, called in Task 7 Step 3.
- **No new routes**, no `@atlas/ui` additions (the Sparkles-circle is a 6-line local repeat in two files — below the "extract a shared component" bar; revisit if a third surface needs it in Spec 2/3).
