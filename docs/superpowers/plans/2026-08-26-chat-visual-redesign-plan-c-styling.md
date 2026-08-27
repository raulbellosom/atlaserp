# atlas.chat Visual Redesign (Plan C — Styling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work directly on the `main` branch — do NOT create a git worktree or feature branch (this project's established convention; see Plan A/B in this same repo for precedent).

**Goal:** Give the `atlas.chat` module its own refined visual identity (glass surfaces, larger radii, a three-tier type system for names/body/metadata) drawn from the `DESIGN.md`/`code.html` reference mockups, without touching any `@atlas/ui` global theme token.

**Architecture:** A single new CSS file (`chat-theme.css`) defines chat-only custom properties and a `.chat-glass` utility class, scoped under a `.chat-glass-theme` wrapper class applied to the two chat root containers (`ChatScreen.jsx`, `MiniChatWindow.jsx`). Every subsequent task only changes `className` strings (and a couple of literal Tailwind arbitrary-value swaps) on existing components — no new state, no new data flow, no new dependencies.

**Tech Stack:** React (JSX), Tailwind CSS v4 (`@theme`/`@custom-variant` already in use), plain CSS custom properties, Google Fonts (Hanken Grotesk, JetBrains Mono).

**Spec:** `docs/superpowers/specs/2026-08-26-chat-visual-redesign-and-reaction-viewer-design.md`, Part A.

**Verification tooling note:** This repo has no component-level test runner for React/JSX (per `CLAUDE.md`, only `node --test` for backend services). Verification for every task in this plan is: (1) `pnpm --filter @atlas/desktop exec vite build` must succeed with no errors, and (2) a manual visual check description (what to look at, in the running dev server or the built app) — there is no automated substitute for "does this look right" here.

---

### Task 1: Load fonts + create the chat-scope theme file

**Files:**
- Modify: `apps/desktop/index.html:24-27`
- Create: `apps/desktop/src/modules/atlas.chat/chat-theme.css`

- [ ] **Step 1: Add Hanken Grotesk and JetBrains Mono to the existing Google Fonts link**

The file already loads five families in one `<link>` (lines 22-27). Add the two new families to the same `href` query string — Google Fonts serves multiple families from one request when they're joined with `&family=`.

Replace:
```html
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap"
      rel="stylesheet"
    />
```
With:
```html
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Hanken+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: Create the chat theme CSS file**

```css
/* apps/desktop/src/modules/atlas.chat/chat-theme.css */
/*
 * Chat-only visual layer. Scoped entirely under `.chat-glass-theme` so it
 * never leaks into the rest of the ERP shell. Reuses the app's existing
 * semantic color tokens (--surface-1/2/3, --primary, --border, --muted,
 * --background, --foreground, all defined globally in styles.css) — only
 * typography, radius, and glass/blur treatment are new here. See
 * docs/superpowers/specs/2026-08-26-chat-visual-redesign-and-reaction-viewer-design.md
 * Part A for the full rationale.
 */

.chat-glass-theme {
  --chat-font-display: "Hanken Grotesk", "Plus Jakarta Sans", system-ui, sans-serif;
  --chat-font-mono: "JetBrains Mono", ui-monospace, monospace;
  --chat-radius-bubble: 1.125rem;
  --chat-radius-bubble-tail: 0.375rem;
  --chat-radius-panel: 1.25rem;
  --chat-radius-pill: 9999px;
}

