# Chat Conversation Profile Panel — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Plan A (`docs/superpowers/plans/2026-08-26-chat-conversation-profile-panel-plan-a-backend.md`) must be complete and merged first — every task here calls SDK methods that plan adds.

**Spec:** `docs/superpowers/specs/2026-08-26-chat-conversation-profile-panel-design.md`

**Goal:** Build the `ConversationProfilePanel` (Info/Media/En comun/Notificaciones for direct chats; General/Miembros/Roles/Media/Notificaciones for group/channel), wire it into both `ChatWindow` and the floating mini-chat window, mute-aware the realtime toast, and add the `ChatReportsScreen` admin screen under atlas.identity.

**Architecture:** New small tab components under `apps/desktop/src/modules/atlas.chat/components/`, following the existing `ChannelGeneralTab.jsx`/`ChannelMembersTab.jsx` pattern exactly. Two existing files (`ChatWindow.jsx` at 829 lines, `FloatingChatHub.jsx` at 908 lines) are already near the project's 800-line proactive-split threshold (CLAUDE.md) — Tasks 1 and 2 extract self-contained pieces (`ChatFilesGallery`, `MiniChatWindow`) into their own files before adding new code, both shrinking the source files and giving the Media tab a shared, single implementation instead of a duplicate.

**Tech Stack:** React, TanStack Query, `@atlas/ui` (`Tabs`, `Dialog`, `SelectField`, `TextareaField`, `CheckboxField`, `DataTable`, `ConfirmDialog`, `PageHeader`, `EmptyState`), `sonner` toast, lucide-react icons.

---

### Task 1: Extract `ChatFilesGallery` into its own file

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

This is a pure refactor (no behavior change) — do it first so Task 5 (the Media tab) can import the same component instead of duplicating ~115 lines of gallery-rendering JSX.

- [ ] **Step 1: Create the new file**

Create `apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx` with this content (copied verbatim from `ChatWindow.jsx` lines 45-160, which define `FileTypeIcon` and `ChatFilesGallery` — read those exact lines from the current file before copying, since line numbers may have shifted since this plan was written):

```jsx
import { useMemo } from "react";
import { EmptyState, Skeleton } from "@atlas/ui";
import {
  FileText, FileType2, FileSpreadsheet, FileVideo, FileAudio,
  FileArchive, FileCode, File as FileIconBase, FileImage,
} from "lucide-react";
import { isImageMime, formatFileSize, formatMessageTime } from "../lib/chatUtils";

export function FileTypeIcon({ mimeType }) {
  const m = String(mimeType ?? "").toLowerCase();
  if (m === "application/pdf") return <FileType2 className="h-5 w-5 text-red-400" />;
  if (m.includes("spreadsheet") || m.includes("excel") || m === "text/csv")
    return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
  if (m.includes("word") || m.includes("document"))
    return <FileText className="h-5 w-5 text-blue-400" />;
  if (m.startsWith("video/")) return <FileVideo className="h-5 w-5 text-orange-400" />;
  if (m.startsWith("audio/")) return <FileAudio className="h-5 w-5 text-emerald-400" />;
  if (m.includes("zip") || m.includes("rar") || m.includes("tar") || m.includes("7z"))
    return <FileArchive className="h-5 w-5 text-yellow-400" />;
  if (m.startsWith("text/") || m.includes("json") || m.includes("xml"))
    return <FileCode className="h-5 w-5 text-cyan-400" />;
  return <FileIconBase className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />;
}

export function ChatFilesGallery({ messages, isLoading, onAttachmentClick }) {
  const allAttachments = useMemo(() => {
    if (!messages?.length) return [];
    const result = [];
    for (const msg of [...messages].reverse()) {
      for (const att of (msg.attachments ?? [])) {
        result.push({ ...att, createdAt: msg.created_at, msgAttachments: msg.attachments });
      }
    }
    return result;
  }, [messages]);

  const images = useMemo(() => allAttachments.filter((a) => isImageMime(a.mimeType)), [allAttachments]);
  const otherFiles = useMemo(() => allAttachments.filter((a) => !isImageMime(a.mimeType)), [allAttachments]);

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!allAttachments.length) {
    return (
      <EmptyState
        className="flex-1 min-h-0"
        title="Sin archivos"
        description="Aun no se han compartido archivos en esta conversacion."
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
      {images.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
            Fotos y videos
          </p>
          <div className="grid grid-cols-3 gap-1">
            {images.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => {
                  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
                  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
                }}
                className="aspect-square bg-[hsl(var(--muted))] rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
              >
                {att.url ? (
                  <img src={att.url} alt={att.fileName ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileImage className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {otherFiles.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
            Archivos
          </p>
          <div className="space-y-1">
            {otherFiles.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => {
                  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
                  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg bg-[hsl(var(--border))] flex items-center justify-center shrink-0">
                  <FileTypeIcon mimeType={att.mimeType} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{att.fileName ?? "Archivo"}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {att.sizeBytes ? `${formatFileSize(att.sizeBytes)} · ` : ""}
                    {att.createdAt ? formatMessageTime(att.createdAt) : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove the extracted code from `ChatWindow.jsx`**

Delete lines 43-160 of `ChatWindow.jsx` (the `// ── Files gallery ──` comment through the closing `}` of `ChatFilesGallery` — everything Step 1 copied). Add an import instead, next to the other component imports near the top of the file:

```js
import { ChatFilesGallery } from "./ChatFilesGallery";
```

