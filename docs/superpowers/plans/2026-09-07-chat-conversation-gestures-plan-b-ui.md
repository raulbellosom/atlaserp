# Plan B — Chat row gestures & context menu (UI)

Spec: `docs/superpowers/specs/2026-09-07-chat-conversation-gestures-design.md`
Depends on Plan A (pin/hide endpoints + `is_pinned` on rows).

## Tasks

1. **`@atlas/ui` — `ContextMenu`**
   - `packages/ui/package.json`: add `@radix-ui/react-context-menu`.
   - `packages/ui/src/components/ContextMenu.jsx` — themed wrapper
     (copy `DropdownMenu.jsx` styling). Export from `packages/ui/src/index.js`.

2. **`@atlas/ui` — `SwipeableRow`**
   - `packages/ui/src/components/SwipeableRow.jsx` using `motion` `drag="x"`.
     Props: `rightActions` (array of `{key,label,icon,onSelect,tone}`),
     `onFullSwipeRight`, `fullSwipeLabel`, `open`, `onOpenChange`, `disabled`,
     `children`. Touch-only engage (`useIsMobile()` + `(pointer: coarse)`).
   - Export from index. Add both to
     `docs/ai-context/ame3-runtime-capabilities.md`.

3. **`lib/buildConversationActions.js`** (pure) + unit test.

4. **Hooks** (`hooks/useChatConversations.js`) — `usePinConversation`,
   `useHideConversation`, `useLeaveConversation`. Optimistic cache updates
   with rollback on error + toast.

5. **`components/ConversationRowActions.jsx`** — wraps a row:
   - always: `ContextMenu` with the full action list;
   - touch: `SwipeableRow` (first two non-destructive actions as buttons +
     "Más" opening a `Sheet` with the full list); long-press also opens the
     `Sheet`;
   - hosts `ConfirmDialog` for `destructive` actions;
   - controlled `openRowId` pair via props so the list closes siblings.

6. **`components/ChatConversationItem.jsx`** — remove `onUnarchive`
   side-button; add `Pin` glyph when `conversation.is_pinned`.

7. **`components/ChatSidebar.jsx`** — wrap main + archived rows in
   `ConversationRowActions`; own `openRowId` state; feed handlers
   (pin/mute/read/archive/unarchive/delete/leave).

8. **`components/FloatingChatHub.jsx`** — swap bespoke row for
   `ChatConversationItem` + `ConversationRowActions` (compact). Fallback:
   `ContextMenu`-only wrap if layout regresses.

## Verify

- `node --test` chat FE lib suites (incl. new `buildConversationActions.test.js`).
- `pnpm --filter @atlas/desktop build` (vite) green.
- `pnpm lint` (root `eslint .`) green.
- Manual QA 390 / 1440: swipe both directions, full-swipe archive, long-press
  sheet, desktop right-click, pinned ordering + glyph, delete/leave confirm.