.chat-glass-theme .chat-glass {
  background: hsl(var(--surface-2) / 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid hsl(var(--border) / 0.5);
}

.chat-glass-theme .chat-font-display {
  font-family: var(--chat-font-display);
}

.chat-glass-theme .chat-font-mono {
  font-family: var(--chat-font-mono);
}
```

- [ ] **Step 3: Import the CSS file from the two chat root components**

In `apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx`, add near the top with the other imports:
```js
import "../chat-theme.css";
```

In `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx`, add near the top with the other imports:
```js
import "../chat-theme.css";
```

(Vite deduplicates repeated CSS imports across modules automatically — importing it from both files is safe and each file stays self-sufficient if one is ever used without the other.)

- [ ] **Step 4: Apply the scope class to both chat roots**

In `ChatScreen.jsx`, change the outer wrapper (currently `<div className="flex h-full overflow-hidden">` at line 70):
```jsx
<div className="chat-glass-theme flex h-full overflow-hidden">
```

In `MiniChatWindow.jsx`, change the floating window's root `<div>` (currently starts `className="rounded-xl shadow-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col overflow-hidden relative"` around line 147):
```jsx
className="chat-glass-theme rounded-xl shadow-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col overflow-hidden relative"
```

- [ ] **Step 5: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors (a new CSS import and two className string edits cannot break the build, but this confirms no typo in the import path).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/index.html apps/desktop/src/modules/atlas.chat/chat-theme.css apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx
git commit -m "feat(chat): add chat-scoped theme file, fonts, and root scope class"
```

---

### Task 2: Restyle ChatSidebar

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatSidebar.jsx:55`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx`

- [ ] **Step 1: Apply the glass treatment to the sidebar root**

In `ChatSidebar.jsx`, change (line 55):
```jsx
<aside className="flex flex-col w-full h-full border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
```
to:
```jsx
<aside className="chat-glass flex flex-col w-full h-full border-r border-[hsl(var(--border))]">
```
(`chat-glass` already sets its own background — dropping the flat `bg-[hsl(var(--surface-2))]` avoids fighting the blur layer underneath it.)

- [ ] **Step 2: Read ChatConversationItem.jsx to find the active/inactive row classNames**

Open `apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx` and locate the root element's className — it currently branches on an `isActive` prop with a conditional string (e.g. `isActive ? "bg-[hsl(var(--muted))] ..." : "hover:bg-[hsl(var(--muted)/0.5)] ..."`) and a conversation-name `<span>`/`<p>`.

- [ ] **Step 3: Bump the row radius and give the active row a glow ring**

Wherever the active-state className branch currently applies a flat highlight background, add a glow shadow alongside it — e.g. if the active branch reads:
```jsx
isActive ? "bg-[hsl(var(--muted))]" : "hover:bg-[hsl(var(--muted)/0.5)]"
```
change it to:
```jsx
isActive
  ? "bg-[hsl(var(--muted))] shadow-[0_0_16px_hsl(var(--primary)/0.18)] ring-1 ring-[hsl(var(--primary)/0.25)]"
  : "hover:bg-[hsl(var(--muted)/0.5)]"
```
and change the row's radius class from `rounded-lg`/`rounded-xl` (whichever is present) to `rounded-2xl`.

- [ ] **Step 4: Give the conversation name its own type**

Find the `<span>` or `<p>` rendering the conversation's display name (title/other-member name) and add `chat-font-display font-semibold` to its className (keep any existing `truncate`/`text-sm` classes alongside it).

- [ ] **Step 5: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manual visual check**

Run `pnpm dev:frontend`, open `/app/m/atlas.chat/chat/inbox`. Confirm: the sidebar background has a visible blur/glass effect over content behind it, the active conversation row has a soft purple glow instead of a flat fill, and conversation names render in the Hanken Grotesk display font (visually distinct — more geometric — from the body text below it).

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatSidebar.jsx apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx
git commit -m "feat(chat): restyle sidebar with glass panel, glow active state, display font"
```

---

### Task 3: Restyle ChatWindow header

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx:164-224` (normal-mode header), `:121-160` (search-mode header)

- [ ] **Step 1: Apply glass to the normal-mode header row**

Change (line 166):
```jsx
<div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-3 sm:px-4 py-3 shrink-0">
```
to:
```jsx
<div className="chat-glass flex items-center gap-3 px-3 sm:px-4 py-3 shrink-0">
```
(dropping the separate `border-b` — `chat-glass` already supplies a full border via its own class; a bottom-only border under a blurred panel would look like a stray hairline against the blur).

- [ ] **Step 2: Turn the online-status indicator into a ring around the whole avatar**

Change the avatar `<img>` (lines 178-184):
```jsx
<img
  src={avatarUrl}
  alt={displayName}
  className="h-9 w-9 rounded-full object-cover"
  onError={() => setAvatarErr(true)}
/>
```
to:
```jsx
<img
  src={avatarUrl}
  alt={displayName}
  className={[
    "h-9 w-9 rounded-full object-cover ring-2 ring-offset-2 ring-offset-[hsl(var(--surface-2))]",
    conversation?.type === "direct" && directOnline ? "ring-green-500/60" : "ring-[hsl(var(--border))]",
  ].join(" ")}
  onError={() => setAvatarErr(true)}
/>
```
(the existing small corner dot at line 197-199 stays untouched — the ring is additive, not a replacement, since users already recognize the dot).

- [ ] **Step 3: Give the conversation title the display font**

Change (line 204):
```jsx
<p className="text-sm font-semibold truncate">{titleLabel}</p>
```
to:
```jsx
<p className="chat-font-display text-sm font-semibold truncate">{titleLabel}</p>
```

- [ ] **Step 4: Make the search-mode bar a pill**

Change the search-mode container (line 124):
```jsx
<div className="flex items-center gap-1.5 border-b border-[hsl(var(--border))] px-3 py-2.5 shrink-0">
```
to:
```jsx
<div className="chat-glass flex items-center gap-1.5 rounded-full mx-2 mt-2 px-3 py-2.5 shrink-0">
```
(adding `mx-2 mt-2` so the pill doesn't touch the window edges — without it, a `rounded-full` bar flush against the container edges would clip its own rounded corners).

- [ ] **Step 5: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manual visual check**

Open a direct conversation with an online contact and one with an offline contact. Confirm the online avatar shows a soft green ring, the offline one a neutral ring, the title uses the display font, and toggling search mode (the search icon in the header) shows a pill-shaped bar with visible margin from the window edges.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): restyle ChatWindow header with glass, avatar ring, pill search bar"
```

---

### Task 4: Restyle the message composer (capsule input bar)

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx:566, 594`

- [ ] **Step 1: Turn the text-input row into a capsule**

Change (line 594):
```jsx
<div className="flex items-end gap-1 bg-[hsl(var(--muted))] rounded-2xl px-2 py-1.5">
```
to:
```jsx
<div className="chat-glass flex items-end gap-1 rounded-full px-2 py-1.5">
```

- [ ] **Step 2: Match the voice-recording row to the same shape**

Change (line 566):
```jsx
<div className="flex items-center gap-2 bg-[hsl(var(--muted))] rounded-2xl px-3 py-2">
```
to:
```jsx
<div className="chat-glass flex items-center gap-2 rounded-full px-3 py-2">
```

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual visual check**

Open any conversation. Confirm the message input row renders as a full capsule (fully rounded ends, not just rounded corners) with the same glass blur as the header, in both `ChatWindow` and a `MiniChatWindow` floating window. Type a multi-line message (Shift+Enter) and confirm the capsule grows in height without visually breaking (corners stay fully rounded top and bottom). Start a voice recording and confirm that row is also a capsule.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx
git commit -m "feat(chat): restyle message composer as a glass capsule"
```

---

### Task 5: Restyle message bubbles, timestamps, and entity reference chips

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx:575-587` (`bubbleRadius`), the four timestamp `<span>`s (own/other × shown/pending), `formatMessageTime`/`"Enviando..."` text
- Modify: `apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx`

- [ ] **Step 1: Move the two literal bubble radius values to the new CSS vars**

Change `bubbleRadius()` (lines 575-587):
```jsx
function bubbleRadius(isOwn, isFirst, isLast) {
  const FULL = "rounded-2xl";
  if (isFirst && isLast) return FULL;
  if (isOwn) {
    if (isFirst) return `${FULL} rounded-br-[4px]`;
    if (isLast)  return `${FULL} rounded-tr-[4px]`;
    return `${FULL} rounded-r-[4px]`;
  } else {
    if (isFirst) return `${FULL} rounded-bl-[4px]`;
    if (isLast)  return `${FULL} rounded-tl-[4px]`;
    return `${FULL} rounded-l-[4px]`;
  }
}
```
to:
```jsx
function bubbleRadius(isOwn, isFirst, isLast) {
  const FULL = "rounded-[var(--chat-radius-bubble)]";
  const TAIL = "rounded-[var(--chat-radius-bubble-tail)]";
  if (isFirst && isLast) return FULL;
  if (isOwn) {
    if (isFirst) return `${FULL} rounded-br-[var(--chat-radius-bubble-tail)]`;
    if (isLast)  return `${FULL} rounded-tr-[var(--chat-radius-bubble-tail)]`;
    return `${FULL} rounded-r-[var(--chat-radius-bubble-tail)]`;
  } else {
    if (isFirst) return `${FULL} rounded-bl-[var(--chat-radius-bubble-tail)]`;
    if (isLast)  return `${FULL} rounded-tl-[var(--chat-radius-bubble-tail)]`;
    return `${FULL} rounded-l-[var(--chat-radius-bubble-tail)]`;
  }
}
```
(the unused `TAIL` local — remove it; it was only written to show the value, the arbitrary-value classes reference the CSS var directly. Delete the `const TAIL = ...` line.)

- [ ] **Step 2: Put timestamps and "Enviando..." in the mono font**

There are four places rendering `formatMessageTime(...)` or the `"Enviando..."` string inside a `<span className="text-[10px] text-[hsl(var(--muted-foreground))]">` (two in the "own" branch, two in the "other" branch — search for `text-[10px] text-[hsl(var(--muted-foreground))]` in the file, the ones wrapping `formatMessageTime` or `isPending ? "Enviando..."`). For each one, add `chat-font-mono tabular-nums` to the className, e.g.:
```jsx
<span className="text-[10px] text-[hsl(var(--muted-foreground))]">
  {isPending ? "Enviando..." : formatMessageTime(message.created_at)}
</span>
```
becomes:
```jsx
<span className="chat-font-mono tabular-nums text-[10px] text-[hsl(var(--muted-foreground))]">
  {isPending ? "Enviando..." : formatMessageTime(message.created_at)}
</span>
```
Do this for every `<span>` that renders that exact expression (there are two: one in the own-message branch, one in the other-message branch).

- [ ] **Step 3: Restyle the entity reference chip**

In `EntityReferenceCard.jsx`, change:
```jsx
<button
  type="button"
  onClick={() => navigate(reference.url)}
  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-left hover:bg-[hsl(var(--muted))] transition-colors max-w-full"
>
  <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
  <div className="min-w-0">
    <p className="text-xs font-medium truncate">{reference.title}</p>
    {reference.subtitle && (
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{reference.subtitle}</p>
    )}
  </div>
</button>
```
to:
```jsx
<button
  type="button"
  onClick={() => navigate(reference.url)}
  className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-2.5 py-1.5 text-left hover:bg-[hsl(var(--muted))] transition-colors max-w-full"
>
  <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
  <div className="min-w-0">
    <p className="chat-font-display text-xs font-semibold truncate">{reference.title}</p>
    {reference.subtitle && (
      <p className="chat-font-mono text-[10px] text-[hsl(var(--muted-foreground))] truncate">{reference.subtitle}</p>
    )}
  </div>
</button>
```
(`EntityReferenceCard` isn't inside a `.chat-glass-theme` ancestor by DOM structure alone if it's ever reused outside chat — but it currently only renders inside `ChatMessageBubble`, which always renders inside `ChatWindow`/`MiniChatWindow`/`ThreadPanel`, all of which are inside the scoped roots from Task 1, so `chat-font-display`/`chat-font-mono` will resolve correctly here.)

- [ ] **Step 4: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manual visual check**

Send a few consecutive messages from the same sender to confirm bubble grouping still looks correct (rounded on the outside, tighter tail corner between grouped bubbles — just with the new radius values, same grouping logic). Confirm timestamps render in a monospace font. If any test message has an entity reference chip attached (or attach one via the paperclip/link picker), confirm its title is in the display font and its subtitle in mono.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx
git commit -m "feat(chat): restyle message bubbles, timestamps, and entity reference chips"
```

---

### Task 6: Add profile hero and restyle tabs in ConversationProfilePanel

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`

- [ ] **Step 1: Import what the hero needs**

At the top of `ConversationProfilePanel.jsx`, add to the existing imports:
```jsx
import { useState } from "react";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";
```
(`useState` is needed for Task in Plan D too — if this component doesn't already import it, add it now; check the existing import line first and merge rather than duplicate.)

- [ ] **Step 2: Compute hero data**

Inside the component body, right after the existing `const isMuted = ...` line, add:
```jsx
const { isUserOnline, getLastSeen } = useGlobalPresence();
const displayName = getConversationDisplayName(conversation, currentUserId);
const heroAvatarUrl = conversation?.avatarUrl ?? null;
const heroAvatarEmoji = conversation?.avatar_emoji ?? null;
const memberCount = (detail?.members ?? conversation?.members ?? []).length;
let statusLine = null;
if (type === "direct") {
  const other = (detail?.members ?? conversation?.members ?? []).find((m) => m.userId !== currentUserId);
  const online = other ? isUserOnline(other.userId) : false;
  const lastSeen = other ? getLastSeen(other.userId) : null;
  statusLine = online ? "En linea" : lastSeen ? `Visto ${new Date(lastSeen).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Desconectado";
} else {
  statusLine = `${memberCount} ${memberCount === 1 ? "miembro" : "miembros"}`;
}
```
(For `type === "direct"`, avatar resolution mirrors `ChatHeader`'s pattern in `ChatWindow.jsx`: fall back to the other member's avatar when the conversation itself has none. Add that fallback: change `heroAvatarUrl` to `conversation?.avatarUrl ?? (type === "direct" ? (detail?.members ?? conversation?.members ?? []).find((m) => m.userId !== currentUserId)?.avatarUrl : null) ?? null`.)

- [ ] **Step 3: Render the hero above the tabs in both branches**

Define the hero JSX once, right before the `if (type === "direct")` branch:
```jsx
const [avatarErr, setAvatarErr] = useState(false);
const hero = (
  <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
    <div className="h-20 w-20 rounded-full overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center">
      {heroAvatarUrl && !avatarErr ? (
        <img
          src={heroAvatarUrl}
          alt={displayName}
          className="h-full w-full object-cover"
          onError={() => setAvatarErr(true)}
        />
      ) : heroAvatarEmoji ? (
        <span className="text-4xl">{heroAvatarEmoji}</span>
      ) : (
        <span className="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">
          {(displayName ?? "?")[0]?.toUpperCase()}
        </span>
      )}
    </div>
    <p className="chat-font-display text-lg font-bold">{displayName}</p>
    <p className="text-xs text-[hsl(var(--muted-foreground))]">{statusLine}</p>
  </div>
);
```
(the avatar's `onClick` to open the lightbox is added in Plan D, Task 3 — this task only adds the visual hero.)

Then insert `{hero}` right after `{backHeader}` in **both** returned `<Tabs>` trees (direct branch and group/channel branch) — e.g.:
```jsx
return (
  <Tabs defaultValue={initialTab ?? "info"} className="flex-1 min-h-0 flex flex-col overflow-hidden">
    {backHeader}
    {hero}
    <TabsList className="px-3 pt-2 overflow-x-auto">
```
and the same `{hero}` placement in the group/channel branch's `<Tabs>` tree.

- [ ] **Step 4: Restyle the tab list as a pill/segmented control**

Both `<TabsList className="px-3 pt-2 overflow-x-auto">` occurrences become:
```jsx
<TabsList className="chat-glass mx-3 mt-1 mb-2 rounded-full p-1 overflow-x-auto">
```
Each `<TabsTrigger>` inside them gains a rounded-full active-state look. If `TabsTrigger` (from `@atlas/ui`) doesn't already expose a way to round its active indicator per-instance, wrap the children instead — check `packages/ui/src/components/Tabs.jsx` first: if `TabsTrigger` applies `data-[state=active]:` styling via its own fixed className (not overridable per-call), add a local override using the same `!` important-modifier pattern already used elsewhere in this codebase (see `MessageComposer.jsx`'s `MentionTextarea` comment for precedent): append `"rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"` to each `<TabsTrigger className="...">` call.

- [ ] **Step 5: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manual visual check**

Open the profile panel for a direct conversation: confirm a large avatar, name, and "En linea"/"Visto ..."/"Desconectado" line appear above the pill-shaped tab bar. Open it for a group/channel: confirm the same hero shows the group avatar/emoji and a "`N` miembros" line, and the tab bar (including the conditional "Roles" tab, if you have manage-roles permission on a test group) still switches tabs correctly.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx
git commit -m "feat(chat): add profile hero and pill-style tabs to ConversationProfilePanel"
```

---

### Task 7: Restyle MiniChatWindow header to match ChatWindow

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx:210-233`

- [ ] **Step 1: Apply glass to the expanded (non-minimized) header row**

Change (line 210-212):
```jsx
<div
  className="flex items-center gap-2 px-3 h-11 bg-[hsl(var(--surface-2))] border-b border-[hsl(var(--border))] shrink-0"
>
```
to:
```jsx
<div
  className="chat-glass flex items-center gap-2 px-3 h-11 shrink-0"
>
```

- [ ] **Step 2: Give the mini-window title the display font**

Change (line 219, inside the expanded header):
```jsx
<p className="flex-1 text-xs font-semibold truncate">{titleLabel}</p>
```
to:
```jsx
<p className="chat-font-display flex-1 text-xs font-semibold truncate">{titleLabel}</p>
```
(leave the minimized-mode title at line 176 as plain text — it's a compact taskbar-style strip, not a header, and doesn't need the display font treatment.)

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual visual check**

Open a floating mini chat window (click a conversation from a notification or wherever `openChat()` is triggered in this app). Confirm the expanded header has the same glass look as the main `ChatWindow` header and the title uses the display font.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx
git commit -m "feat(chat): restyle MiniChatWindow header to match ChatWindow"
```

---

### Task 8: Responsive QA pass

**Files:** None (verification-only task).

- [ ] **Step 1: Run the 14-aspect UI checklist at 390px**

Open `docs/ai-context/ui-screen-audit-checklist.md`. With `pnpm dev:frontend` running, resize the browser (or use devtools device toolbar) to 390px width. Walk the checklist against: `ChatSidebar` (list view), `ChatWindow` (header, message list, composer), `ConversationProfilePanel` for both a direct conversation and a group conversation, `MiniChatWindow` (if mini windows are reachable at this width — otherwise skip and note why).

Specifically confirm, since these are new to this plan:
- The capsule composer from Task 4 doesn't overflow or clip its buttons at 390px.
- The profile hero's 80px avatar plus name/status text doesn't overflow the panel width.
- The pill tab bar from Task 6 scrolls horizontally (`overflow-x-auto` is already set) rather than wrapping or clipping when there are 5 tabs (group/channel with Roles visible).
- The sidebar's glow-ring active state doesn't get clipped by the sidebar's own edge at narrow widths.

- [ ] **Step 2: Run the same checklist at 1440px**

Repeat Step 1 at 1440px width, additionally confirming:
- The glass blur effect is visible against the message list scrolling behind the sticky header (i.e. `backdrop-filter` is actually being applied, not silently falling back to opaque — check by scrolling messages under the header and watching for blurred content showing through).
- `MiniChatWindow`'s restyled header doesn't look inconsistent next to the un-restyled parts of the floating window (its message list background, if any Task in this plan didn't touch it, should still be checked for whether it visually clashes with the new glass header — if it looks jarring, that's a finding to fix in this task, not a new task, since it's directly caused by Tasks 1-7's changes).

- [ ] **Step 3: Fix any findings inline**

If Steps 1-2 surface a real visual defect introduced by Tasks 1-7 (not a pre-existing issue unrelated to this plan), fix it directly in the relevant component file and re-check.

- [ ] **Step 4: Final full build check**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Commit (only if Step 3 produced changes)**

```bash
git add -A
git commit -m "fix(chat): responsive QA fixes for chat visual redesign"
```

---

## Self-Review Notes

- **Spec coverage:** A1 (scope wrapper) → Task 1. A2 (typography) → Tasks 1, 2, 3, 5. A3 (shape/elevation tokens) → Task 1 (definitions), used throughout Tasks 2-7. A4 component-by-component → Task 2 (sidebar), Task 3 (header), Task 4 (input bar), Task 5 (bubbles/timestamps/entity chips), Task 6 (profile panel hero + tabs), Task 7 (MiniChatWindow). A5 (responsive QA) → Task 8.
- **No call/video icons added** — the spec's Non-goals explicitly rule this out; Task 6's hero deliberately has no action-icon row.
- **`EntityReferenceCard.jsx` scope note**: this component is only ever rendered inside chat message bubbles today (confirmed by reading `ChatMessageBubble.jsx`), so applying `chat-font-display`/`chat-font-mono` classes to it is safe without an explicit scope check inside the file itself.
