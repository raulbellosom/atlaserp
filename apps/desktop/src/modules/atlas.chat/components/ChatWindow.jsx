import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button, EmptyState, Skeleton, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, ConfirmDialog } from "@atlas/ui";
import {
  ArrowLeft, Users, FolderOpen, MessageSquare,
  FileText, FileType2, FileSpreadsheet, FileVideo, FileAudio,
  FileArchive, FileCode, File as FileIconBase, FileImage,
  MoreVertical, Trash2, X as XIcon, Search, Share2, CheckSquare,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { ChatMessageList } from "./ChatMessageList";
import { MessageComposer } from "./MessageComposer";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { useChatMessages, useSendMessage, useMarkRead, useDeleteMessage } from "../hooks/useChatMessages";
import { useChatPresence } from "../hooks/useChatPresence";
import { useChatConversations } from "../hooks/useChatConversations";
import {
  getConversationDisplayName, isImageMime, formatFileSize, formatMessageTime,
} from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";

function formatLastSeen(date) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return "hace un momento";
  if (diff < 60) return `hace ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// ── Files gallery ─────────────────────────────────────────────────────────────

function FileTypeIcon({ mimeType }) {
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

function ChatFilesGallery({ messages, isLoading, onAttachmentClick }) {
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

// ── Chat header ───────────────────────────────────────────────────────────────

function ChatHeader({
  conversation, currentUserId, onlineUsers, onClose,
  filesView, onToggleFilesView,
  searchMode, searchQuery, onSearchToggle, onSearchChange,
  searchMatchCount, searchCurrentIdx, onNextMatch, onPrevMatch,
  selectionMode, selectionCount, hasOwnSelected,
  onSelectionCancel, onDeleteForMe, onDeleteForAll, onForwardSelected,
  onEnterSelection,
  onDeleteConversation,
}) {
  const [avatarErr, setAvatarErr] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const searchInputRef = useRef(null);
  const { isUserOnline, getLastSeen } = useGlobalPresence();
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const members = conversation?.members ?? [];
  const onlineCount = Object.keys(onlineUsers ?? {}).length;
  const otherMember =
    conversation?.type === "direct"
      ? members.find((m) => m.userId !== currentUserId)
      : null;
  const avatarUrl = conversation?.avatar_url ?? otherMember?.avatarUrl ?? null;
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
      <div className="flex items-center gap-1.5 border-b border-[hsl(var(--border))] px-3 py-2.5 shrink-0">
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
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-3 sm:px-4 py-3 shrink-0">
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
        <div className="relative shrink-0">
          {avatarUrl && !avatarErr ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-9 w-9 rounded-full object-cover"
              onError={() => setAvatarErr(true)}
            />
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
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {conversation?.type === "direct" ? (
              directOnline ? (
                <span className="text-green-500">En linea</span>
              ) : directLastSeen ? (
                `Visto ${formatLastSeen(directLastSeen)}`
              ) : (
                "Desconectado"
              )
            ) : (
              onlineCount > 0
                ? `${onlineCount} en linea`
                : `${members.length} miembro${members.length !== 1 ? "s" : ""}`
            )}
          </p>
        </div>

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

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={headerBtnCls}>
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {conversation?.type === "group" && (
              <DropdownMenuItem>
                <Users className="h-3.5 w-3.5 mr-2" />
                Ver miembros
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onEnterSelection}>
              <CheckSquare className="h-3.5 w-3.5 mr-2" />
              Seleccionar mensajes
            </DropdownMenuItem>
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
  const { userProfile, session } = useAuth();
  const token = session?.access_token;
  const conversationId = conversation?.id;

  const { data: messagesData, isLoading, hasMore, isLoadingMore, loadMore } = useChatMessages(conversationId);
  const { mutateAsync: sendMessage } = useSendMessage(conversationId);
  const { mutate: markReadMutate } = useMarkRead(conversationId);
  const { mutate: deleteMessageMutate } = useDeleteMessage(conversationId);
  const { onlineUsers, typingUsersList, sendTyping } = useChatPresence(conversationId);
  const { data: convsData } = useChatConversations();
  const conversations = convsData?.data ?? [];

  const [filesView, setFilesView] = useState(initialFilesView);
  const [hiddenMessageIds, setHiddenMessageIds] = useState(() =>
    conversationId ? loadHidden(conversationId) : new Set(),
  );
  const [forwardMessage, setForwardMessage] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const composerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });

  const markReadRef = useRef(markReadMutate);
  markReadRef.current = markReadMutate;

  // Reset local state when conversation changes
  useEffect(() => {
    setFilesView(initialFilesView);
    setHiddenMessageIds(conversationId ? loadHidden(conversationId) : new Set());
    setSelectionMode(false);
    setSelectedMsgIds(new Set());
    setSearchMode(false);
    setSearchQuery("");
    setSearchCurrentIdx(0);
  }, [conversationId, initialFilesView]);

  useEffect(() => {
    if (conversationId && token) markReadRef.current();
  }, [conversationId, token]);

  const handleSend = useCallback(
    async (data) => { await sendMessage(data); },
    [sendMessage],
  );

  const handleAttachmentClick = useCallback((attachments, activeIndex) => {
    setViewer({ open: true, attachments, activeIndex });
  }, []);

  const handleDeleteMessage = useCallback((messageId) => {
    deleteMessageMutate(messageId);
  }, [deleteMessageMutate]);

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
      <div className="flex-1 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
        <div className="text-center space-y-2">
          <p className="text-4xl">💬</p>
          <p className="text-sm">Selecciona una conversacion para empezar</p>
        </div>
      </div>
    );
  }

  const messages = messagesData?.data ?? [];

  return (
    <div
      className="flex flex-col flex-1 min-h-0 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] pointer-events-none rounded-none">
          <p className="text-sm font-medium text-[hsl(var(--primary))]">Suelta los archivos aqui</p>
        </div>
      )}

      <ChatHeader
        conversation={conversation}
        currentUserId={userProfile?.id}
        onlineUsers={onlineUsers}
        onClose={onClose}
        filesView={filesView}
        onToggleFilesView={() => setFilesView((v) => !v)}
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
      />

      {filesView ? (
        <ChatFilesGallery
          messages={messages}
          isLoading={isLoading}
          onAttachmentClick={handleAttachmentClick}
        />
      ) : (
        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          currentUserId={userProfile?.id}
          typingUsers={typingUsersList}
          onAttachmentClick={handleAttachmentClick}
          members={conversation.members}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
          onDeleteMessage={handleDeleteMessage}
          onHideForMe={handleHideForMe}
          onForward={setForwardMessage}
          hiddenMessageIds={hiddenMessageIds}
          selectionMode={selectionMode}
          selectedMsgIds={selectedMsgIds}
          onToggleSelect={toggleSelectMessage}
          onEnterSelection={enterSelectionMode}
          searchQuery={searchMode ? searchQuery : ""}
          searchMatchIds={searchMode && searchMatchIds.length ? new Set(searchMatchIds) : null}
          currentMatchId={currentMatchId}
        />
      )}

      {!filesView && (
        <MessageComposer
          ref={composerRef}
          onSend={handleSend}
          onTyping={sendTyping}
          placeholder="Escribe un mensaje..."
          conversationId={conversationId}
        />
      )}

      <ChatAttachmentViewer
        open={viewer.open}
        onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
        attachments={viewer.attachments}
        activeIndex={viewer.activeIndex}
        onIndexChange={(i) => setViewer((v) => ({ ...v, activeIndex: i }))}
      />

      <ForwardMessageModal
        open={Boolean(forwardMessage)}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
        conversations={conversations}
      />
    </div>
  );
}
