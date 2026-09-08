# MeridIAn Spec 2 — Plan B (UI: assistant panel + per-message action)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** A private right-side `Sheet` in `ChatWindow` where the user asks MeridIAn about the open conversation, plus a "Preguntar a MeridIAn" item in the message action menu that opens the Sheet with that message as focus.

**Depends on:** Spec 2 Plan A merged (`chat.meridian.panel*` SDK; `GET/POST/DELETE /chat/meridian/panel/:conversationId`).

**Reference:** the PFM assistant sidebar for message-list/composer shape; Spec 1's `lib/meridian.js` + `hooks/useMeridian.js` + the Sparkles identity already in `ChatMessageBubble`.

---

## Conventions
- Helper tests: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/`
- Build: `pnpm --filter @atlas/desktop build:web`
- `git add <files>` targeted; strings Spanish; only `@atlas/ui` + lucide.

---

## Task 1: `hooks/useMeridianPanel.js`

**Files:** Create `apps/desktop/src/modules/atlas.chat/hooks/useMeridianPanel.js`

- [ ] Follow `hooks/useMeridian.js` exactly for client (`atlas` singleton) + token (`useAuth().session?.access_token`):
```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

export function useMeridianPanelThread(conversationId, { enabled = true } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery({
    queryKey: ["chat-meridian-panel", conversationId],
    enabled: enabled && Boolean(token && conversationId),
    staleTime: 0,
    queryFn: async () => {
      const res = await atlas.chat.meridian.panel(conversationId, token);
      return res?.data ?? { threadId: null, messages: [] };
    },
  });
}

export function useSendMeridianPanel(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, focusMessageId }) =>
      atlas.chat.meridian.panelSend(conversationId, { content, focusMessageId: focusMessageId ?? undefined }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-meridian-panel", conversationId] }),
  });
}

export function useClearMeridianPanel(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => atlas.chat.meridian.panelClear(conversationId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-meridian-panel", conversationId] }),
  });
}
```

- [ ] `node --check`. Commit — `feat(chat): useMeridianPanel hooks`.

---

## Task 2: `MeridianPanel.jsx` (Sheet)

**Files:** Create `apps/desktop/src/modules/atlas.chat/components/MeridianPanel.jsx`

- [ ] A controlled `Sheet` (`open`, `onOpenChange`) from `@atlas/ui`, `side="right"`, `className` ~`w-full sm:w-[380px]`. Contents:
  - Header: `Sparkles` + "MeridIAn" + a muted "· solo tú ves esto"; a "Limpiar" ghost button (opens a `ConfirmDialog`, calls `useClearMeridianPanel`).
  - Body: scrollable message list. `messages` from `useMeridianPanelThread`. Each row: user right-aligned bubble, assistant left with the Sparkles circle (copy the 6-line block from `ChatConversationItem`). `EmptyState` ("Pregúntame sobre esta conversación") when no messages and not pending.
  - While `useSendMeridianPanel().isPending`: a "MeridIAn está pensando…" row with the bouncing dots (reuse `TypingIndicator` names={["MeridIAn"]}).
  - Composer: `TextareaField` + send `Button` (`Enter` sends, `Shift+Enter` newline). Disabled while pending or when `available === false` (`useMeridianStatus`), with helper text "MeridIAn no está configurado".
  - Props: `open`, `onOpenChange`, `conversationId`, `focusMessage` (optional; when set and the panel opens, prefill the composer with "¿Qué me puedes decir de este mensaje?" and keep `focusMessage.id` to send as `focusMessageId` on the first send only, then clear it).
- [ ] `node --check` + `pnpm --filter @atlas/desktop build:web`. Commit — `feat(chat): MeridianPanel private assistant sheet`.

---

## Task 3: Wire into `ChatWindow` + header button

**Files:** Modify `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] In `ChatWindow`: `const [meridianPanelOpen, setMeridianPanelOpen] = useState(false); const [meridianFocus, setMeridianFocus] = useState(null);`
- [ ] Render once (near the other right-side panels): `<MeridianPanel open={meridianPanelOpen} onOpenChange={(o) => { setMeridianPanelOpen(o); if (!o) setMeridianFocus(null); }} conversationId={conversationId} focusMessage={meridianFocus} />`
- [ ] `ChatHeader`: new prop `onOpenMeridian`, a `headerBtnCls` button with `Sparkles`, shown when `!isMeridian && conversation?.type !== "external_support"`; disabled + tooltip when `meridianStatus?.available === false`. Pass `onOpenMeridian={() => { setMeridianFocus(null); setMeridianPanelOpen(true); }}`.
- [ ] `pnpm --filter @atlas/desktop build:web`. Commit — `feat(chat): open the MeridIAn panel from the chat header`.

---

## Task 4: "Preguntar a MeridIAn" message action

**Files:** Modify `apps/desktop/src/modules/atlas.chat/lib/messageActions.jsx` (or wherever `buildMessageActions` lives) + `ChatMessageList.jsx` + `ChatWindow.jsx`

- [ ] Add an `onAskMeridian` callback threaded: `ChatWindow` passes `onAskMeridian={(m) => { setMeridianFocus(m); setMeridianPanelOpen(true); }}` to `ChatMessageList`, which passes it to `ChatMessageBubble` / the action builder.
- [ ] In the message actions list, add `{ key: "ask-meridian", label: "Preguntar a MeridIAn", icon: Sparkles, onSelect: () => onAskMeridian(message) }` — only when `onAskMeridian` is provided, the message is not deleted/system, and (optional) `useMeridianStatus().available !== false`. Place it near "Reenviar".
- [ ] `pnpm --filter @atlas/desktop build:web`. Commit — `feat(chat): "Preguntar a MeridIAn" message action opens the panel with that message`.

---

## Task 5: Build + QA

- [ ] `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/`; `pnpm --filter @atlas/desktop build:web`; `pnpm build`; `pnpm lint` — all green.
- [ ] Browser QA at **390px and 1440px** (per feedback_responsive_qa):
  1. In a normal chat, the header shows a Sparkles button → opens the right Sheet.
  2. Ask "resume los últimos mensajes" → spinner → private reply (not posted to the conversation; other members don't see it).
  3. On a message, "Preguntar a MeridIAn" → Sheet opens, composer prefilled; send → answer references that message; if it's an image, it's described.
  4. "Limpiar" wipes the thread (confirm dialog).
  5. In the MeridIAn direct chat and in an `external_support` conversation, the Sparkles button is absent.
  6. Unset `GROQ_API_KEY` → button disabled, composer disabled with helper text.
- [ ] Commit verification note.

---

## Self-review notes
- Spec §5.1 Sheet (not embedded) → Task 2. §5.2 entry points → Tasks 3 + 4. §5.3 hooks → Task 1.
- `focusMessage` sent only on the first message of a focused session → Task 2.
- No new routes; no `ModuleOutlet` changes; `ChatWindow` edits are a state pair + one render + one header button + one callback.
