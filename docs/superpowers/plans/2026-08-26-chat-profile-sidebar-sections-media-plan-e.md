# Chat Profile Sidebar, Sections, Media Multi-Select, Entity-Ref Integration (Plan E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work directly on the `main` branch — do NOT create a git worktree or feature branch (this project's established convention).

**Goal:** Turn the conversation profile panel from a tabbed, always-swap-the-message-list overlay into a flat-sections panel that opens as a persistent sidebar on large screens; shrink and add multi-select+bulk-download to the media grid; visually merge entity reference chips into the message bubble they belong to.

**Architecture:** `ConversationProfilePanel` drops `Tabs`/`TabsList`/`TabsContent` for a single scrollable column of labeled sections (each section component unchanged internally — they already use plain block layout, confirmed by reading every one of them). `ChatWindow` grows a responsive flex layout so the panel renders beside the message view at `xl:` (1280px) and above, replacing it below that. `ChatFilesGallery`/`ConversationMediaTab` gain selection state and a bulk-download action using the same direct-download mechanism already used for single files. `EntityReferenceCard` gains an `attached` prop that changes its background/border/radius to match the message bubble above it.

**Tech Stack:** React (JSX), Tailwind CSS v4, `@atlas/ui`.

**Spec:** `docs/superpowers/specs/2026-08-26-chat-profile-sidebar-sections-media-design.md`.

**Verification tooling note:** No component-level test runner exists for React/JSX in this repo. Verification is `pnpm --filter @atlas/desktop exec vite build` plus a manual/visual check description per task.

---

### Task 1: Rewrite ConversationProfilePanel as flat sections

**Files:** `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`

- [ ] **Step 1: Read the current file in full**

It currently uses `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from `@atlas/ui`, a `hero` block, a `backHeader` block, an `avatarViewer` block, and two return branches (`type === "direct"`, group/channel). Confirm the exact current content of `hero`, `backHeader`, `avatarViewer`, and the hook calls above them (`useChatConversationDetail`, `useGlobalPresence`, `getConversationDisplayName`, `findOwnMember`/`roleHasPermission`) — none of that setup logic changes in this task, only what's rendered below `{hero}`.

- [ ] **Step 2: Replace the imports**

Remove `Tabs, TabsList, TabsTrigger, TabsContent` from the `@atlas/ui` import (keep `ImageViewer`). Add `useEffect, useRef` to the React import (alongside the existing `useState`).

- [ ] **Step 3: Add a local SectionHeader component**

At the top of the file, after the imports, add:
```jsx
function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Add a scroll ref and scroll-to-section effect**

