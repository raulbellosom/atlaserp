# atlas.chat Visual Redesign + Reaction Viewer + Avatar Lightbox — Design

## Context

Follow-up to the just-shipped Conversation Profile Panel work (Plan A backend + Plan B frontend, merged to `main`). The user provided:

- Two screenshots of the current app (mobile "Perfil" view, desktop chat window) showing the existing state.
- `code.html`: a static "Nexus Chat" mockup (glassmorphic dark UI, three-column layout: nav rail / conversation list / chat stage / profile panel).
- `DESIGN.md`: a full design-system spec for that mockup ("Aether Luxury Chat") — Material-3-style color token names, a Hanken Grotesk / Inter / JetBrains Mono triple-font strategy, large-radius glassmorphism, tonal elevation.
- Two functional gaps found while using the app:
  1. No way to see **who** reacted to a message with which emoji, or to remove your own reaction from that view.
  2. Clicking a profile picture does nothing — it should open in the existing image lightbox.

## Scope decision (confirmed with user)

`@atlas/ui`'s theme tokens (`--background`, `--primary`, `--surface-1/2/3`, etc., defined in `apps/desktop/src/styles.css`) are **global** — every module in the ERP reads them. Replacing them with `DESIGN.md`'s literal palette would re-brand the entire app, not just chat. The user chose: **redesign atlas.chat only**, with zero changes to the global token values.

Consequence: this redesign adopts `DESIGN.md`'s **typography, shape language (radius/spacing/glass), and layout ideas**, applied on top of the **existing** semantic color tokens (`--surface-1/2/3`, `--primary`, `--border`, `--muted`, `--background`, `--foreground`) — which are already a dark glassmorphic theme (see `project_glass_design_system` memory). No new hex palette is introduced. This keeps chat visually consistent with the rest of the shell (module sidebar, top nav) while giving it its own refined identity, the same way the mockup's chat widget has its own type/shape identity within a larger app.

## Part A — Visual redesign (chat-scoped)

### A1. Scope wrapper

A new class `chat-glass-theme` wraps every chat root:
- `ChatScreen.jsx` — the outer `<div className="flex h-full overflow-hidden">` (line 70) gains the class.
- `FloatingChatHub.jsx` — its root floating container gains the class (so `MiniChatWindow` picks up the same rules).

All new chat-specific CSS lives in a new file `apps/desktop/src/modules/atlas.chat/chat-theme.css`, imported once from `ChatScreen.jsx` and once from `FloatingChatHub.jsx` (side-effect import, mirrors how other modules scope local CSS). Selectors are all prefixed `.chat-glass-theme …` so nothing leaks to the rest of the app.

### A2. Typography

Add Hanken Grotesk and JetBrains Mono via a Google Fonts `<link>` in `apps/desktop/index.html` (Inter is not added — see below).

