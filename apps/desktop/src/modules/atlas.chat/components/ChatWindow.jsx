import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, ConfirmDialog } from "@atlas/ui";
import {
  ArrowLeft, Users, FolderOpen, MessageSquare,
  MoreVertical, Trash2, X as XIcon, Search, Share2, CheckSquare,
  ChevronUp, ChevronDown, Archive, ArchiveRestore, Pin,
  Phone, Video,
} from "lucide-react";
import { ChatFilesGallery } from "./ChatFilesGallery";
import { DropZoneOverlay } from "./DropZoneOverlay";
import { ChatMessageList } from "./ChatMessageList";
import { MessageComposer } from "./MessageComposer";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { ConversationProfilePanel } from "./ConversationProfilePanel";
import { ConversationTypeBadge } from "./ConversationTypeBadge";
import { MemberAvatarStack } from "./MemberAvatarStack";
import { PinnedMessagesSheet } from "./PinnedMessagesSheet";
import { ThreadPanel } from "./ThreadPanel";
import {
  useChatMessages, useSendMessage, useMarkRead, useDeleteMessage, useDeleteAttachment,
  usePinMessage, useToggleReaction,
} from "../hooks/useChatMessages";
import { usePinnedMessages } from "../hooks/usePinnedMessages";
import { useChatPresence } from "../hooks/useChatPresence";
import { useChatConversations, useArchiveConversation, useUnarchiveConversation } from "../hooks/useChatConversations";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";
import {
  getConversationDisplayName, getConversationTitleLabel, buildAllAttachments,
} from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";
import { useCalls } from "../calls/CallsProvider";