Also remove the now-unused icon imports from `ChatWindow.jsx`'s lucide-react import block (lines 3-9): `FileText, FileType2, FileSpreadsheet, FileVideo, FileAudio, FileArchive, FileCode, File as FileIconBase, FileImage` are no longer referenced directly in this file — only `ArrowLeft, Users, FolderOpen, MessageSquare, MoreVertical, Trash2, X as XIcon, Search, Share2, CheckSquare, ChevronUp, ChevronDown, Archive, ArchiveRestore, Pin` remain in use. Also remove `isImageMime, formatFileSize` from the `../lib/chatUtils` import if `ChatWindow.jsx` no longer uses them directly (check remaining usages in the file with a search before removing — `formatMessageTime` is still used elsewhere in this file, keep it).

- [ ] **Step 3: Verify both files are syntactically valid**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx`
Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: Both succeed with no errors. The build output should show `ChatWindow.jsx`'s line count effectively reduced (not a build check, but confirm via `wc -l apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` — expect roughly 829 minus ~115 lines plus 2 import lines, landing around 716).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "refactor(chat): extract ChatFilesGallery into its own file"
```

---

### Task 2: Extract `MiniChatWindow` into its own file

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx`

Also a pure refactor. `MiniChatWindow` (currently lines 96-329 of `FloatingChatHub.jsx`) is Task 10's target for the new profile-view swap — extracting it first keeps that diff contained to one focused file instead of growing an already-908-line file further.

- [ ] **Step 1: Read the exact current boundaries**

Before copying, re-run this to get the exact current line numbers (they may have shifted from the 96-329 range recorded during planning):

Run: `grep -n "^function MiniChatWindow\|^function OnlineUserPill" apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx`

Copy everything from the `function MiniChatWindow(...)` line up to (but not including) the blank line + `// --- Online user pill ---` comment that follows its closing `}`.

- [ ] **Step 2: Create the new file**

Create `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx`. Start with these imports (the subset of `FloatingChatHub.jsx`'s current imports that `MiniChatWindow` and its helpers `AvatarCircle`/`getAvatarUrl`/`getAvatarEmoji` actually use):

```jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare, X, Minus, ChevronUp,
  ExternalLink, FolderOpen, MoreVertical,
} from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@atlas/ui";
import { useChatMessages, useSendMessage, useMarkRead, useDeleteMessage, usePinMessage, useToggleReaction } from "../hooks/useChatMessages";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { MessageComposer } from "./MessageComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";
import { getConversationDisplayName, getConversationTitleLabel } from "../lib/chatUtils";
import { ConversationTypeBadge } from "./ConversationTypeBadge";
import { useAuth } from "../../../auth/AuthProvider";

const BM = 16;     // margin from edge px
const WW = 300;    // mini-window width px
const WH = 380;    // mini-window height px
const WH_MIN = 44; // minimized height px
const GAP = 8;     // gap between elements px

function getAvatarUrl(conversation, currentUserId) {
  if (conversation?.avatarUrl) return conversation.avatarUrl;
  if (conversation?.type === "direct") {
    const other = (conversation.members ?? []).find((m) => m.userId !== currentUserId);
    return other?.avatarUrl ?? null;
  }
  return null;
}

function getAvatarEmoji(conversation) {
  return conversation?.avatar_emoji ?? null;
}

export function AvatarCircle({ avatarUrl, avatarEmoji, type, name, size = "md" }) {
  const [avatarErr, setAvatarErr] = useState(false);
  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div className="relative shrink-0">
      {avatarUrl && !avatarErr ? (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClass} rounded-full object-cover`}
          onError={() => setAvatarErr(true)}
        />
      ) : avatarEmoji ? (
        <div className={`${sizeClass} rounded-full flex items-center justify-center bg-[hsl(var(--muted))]`}>
          <span className="text-sm leading-none">{avatarEmoji}</span>
        </div>
      ) : (
        <div
          className={`${sizeClass} rounded-full flex items-center justify-center font-bold`}
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}
        >
          {name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <ConversationTypeBadge type={type} />
    </div>
  );
}
```

**Important:** the block above (`getAvatarUrl`, `getAvatarEmoji`, `AvatarCircle`) is copied from `FloatingChatHub.jsx` lines 33-76 (per earlier investigation) — re-read those exact current lines before finalizing this file, since `AvatarCircle` is also used elsewhere in `FloatingChatHub.jsx` (the conversation list, `ConversationPanel`). Export it from this new file and have `FloatingChatHub.jsx` import it back (Step 4), rather than duplicating it in both files.

Then paste the body of `MiniChatWindow` (copied from Step 1) directly after these definitions, unchanged, ending with `export function MiniChatWindow({ entry, index, edge, zIndex = 45, onClose, onMinimize }) { ... }` (add the `export` keyword — it wasn't exported before since it was module-private within `FloatingChatHub.jsx`).

- [ ] **Step 3: Remove the extracted code from `FloatingChatHub.jsx`**

Delete the `getAvatarUrl`, `getAvatarEmoji`, `AvatarCircle`, and `MiniChatWindow` function definitions from `FloatingChatHub.jsx`. Add this import near the top with the other component imports:

```js
import { MiniChatWindow, AvatarCircle } from "./MiniChatWindow";
```

Remove now-unused imports from `FloatingChatHub.jsx`'s top-level import block: `useChatMessages, useSendMessage, useMarkRead, useDeleteMessage, usePinMessage, useToggleReaction` (only used inside the deleted `MiniChatWindow`), `useChatConversationDetail` (same), `MessageComposer`, `ChatMessageList` (same) — but check first whether `ConversationPanel` or `FloatingChatHubInner` (the two functions that remain) reference any of these directly before removing each one; keep whatever is still used (e.g. `ChatAttachmentViewer` may still be needed if another part of the file uses it — verify with a search before deleting).

- [ ] **Step 4: Verify both files are syntactically valid and the build passes**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx`
Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: No errors. Confirm `wc -l apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx` now shows roughly 908 minus ~235 lines plus 1 import line, landing around 674.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx
git commit -m "refactor(chat): extract MiniChatWindow into its own file"
```

---

### Task 3: Moderation hooks — `useChatModeration.js`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useChatModeration.js`