Inside `.chat-glass-theme`:
- `--chat-font-display: "Hanken Grotesk", "Plus Jakarta Sans", system-ui, sans-serif` — conversation names, sender names, screen titles ("Perfil", tab labels).
- `--chat-font-mono: "JetBrains Mono", ui-monospace, monospace` — timestamps, "Enviando...", file sizes, entity-reference-card labels (mirrors `DESIGN.md`'s use of mono for ERP metadata).
- Message body text keeps the app's existing base font (`Plus Jakarta Sans`, not Inter) — introducing a second body font for chat only would fight the shell's own body text in the same viewport (sidebar nav uses the base font already) with no real benefit; `DESIGN.md`'s Inter and the app's Plus Jakarta Sans are visually close enough that switching isn't worth the inconsistency.

### A3. Shape & elevation tokens

Inside `.chat-glass-theme`, new custom properties (values only — reusing existing color tokens):
```css
.chat-glass-theme {
  --chat-radius-bubble: 1.125rem;   /* message bubbles: rounded-2xl / 18px, matches DESIGN.md */
  --chat-radius-panel: 1.25rem;     /* cards, panels, ERP reference cards */
  --chat-radius-pill: 9999px;       /* tab list, search bar, input bar, reaction pills */
}
.chat-glass-theme .chat-glass {
  background: hsl(var(--surface-2) / 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid hsl(var(--border) / 0.5);
}
```
`.chat-glass` is applied to: `ChatSidebar`'s root, `ChatWindow`'s header bar, the message input bar container, `ConversationProfilePanel`'s root, and `MiniChatWindow`'s header/input.

### A4. Component-by-component treatment

**`ChatSidebar.jsx`** — no structural change (header alignment with `ModuleSidebar` was already fixed in Plan B). Visual only:
- Root `<aside>` gains `chat-glass` instead of the flat `bg-[hsl(var(--surface-2))]`.
- Conversation list items: radius bumped to `rounded-2xl` (via `--chat-radius-panel`), active item gets a soft glow ring (`shadow-[0_0_20px_hsl(var(--primary)/0.15)]`, mirrors `DESIGN.md`'s `.glow-active`) instead of the current flat highlight.
- Conversation name uses `--chat-font-display`; the timestamp/preview line stays on the base font (body text, not metadata).

**`ChatWindow.jsx` header (`ChatHeader`, line 44–316)**:
- Header row gains `chat-glass` (currently plain `border-b`).
- Avatar (line 177–201): online-status ring becomes a colored glow around the whole avatar (`ring-2 ring-green-500/60 ring-offset-2 ring-offset-[hsl(var(--surface-2))]` when online, `ring-[hsl(var(--border))]` otherwise) instead of just the small corner dot — dot is kept too (redundant signal is fine, matches the mockup's ring + the existing dot users already recognize).
- Title (`titleLabel`) switches to `--chat-font-display`.
- Search-mode input bar (line 121–160) becomes a pill (`rounded-full`) rather than the current flush bar, matching the capsule search treatment in the mockup.

**Message list / `ChatMessageBubble.jsx`**:
- `bubbleRadius()` (line 575–587) constants swap from `rounded-2xl` / `rounded-br-[4px]` to use `--chat-radius-bubble` and a tighter tail radius (`0.375rem`) — same grouping logic, just the two literal radius values move to the CSS vars.
- Timestamps (`formatMessageTime` output) and "Enviando..." get `--chat-font-mono` — small, deliberate detail matching `DESIGN.md`'s use of mono type for metadata.
- `EntityReferenceCard.jsx` (bank-transfer-style cards): label row (e.g. institution name) switches to `--chat-font-mono` uppercase-tracked, matching the mockup's "GLOBAL NEXUS BANK" treatment; card radius uses `--chat-radius-panel`.

**Message input bar** (`ChatWindow.jsx`, ~line 680–720): container becomes a single pill (`chat-glass rounded-full`) wrapping attach/emoji/send buttons and the text input, replacing the current flat bordered strip — mirrors the mockup's capsule composer.

**`ConversationProfilePanel.jsx`**:
- New **hero section**, inserted between `backHeader` and `TabsList` (both branches, direct and group/channel): avatar (large, 80px), name (`--chat-font-display`, large), one-line status (direct: "En línea" / "Visto ..." reusing the same presence logic already in `ChatHeader`; group/channel: "`{memberCount}` miembros"). No call/video/notification icon row — this app has no calling feature, and adding icons with no action would be dead UI (explicitly against project convention). The **avatar in this hero is the one wired to the new lightbox** (Part C).
- `TabsList` restyled as a pill/segmented control (`chat-glass rounded-full p-1`, active tab gets `bg-[hsl(var(--primary)/0.15)] rounded-full`) instead of the current flat underline-style tabs — matches the mockup's "Info / Media / Links" pill bar.

**`MiniChatWindow.jsx`**: same header/input treatment as `ChatWindow` (glass + pill input), since it shares the same visual space (floating window) and the user's second screenshot is specifically this component's profile view.

### A5. Responsive QA

Re-run the 14-aspect UI checklist (`docs/ai-context/ui-screen-audit-checklist.md`) at 390px and 1440px for: `ChatSidebar`, `ChatWindow` header + input + bubbles, `ConversationProfilePanel` (both direct and group variants), `MiniChatWindow`. No new breakpoints are introduced — existing responsive behavior (mobile single-pane, desktop triple-pane) is preserved; this pass only confirms the new glass/radius/font treatment doesn't break it (e.g. pill input bar not clipping on narrow widths, hero avatar not overflowing at 390px).

## Part B — "Who reacted" modal with remove-own-reaction

### Current behavior (to change)

`MessageReactions.jsx` renders one pill per emoji (`{emoji, userIds}` from `message.reactions`, already aggregated server-side). Clicking **any** pill calls `onToggle(emoji)` immediately — toggles the current user's own reaction with that emoji, with no way to see the other reactors' names.

### New behavior

Clicking a reaction pill **opens a modal** listing every reaction on that message instead of instantly toggling. The modal is where the toggle-off action moves to.

**New component**: `apps/desktop/src/modules/atlas.chat/components/MessageReactionsModal.jsx`
- Props: `open`, `onOpenChange`, `reactions` (message's `reactions` array), `members` (conversation members, for name/avatar lookup), `currentUserId`, `onRemoveOwn(emoji)`.
- Built on `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` from `@atlas/ui` (no native dialog, per the UI-first policy).
- One section per emoji group (in the same order as `reactions`): emoji + count as the section heading, then one row per `userId` in that group — resolved via `members.find(m => m.userId === userId)` → avatar (image, or initial-letter fallback matching the existing avatar-fallback pattern used in `ChatMessageBubble`) + `displayName` (fallback "Usuario").
- For the row where `userId === currentUserId`: an inline "Quitar" button (ghost, `X` icon from `lucide-react`) that calls `onRemoveOwn(emoji)` — which the caller wires to the **existing** `onToggleReaction(message.id, emoji)` handler (already implemented, no backend change — toggling an existing reaction removes it). No "add reaction" action lives in this modal — adding is unchanged (the hover smiley icon / "..." → "Reaccionar" flow already shipped).
- Empty/no-reactions state isn't reachable — the modal is only ever opened from a pill that exists because `reactions.length > 0`.

**`MessageReactions.jsx` changes**:
- Add local `const [modalOpen, setModalOpen] = useState(false)`.
- Pill `onClick` changes from `() => onToggle(emoji)` to `() => setModalOpen(true)` (same handler on every pill — the modal always shows all groups, not just the clicked emoji's).
- Render `<MessageReactionsModal open={modalOpen} onOpenChange={setModalOpen} reactions={reactions} members={members} currentUserId={currentUserId} onRemoveOwn={onToggle} />` — needs `members` threaded in as a new prop (currently `MessageReactions` only receives `reactions`, `currentUserId`, `onToggle`).
- `ChatMessageBubble.jsx`'s two `<MessageReactions .../>` call sites (own-message branch and other-message branch) both already have `members` in scope (it's already a prop of `ChatMessageBubble`) — pass it through.

This is a deliberate behavior change (1-click-toggle → open-modal, then 1-click-remove-inside-modal) made explicitly per the user's request that removal live inside the "who reacted" list, not on the pill itself.

## Part C — Avatar click opens image lightbox

### Which viewer

Two image viewers already exist:
- `ChatAttachmentViewer.jsx` (wraps `AdvancedFileViewer`) — multi-file gallery with signed-URL resolution, used for message attachments. Overkill for a single already-resolved avatar URL.
- `ImageViewer` (exported from `@atlas/ui`, `packages/ui/src/components/ImageViewer.jsx`) — single-image lightbox (dark overlay, download + close, Escape to close). Currently **unused** anywhere in the app. This is the right fit: no gallery navigation needed, no signed-URL fetch needed (`avatarUrl` from the conversation/member record is already a usable URL), and it's still "our" viewer component per the UI-first policy.

### Wiring

In `ConversationProfilePanel.jsx`'s new hero section (Part A4): the avatar `<img>` (or emoji/initial fallback) becomes a `<button type="button" onClick={() => setAvatarViewerOpen(true)}>` — only when a real `avatarUrl` exists (emoji/initial fallbacks aren't "photos," clicking them opens nothing, matching the existing pattern elsewhere in this codebase of only wiring real images).

```jsx
const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
// ...
<ImageViewer
  src={avatarUrl}
  alt={displayName}
  open={avatarViewerOpen}
  onClose={() => setAvatarViewerOpen(false)}
/>
```

`avatarUrl` and `displayName` for the hero are resolved the same way `ChatHeader` already does it (`conversation?.avatarUrl ?? otherMember?.avatarUrl`, `getConversationDisplayName`) — no new resolution logic, reuse the existing helpers from `chatUtils`/`ChatHeader`'s pattern.

Group/channel avatars (edited via `ChannelGeneralTab.jsx`) get the same click-to-view treatment on their existing avatar preview (the 64px circle at the top of that tab) — same `ImageViewer` instance pattern, gated the same way (only when `conversation?.avatarUrl` is set, not for emoji/initial).

## Non-goals

- No changes to `@atlas/ui`'s global theme tokens or any other module's appearance.
- No call/video buttons — not a real feature of this app, won't add dead UI.
- No change to the "add a reaction" flow (hover smiley / "..." menu) — only how you view + remove existing reactions.
- No backend changes — `reactions` already carries `userIds` per emoji (Plan A/B era), and `avatarUrl` is already resolved server-side for conversations and members. This is 100% frontend.
- No gallery/multi-avatar navigation in the lightbox — it's a single image per open.