function formatLastSeen(date) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return "hace un momento";
  if (diff < 60) return `hace ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// ── Chat header ───────────────────────────────────────────────────────────────

function ChatHeader({
  conversation, currentUserId, onlineUsers, onClose,
  detailMembers,
  filesView, onToggleFilesView,
  membersView,
  searchMode, searchQuery, onSearchToggle, onSearchChange,
  searchMatchCount, searchCurrentIdx, onNextMatch, onPrevMatch,
  selectionMode, selectionCount, hasOwnSelected,
  onSelectionCancel, onDeleteForMe, onDeleteForAll, onForwardSelected,
  onEnterSelection,
  onDeleteConversation,
  onArchive, isArchived,
  onOpenProfile, onCloseProfile,
  onOpenPinned,
  callsEnabled, callPending, onStartAudioCall, onStartVideoCall,
}) {
  const [avatarErr, setAvatarErr] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const searchInputRef = useRef(null);
  const { isUserOnline, getLastSeen } = useGlobalPresence();
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const titleLabel = getConversationTitleLabel(conversation, currentUserId);
  const members = conversation?.members ?? [];
  const isChannelOrGroup = conversation?.type === "group" || conversation?.type === "channel";
  // Pinning is only ever offered for channel/group conversations (Section 8/12
  // of the spec) — skip the fetch entirely for direct/external_support so every
  // conversation open/switch doesn't fire a request the UI will never use.
  const { data: pinnedData } = usePinnedMessages(conversation?.id, { enabled: isChannelOrGroup });
  const pinnedCount = isChannelOrGroup ? (pinnedData?.data?.length ?? 0) : 0;
  const onlineCount = Object.keys(onlineUsers ?? {}).length;
  const otherMember =
    conversation?.type === "direct"
      ? members.find((m) => m.userId !== currentUserId)
      : null;
  const avatarUrl = conversation?.avatarUrl ?? otherMember?.avatarUrl ?? null;
  const avatarEmoji = conversation?.avatar_emoji ?? null;
  const initial = (displayName?.[0] ?? "?").toUpperCase();

  const directOnline = otherMember ? isUserOnline(otherMember.userId) : false;
  const directLastSeen = otherMember ? getLastSeen(otherMember.userId) : null;

  useEffect(() => { setAvatarErr(false); }, [avatarUrl]);
  useEffect(() => {
    if (searchMode) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchMode]);

  const headerBtnCls = "shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation";

  // ── Selection mode ──────────────────────────────────────────────────────────
  if (selectionMode) {
    return (
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2.5 shrink-0">
        <button type="button" onClick={onSelectionCancel} className={headerBtnCls} title="Cancelar">
          <XIcon className="h-4 w-4" />
        </button>
        <span className="flex-1 text-sm font-semibold">
          {selectionCount > 0 ? `${selectionCount} seleccionado${selectionCount !== 1 ? "s" : ""}` : "Selecciona mensajes"}
        </span>
        {selectionCount > 0 && (
          <>
            <button type="button" onClick={onForwardSelected} className={headerBtnCls} title="Reenviar seleccionados">
              <Share2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onDeleteForMe} className={[headerBtnCls, "text-red-400 hover:text-red-500"].join(" ")} title="Eliminar para mi">
              <Trash2 className="h-4 w-4" />
            </button>
            {hasOwnSelected && (
              <Button size="sm" variant="outline" onClick={onDeleteForAll} className="text-red-500 border-red-500/40 hover:bg-red-500/10 text-xs shrink-0">
                Para todos
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Search mode ─────────────────────────────────────────────────────────────
  if (searchMode) {
    const hasMatches = searchMatchCount > 0;
    return (
      <div className="chat-glass flex items-center gap-1.5 rounded-full mx-2 mt-2 px-3 py-2.5 shrink-0">
        <button type="button" onClick={onSearchToggle} className={headerBtnCls} title="Cerrar busqueda">
          <XIcon className="h-4 w-4" />
        </button>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar en la conversacion..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-[hsl(var(--muted-foreground))]"
        />
        {searchQuery && (
          <span className={["text-xs shrink-0 tabular-nums", hasMatches ? "text-[hsl(var(--muted-foreground))]" : "text-red-400"].join(" ")}>
            {hasMatches ? `${searchCurrentIdx + 1} / ${searchMatchCount}` : "Sin resultados"}
          </span>
        )}
        <button
          type="button"
          onClick={onPrevMatch}
          disabled={!hasMatches}
          className={[headerBtnCls, !hasMatches ? "opacity-30 cursor-not-allowed" : ""].join(" ")}
          title="Anterior"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNextMatch}
          disabled={!hasMatches}
          className={[headerBtnCls, !hasMatches ? "opacity-30 cursor-not-allowed" : ""].join(" ")}
          title="Siguiente"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Normal mode ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="chat-glass flex items-center gap-3 px-3 sm:px-4 py-3 shrink-0">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors md:hidden touch-manipulation shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <button type="button" onClick={() => onOpenProfile(null)} className="relative shrink-0" title="Ver perfil">
          {avatarUrl && !avatarErr ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className={[
                "h-9 w-9 rounded-full object-cover ring-2 ring-offset-2 ring-offset-[hsl(var(--surface-2)/0.6)]",
                conversation?.type === "direct" && directOnline ? "ring-green-500/60" : "ring-[hsl(var(--border))]",
              ].join(" ")}
              onError={() => setAvatarErr(true)}
            />
          ) : avatarEmoji ? (
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-[hsl(var(--muted))]">
              <span className="text-lg leading-none">{avatarEmoji}</span>
            </div>
          ) : (
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm"
              style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}
            >
              {initial}
            </div>
          )}
          {conversation?.type === "direct" && directOnline && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[hsl(var(--background))]" />
          )}
          <ConversationTypeBadge type={conversation?.type} />
        </button>
        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => onOpenProfile(null)} className="block max-w-full text-left" title="Ver perfil">
            <p className="chat-font-display text-sm font-semibold truncate">{titleLabel}</p>
          </button>
          {conversation?.type === "direct" ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {directOnline ? (
                <span className="text-green-500">En linea</span>
              ) : directLastSeen ? (
                `Visto ${formatLastSeen(directLastSeen)}`
              ) : (
                "Desconectado"
              )}
            </p>
          ) : conversation?.type === "group" || conversation?.type === "channel" ? (
            <div className="flex items-center gap-2">
              <MemberAvatarStack members={detailMembers ?? members} onClick={() => onOpenProfile("members")} />
              {onlineCount > 0 && (
                <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{`${onlineCount} en linea`}</span>
              )}
            </div>
          ) : null}
        </div>

        {callsEnabled && conversation?.type !== "external_support" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={headerBtnCls}
              onClick={onStartAudioCall}
              disabled={callPending}
              title="Iniciar llamada de voz"
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={headerBtnCls}
              onClick={onStartVideoCall}
              disabled={callPending}
              title="Iniciar videollamada"
            >
              <Video className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Search */}
        <button type="button" onClick={onSearchToggle} className={headerBtnCls} title="Buscar mensajes">
          <Search className="h-4 w-4" />
        </button>

        {/* Files toggle */}
        <button
          type="button"
          onClick={onToggleFilesView}
          title={filesView ? "Ver mensajes" : "Ver archivos"}
          className={[
            headerBtnCls,
            filesView ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]" : "",
          ].join(" ")}
        >
          {filesView ? <MessageSquare className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
        </button>

        {/* Profile toggle — every conversation type now has a profile panel
            (direct chats gained Info/Media/En comun/Notificaciones). Opens
            the default tab — use the avatar/title or "Ver miembros" for a
            specific one. */}
        <button
          type="button"
          onClick={() => (membersView ? onCloseProfile() : onOpenProfile(null))}
          title={membersView ? "Ver mensajes" : "Ver perfil"}
          className={[
            headerBtnCls,
            membersView ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]" : "",
          ].join(" ")}
        >
          {membersView ? <MessageSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </button>

        {/* Pinned messages */}
        {pinnedCount > 0 && (
          <button type="button" onClick={onOpenPinned} title="Mensajes fijados" className={[headerBtnCls, "relative"].join(" ")}>
            <Pin className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[9px] font-bold flex items-center justify-center px-1 ring-2 ring-[hsl(var(--background))]">
              {pinnedCount > 9 ? "9+" : pinnedCount}
            </span>
          </button>
        )}

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={headerBtnCls}>
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(conversation?.type === "group" || conversation?.type === "channel") && (
              <DropdownMenuItem onSelect={() => onOpenProfile("members")}>
                <Users className="h-3.5 w-3.5 mr-2" />
                Ver miembros
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onEnterSelection}>
              <CheckSquare className="h-3.5 w-3.5 mr-2" />
              Seleccionar mensajes
            </DropdownMenuItem>
            {onArchive && (
              <DropdownMenuItem onSelect={onArchive}>
                {isArchived
                  ? <><ArchiveRestore className="h-3.5 w-3.5 mr-2" />Desarchivar</>
                  : <><Archive className="h-3.5 w-3.5 mr-2" />Archivar</>
                }
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-red-500 focus:text-red-500">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Eliminar conversacion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar conversacion"
        description="Se eliminaran todos los mensajes y archivos de esta conversacion solo para ti. La otra persona seguira teniendo su copia. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => { onDeleteConversation(); setConfirmDelete(false); }}
      />
    </>
  );
}

// ── Helpers for local "delete for me" ─────────────────────────────────────────

function loadHidden(conversationId) {
  try {
    const raw = localStorage.getItem(`atlas-chat-hidden-${conversationId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveHidden(conversationId, set) {
  try {
    localStorage.setItem(`atlas-chat-hidden-${conversationId}`, JSON.stringify([...set]));
  } catch {}
}

// ── Main ChatWindow ───────────────────────────────────────────────────────────

export function ChatWindow({ conversation, onClose, initialFilesView = false }) {
  const navigate = useNavigate();
  const { userProfile, session } = useAuth();
  const { enabled: callsEnabled, isStarting: callPending, startCall } = useCalls();
  const token = session?.access_token;
  const conversationId = conversation?.id;

  const { data: messagesData, isLoading, hasMore, isLoadingMore, loadMore } = useChatMessages(conversationId);
  const { mutateAsync: sendMessage } = useSendMessage(conversationId);
  const { mutate: markReadMutate } = useMarkRead(conversationId);
  const { mutate: deleteMessageMutate } = useDeleteMessage(conversationId);
  const { mutate: deleteAttachmentMutate, isPending: isDeletingAttachment, variables: deletingAttachmentId } = useDeleteAttachment(conversationId);
  const { mutate: pinMutate } = usePinMessage(conversationId);
  const { mutate: toggleReactionMutate } = useToggleReaction(conversationId);
  const { mutate: archiveMutate } = useArchiveConversation();
  const { mutate: unarchiveMutate } = useUnarchiveConversation();
  const { onlineUsers, typingUsersList, sendTyping } = useChatPresence(conversationId);
  const { data: convsData } = useChatConversations();
  const conversations = convsData?.data ?? [];
  // The conversation-list preview only returns a 5-member slice with no
  // role/permission fields — messages.pin gating needs the full member list
  // with roleId/rolePermissions, which only the detail query returns.
  const { data: conversationDetail } = useChatConversationDetail(conversationId);
  const detailMembers = conversationDetail?.data?.members ?? null;
  // messages.send is only meaningful for channel/group (direct/external_support
  // have no roles, so roleHasPermission would just resolve false for them —
  // guard by type instead of relying on that, same as the backend's own gate).
  const isChannelOrGroupType = conversation?.type === "channel" || conversation?.type === "group";
  const ownMemberForComposer = findOwnMember(detailMembers ?? conversation?.members ?? [], userProfile?.id);
  const canSendMessages = !isChannelOrGroupType || roleHasPermission(ownMemberForComposer, CHAT_PERMISSIONS.MESSAGES_SEND);

  const [filesView, setFilesView] = useState(initialFilesView);
  const [hiddenMessageIds, setHiddenMessageIds] = useState(() =>
    conversationId ? loadHidden(conversationId) : new Set(),
  );
  const [forwardMessage, setForwardMessage] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  // Separate selection state for the standalone Files view (reached from the
  // header's file icon) — this is a distinct surface from
  // ConversationMediaTab.jsx's own copy of the same pattern (profile panel's
  // Media tab), not shared with it, so each needs its own state.
  const [filesSelectionMode, setFilesSelectionMode] = useState(false);
  const [filesSelectedIds, setFilesSelectedIds] = useState(new Set());
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [membersView, setMembersView] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState(null);
  const [showPinned, setShowPinned] = useState(false);
  const [jumpTarget, setJumpTarget] = useState(null);
  const [threadPanelRootId, setThreadPanelRootId] = useState(null);

  const composerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // No longer stores its own attachments array — the viewer always renders
  // the conversation-wide allAttachments list below, positioned at whichever
  // index the click resolved to, so it can page through every file in the
  // chat rather than being scoped to one message.
  const [viewer, setViewer] = useState({ open: false, activeIndex: 0 });
  // Every file ever shared in this conversation (real attachments + file-type
  // entity references), oldest first — see buildAllAttachments in
  // chatUtils.js. Opening ANY file inline resolves to its position in THIS
  // list, not a per-message one, so the viewer can page through the whole
  // chat's media.
  const allAttachments = useMemo(() => buildAllAttachments(messagesData?.data ?? []), [messagesData]);

  const markReadRef = useRef(markReadMutate);
  markReadRef.current = markReadMutate;

  // Snapshot the unread count the instant this conversation is opened —
  // captured during render (before the markRead effect below fires and its
  // mutation's onSuccess invalidates the conversations list, zeroing this
  // same field out). ChatMessageList uses it to land the initial scroll on
  // the first unread message (WhatsApp-style) instead of the very bottom,
  // and to scope the "@" jump button to mentions that are actually unread.
  const unreadSnapshotRef = useRef({ id: null, count: 0 });
  if (unreadSnapshotRef.current.id !== conversationId) {
    unreadSnapshotRef.current = { id: conversationId, count: conversation?.unread_count ?? 0 };
  }

  // Reset local state when conversation changes
  useEffect(() => {
    setFilesView(initialFilesView);
    setHiddenMessageIds(conversationId ? loadHidden(conversationId) : new Set());
    setSelectionMode(false);
    setSelectedMsgIds(new Set());
    setFilesSelectionMode(false);
    setFilesSelectedIds(new Set());
    setSearchMode(false);
    setSearchQuery("");
    setSearchCurrentIdx(0);
    setMembersView(false);
    setProfileInitialTab(null);
    setShowPinned(false);
    setJumpTarget(null);
    setThreadPanelRootId(null);
  }, [conversationId, initialFilesView]);

  useEffect(() => {
    if (conversationId && token) markReadRef.current();
  }, [conversationId, token]);

  const handleSend = useCallback(
    async (data) => { await sendMessage(data); },
    [sendMessage],
  );

  // Ignores the (attachments, activeIndex) pair's CONTENTS beyond the
  // clicked item's id — that pair is whatever local list the caller had on
  // hand (a message's own attachments, or one message's file-type entity
  // refs), just enough to identify which file was clicked. This always opens
  // the SAME viewer positioned at that file's spot in the conversation-wide
  // allAttachments list, so paging from here walks the whole chat's media.
  const handleAttachmentClick = useCallback((attachments, activeIndex) => {
    const clickedId = attachments?.[activeIndex]?.id;
    const globalIdx = allAttachments.findIndex((f) => f.id === clickedId);
    setViewer({ open: true, activeIndex: globalIdx >= 0 ? globalIdx : 0 });
  }, [allAttachments]);

  function toggleFilesSelect(id) {
    setFilesSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelFilesSelection() {
    setFilesSelectionMode(false);
    setFilesSelectedIds(new Set());
  }

  // Direct sequential downloads — same staggered pattern as
  // ConversationMediaTab.jsx's handleBulkDownload, avoiding Chrome's
  // multi-download permission prompt on a burst of simultaneous downloads.
  function handleFilesBulkDownload() {
    const targets = [];
    for (const msg of messagesData?.data ?? []) {
      for (const att of msg.attachments ?? []) {
        if (filesSelectedIds.has(att.id)) targets.push(att);
      }
    }
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
    cancelFilesSelection();
  }

  const openProfile = useCallback((tab = null) => {
    setProfileInitialTab(tab);
    setMembersView(true);
    setFilesView(false);
  }, []);

  const closeProfile = useCallback(() => {
    setMembersView(false);
    setProfileInitialTab(null);
  }, []);

  const showAllFiles = useCallback(() => {
    setMembersView(false);
    setProfileInitialTab(null);
    setFilesView(true);
  }, []);

  const handleDeleteMessage = useCallback((messageId) => {
    deleteMessageMutate(messageId);
  }, [deleteMessageMutate]);

  const handleDeleteAttachment = useCallback((attachmentId) => {
    deleteAttachmentMutate(attachmentId);
  }, [deleteAttachmentMutate]);

  const handleJumpToMessage = useCallback((messageId, threadRootId) => {
    setShowPinned(false);
    if (threadRootId) {
      setThreadPanelRootId(threadRootId);
      return;
    }
    setFilesView(false);
    setJumpTarget({ id: messageId, nonce: Date.now() });
  }, []);

  const handleHideForMe = useCallback((messageId) => {
    setHiddenMessageIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      if (conversationId) saveHidden(conversationId, next);
      return next;
    });
  }, [conversationId]);

  // Selection handlers
  const enterSelectionMode = useCallback((firstMsgId) => {
    setSelectionMode(true);
    setSelectedMsgIds(new Set(firstMsgId ? [firstMsgId] : []));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMsgIds(new Set());
  }, []);

  // Escape closes whichever plain-state overlay is currently on top of the
  // base message view, one layer at a time — selection mode, then search,
  // then the profile panel, then the files view. Dialog/Sheet-based overlays
  // (ForwardMessageModal, PinnedMessagesSheet, ThreadPanel, ConfirmDialog)
  // already close on Escape via Radix's own built-in handling and don't need
  // anything here.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (selectionMode) { exitSelectionMode(); return; }
      if (searchMode) { setSearchMode(false); setSearchQuery(""); return; }
      if (membersView) { closeProfile(); return; }
      if (filesView) { setFilesView(false); return; }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectionMode, searchMode, membersView, filesView, exitSelectionMode, closeProfile]);

  const toggleSelectMessage = useCallback((msgId) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const handleDeleteSelectedForMe = useCallback(() => {
    setHiddenMessageIds((prev) => {
      const next = new Set(prev);
      for (const id of selectedMsgIds) next.add(id);
      if (conversationId) saveHidden(conversationId, next);
      return next;
    });
    exitSelectionMode();
  }, [selectedMsgIds, conversationId, exitSelectionMode]);

  const handleDeleteSelectedForAll = useCallback(() => {
    const messages = messagesData?.data ?? [];
    for (const id of selectedMsgIds) {
      const msg = messages.find((m) => m.id === id);
      if (msg && msg.sender_user_id === userProfile?.id && !msg.deleted_at) {
        deleteMessageMutate(id);
      }
    }
    // Also hide the rest for me
    const ownIds = new Set(
      messages
        .filter((m) => selectedMsgIds.has(m.id) && m.sender_user_id === userProfile?.id)
        .map((m) => m.id),
    );
    const otherIds = [...selectedMsgIds].filter((id) => !ownIds.has(id));
    if (otherIds.length) {
      setHiddenMessageIds((prev) => {
        const next = new Set(prev);
        for (const id of otherIds) next.add(id);
        if (conversationId) saveHidden(conversationId, next);
        return next;
      });
    }
    exitSelectionMode();
  }, [selectedMsgIds, messagesData, userProfile, deleteMessageMutate, conversationId, exitSelectionMode]);

  const handleDeleteConversation = useCallback(() => {
    const messages = messagesData?.data ?? [];
    setHiddenMessageIds((prev) => {
      const next = new Set(prev);
      for (const m of messages) next.add(m.id);
      if (conversationId) saveHidden(conversationId, next);
      return next;
    });
  }, [messagesData, conversationId]);

  const handleForwardSelected = useCallback(() => {
    // Build a synthetic "message" that contains all selected bodies concatenated
    const msgs = (messagesData?.data ?? []).filter((m) => selectedMsgIds.has(m.id) && m.body && !m.deleted_at);
    if (!msgs.length) return;
    // Forward them as one combined message (join with newlines)
    const combined = msgs.map((m) => m.body).join("\n");
    setForwardMessage({ body: combined });
    exitSelectionMode();
  }, [messagesData, selectedMsgIds, exitSelectionMode]);

  // "Para todos" only when ALL selected messages are own and non-deleted
  const hasOwnSelected = useMemo(() => {
    if (!selectedMsgIds.size) return false;
    const messages = messagesData?.data ?? [];
    return [...selectedMsgIds].every((id) => {
      const m = messages.find((msg) => msg.id === id);
      return m && m.sender_user_id === userProfile?.id && !m.deleted_at;
    });
  }, [selectedMsgIds, messagesData, userProfile]);

  // Ordered list of matching message IDs for navigation
  const searchMatchIds = useMemo(() => {
    if (!searchMode || !searchQuery.trim()) return [];
    const all = messagesData?.data ?? [];
    const q = searchQuery.toLowerCase();
    return all
      .filter((m) => !hiddenMessageIds.has(m.id) && m.body?.toLowerCase().includes(q))
      .map((m) => m.id)
      .reverse();
  }, [messagesData, hiddenMessageIds, searchMode, searchQuery]);

  const [searchCurrentIdx, setSearchCurrentIdx] = useState(0);

  useEffect(() => { setSearchCurrentIdx(0); }, [searchQuery]);

  const currentMatchId = searchMatchIds[searchCurrentIdx] ?? null;

  const handleNextMatch = useCallback(() => {
    if (!searchMatchIds.length) return;
    setSearchCurrentIdx((i) => (i + 1) % searchMatchIds.length);
  }, [searchMatchIds]);

  const handlePrevMatch = useCallback(() => {
    if (!searchMatchIds.length) return;
    setSearchCurrentIdx((i) => (i - 1 + searchMatchIds.length) % searchMatchIds.length);
  }, [searchMatchIds]);

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) composerRef.current?.addFiles(files);
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center">
            <MessageSquare className="h-7 w-7 text-[hsl(var(--primary)/0.4)]" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">Selecciona una conversacion</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">para empezar a chatear</p>
          </div>
        </div>
      </div>
    );
  }

  const messages = messagesData?.data ?? [];

  return (
    <div
      className="flex flex-1 min-h-0 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && <DropZoneOverlay rounded="rounded-none" />}

      {/* Header + message body + composer all live in ONE column now, so the
          profile sidebar (below) sits alongside the WHOLE chat — header
          included — instead of being nested inside just the message-body
          row below a second, separate header. That nesting used to leave
          ConversationProfilePanel's own header stacked under ChatHeader
          instead of flush with the top of the window, and left the composer
          spanning full width underneath the sidebar instead of stopping at
          this column's edge. */}
      <div className={[
        "min-w-0 min-h-0 flex-col",
        membersView ? "hidden xl:flex xl:flex-1" : "flex flex-1",
      ].join(" ")}>
      <ChatHeader
        conversation={conversation}
        currentUserId={userProfile?.id}
        onlineUsers={onlineUsers}
        detailMembers={detailMembers}
        onClose={onClose}
        filesView={filesView}
        onToggleFilesView={() => { setFilesView((v) => !v); setMembersView(false); setProfileInitialTab(null); }}
        membersView={membersView}
        searchMode={searchMode}
        searchQuery={searchQuery}
        onSearchToggle={() => { setSearchMode((v) => !v); setSearchQuery(""); setSearchCurrentIdx(0); }}
        onSearchChange={setSearchQuery}
        searchMatchCount={searchMatchIds.length}
        searchCurrentIdx={searchCurrentIdx}
        onNextMatch={handleNextMatch}
        onPrevMatch={handlePrevMatch}
        selectionMode={selectionMode}
        selectionCount={selectedMsgIds.size}
        hasOwnSelected={hasOwnSelected}
        onSelectionCancel={exitSelectionMode}
        onDeleteForMe={handleDeleteSelectedForMe}
        onDeleteForAll={handleDeleteSelectedForAll}
        onForwardSelected={handleForwardSelected}
        onEnterSelection={() => enterSelectionMode(null)}
        onDeleteConversation={handleDeleteConversation}
        onOpenProfile={openProfile}
        onCloseProfile={closeProfile}
        onOpenPinned={() => setShowPinned(true)}
        callsEnabled={callsEnabled}
        callPending={callPending}
        onStartAudioCall={() => startCall({ conversationId, kind: "AUDIO" })}
        onStartVideoCall={() => startCall({ conversationId, kind: "VIDEO" })}
        isArchived={conversation?.is_archived ?? false}
        onArchive={conversationId
          ? () => conversation?.is_archived
            ? unarchiveMutate(conversationId)
            : archiveMutate(conversationId)
          : undefined}
      />

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {filesView ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <ChatFilesGallery
                messages={messages}
                isLoading={isLoading}
                onAttachmentClick={handleAttachmentClick}
                selectionMode={filesSelectionMode}
                selectedIds={filesSelectedIds}
                onToggleSelect={toggleFilesSelect}
                onEnterSelection={() => setFilesSelectionMode(true)}
                onCancelSelection={cancelFilesSelection}
              />
              {filesSelectionMode && filesSelectedIds.size > 0 && (
                <div className="shrink-0 px-4 py-2.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center justify-between">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {filesSelectedIds.size} {filesSelectedIds.size === 1 ? "archivo" : "archivos"}
                  </span>
                  <button
                    type="button"
                    onClick={handleFilesBulkDownload}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
                  >
                    Descargar ({filesSelectedIds.size})
                  </button>
                </div>
              )}
            </div>
          ) : (
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
              onDeleteAttachment={handleDeleteAttachment}
              deletingAttachmentId={isDeletingAttachment ? deletingAttachmentId : null}
              onHideForMe={handleHideForMe}
              onForward={setForwardMessage}
              onPinMessage={(messageId, pinned) => pinMutate({ messageId, pinned })}
              onToggleReaction={(messageId, emoji, attachmentId) => toggleReactionMutate({ messageId, emoji, attachmentId })}
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
              unreadCountAtOpen={unreadSnapshotRef.current.count}
            />
          )}
      </div>

      {/* Below xl: the profile sidebar fully replaces this whole column (no
          room for both) — the column div's own "hidden xl:flex" above
          handles that. At xl and up this column stays visible alongside the
          sidebar (see below), composer included, so you can keep chatting
          while looking at the profile. */}
      {!filesView && (
        <MessageComposer
          ref={composerRef}
          onSend={handleSend}
          onTyping={sendTyping}
          placeholder={canSendMessages ? "Escribe un mensaje..." : "Solo un administrador puede escribir en este canal"}
          conversationId={conversationId}
          conversationType={conversation?.type}
          dropZoneDisabled
          disabled={!canSendMessages}
        />
      )}
      </div>

      {/* True full-height sidebar, alongside the whole chat column above —
          header included — not nested inside just the message-body row. */}
      {membersView && (
        <div className="w-full xl:w-96 xl:shrink-0 xl:border-l xl:border-[hsl(var(--border))] flex flex-col min-h-0 min-w-0">
          <ConversationProfilePanel
            key={profileInitialTab ?? "default"}
            conversation={conversation}
            currentUserId={userProfile?.id}
            initialTab={profileInitialTab}
            onBack={closeProfile}
            messages={messages}
            isLoadingMessages={isLoading}
            onShowAllFiles={showAllFiles}
            onOpenConversation={(conv) => navigate(`/app/m/atlas.chat/chat/inbox/${conv.id}`)}
            onDeleted={onClose}
          />
        </div>
      )}

      <ChatAttachmentViewer
        open={viewer.open}
        onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
        attachments={allAttachments}
        activeIndex={viewer.activeIndex}
        onIndexChange={(i) => setViewer((v) => ({ ...v, activeIndex: i }))}
      />

      <ForwardMessageModal
        open={Boolean(forwardMessage)}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
        conversations={conversations}
      />

      <PinnedMessagesSheet
        open={showPinned}
        onOpenChange={setShowPinned}
        conversationId={conversationId}
        currentUserId={userProfile?.id}
        members={detailMembers ?? conversation.members}
        onJumpToMessage={handleJumpToMessage}
      />

      <ThreadPanel
        open={Boolean(threadPanelRootId)}
        onOpenChange={(open) => { if (!open) setThreadPanelRootId(null); }}
        rootMessageId={threadPanelRootId}
        conversationId={conversationId}
        conversationType={conversation?.type}
        members={detailMembers ?? conversation.members}
        onToggleReaction={(messageId, emoji, attachmentId) => toggleReactionMutate({ messageId, emoji, attachmentId })}
      />
    </div>
  );
}