- [ ] **Step 1: Write the hooks file**

Create `apps/desktop/src/modules/atlas.chat/hooks/useChatModeration.js`, mirroring `useChatConversations.js`'s exact structure (`useQuery`/`useMutation` from `@tanstack/react-query`, `useAuth` for the token, `atlas` client):

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function useMuteConversation() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, muted }) => atlas.chat.muteConversation(conversationId, muted, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations-archived"] });
    },
  });
}

export function useBlockStatus(targetUserId, { enabled = true } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-block-status", targetUserId],
    queryFn: () => atlas.chat.getBlockStatus(targetUserId, token),
    enabled: Boolean(token && targetUserId && enabled),
    staleTime: 30_000,
  });
}

export function useBlockUser() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId) => atlas.chat.blockUser(targetUserId, token),
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-block-status", targetUserId] });
    },
  });
}

export function useUnblockUser() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId) => atlas.chat.unblockUser(targetUserId, token),
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-block-status", targetUserId] });
    },
  });
}

export function useGroupsInCommon(targetUserId, { enabled = true } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-groups-in-common", targetUserId],
    queryFn: () => atlas.chat.getGroupsInCommon(targetUserId, token),
    enabled: Boolean(token && targetUserId && enabled),
    staleTime: 60_000,
  });
}

export function useCreateReport() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useMutation({
    mutationFn: (payload) => atlas.chat.createReport(payload, token),
  });
}

export function useChatReports(status) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-reports", status ?? "all"],
    queryFn: () => atlas.chat.listReports(status ? { status } : {}, token),
    enabled: Boolean(token),
    staleTime: 15_000,
  });
}

export function useResolveReport() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, action }) => atlas.chat.resolveReport(reportId, action, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-reports"] });
    },
  });
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.chat/hooks/useChatModeration.js`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatModeration.js
git commit -m "feat(chat): add moderation hooks (mute, block, reports, groups in common)"
```

---

### Task 4: `NotificationsTab.jsx` — mute toggle

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/NotificationsTab.jsx`

Applies to every conversation type — the simplest new tab, build it first to validate the hooks from Task 3 work end-to-end before building the more involved tabs.

- [ ] **Step 1: Write the component**

Create `apps/desktop/src/modules/atlas.chat/components/NotificationsTab.jsx`:

```jsx
// apps/desktop/src/modules/atlas.chat/components/NotificationsTab.jsx
import { CheckboxField } from "@atlas/ui";
import { toast } from "sonner";
import { useMuteConversation } from "../hooks/useChatModeration";

// Mutes only the realtime new-message toast (RealtimeProvider.jsx) — unread
// counts/badges are unaffected, matching WhatsApp (spec Non-goal 3).
export function NotificationsTab({ conversationId, isMuted }) {
  const { mutate: muteMutate, isPending } = useMuteConversation();

  function handleToggle(e) {
    muteMutate(
      { conversationId, muted: e.target.checked },
      {
        onError: () => toast.error("No se pudo actualizar la configuracion de notificaciones."),
      },
    );
  }

  return (
    <div className="p-4 space-y-2">
      <CheckboxField
        label="Silenciar conversacion"
        checked={Boolean(isMuted)}
        onChange={handleToggle}
        disabled={isPending}
      />
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        No recibiras notificaciones emergentes de mensajes nuevos en esta conversacion.
      </p>
    </div>
  );
}
```

Confirmed against `packages/ui/src/components/FormFields.jsx:1085` during plan self-review: `CheckboxField` takes `checked` + `onChange` (a raw DOM change event, like a native `<input type="checkbox">`), not `onCheckedChange` with a boolean — the snippet above already reflects this.

- [ ] **Step 2: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/NotificationsTab.jsx`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/NotificationsTab.jsx
git commit -m "feat(chat): add NotificationsTab (mute toggle)"
```

---

### Task 5: `ConversationMediaTab.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx`

- [ ] **Step 1: Write the component**

Create `apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx`:

```jsx
// apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx
import { useState } from "react";
import { useChatMessages } from "../hooks/useChatMessages";
import { ChatFilesGallery } from "./ChatFilesGallery";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";