Inside `ConversationProfilePanel`, after the existing `const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);` line, add:
```jsx
const scrollRef = useRef(null);

useEffect(() => {
  if (!initialTab || !scrollRef.current) return;
  const target = scrollRef.current.querySelector(`[data-section="${initialTab}"]`);
  target?.scrollIntoView({ block: "start" });
}, [initialTab]);
```
(This runs once per mount — the caller already remounts this component via `key={initialTab ?? "default"}` whenever `initialTab` changes, per `ChatWindow.jsx`/`MiniChatWindow.jsx`'s existing render call, so a plain mount-time effect is enough; no need to re-run on every render.)

- [ ] **Step 5: Replace the direct-conversation return branch**

Replace the entire `if (type === "direct") { return (...); }` block with:
```jsx
if (type === "direct") {
  return (
    <>
      {backHeader}
      {hero}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div data-section="info">
          <SectionHeader icon={Info} label="Info" />
          <ConversationInfoTab
            conversationId={conversationId}
            otherUserId={otherMemberForHero?.userId}
            otherDisplayName={otherMemberForHero?.displayName}
          />
        </div>
        <div data-section="media">
          <SectionHeader icon={FolderOpen} label="Multimedia" />
          <ConversationMediaTab messages={messages} isLoading={isLoadingMessages} />
        </div>
        <div data-section="common">
          <SectionHeader icon={Users} label="En comun" />
          <GroupsInCommonTab otherUserId={otherMemberForHero?.userId} />
        </div>
        <div data-section="notifications">
          <SectionHeader icon={Bell} label="Notificaciones" />
          <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
        </div>
      </div>
      {avatarViewer}
    </>
  );
}
```

- [ ] **Step 6: Replace the group/channel return branch**

Replace the final `return (<Tabs defaultValue={initialTab ?? "general"} ...>...</Tabs>);` block (and the `{avatarViewer}` fragment around it) with:
```jsx
return (
  <>
    {backHeader}
    {hero}
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
      <div data-section="general">
        <SectionHeader icon={Settings} label="General" />
        <ChannelGeneralTab conversationId={conversationId} currentUserId={currentUserId} />
      </div>
      <div data-section="members">
        <SectionHeader icon={Users} label="Miembros" />
        <ChannelMembersTab conversationId={conversationId} currentUserId={currentUserId} />
      </div>
      {canManageRoles && (
        <div data-section="roles">
          <SectionHeader icon={Shield} label="Roles" />
          <ChannelRolesTab conversationId={conversationId} currentUserId={currentUserId} />
        </div>
      )}
      <div data-section="media">
        <SectionHeader icon={FolderOpen} label="Multimedia" />
        <ConversationMediaTab messages={messages} isLoading={isLoadingMessages} />
      </div>
      <div data-section="notifications">
        <SectionHeader icon={Bell} label="Notificaciones" />
        <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
      </div>
    </div>
    {avatarViewer}
  </>
);
```
(`ownMember`/`canManageRoles` are computed just above this return, unchanged from before — keep that code as-is.)

- [ ] **Step 7: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx
git commit -m "feat(chat): replace profile panel tabs with flat scrollable sections"
```

---

### Task 2: Fix GroupsInCommonTab's empty state for flat layout

**Files:** `apps/desktop/src/modules/atlas.chat/components/GroupsInCommonTab.jsx`

- [ ] **Step 1: Change the empty-state className**

Change:
```jsx
<EmptyState
  className="flex-1 min-h-0"
  icon={Users}
  title="Sin grupos en comun"
  description="No comparten grupos en comun."
/>
```
to:
```jsx
<EmptyState
  className="py-8"
  icon={Users}
  title="Sin grupos en comun"
  description="No comparten grupos en comun."
/>
```
(`flex-1 min-h-0` assumed a flex parent sizing it to fill available height — that parent no longer exists once this section is stacked in a normal scroll rather than being the sole child of a `TabsContent`. `py-8` matches the same inline-empty-state convention already used in `ChatSidebar.jsx`.)

- [ ] **Step 2: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/GroupsInCommonTab.jsx
git commit -m "fix(chat): fix GroupsInCommonTab empty state for stacked-section layout"
```

---

### Task 3: Persistent right-side panel on large screens

**Files:** `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: Read the current content-area JSX**

Find the section of `ChatWindow`'s render (after `<ChatHeader .../>`) that currently reads roughly:
```jsx
{membersView ? (
  <ConversationProfilePanel
    key={profileInitialTab ?? "default"}
    conversation={conversation}
    currentUserId={userProfile?.id}
    initialTab={profileInitialTab}
    onBack={closeProfile}
    messages={messages}
    isLoadingMessages={isLoading}
  />
) : (
  <ChatMessageList
    messages={messages}
    ... (many props)
  />
)}

{!filesView && !membersView && (
  <MessageComposer .../>
)}
```
Confirm the exact current prop list on `ChatMessageList` (do not change any of its props — only the wrapping structure around it and the profile panel changes).

- [ ] **Step 2: Replace the ternary with a side-by-side responsive layout**

Wrap the existing ternary's two branches in a flex row, keeping every existing prop on `ChatMessageList` and `ConversationProfilePanel` exactly as they are:
```jsx
<div className="flex-1 min-w-0 min-h-0 flex">
  <div className={[
    "min-w-0 min-h-0 flex-col",
    membersView ? "hidden xl:flex xl:flex-1" : "flex flex-1",
  ].join(" ")}>
    <ChatMessageList
      messages={messages}
      isLoading={isLoading}
      currentUserId={userProfile?.id}
      typingUsers={typingUsersList}
      onAttachmentClick={handleAttachmentClick}
      members={detailMembers ?? conversation.members}
      conversationType={conversation?.type}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      onDeleteMessage={handleDeleteMessage}
      onHideForMe={handleHideForMe}
      onForward={setForwardMessage}
      onPinMessage={(messageId, pinned) => pinMutate({ messageId, pinned })}
      onToggleReaction={(messageId, emoji) => toggleReactionMutate({ messageId, emoji })}
      onOpenThread={(messageId) => setThreadPanelRootId(messageId)}
      hiddenMessageIds={hiddenMessageIds}
      selectionMode={selectionMode}
      selectedMsgIds={selectedMsgIds}
      onToggleSelect={toggleSelectMessage}
      onEnterSelection={enterSelectionMode}
      searchQuery={searchMode ? searchQuery : ""}
      searchMatchIds={searchMode && searchMatchIds.length ? new Set(searchMatchIds) : null}
      currentMatchId={currentMatchId}
      scrollToMessage={jumpTarget}
    />
  </div>
  {membersView && (
    <div className="w-full xl:w-96 xl:shrink-0 xl:border-l xl:border-[hsl(var(--border))] flex flex-col min-h-0">
      <ConversationProfilePanel
        key={profileInitialTab ?? "default"}
        conversation={conversation}
        currentUserId={userProfile?.id}
        initialTab={profileInitialTab}
        onBack={closeProfile}
        messages={messages}
        isLoadingMessages={isLoading}
      />
    </div>
  )}
</div>
```

Important: this replaces the ternary — `filesView`'s branch (whatever currently renders when `filesView` is true, e.g. a files gallery view instead of `ChatMessageList`) must stay exactly where it was in the surrounding conditional structure. If the real file has a three-way branch (`filesView` / `membersView` / else `ChatMessageList`) rather than the two-way ternary sketched above, adapt this step to preserve the `filesView` branch's existing behavior unchanged — only `membersView`'s handling (swap vs. side-by-side) is what this task changes. Read the actual current structure carefully before editing; do not guess if it differs from what's summarized here.

The `{!filesView && !membersView && (<MessageComposer .../>)}` line immediately after this block stays exactly as-is — the composer remains hidden whenever `membersView` is true, at every viewport width, per the spec's Part B rationale.

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual visual check**

At a viewport narrower than 1280px, open a conversation's profile panel — confirm it still replaces the message list entirely (today's behavior, unchanged). Resize to 1280px or wider — confirm the message list stays visible on the left and the profile panel appears as a ~384px column on the right with a left border, without needing to close and reopen the panel (resizing the window while the panel is already open should re-flow live, since this is pure CSS).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): show profile panel as a persistent right sidebar at xl breakpoint"
```

---

### Task 4: Media section — smaller thumbnails and selection mode

**Files:** `apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx`

- [ ] **Step 1: Add selection-mode props**

Change the export signature:
```jsx
export function ChatFilesGallery({ messages, isLoading, onAttachmentClick }) {
```
to:
```jsx
export function ChatFilesGallery({
  messages, isLoading, onAttachmentClick,
  selectionMode = false, selectedIds, onToggleSelect, onEnterSelection, onCancelSelection,
}) {
```

- [ ] **Step 2: Shrink the image grid**

Change:
```jsx
<div className="grid grid-cols-3 gap-1">
```
to:
```jsx
<div className="grid grid-cols-4 gap-1">
```

- [ ] **Step 3: Add a local selection-circle indicator**

After the `FileTypeIcon` function, add:
```jsx
function MediaSelectionCircle({ isSelected }) {
  return (
    <div
      className={[
        "absolute top-1 right-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
        isSelected
          ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]"
          : "border-white/70 bg-black/20",
      ].join(" ")}
    >
      {isSelected && (
        <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none">
          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire selection into the image grid buttons**

Change the image button's `onClick` and add the overlay:
```jsx
{images.map((att) => (
  <button
    key={att.id}
    type="button"
    onClick={() => {
      if (selectionMode) {
        onToggleSelect(att.id);
        return;
      }
      const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
      onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
    }}
    className="relative aspect-square bg-[hsl(var(--muted))] rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
  >
    {att.url ? (
      <img src={att.url} alt={att.fileName ?? ""} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center">
        <FileImage className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
      </div>
    )}
    {selectionMode && <MediaSelectionCircle isSelected={selectedIds?.has(att.id)} />}
  </button>
))}
```

- [ ] **Step 5: Add a toolbar row above the "Fotos y videos" label**

Only render the toolbar when there are images to select. Change:
```jsx
{images.length > 0 && (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
      Fotos y videos
    </p>
    <div className="grid grid-cols-4 gap-1">
```
to:
```jsx
{images.length > 0 && (
  <div>
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        Fotos y videos
      </p>
      {selectionMode ? (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {selectedIds?.size ?? 0} seleccionados
          </span>
          <button
            type="button"
            onClick={onCancelSelection}
            className="text-[10px] font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEnterSelection}
          className="text-[10px] font-medium text-[hsl(var(--primary))] hover:underline"
        >
          Seleccionar
        </button>
      )}
    </div>
    <div className="grid grid-cols-4 gap-1">
```

- [ ] **Step 6: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors — `ConversationMediaTab` (updated in the next task) hasn't been wired to pass the new props yet, so `selectionMode` defaults to `false` and the component behaves exactly as before until Task 5 wires it up.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx
git commit -m "feat(chat): shrink media thumbnails and add selection-mode UI to ChatFilesGallery"
```

---

### Task 5: Media section — bulk direct download

**Files:** `apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx`

- [ ] **Step 1: Add selection state and the download handler**

Replace the whole file:
```jsx
// apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx
import { useState, useMemo } from "react";
import { ChatFilesGallery } from "./ChatFilesGallery";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";

// Receives messages as a prop rather than calling useChatMessages itself —
// the parent (ChatWindow/MiniChatWindow) already has this data from its own
// single useChatMessages call. Calling the hook a second time here would
// open a second Supabase Realtime subscription for the same conversationId,
// and subscribeToMessages() defensively tears down any existing channel
// with the same topic before subscribing — silently killing the main
// message list's live updates the moment this tab mounts.
export function ConversationMediaTab({ messages, isLoading }) {
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Same lookup ChatFilesGallery builds internally, needed here too so
  // "Descargar" can resolve each selected id back to its url/fileName.
  const allAttachments = useMemo(() => {
    if (!messages?.length) return [];
    const result = [];
    for (const msg of messages) {
      for (const att of (msg.attachments ?? [])) result.push(att);
    }
    return result;
  }, [messages]);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  // Direct sequential downloads — no zip library, no new dependency. Staggered
  // by 150ms per file so browsers that would otherwise block a burst of
  // simultaneous downloads (Chrome's multi-download permission prompt) let
  // them through one at a time instead.
  function handleBulkDownload() {
    const targets = allAttachments.filter((a) => selectedIds.has(a.id));
    targets.forEach((att, i) => {
      setTimeout(() => {
        if (!att.url) return;
        const a = document.createElement("a");
        a.href = att.url;
        a.download = att.fileName ?? "archivo";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }, i * 150);
    });
    cancelSelection();
  }

  return (
    <div className="flex flex-col">
      <ChatFilesGallery
        messages={messages ?? []}
        isLoading={isLoading}
        onAttachmentClick={(attachments, activeIndex) => setViewer({ open: true, attachments, activeIndex })}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onEnterSelection={() => setSelectionMode(true)}
        onCancelSelection={cancelSelection}
      />
      {selectionMode && selectedIds.size > 0 && (
        <div className="sticky bottom-0 px-4 py-2.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center justify-between">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {selectedIds.size} {selectedIds.size === 1 ? "archivo" : "archivos"}
          </span>
          <button
            type="button"
            onClick={handleBulkDownload}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            Descargar ({selectedIds.size})
          </button>
        </div>
      )}
      <ChatAttachmentViewer
        open={viewer.open}
        onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
        attachments={viewer.attachments}
        activeIndex={viewer.activeIndex}
        onIndexChange={(i) => setViewer((v) => ({ ...v, activeIndex: i }))}
      />
    </div>
  );
}
```

Note the root changed from `className="flex-1 min-h-0 flex flex-col overflow-hidden"` to `className="flex flex-col"` — this section no longer owns its own independent scroll region; it now flows inside `ConversationProfilePanel`'s single outer scroll container (`scrollRef` from Task 1), consistent with every other section.

- [ ] **Step 2: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Manual visual check**

Open the Media section for a conversation with at least 3 shared images. Click "Seleccionar" — confirm the label changes to show a count and "Cancelar" appears, and clicking thumbnails now toggles a checkmark circle instead of opening the lightbox. Select 2-3 images and click "Descargar (`N`)" — confirm each triggers a browser download and selection mode exits afterward. Confirm clicking "Cancelar" without downloading exits selection mode and clears any checkmarks.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx
git commit -m "feat(chat): add bulk direct-download to the media section, drop its own scroll region"
```

---

### Task 6: Entity reference chips visually merge into the message bubble

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 1: Add the `attached` prop to EntityReferenceCard**

Change the file to:
```jsx
import { useNavigate } from "react-router-dom";
import { User, Paperclip, Landmark, IdCard, ExternalLink } from "lucide-react";

const ICON_BY_TYPE = { contact: User, file: Paperclip, ledger_account: Landmark, hr_employee: IdCard };

// `attached` is true when this chip immediately follows a text bubble in the
// same message — it then drops its own border/background/top-radius in favor
// of matching whichever bubble color sits above it, so the two read as one
// continuous message instead of a card floating below a separate one. When
// there's no text above it (an entity-ref-only message), it keeps its own
// independent card look since there's nothing to visually continue.
export function EntityReferenceCard({ reference, attached = false, isOwn = false }) {
  const navigate = useNavigate();
  const Icon = ICON_BY_TYPE[reference.entityType] ?? ExternalLink;

  const attachedClasses = isOwn
    ? "bg-(--brand-primary)/90 text-(--brand-primary-foreground) border-transparent rounded-t-none"
    : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] border-transparent rounded-t-none";
  const standaloneClasses = "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]";

  return (
    <button
      type="button"
      onClick={() => navigate(reference.url)}
      className={[
        "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors max-w-full",
        attached ? attachedClasses : standaloneClasses,
      ].join(" ")}
    >
      <Icon className={["h-3.5 w-3.5 shrink-0", attached && isOwn ? "" : "text-[hsl(var(--muted-foreground))]"].join(" ")} />
      <div className="min-w-0">
        <p className="chat-font-display text-xs font-semibold truncate">{reference.title}</p>
        {reference.subtitle && (
          <p className={["chat-font-mono text-[10px] truncate", attached && isOwn ? "opacity-80" : "text-[hsl(var(--muted-foreground))]"].join(" ")}>
            {reference.subtitle}
          </p>
        )}
      </div>
    </button>
  );
}
```
(The icon's color: when `attached && isOwn`, it inherits the button's own light text color via no explicit class rather than the muted-foreground token, since muted-foreground would be low-contrast against the primary-colored own-bubble background.)

- [ ] **Step 2: Pass `attached`/`isOwn` from both ChatMessageBubble call sites**

Find the two blocks:
```jsx
{!isDeleted && message.metadata?.entityRefs?.length > 0 && (
  <div className="flex flex-col gap-1 mt-1">
    {message.metadata.entityRefs.map((ref, i) => (
      <EntityReferenceCard key={`${ref.entityType}:${ref.recordId}:${i}`} reference={ref} />
    ))}
  </div>
)}
```
(one in the own-message branch, one in the other-message branch). In BOTH, change to:
```jsx
{!isDeleted && message.metadata?.entityRefs?.length > 0 && (
  <div className={["flex flex-col gap-1", hasText ? "mt-0" : "mt-1"].join(" ")}>
    {message.metadata.entityRefs.map((ref, i) => (
      <EntityReferenceCard
        key={`${ref.entityType}:${ref.recordId}:${i}`}
        reference={ref}
        attached={hasText}
        isOwn={isOwn}
      />
    ))}
  </div>
)}
```
(`hasText` and `isOwn` are already in scope at both call sites — `hasText` is computed once near the top of the component and used by both branches; `isOwn` is the branch's own boolean, `true` in the own-message return and `false` in the other-message return — pass the literal `isOwn` in the own-message branch's call and the literal `false` in the other-message branch's call, matching whichever branch you're editing.)

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual visual check**

Send a message with body text plus an attached entity reference (contact/file/ledger account/HR employee link) — confirm the reference chip sits flush against the bottom of the text bubble with no gap, matching background color, and no border, reading as one continuous bubble. Then send an entity reference with NO text (now possible since the earlier "requires text" bug is fixed) — confirm that chip keeps its own bordered, independently-rounded look instead.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "feat(chat): merge entity reference chips into their message bubble visually"
```

---

## Self-Review Notes

- **Spec coverage:** Part A (sections instead of tabs) → Tasks 1-2. Part B (persistent sidebar) → Task 3. Part C (media shrink + multi-select + bulk download) → Tasks 4-5. Part D (entity-ref integration) → Task 6.
- **Type/prop consistency:** `ChatFilesGallery`'s new props (`selectionMode, selectedIds, onToggleSelect, onEnterSelection, onCancelSelection`) are defined in Task 4 and consumed with matching names in Task 5's `ConversationMediaTab` rewrite. `EntityReferenceCard`'s new props (`attached, isOwn`) are defined in Task 6 Step 1 and passed with matching names in Step 2.
- **No backend changes anywhere in this plan** — `att.url` (already embedded in message payloads), member/conversation fields, and mute state are all already available to every component touched here.
- **MiniChatWindow is untouched** — its fixed 300px width never reaches the `xl:` breakpoint Task 3 introduces, so its existing swap-only behavior for `profileView` needs no special-casing.
