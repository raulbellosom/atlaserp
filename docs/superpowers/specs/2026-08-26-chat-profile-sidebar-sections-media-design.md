# Chat Profile Sidebar, Flat Sections, Media Multi-Select, Entity-Ref Integration — Design

## Context

Follow-up to the just-shipped visual redesign (Plan C) and reaction-viewer/avatar-lightbox work (Plan D). After using the redesigned chat, the user identified four more things, all pointing at the same area (the conversation profile panel and message composition):

1. On large screens, the profile panel should open as a **persistent sidebar to the right of the chat**, not replace the message list — matching the reference mockup's triple-column layout (nav rail / conversation list / chat stage / profile sidebar).
2. The profile panel should be **flat sections in one scroll, not tabs** — also matching the reference mockup, which shows Contact Info, Shared Media, and Recent Files stacked in a single scrollable column with no tab-switching.
3. The Media section's thumbnails are too large, and there's no way to select multiple files and download them together.
4. Entity reference chips (links to other ERP records — contacts, files, ledger accounts, HR employees) look like a second, separate message glued below the text bubble instead of part of the same message, and — already fixed separately — used to require message text to be present before you could send one.

This spec covers items 1-3 plus the visual-integration half of item 4 (the "requires text" bug was a one-line fix, already shipped).

## Scope decision

Item 1 (persistent sidebar) only needs to change behavior at large viewport widths — Tailwind's `xl:` breakpoint (1280px), matching `DESIGN.md`'s own stated desktop breakpoint. Below that, the existing swap-the-message-list-for-the-panel behavior is kept (there isn't room for both side by side on a laptop-width or mobile screen). This is achievable with pure CSS responsive classes — no JavaScript viewport-width detection needed — by keeping the message view mounted at all times and using `hidden xl:flex` and `w-full xl:w-96` style overrides. `MiniChatWindow`'s floating window (max 300px wide) is unaffected — it always uses swap behavior, at every width, since a persistent side-by-side layout makes no sense in a 300px popup.

Item 2 (tabs → sections) replaces `ConversationProfilePanel`'s `<Tabs>`/`<TabsList>`/`<TabsContent>` structure with a single scrollable column of labeled sections. The `initialTab` prop (used by "Ver miembros" and the member-avatar-stack click to jump straight to a specific tab) becomes "scroll to a specific section" instead, via a ref and `scrollIntoView`.

Item 3 (media) shrinks the thumbnail grid, and adds a selection mode: a toolbar toggle enters selection, tapping a thumbnail while in that mode toggles its checkbox instead of opening the viewer, and a bottom bar shows the count with a "Descargar" action. Per the user's own phrasing ("en un zip o rar o directamente" — in a zip/rar or directly), the direct-downloads route is taken: no new dependency, no client-side zip library — selecting N files and hitting "Descargar" triggers N sequential direct downloads (the same mechanism `FileCard`'s existing single-file download button already uses), which is simpler, has no CORS/blob-fetching risk, and matches an option the user explicitly named as acceptable.

Item 4 (entity reference visual integration): when an entity reference chip immediately follows a text bubble in the same message, it's re-styled to look like a continuation of that bubble (matching background color, no border, flush top corners, zero gap) instead of a visually distinct bordered card floating below it. When there's no text (entity-ref-only message, now possible since the "requires text" bug is fixed), the chip keeps its own bubble-like rounded shape on all corners, since there's nothing above it to merge with.

## Part A — ConversationProfilePanel: sections instead of tabs

### A1. Structure

Both branches (`type === "direct"` and group/channel) render:
```
{backHeader}
{hero}
<div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
  <SectionHeader icon={...} label="..." />
  {section content}
  <SectionHeader icon={...} label="..." />
  {section content}
  ...
</div>
```
`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` imports are removed from this file entirely — no tab-switching state, no `defaultValue`.

