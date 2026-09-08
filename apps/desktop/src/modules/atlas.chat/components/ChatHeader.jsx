import { useState, useEffect, useRef } from "react";
import {
  Button,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  ConfirmDialog,
} from "@atlas/ui";
import {
  ArrowLeft, Users, FolderOpen, MessageSquare,
  MoreVertical, Trash2, X as XIcon, Search, Forward, Copy, CheckSquare,
  ChevronUp, ChevronDown, ChevronRight, Archive, ArchiveRestore, Pin,
  Phone, Video, UserPlus, Sparkles,
} from "lucide-react";
import { usePinnedMessages } from "../hooks/usePinnedMessages";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";
import { ConversationTypeBadge } from "./ConversationTypeBadge";
import { MemberAvatarStack } from "./MemberAvatarStack";
import { MERIDIAN_SUBTITLE } from "../lib/meridian";
import { getConversationDisplayName, getConversationTitleLabel } from "../lib/chatUtils";

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

export function ChatHeader({
  conversation, currentUserId, onlineUsers, onClose,
  detailMembers,
  filesView, onToggleFilesView,
  searchMode, searchQuery, onSearchToggle, onSearchChange,
  searchMatchCount, searchCurrentIdx, searchBusy, searchError, onNextMatch, onPrevMatch,
  selectionMode, selectionCount, hasOwnSelected,
  onSelectionCancel, onDeleteForMe, onDeleteForAll, onForwardSelected, onCopySelected,
  onEnterSelection,
  onDeleteConversation,
  onArchive, isArchived,
  onOpenProfile,
  onOpenPinned,
  callsEnabled, callPending, onStartAudioCall, onStartVideoCall, onOpenGuestLink,
  isMeridian = false,
  onOpenMeridian, meridianDisabled = false,
  embedded = null, onCollapse = null,
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
            <button type="button" onClick={onCopySelected} className={headerBtnCls} title="Copiar seleccionados">
              <Copy className="h-4 w-4" />
            </button>
            <button type="button" onClick={onForwardSelected} className={headerBtnCls} title="Reenviar seleccionados">
              <Forward className="h-4 w-4" />
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
          <span className={["text-xs shrink-0 tabular-nums", (hasMatches || searchBusy) && !searchError ? "text-[hsl(var(--muted-foreground))]" : "text-red-400"].join(" ")}>
            {searchError
              ? "Error al buscar"
              : searchBusy && !hasMatches
                ? "Buscando..."
                : hasMatches
                  ? `${searchCurrentIdx + 1} / ${searchMatchCount}`
                  : "Sin resultados"}
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
        {embedded === "call" ? (
          <button
            type="button"
            onClick={onCollapse}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors touch-manipulation shrink-0"
            aria-label="Ocultar chat"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors md:hidden touch-manipulation shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
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
          {isMeridian ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{MERIDIAN_SUBTITLE}</p>
          ) : conversation?.type === "direct" ? (
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

        {!embedded && callsEnabled && !isMeridian && conversation?.type !== "external_support" && (
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
            {onOpenGuestLink && (conversation?.type === "channel" || conversation?.type === "group") && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={headerBtnCls}
                onClick={onOpenGuestLink}
                title="Invitar a alguien externo (enlace de reunión)"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {/* MeridIAn assistant panel */}
        {!isMeridian && onOpenMeridian && conversation?.type !== "external_support" && (
          <button
            type="button"
            onClick={onOpenMeridian}
            disabled={meridianDisabled}
            className={[headerBtnCls, meridianDisabled ? "opacity-40 cursor-not-allowed" : ""].join(" ")}
            title={meridianDisabled ? "MeridIAn no esta configurado" : "Preguntar a MeridIAn sobre esta conversacion"}
          >
            <Sparkles className="h-4 w-4" />
          </button>
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

        {/* Profile / members access lives in the three-dots menu below — the
            header row keeps only the avatar/title as the tap target for it. */}

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
            {!isMeridian && (
              <DropdownMenuItem onSelect={() => onOpenProfile(isChannelOrGroup ? "members" : null)}>
                <Users className="h-3.5 w-3.5 mr-2" />
                {isChannelOrGroup ? "Ver miembros" : "Ver perfil"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onEnterSelection}>
              <CheckSquare className="h-3.5 w-3.5 mr-2" />
              Seleccionar mensajes
            </DropdownMenuItem>
            {!isMeridian && !embedded && onArchive && (
              <DropdownMenuItem onSelect={onArchive}>
                {isArchived
                  ? <><ArchiveRestore className="h-3.5 w-3.5 mr-2" />Desarchivar</>
                  : <><Archive className="h-3.5 w-3.5 mr-2" />Archivar</>
                }
              </DropdownMenuItem>
            )}
            {!isMeridian && !embedded && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-red-500 focus:text-red-500">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Eliminar conversacion
                </DropdownMenuItem>
              </>
            )}
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