// Reuses ChatFilesGallery — the same component the header's standalone
// "Ver archivos" full-screen toggle already renders (Task 1 extracted it so
// both call sites share one implementation). Only shows attachments from
// messages already loaded/paginated into the query cache, same limitation
// the existing toggle already has (spec Risk 1 — this is a convenience view,
// not a replacement for that toggle).
export function ConversationMediaTab({ conversationId }) {
  const { data, isLoading } = useChatMessages(conversationId);
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <ChatFilesGallery
        messages={data?.data ?? []}
        isLoading={isLoading}
        onAttachmentClick={(attachments, activeIndex) => setViewer({ open: true, attachments, activeIndex })}
      />
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

- [ ] **Step 2: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx
git commit -m "feat(chat): add ConversationMediaTab (shared-files tab)"
```

---

### Task 6: `GroupsInCommonTab.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/GroupsInCommonTab.jsx`

- [ ] **Step 1: Write the component**

Create `apps/desktop/src/modules/atlas.chat/components/GroupsInCommonTab.jsx`:

```jsx
// apps/desktop/src/modules/atlas.chat/components/GroupsInCommonTab.jsx
import { useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@atlas/ui";
import { Users } from "lucide-react";
import { useGroupsInCommon } from "../hooks/useChatModeration";
import { getConversationTitleLabel } from "../lib/chatUtils";

// Direct-conversation-only (spec Section 8) — group/channel conversations
// where both the caller and the other member are active members.
export function GroupsInCommonTab({ otherUserId }) {
  const navigate = useNavigate();
  const { data, isLoading } = useGroupsInCommon(otherUserId);
  const groups = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <EmptyState
        className="flex-1 min-h-0"
        icon={Users}
        title="Sin grupos en comun"
        description="No comparten grupos en comun."
      />
    );
  }

  return (
    <div className="p-2 space-y-0.5">
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => navigate(`/app/m/atlas.chat/chat/inbox/${g.id}`)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[hsl(var(--muted))] text-left transition-colors"
        >
          <div className="h-9 w-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
               style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}>
            {g.avatarEmoji ?? (g.title?.[0]?.toUpperCase() ?? "?")}
          </div>
          <p className="text-sm font-medium truncate">{getConversationTitleLabel(g, null)}</p>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/GroupsInCommonTab.jsx`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/GroupsInCommonTab.jsx
git commit -m "feat(chat): add GroupsInCommonTab"
```

---

### Task 7: `ConversationInfoTab.jsx` — direct-chat info + Block/Report

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx`

- [ ] **Step 1: Write the component**

Create `apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx`:

```jsx
// apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx
import { useState } from "react";
import {
  Button, ConfirmDialog, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  SelectField, TextareaField, CheckboxField,
} from "@atlas/ui";
import { Ban, Flag } from "lucide-react";
import { toast } from "sonner";
import { useBlockStatus, useBlockUser, useUnblockUser, useCreateReport } from "../hooks/useChatModeration";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Acoso o abuso" },
  { value: "inappropriate", label: "Contenido inapropiado" },
  { value: "other", label: "Otro" },
];