**Direct conversation sections, in order:** Info (danger zone: block/report — `ConversationInfoTab`'s existing content), Media (`ConversationMediaTab`), En comun (`GroupsInCommonTab`), Notificaciones (`NotificationsTab`).

**Group/channel sections, in order:** General (`ChannelGeneralTab`), Miembros (`ChannelMembersTab`), Roles (`ChannelRolesTab`, only when `canManageRoles`), Media (`ConversationMediaTab`), Notificaciones (`NotificationsTab`).

A small local `SectionHeader({ icon: Icon, label })` component renders a sticky-free label row (icon + uppercase-tracked text + a bottom border), reusing the same icons already imported for the old tab triggers (`Info, Users, Shield, FolderOpen, Bell, Settings`).

### A2. `initialTab` becomes scroll-to-section

Each section gets a stable DOM anchor via a `data-section="info"` (etc.) attribute on its wrapping `<div>`, using the same string values `initialTab` already accepts today (`"info"`, `"media"`, `"common"`, `"notifications"`, `"general"`, `"members"`, `"roles"`). On mount (and whenever `initialTab` changes — the caller still remounts this component via the `key={initialTab ?? "default"}` pattern already established in `ChatWindow.jsx`/`MiniChatWindow.jsx`, so a plain `useEffect(() => {...}, [])` running once per mount is sufficient), if `initialTab` is set, find the element with that `data-section` inside `scrollRef.current` and call `.scrollIntoView({ block: "start" })`.

### A3. Section components' layout in a flat scroll

Every section component currently assumes it's the sole flex-growing, independently-scrolling child of a `<TabsContent>` (`className="flex-1 min-h-0 overflow-y-auto"` was on the `TabsContent` wrapper, not inside the section components themselves — checked: `ConversationInfoTab`, `ChannelGeneralTab`, `NotificationsTab`, `ChannelMembersTab`, `ChannelRolesTab` all already use plain block layout internally, so removing the `TabsContent` wrapper and rendering them directly costs nothing). Two exceptions need a small fix:

- `GroupsInCommonTab.jsx`'s empty state uses `<EmptyState className="flex-1 min-h-0" .../>` — that class assumes a flex parent sizing it to fill available height, which no longer exists once it's stacked in a normal scroll. Change to no className override (or a fixed `py-8` per the existing repo convention for inline empty states, e.g. `ChatSidebar.jsx`'s `<EmptyState className="py-8" .../>`).
- `ConversationMediaTab`/`ChatFilesGallery`'s root (`flex-1 min-h-0 overflow-y-auto`) is being restructured anyway in Part C below — its new root drops `flex-1 min-h-0 overflow-y-auto` in favor of plain block layout, consistent with every other section.

## Part B — Persistent right-side panel on large screens

**File:** `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

The area that currently renders either the message list/files-view OR (exclusively) the profile panel becomes a flex row containing both, with responsive visibility:

```jsx
<div className="flex-1 min-w-0 min-h-0 flex">
  <div className={membersView ? "hidden xl:flex flex-1 min-w-0 min-h-0 flex-col" : "flex flex-1 min-w-0 min-h-0 flex-col"}>
    {/* existing filesView / ChatMessageList branch, unchanged */}
  </div>
  {membersView && (
    <div className="w-full xl:w-96 xl:shrink-0 xl:border-l xl:border-[hsl(var(--border))] flex flex-col min-h-0">
      <ConversationProfilePanel key={profileInitialTab ?? "default"} conversation={conversation} currentUserId={userProfile?.id} initialTab={profileInitialTab} onBack={closeProfile} messages={messages} isLoadingMessages={isLoading} />
    </div>
  )}
</div>
{!filesView && !membersView && (
  <MessageComposer .../>
)}
```

Below `xl:` (1280px): message view is `hidden` while `membersView` is true (today's swap behavior, unchanged), profile panel is `w-full` (fills the whole content area, unchanged from today).

At `xl:` and above: message view keeps `xl:flex` even while `membersView` is true (both visible), profile panel becomes a fixed `xl:w-96` column with a left border, sitting beside the message view rather than replacing it.

The message composer (`<MessageComposer/>`) is currently hidden whenever `membersView` is true (`{!filesView && !membersView && (...)}`) — this stays exactly as-is even at `xl:` widths: when the profile sidebar is open, you're looking at conversation info, not actively composing, matching the reference mockup (its right sidebar coexists with the message view, but the mockup's composer is for the chat stage, unrelated to the sidebar being open or closed — there's no requirement to keep composing while the sidebar is open, and hiding it avoids the composer visually competing with a persistent sidebar for space on narrower `xl:` widths like 1280-1366px laptops).

`MiniChatWindow.jsx` is NOT touched by this part — its floating window's fixed 300px width never triggers `xl:`, so its existing full swap behavior (profile view replaces messages) is unaffected automatically; no special-casing needed.

## Part C — Media section: smaller thumbnails + multi-select + bulk download

**Files:** `apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx`, `apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx`

### C1. Smaller thumbnails

The image grid's `grid-cols-3` becomes `grid-cols-4` — with the panel now a fixed `xl:w-96` (384px) sidebar (Part B) instead of stretching across the whole content area, 4 columns at ~90px each is a reasonable "thumbnail" size (previously 3 columns of a full-width swapped panel could render each tile well over 200px on a wide monitor, which was the actual root cause of "thumbnails too large").

### C2. Selection mode

`ChatFilesGallery` gains a `selectionMode`/`selectedIds`/`onToggleSelect` set of props (lifted to `ConversationMediaTab`, which owns the state) plus an `onEnterSelection` callback:

- A small toolbar row above the grid: when not in selection mode, a single "Seleccionar" text button (right-aligned, small). When in selection mode, it becomes "`N` seleccionados" (left) + "Cancelar" (right).
- While in selection mode, clicking an image thumbnail toggles its checkbox (a small circular check overlay in the corner, matching the visual language of `ChatMessageBubble.jsx`'s existing `SelectionCircle` component — that component is local/unexported to that file, so `ChatFilesGallery.jsx` gets its own small local equivalent rather than changing `ChatMessageBubble.jsx`'s export surface for an unrelated feature). Non-image files (the "Archivos" list) are NOT selectable for this feature (bulk download only applies to the media/image grid, per the user's specific complaint being about the Media section's thumbnails) — clicking a file row always opens the viewer regardless of selection mode.
- A bottom bar appears only while `selectedIds.size > 0`: "Descargar (`N`)" button.

### C3. Bulk download

`ConversationMediaTab` resolves each selected attachment's URL (already available as `att.url` from the message payload — the same embedded `card`-variant URL `ChatFilesGallery` already uses for rendering, no new signed-URL fetch needed since this is a bulk-download convenience, not the full-resolution single-image viewer) and triggers a direct download for each, staggered by 150ms per file (matching common browser download-manager UX to avoid the browser's multiple-simultaneous-download-popup blocking behavior some browsers apply) using the same `<a href download>` pattern `FileCard.jsx`'s existing `handleDownload` already uses. After triggering, selection mode is exited and `selectedIds` cleared.

## Part D — Entity reference visual integration

**File:** `apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx`, `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

`EntityReferenceCard` gains an `attached` boolean prop. `ChatMessageBubble.jsx` passes `attached={hasText}` at both its entity-ref render call sites (own-message and other-message branches) — `hasText` is already computed there (`Boolean(message.body) || isDeleted`, gated so entity refs never render when `isDeleted`, so effectively `attached = Boolean(message.body)`).

When `attached` is true:
- No top margin (currently `mt-1` on the wrapping `<div className="flex flex-col gap-1 mt-1">` around the map of entity ref cards — becomes `mt-0` when `attached`, so it sits flush against the text bubble above it).
- Background matches the bubble's own color instead of the default card look: own-message bubbles use `bg-(--brand-primary)/90 text-(--brand-primary-foreground)` (matching the exact classes the own-message text bubble already uses), other-message bubbles use `bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]` (matching the other-message text bubble).
- No border (`border border-[hsl(var(--border))]` dropped).
- Top corners are flush (`rounded-t-none`), bottom corners keep the existing radius, so it reads as the bottom continuation of the same bubble shape.

When `attached` is false (no text — an entity-ref-only message), `EntityReferenceCard` keeps its current independent look (border, own background, fully rounded) since there's no bubble above it to visually continue.

## Non-goals

- No zip/rar file creation, client-side or server-side — direct sequential downloads only, per the user's own stated fallback preference and to avoid a new dependency.
- No changes to non-image file rows' selectability — bulk-select applies only to the image grid.
- No changes to `MiniChatWindow`'s always-swap behavior.
- No changes to any Radix-based overlay (`ThreadPanel`, `PinnedMessagesSheet`, `ForwardMessageModal`, `ConfirmDialog`) — this spec is scoped to `ConversationProfilePanel`, its section components, `ChatWindow`'s content-area layout, and entity reference chip styling.
- No backend changes — every value used here (`att.url`, member/conversation fields) is already present in payloads these components already receive.