// Direct-conversation-only (spec Non-goal 7 — block/report never apply
// inside groups/channels). otherUserId is the contact's user_profile id.
export function ConversationInfoTab({ conversationId, otherUserId, otherDisplayName }) {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);

  const { data: blockStatus } = useBlockStatus(otherUserId);
  const blockedByMe = blockStatus?.data?.blockedByMe ?? false;

  const { mutate: blockMutate, isPending: blocking } = useBlockUser();
  const { mutate: unblockMutate, isPending: unblocking } = useUnblockUser();
  const { mutate: reportMutate, isPending: reporting } = useCreateReport();

  function handleBlockConfirmed() {
    blockMutate(otherUserId, {
      onSuccess: () => toast.success(`${otherDisplayName ?? "Usuario"} bloqueado.`),
      onError: () => toast.error("No se pudo bloquear al usuario."),
    });
    setConfirmBlock(false);
  }

  function handleUnblock() {
    unblockMutate(otherUserId, {
      onSuccess: () => toast.success(`${otherDisplayName ?? "Usuario"} desbloqueado.`),
      onError: () => toast.error("No se pudo desbloquear al usuario."),
    });
  }

  function handleSubmitReport() {
    reportMutate(
      { reportedUserId: otherUserId, conversationId, reason, note: note.trim() || undefined, alsoBlock },
      {
        onSuccess: () => {
          toast.success("Reporte enviado. Un administrador lo revisara.");
          setReportOpen(false);
          setNote("");
          setReason("spam");
          setAlsoBlock(false);
        },
        onError: () => toast.error("No se pudo enviar el reporte."),
      },
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="pt-4 border-t border-[hsl(var(--border))] space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Zona de peligro
        </p>
        {blockedByMe ? (
          <Button variant="outline" className="w-full justify-start" onClick={handleUnblock} disabled={unblocking}>
            <Ban className="h-3.5 w-3.5 mr-2" />
            Desbloquear a {otherDisplayName ?? "este usuario"}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start text-red-500 border-red-500/40 hover:bg-red-500/10"
            onClick={() => setConfirmBlock(true)}
            disabled={blocking}
          >
            <Ban className="h-3.5 w-3.5 mr-2" />
            Bloquear a {otherDisplayName ?? "este usuario"}
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full justify-start text-red-500 border-red-500/40 hover:bg-red-500/10"
          onClick={() => setReportOpen(true)}
        >
          <Flag className="h-3.5 w-3.5 mr-2" />
          Reportar usuario
        </Button>
      </div>

      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title="Bloquear usuario"
        description={`${otherDisplayName ?? "Este usuario"} ya no podra enviarte mensajes. Puedes desbloquearlo en cualquier momento.`}
        confirmLabel="Bloquear"
        onConfirm={handleBlockConfirmed}
      />

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar a {otherDisplayName ?? "usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <SelectField
              label="Motivo"
              value={reason}
              onValueChange={setReason}
              options={REPORT_REASONS}
            />
            <TextareaField
              label="Nota (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe brevemente lo ocurrido..."
              rows={3}
            />
            <CheckboxField
              label="Tambien bloquear a este usuario"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitReport} disabled={reporting}>Enviar reporte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Confirmed against `packages/ui/src/components/FormFields.jsx` during plan self-review: `SelectField` takes `value`/`onValueChange` (receives the raw value, not an event) with an `options` array of `{ value, label }`; `TextareaField` takes `value`/`onChange` (a raw DOM event) and `rows`; `CheckboxField` takes `checked`/`onChange` (a raw DOM event, not `onCheckedChange`) — the snippet above already reflects all three correctly.

- [ ] **Step 2: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx
git commit -m "feat(chat): add ConversationInfoTab (block/report)"
```

---

### Task 8: `ConversationProfilePanel.jsx` — the tab-set router

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`
- Delete: `apps/desktop/src/modules/atlas.chat/components/ChatMembersPanel.jsx` (superseded — its General/Miembros/Roles tabs are folded into the new panel)

- [ ] **Step 1: Write the component**

Create `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`:

```jsx
// apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@atlas/ui";
import { ChannelGeneralTab } from "./ChannelGeneralTab";
import { ChannelMembersTab } from "./ChannelMembersTab";
import { ChannelRolesTab } from "./ChannelRolesTab";
import { ConversationInfoTab } from "./ConversationInfoTab";
import { ConversationMediaTab } from "./ConversationMediaTab";
import { GroupsInCommonTab } from "./GroupsInCommonTab";
import { NotificationsTab } from "./NotificationsTab";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

// Replaces ChatMembersPanel — same swap-into-content-slot contract (root
// carries flex-1/min-h-0/flex-col/overflow-hidden so it fills ChatWindow's
// or MiniChatWindow's content area identically to the message list it
// replaces), but now handles every conversation type, not just group/
// channel. Tab set is type-dependent per spec Section 8.
export function ConversationProfilePanel({ conversation, currentUserId }) {
  const conversationId = conversation?.id;
  const type = conversation?.type;
  const { data: convData } = useChatConversationDetail(conversationId);
  const detail = convData?.data ?? conversation;
  const isMuted = Boolean(detail?.is_muted ?? conversation?.is_muted);

  if (type === "direct") {
    const otherMember = (detail?.members ?? conversation?.members ?? []).find(
      (m) => m.userId !== currentUserId,
    );
    return (
      <Tabs defaultValue="info" className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TabsList className="px-3 pt-2 overflow-x-auto">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="common">En comun</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="flex-1 min-h-0 overflow-y-auto">
          <ConversationInfoTab
            conversationId={conversationId}
            otherUserId={otherMember?.userId}
            otherDisplayName={otherMember?.displayName}
          />
        </TabsContent>
        <TabsContent value="media" className="flex-1 min-h-0 overflow-y-auto">
          <ConversationMediaTab conversationId={conversationId} />
        </TabsContent>
        <TabsContent value="common" className="flex-1 min-h-0 overflow-y-auto">
          <GroupsInCommonTab otherUserId={otherMember?.userId} />
        </TabsContent>
        <TabsContent value="notifications" className="flex-1 min-h-0 overflow-y-auto">
          <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
        </TabsContent>
      </Tabs>
    );
  }

  // group / channel
  const ownMember = findOwnMember(detail?.members ?? [], currentUserId);
  const canManageRoles = roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE);

  return (
    <Tabs defaultValue="general" className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <TabsList className="px-3 pt-2 overflow-x-auto">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="members">Miembros</TabsTrigger>
        {canManageRoles && <TabsTrigger value="roles">Roles</TabsTrigger>}
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto">
        <ChannelGeneralTab conversationId={conversationId} currentUserId={currentUserId} />
      </TabsContent>
      <TabsContent value="members" className="flex-1 min-h-0 overflow-y-auto">
        <ChannelMembersTab conversationId={conversationId} currentUserId={currentUserId} />
      </TabsContent>
      {canManageRoles && (
        <TabsContent value="roles" className="flex-1 min-h-0 overflow-y-auto">
          <ChannelRolesTab conversationId={conversationId} currentUserId={currentUserId} />
        </TabsContent>
      )}
      <TabsContent value="media" className="flex-1 min-h-0 overflow-y-auto">
        <ConversationMediaTab conversationId={conversationId} />
      </TabsContent>
      <TabsContent value="notifications" className="flex-1 min-h-0 overflow-y-auto">
        <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
      </TabsContent>
    </Tabs>
  );
}
```

This assumes `listConversations`/`getConversation` rows expose `is_muted` (Plan A Task 7) — `conversation` (the list-preview shape passed down from `ChatWindow`/`MiniChatWindow`) already has it from the list query; `detail` (the full member-list fetch) does not include it (Plan A only added it to `listConversations`, not `getConversation` — see spec Section 10, which scopes `is_muted` to the list query only), which is why the fallback `detail?.is_muted ?? conversation?.is_muted` prefers `conversation`'s value.

- [ ] **Step 2: Delete the superseded file**

```bash
git rm apps/desktop/src/modules/atlas.chat/components/ChatMembersPanel.jsx
```

- [ ] **Step 3: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx
git commit -m "feat(chat): add ConversationProfilePanel, retire ChatMembersPanel"
```

---

### Task 9: Wire `ConversationProfilePanel` into `ChatWindow.jsx`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: Swap the import**

Replace:
```js
import { ChatMembersPanel } from "./ChatMembersPanel";
```
with:
```js
import { ConversationProfilePanel } from "./ConversationProfilePanel";
```

- [ ] **Step 2: Swap the render call**

Replace:
```jsx
      ) : membersView ? (
        <ChatMembersPanel conversationId={conversationId} currentUserId={userProfile?.id} />
      ) : (
```
with:
```jsx
      ) : membersView ? (
        <ConversationProfilePanel conversation={conversation} currentUserId={userProfile?.id} />
      ) : (
```

- [ ] **Step 3: Widen the header's profile-toggle button to all conversation types**

In the `ChatHeader` sub-component, find the "Members toggle" block:

```jsx
        {/* Members toggle — channel/group only, matching the "Ver miembros"
            dropdown item and MemberAvatarStack, both already scoped the
            same way (a direct chat has no roles/permissions to manage). */}
        {(conversation?.type === "group" || conversation?.type === "channel") && (
          <button
            type="button"
            onClick={onToggleMembersView}
            title={membersView ? "Ver mensajes" : "Ver miembros"}
            className={[
              headerBtnCls,
              membersView ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]" : "",
            ].join(" ")}
          >
            {membersView ? <MessageSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          </button>
        )}
```

Replace it with an always-rendered version (direct chats now have a profile panel too — Info/Media/En comun/Notificaciones — so this button is no longer group/channel-only):

```jsx
        {/* Profile toggle — every conversation type now has a profile panel
            (direct chats gained Info/Media/En comun/Notificaciones). */}
        <button
          type="button"
          onClick={onToggleMembersView}
          title={membersView ? "Ver mensajes" : "Ver perfil"}
          className={[
            headerBtnCls,
            membersView ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]" : "",
          ].join(" ")}
        >
          {membersView ? <MessageSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </button>
```

- [ ] **Step 4: Make the header avatar clickable for direct chats too**

Find the avatar block in `ChatHeader` (the `<div className="relative shrink-0">` containing the `avatarUrl`/`avatarEmoji`/initial rendering, followed by `<ConversationTypeBadge .../>`). Wrap it in a button so clicking it opens the profile panel for every type, not just via the `MemberAvatarStack` subtitle line that only exists for group/channel:

Change:
```jsx
        <div className="relative shrink-0">
          {avatarUrl && !avatarErr ? (
```
to:
```jsx
        <button type="button" onClick={onOpenDetails} className="relative shrink-0" title="Ver perfil">
          {avatarUrl && !avatarErr ? (
```

And change the matching closing tag right after the `<ConversationTypeBadge type={conversation?.type} />` line from `</div>` to `</button>`.

- [ ] **Step 5: Confirm `onOpenDetails` still does the right thing**

`onOpenDetails={() => { setMembersView(true); setFilesView(false); }}` (already passed to `ChatHeader` from the main `ChatWindow` render, unchanged) now opens the profile panel for every type via both the avatar click and the "Ver detalles" dropdown item — no further change needed there, since neither reads `conversation?.type` to decide whether to fire.

- [ ] **Step 6: Build and manually verify**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: No errors.

Manual: with the dev server running (`pnpm dev:frontend` or the full `pnpm dev`), open a direct conversation, click the header avatar, confirm the Info/Media/En comun/Notificaciones tabs render. Open a group conversation, confirm General/Miembros/Roles/Media/Notificaciones all render and nothing regressed from the pre-existing panel.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): wire ConversationProfilePanel into ChatWindow, open it for direct chats too"
```

---

### Task 10: Wire `ConversationProfilePanel` into `MiniChatWindow.jsx`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx`

- [ ] **Step 1: Add the import and state**

Add to the imports:
```js
import { ConversationProfilePanel } from "./ConversationProfilePanel";
```

Inside `MiniChatWindow`, add a new state next to `isDragOver`/`viewer`/`hiddenMsgIds`:
```js
  const [profileView, setProfileView] = useState(false);
```

- [ ] **Step 2: Add a header toggle button**

In the non-minimized header (the block starting `{!minimized && ( <div className="flex items-center gap-2 px-3 h-11 ...">`), add a small icon button right before the existing `<DropdownMenu>` for "..." — find:

```jsx
              <AvatarCircle avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} type={conversation?.type} name={name} size="sm" />
              <p className="flex-1 text-xs font-semibold truncate">{titleLabel}</p>
            </button>
            <DropdownMenu>
```

Insert a button between the closing `</button>` (the minimize-trigger wrapping avatar+name) and `<DropdownMenu>`:

```jsx
              <AvatarCircle avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} type={conversation?.type} name={name} size="sm" />
              <p className="flex-1 text-xs font-semibold truncate">{titleLabel}</p>
            </button>
            <button
              type="button"
              onClick={() => setProfileView((v) => !v)}
              title={profileView ? "Ver mensajes" : "Ver perfil"}
              className={[
                "shrink-0 h-6 w-6 flex items-center justify-center rounded transition-colors touch-manipulation",
                profileView
                  ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
              ].join(" ")}
            >
              <User className="h-3 w-3" />
            </button>
            <DropdownMenu>
```

Add `User` to the lucide-react import list at the top of the file.

- [ ] **Step 3: Swap the body content based on `profileView`**

Find:
```jsx
        {!minimized && (
          <>
            <ChatMessageList
```

Change the `!minimized` block to branch on `profileView` first:

```jsx
        {!minimized && profileView && (
          <ConversationProfilePanel conversation={conversation} currentUserId={userProfile?.id} />
        )}
        {!minimized && !profileView && (
          <>
            <ChatMessageList
```

...and find the end of that block (the `</>` right before `)}` that closes the original `{!minimized && ( <> ... </> )}`) — leave it as `</>` )} (now closing the `!profileView` branch instead of the original single branch).

- [ ] **Step 4: Reset `profileView` when switching conversations**

`MiniChatWindow` receives a fixed `entry`/`id` for its whole lifetime (each open chat gets its own `MiniChatWindow` instance keyed by conversation id in `ConversationPanel`/`FloatingChatHubInner` — verify this by checking how `MiniChatWindow` is invoked in `FloatingChatHub.jsx`'s remaining code), so no reset-on-change effect is needed the way `ChatWindow.jsx` needs one (a single `ChatWindow` instance is reused across different conversations there). Confirm this assumption against the actual call site before skipping the reset; add a `useEffect(() => setProfileView(false), [id])` only if `MiniChatWindow` turns out to be reused across different `id`s.

- [ ] **Step 5: Build and manually verify**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: No errors.

Manual: open a floating mini-chat window (not minimized), click the new profile-toggle button, confirm the tabs render and fit within the 300px-wide window without horizontal page scroll (the `overflow-x-auto` on `TabsList` from Task 8 should let the tab strip itself scroll instead).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx
git commit -m "feat(chat): add profile view to the floating mini-chat window"
```

---

### Task 11: Mute-aware realtime toast

**Files:**
- Modify: `apps/desktop/src/providers/RealtimeProvider.jsx`

- [ ] **Step 1: Add the mute check**

Find the `chat.message.new` handler:

```js
      .on('broadcast', { event: 'chat.message.new' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
        dispatch('chat.message.new', payload)
        const isSelf = payload?.senderId && payload.senderId === userProfile?.id
        if (!isSelf && payload?.senderName) {
          const convId = payload?.conversationId
          const openChats = useChatFloatStore.getState().openChats
          const isOpenAndVisible = convId && openChats.some((c) => c.id === convId && !c.minimized)
          const isOnRoute = convId && window.location.pathname.includes(`/atlas.chat/chat/inbox/${convId}`)
          if (!isOpenAndVisible && !isOnRoute) {
            toast(payload.senderName, {
```

Change the condition to also check `is_muted` from the cached conversation list — read it via `queryClient.getQueryData`, the same client-side-state-check pattern already used for `isOpenAndVisible`/`isOnRoute` on the preceding two lines:

```js
      .on('broadcast', { event: 'chat.message.new' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
        dispatch('chat.message.new', payload)
        const isSelf = payload?.senderId && payload.senderId === userProfile?.id
        if (!isSelf && payload?.senderName) {
          const convId = payload?.conversationId
          const openChats = useChatFloatStore.getState().openChats
          const isOpenAndVisible = convId && openChats.some((c) => c.id === convId && !c.minimized)
          const isOnRoute = convId && window.location.pathname.includes(`/atlas.chat/chat/inbox/${convId}`)
          const cachedConversations = queryClient.getQueryData(['chat-conversations'])?.data ?? []
          const isMuted = convId && cachedConversations.some((c) => c.id === convId && c.is_muted)
          if (!isOpenAndVisible && !isOnRoute && !isMuted) {
            toast(payload.senderName, {
```

This depends on Plan A Task 7 (`is_muted` exposed on `listConversations` rows) and on the `['chat-conversations']` query having been fetched at least once before the broadcast arrives — true in practice since `ChatSidebar`/`ChatScreen` fetch it on mount and this provider mounts at the app shell level, after the sidebar is already rendering. If the cache is empty (e.g. a broadcast arrives before the first fetch resolves), `cachedConversations` is `[]` and `isMuted` safely evaluates to `false` — the toast fires, which is the correct fail-open behavior (never silently swallow a real notification due to a cache-timing edge case).

- [ ] **Step 2: Build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: No errors.

- [ ] **Step 3: Manual verification**

With two test accounts (or one account plus a second browser profile), mute a conversation from the new Notificaciones tab, then send a message into it from the other account. Confirm no toast appears for the muted side, but the conversation's unread badge in the sidebar still increments.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/providers/RealtimeProvider.jsx
git commit -m "feat(chat): suppress the new-message toast for muted conversations"
```

---

### Task 12: `ChatReportsScreen.jsx` admin screen

**Files:**
- Create: `apps/desktop/src/modules/atlas.identity/screens/ChatReportsScreen.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Write the screen**

Create `apps/desktop/src/modules/atlas.identity/screens/ChatReportsScreen.jsx`:

```jsx
import { useMemo, useState } from "react";
import { PageHeader, DataTable, Button, ConfirmDialog, SelectField, ErrorState, Badge } from "@atlas/ui";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { useChatReports, useResolveReport } from "../../atlas.chat/hooks/useChatModeration";

const REASON_LABELS = { spam: "Spam", abuse: "Acoso o abuso", inappropriate: "Contenido inapropiado", other: "Otro" };
const STATUS_LABELS = { open: "Abierto", dismissed: "Desestimado", user_disabled: "Usuario deshabilitado" };

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ChatReportsScreen() {
  const { userProfile } = useAuth();
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) => Boolean(userProfile?.isAdmin || permissions.includes(key));

  const canRead = hasPermission("identity.chat_reports.read");
  const canManage = hasPermission("identity.chat_reports.manage");

  const [statusFilter, setStatusFilter] = useState("open");
  const [resolveTarget, setResolveTarget] = useState(null); // { report, action }

  const { data, isLoading, isError } = useChatReports(statusFilter === "all" ? undefined : statusFilter);
  const { mutate: resolveMutate, isPending: resolving } = useResolveReport();
  const reports = data?.data ?? [];

  const columns = useMemo(() => [
    { accessorKey: "reporterDisplayName", header: "Reportante" },
    { accessorKey: "reportedDisplayName", header: "Usuario reportado" },
    { accessorKey: "reason", header: "Motivo", cell: ({ row }) => REASON_LABELS[row.original.reason] ?? row.original.reason },
    { accessorKey: "note", header: "Nota", cell: ({ row }) => row.original.note || "—" },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "open" ? "secondary" : "success"}>
          {STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    { accessorKey: "createdAt", header: "Fecha", cell: ({ row }) => formatDate(row.original.createdAt) },
    ...(canManage ? [{
      id: "actions",
      header: "",
      cell: ({ row }) => row.original.status !== "open" ? null : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setResolveTarget({ report: row.original, action: "dismiss" })}>
            Desestimar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-500 border-red-500/40 hover:bg-red-500/10"
            onClick={() => setResolveTarget({ report: row.original, action: "disable_user" })}
          >
            Deshabilitar usuario
          </Button>
        </div>
      ),
    }] : []),
  ], [canManage]);

  function handleConfirmResolve() {
    if (!resolveTarget) return;
    resolveMutate(
      { reportId: resolveTarget.report.id, action: resolveTarget.action },
      {
        onSuccess: () => toast.success(resolveTarget.action === "dismiss" ? "Reporte desestimado." : "Usuario deshabilitado."),
        onError: () => toast.error("No se pudo resolver el reporte."),
      },
    );
    setResolveTarget(null);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Identity"
        title="Reportes de chat"
        description="Revisa reportes de usuarios filtrados desde atlas.chat."
      />

      {canRead ? (
        <>
          <div className="max-w-xs">
            <SelectField
              label="Estado"
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "open", label: "Abierto" },
                { value: "dismissed", label: "Desestimado" },
                { value: "user_disabled", label: "Usuario deshabilitado" },
                { value: "all", label: "Todos" },
              ]}
            />
          </div>

          {isError ? (
            <ErrorState message="No se pudieron cargar los reportes." />
          ) : (
            <DataTable
              columns={columns}
              data={reports}
              isLoading={isLoading}
              emptyTitle="Sin reportes"
              emptyDescription="No hay reportes de chat con este filtro."
              emptyIcon={Flag}
            />
          )}
        </>
      ) : (
        <ErrorState message="No tienes permisos para consultar reportes de chat." />
      )}

      <ConfirmDialog
        open={Boolean(resolveTarget)}
        onOpenChange={(v) => !v && setResolveTarget(null)}
        title={resolveTarget?.action === "dismiss" ? "Desestimar reporte" : "Deshabilitar usuario"}
        description={
          resolveTarget?.action === "dismiss"
            ? "Este reporte se marcara como desestimado."
            : `${resolveTarget?.report?.reportedDisplayName ?? "Este usuario"} sera deshabilitado y no podra iniciar sesion.`
        }
        confirmLabel={resolveTarget?.action === "dismiss" ? "Desestimar" : "Deshabilitar"}
        onConfirm={handleConfirmResolve}
        loading={resolving}
      />
    </div>
  );
}
```

Confirmed during plan self-review: `SelectField`'s `value`/`onValueChange` usage above matches Task 7's already-verified signature, and `Badge`'s `variant` prop accepts both `"secondary"` and `"success"` (`packages/ui/src/components/Badge.jsx`).

- [ ] **Step 2: Register the route**

In `apps/desktop/src/app/ModuleOutlet.jsx`, find the `SCREEN_MAP` block containing the `atlas.identity` entries (`"atlas.identity:/identity/users"`, `"atlas.identity:/identity/roles"`) and add:

```js
  "atlas.identity:/identity/chat-reports": lazy(
    () => import("../modules/atlas.identity/screens/ChatReportsScreen.jsx"),
  ),
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: No errors.

- [ ] **Step 4: Manual verification**

Log in as a user with `identity.chat_reports.read` (grant it via an existing role, or a superadmin account), navigate to Identidad → Reportes de chat, confirm the empty state or existing reports render. File a test report from a direct chat's Info tab, confirm it appears with status "Abierto", then dismiss it and confirm the status updates.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.identity/screens/ChatReportsScreen.jsx apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(identity): add ChatReportsScreen admin review screen"
```

---

### Task 13: Responsive QA pass (390px and 1440px)

**Files:** None — verification only, per this project's standing "Responsive QA both viewports" practice.

- [ ] **Step 1: Desktop viewport (1440px)**

With the dev server running, resize the browser (or use device toolbar) to 1440px wide. Verify:
- A direct chat's profile panel: all 4 tabs visible without horizontal scroll on the tab strip, Media grid renders 3 columns cleanly, the report Dialog is centered and not clipped.
- A group's profile panel: all 5 tabs visible.
- The floating mini-chat window's profile view at its native 300px width: tab strip scrolls horizontally if needed, no content overflow, Block/Report buttons remain tappable.

- [ ] **Step 2: Mobile viewport (390px)**

Resize to 390px wide. Verify:
- `ChatWindow`'s profile panel still fills the screen correctly (it already inherits the full-width mobile layout `ChatScreen.jsx` provides).
- The report Dialog fits within 390px without horizontal page scroll (per the project's `artifact`/general responsive convention: wide content scrolls within its own container, the page body never scrolls horizontally).
- The `ChatReportsScreen`'s `DataTable` at 390px: confirm it either horizontally scrolls within its own container or collapses to a mobile-friendly layout (check how `DataTable` already handles this elsewhere, e.g. `GeneratedDocumentsScreen.jsx`, and match that existing behavior — this plan does not add new mobile-table handling, it relies on `DataTable`'s existing responsive behavior).

- [ ] **Step 3: Run the full desktop build one more time as a final gate**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: No errors, no new warnings beyond the pre-existing chunk-size warning already present before this feature.

- [ ] **Step 4: Report findings**

No commit for this task — if any issue is found during manual QA, fix it as a small follow-up commit referencing which sub-step caught it, then re-run Step 3.

---

## Plan B Self-Review Notes

- **Spec coverage:** UX requirements (Section 8), routes/screens (Section 9), navigation (Section 16) are covered by Tasks 4-13. Section 8's "danger zone" visual separation is implemented via a simple bordered/labeled section in `ConversationInfoTab` rather than a distinct visual treatment — acceptable given no existing "danger zone" pattern was found elsewhere in this codebase to match against.
- **`@atlas/ui` prop names verified, not guessed:** `CheckboxField` (`checked`/`onChange` with a raw DOM event, not `onCheckedChange`+boolean), `SelectField` (`value`/`onValueChange` with the raw value), `TextareaField` (`value`/`onChange`/`rows`), and `Badge`'s `variant` values were all confirmed against `packages/ui/src/components/FormFields.jsx` and `Badge.jsx` directly during this plan's self-review — the code in Tasks 4, 7, and 12 reflects the real signatures, including catching and fixing an initial wrong guess (`onCheckedChange`) for `CheckboxField`.
- **Type consistency check:** `ConversationProfilePanel` is called identically from both `ChatWindow.jsx` (Task 9) and `MiniChatWindow.jsx` (Task 10) — `conversation={conversation} currentUserId={currentUserId}` in both places, matching the single signature defined in Task 8. `is_muted` is read consistently as `conversation?.is_muted` (list-query shape) with a fallback, not assumed present on the detail-query shape, matching Plan A's actual scope (Task 7 only touches `listConversations`).
- **Dependency on Plan A:** every hook in Task 3 calls an `atlas.chat.*` SDK method Plan A Task 9 must have already added; do not start Plan B before Plan A is merged and its build/tests pass.
