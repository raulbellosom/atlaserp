import { useState, useRef } from "react";
import {
  CheckCheck, MoreHorizontal, Copy, Trash2, Share2, EyeOff, CheckSquare,
  Pin, PinOff, Smile, MessageSquare, CornerUpLeft,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  renderMentionText, useLongPress, useSwipeToReply,
} from "@atlas/ui";
import { formatMessageTime } from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";
import { roleHasPermission, findOwnMember, isMentioned, CHAT_PERMISSIONS } from "../lib/chatPermissions";
import { MessageReactions } from "./MessageReactions";
import { MessageReactionPicker } from "./MessageReactionPicker";
import { EntityReferenceCard } from "./EntityReferenceCard";
import { FileReferenceGroup } from "./FileReferenceGroup";
import { AttachmentsBlock } from "./MessageAttachments";
import { MessageQuote } from "./MessageQuote";
import { MessageActionSheet } from "./MessageActionSheet";
import { buildMessageActions } from "../lib/messageActions";

// ── Corner radius for grouped bubbles ─────────────────────────────────────────
function bubbleRadius(isOwn, isFirst, isLast) {
  const FULL = "rounded-[var(--chat-radius-bubble)]";
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

// ── Selection checkbox ────────────────────────────────────────────────────────
function SelectionCircle({ isSelected }) {
  return (
    <div
      className={[
        "shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-150 self-center",
        isSelected
          ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]"
          : "border-[hsl(var(--foreground)/0.5)] bg-[hsl(var(--background)/0.85)]",
      ].join(" ")}
      style={!isSelected ? { boxShadow: "0 0 0 1px hsl(var(--foreground)/0.15)" } : undefined}
    >
      {isSelected && (
        <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none">
          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── Swipe-to-reply hint ──────────────────────────────────────────────────────
// The curved-arrow badge revealed as the bubble is dragged sideways. It lives
// inside the transformed row, so it is counter-translated to stay pinned to
// the row's edge while the message content slides past it (WhatsApp-style).
const SWIPE_THRESHOLD = 56;
function SwipeReplyHint({ translateX, isOwn }) {
  if (!translateX) return null;
  const progress = Math.min(1, Math.abs(translateX) / SWIPE_THRESHOLD);
  return (
    <span
      className="absolute top-1/2 z-10 flex items-center justify-center h-8 w-8 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md pointer-events-none"
      style={{
        [isOwn ? "right" : "left"]: 6,
        transform: `translateX(${-translateX}px) translateY(-50%) scale(${0.6 + 0.4 * progress})`,
        opacity: progress,
      }}
    >
      <CornerUpLeft className="h-4 w-4" style={isOwn ? { transform: "scaleX(-1)" } : undefined} />
    </span>
  );
}

// ── Message action dropdown (desktop hover) ──────────────────────────────────
// The action list itself comes from buildMessageActions() — the single source
// shared with MessageActionSheet (mobile long-press / desktop right-click).
function MessageActions({
  isOwn, hasBody, onCopy, onDelete, onHideForMe, onForward, onEnterSelection,
  canPin, isPinned, onPin, onReact, canReply, onOpenThread, onReply,
}) {
  const actions = buildMessageActions({
    hasBody, isOwn, canPin, isPinned, canReply,
    onReply, onCopy, onForward, onEnterSelection, onPin, onReact, onOpenThread,
    onDelete, onHideForMe,
  });
  const primary = actions.filter((a) => a.group === "primary");
  const danger = actions.filter((a) => a.group === "danger");

  return (
    <>
      {/* Hover-visible quick-react affordance — same hover pattern as the "..."
          trigger below, but opens the reaction picker directly (no dropdown
          detour). It isn't opened from inside another overlay's onSelect, so
          it doesn't hit the Radix close/open race the dropdown item does. */}
      {onReact && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReact(); }}
          title="Reaccionar"
          aria-label="Reaccionar"
          className="opacity-0 group-hover/msg:opacity-100 focus:opacity-100 h-6 w-6 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-opacity shrink-0 self-center touch-manipulation"
        >
          <Smile className="h-3.5 w-3.5" />
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="opacity-0 group-hover/msg:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 h-6 w-6 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-opacity shrink-0 self-center touch-manipulation"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isOwn ? "start" : "end"}
          style={{ zIndex: 10000 }}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {primary.map((a) => (
            <DropdownMenuItem
              key={a.key}
              onSelect={() => {
                // "react" opens a Radix Popover from inside this menu's
                // onSelect — defer past the menu's own close (see the
                // onCloseAutoFocus preventDefault above) so the Popover
                // isn't read as an outside interaction and dismissed.
                if (a.key === "react") requestAnimationFrame(() => a.onSelect?.());
                else a.onSelect?.();
              }}
            >
              <a.icon className="h-3.5 w-3.5 mr-2" />
              {a.label}
            </DropdownMenuItem>
          ))}
          {primary.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
          {danger.map((a) => (
            <DropdownMenuItem
              key={a.key}
              onSelect={() => a.onSelect?.()}
              className={a.danger ? "text-red-500 focus:text-red-500" : undefined}
            >
              <a.icon className="h-3.5 w-3.5 mr-2" />
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// ── Search text highlight ──────────────────────────────────────────────────────
// NOTE: despite the name/original design, this is the render path for EVERY
// real (non-system) message body, not just search results — it's called
// unconditionally at both call sites below with `query={searchQuery}`, which
// is "" whenever the user isn't actively searching. So mention-chip rendering
// has to live HERE (composed with the existing substring highlight), not in a
// separate "plain" render path — there isn't one for real messages.
function HighlightedText({ text, query }) {
  if (!text) return null;
  const mentionParts = renderMentionText(text);
  const parts = Array.isArray(mentionParts) ? mentionParts : [mentionParts ?? text];
  if (!query) return <>{parts}</>;

  const q = query.toLowerCase();
  const highlighted = [];
  let key = 0;
  for (const part of parts) {
    if (typeof part !== "string") {
      // Already a mention chip <span> from renderMentionText — pass through
      // unchanged rather than searching for query matches inside its markup.
      highlighted.push(part);
      continue;
    }
    const lower = part.toLowerCase();
    let lastIndex = 0;
    let idx = lower.indexOf(q, lastIndex);
    while (idx !== -1) {
      if (idx > lastIndex) highlighted.push(part.slice(lastIndex, idx));
      highlighted.push(
        <mark key={`hl-${key++}`} className="bg-yellow-300 text-black rounded-xs px-0.5">
          {part.slice(idx, idx + q.length)}
        </mark>
      );
      lastIndex = idx + q.length;
      idx = lower.indexOf(q, lastIndex);
    }
    if (lastIndex < part.length) highlighted.push(part.slice(lastIndex));
  }
  return <>{highlighted}</>;
}

// ── Main bubble ───────────────────────────────────────────────────────────────
export function ChatMessageBubble({
  message,
  isOwn,
  onAttachmentClick,
  showReadReceipt,
  isFirst = true,
  isLast = true,
  onCopy,
  onDelete,
  onHideForMe,
  onForward,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onEnterSelection,
  searchQuery = "",
  isSearchMatch = false,
  isCurrentMatch = false,
  currentUserId,
  members,
  conversationType,
  isPinned = false,
  onPin,
  onToggleReaction,
  onDeleteAttachment,
  deletingAttachmentId,
  isThreadReplyView = false,
  onOpenThreadForMessage,
  onReply,
  onJumpToMessage,
}) {
  const [avatarErr, setAvatarErr] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [actionSheet, setActionSheet] = useState({ open: false, point: null });
  const lastTapRef = useRef(0);

  const isDeleted = Boolean(message.deleted_at);
  const isPending = String(message.id ?? "").startsWith("temp-");
  const gesturesDisabled = selectionMode || isDeleted || isPending || message.type === "date_separator"
    || message.sender_type === "system" || message.message_type === "system";

  const longPress = useLongPress({
    disabled: gesturesDisabled,
    // Capture the press coordinates so the desktop/tablet action menu
    // (MessageActionSheet's non-mobile DropdownMenu path) anchors next to the
    // finger instead of jumping to the top-left corner (point:null -> 0,0).
    // On true-mobile widths MessageActionSheet ignores the point and always
    // raises its bottom Sheet.
    onLongPress: (e) => setActionSheet({
      open: true,
      point: e && Number.isFinite(e.clientX) ? { x: e.clientX, y: e.clientY } : null,
    }),
  });
  const { handlers: swipeHandlers, translateX } = useSwipeToReply({
    disabled: gesturesDisabled || !onReply,
    direction: isOwn ? "left" : "right",
    threshold: SWIPE_THRESHOLD,
    onReply: () => onReply?.(message),
  });

  function handleRowPointerUp(e) {
    longPress.onPointerUp?.(e);
    swipeHandlers.onPointerUp?.(e);
    // Double-tap -> quick heart. Only when the tap lands on the bubble
    // background / text, never an attachment, link, or reaction pill.
    if (gesturesDisabled || !onToggleReaction) return;
    if (e.target?.closest?.("a,button,img,video,input")) return;
    const now = Date.now();
    if (now - lastTapRef.current < 250) {
      onToggleReaction(message.id, "❤️");
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  function handleRowContextMenu(e) {
    if (gesturesDisabled) return;
    e.preventDefault();
    setActionSheet({ open: true, point: { x: e.clientX, y: e.clientY } });
  }

  const rowGestureProps = {
    onPointerDown: (e) => { longPress.onPointerDown?.(e); swipeHandlers.onPointerDown?.(e); },
    onPointerMove: (e) => { longPress.onPointerMove?.(e); swipeHandlers.onPointerMove?.(e); },
    onPointerUp: handleRowPointerUp,
    onPointerCancel: (e) => { longPress.onPointerCancel?.(e); swipeHandlers.onPointerCancel?.(e); },
    onContextMenu: handleRowContextMenu,
    style: {
      transform: translateX ? `translateX(${translateX}px)` : undefined,
      transition: translateX ? "none" : "transform 0.18s ease-out",
      // Let the browser own vertical scroll but hand horizontal drags to the
      // swipe handlers — without this the browser claims the gesture and
      // fires pointercancel mid-drag, so the swipe never completes.
      touchAction: gesturesDisabled ? undefined : "pan-y",
    },
  };

  if (message.type === "date_separator") {
    return (
      <div className="flex items-center gap-3 my-4 px-4">
        <div className="flex-1 h-px bg-[hsl(var(--border))]" />
        <span className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium shrink-0 px-1">
          {message.label}
        </span>
        <div className="flex-1 h-px bg-[hsl(var(--border))]" />
      </div>
    );
  }

  if (message.sender_type === "system" || message.message_type === "system") {
    return (
      <div className="flex justify-center my-2 px-4">
        <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-3 py-1 rounded-full">
          {renderMentionText(message.body)}
        </span>
      </div>
    );
  }

  const attachments = message.attachments ?? [];
  const senderName =
    message.sender?.displayName ??
    (message.sender_type === "guest" ? "Visitante" : "Usuario");

  const radius = bubbleRadius(isOwn, isFirst, isLast);
  const rowPaddingY = isFirst ? "mt-2" : "mt-0.5";
  const showMeta = isLast || showReadReceipt || isPending;

  // Bubble only shown when there's text (attachments render outside/below)
  const hasText = Boolean(message.body) || isDeleted;

  const hasBody = Boolean(message.body) && !isDeleted;
  const showActions = !isDeleted && !isPending;
  const entityRefs = message.metadata?.entityRefs ?? [];
  const firstRefIsFile = entityRefs[0]?.entityType === "file" && Boolean(entityRefs[0]?.mimeType);
  // Only EntityReferenceCard knows how to blend into a bubble (matching
  // background, flush corners) — FileReferenceAttachment always renders its
  // own independent card, same as a real image/file attachment does
  // elsewhere in this app. So the "merge with the bubble above/around it"
  // treatment only ever applies when the ref(s) involved are non-file — the
  // first ref specifically for firstEntityRefAttached (only it ever merges
  // with preceding text), every ref for entityRefsOnlyBubble (the synthetic
  // bubble wrapper only makes sense if nothing inside it is going to render
  // as its own separately-styled attachment card).
  //
  // Only the first entity ref visually merges with the text bubble above it
  // (EntityReferenceCard's `attached` prop) — flatten the BUBBLE's own bottom
  // corners to match, otherwise the bubble's still-rounded bottom edge meets
  // the chip's now-flat top edge and produces the exact seam this feature
  // exists to remove.
  const firstEntityRefAttached = hasBody && entityRefs.length > 0 && !firstRefIsFile;
  // When a message carries entity refs but no text body, the refs ARE the whole
  // message — wrap them in a bubble-colored container instead of leaving them
  // floating bare, so the message still reads as a chat bubble. Only when
  // EVERY ref is non-file — a single file ref in the mix would sit inside
  // this wrapper as its own visually distinct card, reintroducing a seam.
  const entityRefsOnlyBubble =
    !hasBody &&
    entityRefs.length > 0 &&
    entityRefs.every((r) => !(r.entityType === "file" && r.mimeType));
  // All file-type refs in this message (after the same lead-ref slice the
  // render blocks below apply), rendered together as ONE FileReferenceGroup
  // so multiple images lay out in a grid and share a single carousel —
  // instead of each ref rendering its own independent, full-width card with
  // its own private single-item viewer.
  const fileRefs = entityRefs
    .slice(firstEntityRefAttached ? 1 : 0)
    .filter((ref) => ref.entityType === "file" && Boolean(ref.mimeType));

  // Own membership entry in this conversation — needed to detect role-targeted mentions
  // and to gate the pin action by permission.
  const ownMember = findOwnMember(members, currentUserId);
  const ownRoleId = ownMember?.roleId;
  const mentioned = !isDeleted && isMentioned(message, currentUserId, ownRoleId);
  // Someone replied to one of my messages — surface it with the same
  // left-border treatment a mention gets.
  const repliedToMe = !isDeleted && Boolean(message.reply_to?.senderUserId)
    && message.reply_to.senderUserId === currentUserId;
  const highlightRow = mentioned || repliedToMe;
  const canPin =
    (conversationType === "channel" || conversationType === "group") &&
    roleHasPermission(ownMember, CHAT_PERMISSIONS.MESSAGES_PIN);
  const canReply =
    !isThreadReplyView &&
    (conversationType === "channel" || conversationType === "group") &&
    !message.thread_root_id;
  const onOpenThread = onOpenThreadForMessage ? () => onOpenThreadForMessage(message.id) : undefined;

  if (isOwn) {
    return (
      <div
        data-msg-id={message.id}
        role={selectionMode ? "button" : undefined}
        tabIndex={selectionMode ? 0 : undefined}
        onClick={selectionMode ? onSelect : undefined}
        onKeyDown={selectionMode ? (e) => e.key === "Enter" && onSelect?.() : undefined}
        {...rowGestureProps}
        className={[
          "group/msg relative flex justify-end items-start gap-1 px-3 sm:px-4",
          rowPaddingY,
          isPending ? "opacity-60" : "",
          selectionMode ? "cursor-pointer" : "",
          selectionMode && isSelected ? "bg-[hsl(var(--primary)/0.08)]" : "",
          isCurrentMatch ? "bg-yellow-400/15" : isSearchMatch ? "bg-yellow-400/6" : "",
          highlightRow ? "bg-[hsl(var(--primary)/0.05)] border-l-2 border-[hsl(var(--primary))] pl-2" : "",
        ].join(" ")}
      >
        <SwipeReplyHint translateX={translateX} isOwn />
        {selectionMode ? (
          <SelectionCircle isSelected={isSelected} />
        ) : showActions && (
          <MessageActions
            isOwn
            hasBody={hasBody}
            onCopy={onCopy}
            onDelete={onDelete}
            onHideForMe={onHideForMe}
            onForward={onForward}
            onEnterSelection={onEnterSelection}
            canPin={canPin}
            isPinned={isPinned}
            onPin={onPin}
            onReact={() => setReactionPickerOpen(true)}
            canReply={canReply}
            onOpenThread={onOpenThread}
            onReply={onReply ? () => onReply(message) : undefined}
          />
        )}
        <MessageActionSheet
          open={actionSheet.open}
          onOpenChange={(o) => setActionSheet((s) => ({ ...s, open: o }))}
          anchorPoint={actionSheet.point}
          actionProps={{
            hasBody, isOwn: true, canPin, isPinned, canReply,
            onReply: onReply ? () => onReply(message) : undefined,
            onCopy, onForward, onEnterSelection, onPin, onOpenThread, onDelete, onHideForMe,
          }}
          onQuickReact={(emoji) => onToggleReaction?.(message.id, emoji)}
          onOpenFullPicker={() => setReactionPickerOpen(true)}
        />
        <MessageReactionPicker
          open={reactionPickerOpen}
          onOpenChange={setReactionPickerOpen}
          onPick={(emoji) => onToggleReaction?.(message.id, emoji)}
          anchorAlign="end"
        >
          <div className="flex flex-col items-end max-w-[72%] sm:max-w-[65%]">
            {/* Quote sits INSIDE the text bubble (below) when there's a body,
                tinted to match it; only floats on its own when the reply has
                no text bubble to nest into (attachment-only reply). */}
            {message.reply_to && !hasText && (
              <MessageQuote reply={message.reply_to} variant="inline" context="standalone" onJump={onJumpToMessage} />
            )}
            {/* Text bubble + the one entity ref that visually merges with it
                (when applicable) share a grid wrapper so they resolve to the
                SAME width — a flex column with items-end sizes each child to
                its own shrink-to-fit content width independently, which is
                what made a text bubble and its "attached" ref card render
                with mismatched widths despite matching color/radius. A
                single-column grid's own width tracks its widest child, and
                grid's default justify-items:stretch makes the narrower one
                fill that width instead. When nothing merges (no text, or the
                first ref is a file — those never merge), this wrapper is
                display:contents so it's invisible to layout and the text
                bubble renders exactly as if it were a direct child, same as
                before this existed. */}
            {hasText && (
              <div className={firstEntityRefAttached ? "grid" : "contents"}>
                {hasText && (
                  <div
                    className={[
                      "px-3 py-2 text-sm leading-relaxed",
                      radius,
                      firstEntityRefAttached ? "rounded-b-none!" : "",
                      "bg-(--brand-primary) text-(--brand-primary-foreground)",
                      isDeleted ? "opacity-50 italic" : "",
                    ].join(" ")}
                  >
                    {message.reply_to && !isDeleted && (
                      <MessageQuote reply={message.reply_to} variant="inline" context="onBrand" onJump={onJumpToMessage} />
                    )}
                    {isDeleted ? (
                      <span>Mensaje eliminado</span>
                    ) : (
                      <p className="text-left whitespace-pre-wrap wrap-break-word">
                        <HighlightedText text={message.body} query={searchQuery} />
                      </p>
                    )}
                  </div>
                )}
                {firstEntityRefAttached && (
                  <EntityReferenceCard reference={entityRefs[0]} attached isOwn={true} />
                )}
              </div>
            )}

            {!isDeleted && onOpenThread && message.thread_reply_count > 0 && (
              <button
                type="button"
                onClick={() => onOpenThread?.()}
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] hover:underline"
              >
                <MessageSquare className="h-3 w-3" />
                {message.thread_reply_count} {message.thread_reply_count === 1 ? "respuesta" : "respuestas"}
                {message.thread_last_reply_at && ` · ${formatMessageTime(message.thread_last_reply_at)}`}
              </button>
            )}

            {!isDeleted && attachments.length > 0 && (
              <AttachmentsBlock
                attachments={attachments}
                onOpen={onAttachmentClick}
                isOwn
                messageId={message.id}
                currentUserId={currentUserId}
                onToggleReaction={onToggleReaction}
                onDeleteAttachment={onDeleteAttachment}
                deletingAttachmentId={deletingAttachmentId}
              />
            )}

            {!isDeleted && entityRefs.length > (firstEntityRefAttached ? 1 : 0) && (
              <div
                className={[
                  entityRefsOnlyBubble ? "grid" : "flex flex-col",
                  "gap-1",
                  firstEntityRefAttached ? "mt-1" : (hasText ? "mt-0" : "mt-1"),
                  entityRefsOnlyBubble ? [radius, "overflow-hidden", "bg-(--brand-primary)"].join(" ") : "",
                ].join(" ")}
              >
                {entityRefs.slice(firstEntityRefAttached ? 1 : 0).filter((ref) => !(ref.entityType === "file" && ref.mimeType)).map((ref, idx) => (
                  <EntityReferenceCard
                    key={`${ref.entityType}:${ref.recordId}:${idx}`}
                    reference={ref}
                    attached={entityRefsOnlyBubble}
                    isOwn={true}
                  />
                ))}
                {fileRefs.length > 0 && <FileReferenceGroup references={fileRefs} isOwn={true} onOpen={onAttachmentClick} />}
              </div>
            )}

            {/* Reactions render LAST, below every other message part (text,
                attachments, entity refs) — not wedged between the text
                bubble and whatever follows it, which is what visually "cut"
                a message in two regardless of any bubble-color/radius
                matching. Matches how reactions sit under the whole message
                in WhatsApp/Telegram/Discord, not under just its first part. */}
            {!isDeleted && (
              <MessageReactions
                reactions={message.reactions}
                members={members}
                currentUserId={currentUserId}
                onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
              />
            )}

            {showMeta && (
              <div className="flex items-center gap-1 mt-1 px-0.5">
                {isPinned && (
                  <Pin className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />
                )}
                {message.edited_at && !isPending && (
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">editado</span>
                )}
                <span className="chat-font-mono tabular-nums text-[10px] text-[hsl(var(--muted-foreground))]">
                  {isPending ? "Enviando..." : formatMessageTime(message.created_at)}
                </span>
                {showReadReceipt && !isPending && (
                  <CheckCheck className="h-3 w-3 text-(--brand-primary)" />
                )}
              </div>
            )}
          </div>
        </MessageReactionPicker>
      </div>
    );
  }

  return (
    <div
      data-msg-id={message.id}
      role={selectionMode ? "button" : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onClick={selectionMode ? onSelect : undefined}
      onKeyDown={selectionMode ? (e) => e.key === "Enter" && onSelect?.() : undefined}
      {...rowGestureProps}
      className={[
        "group/msg relative flex items-start gap-1 px-3 sm:px-4",
        rowPaddingY,
        isPending ? "opacity-60" : "",
        selectionMode ? "cursor-pointer" : "",
        selectionMode && isSelected ? "bg-[hsl(var(--primary)/0.08)]" : "",
        isCurrentMatch ? "bg-yellow-400/15" : isSearchMatch ? "bg-yellow-400/6" : "",
        highlightRow ? "bg-[hsl(var(--primary)/0.05)] border-l-2 border-[hsl(var(--primary))] pl-2" : "",
      ].join(" ")}
    >
      <SwipeReplyHint translateX={translateX} isOwn={false} />
      {selectionMode && <SelectionCircle isSelected={isSelected} />}
      <MessageActionSheet
        open={actionSheet.open}
        onOpenChange={(o) => setActionSheet((s) => ({ ...s, open: o }))}
        anchorPoint={actionSheet.point}
        actionProps={{
          hasBody, isOwn: false, canPin, isPinned, canReply,
          onReply: onReply ? () => onReply(message) : undefined,
          onCopy, onForward, onEnterSelection, onPin, onOpenThread, onDelete, onHideForMe,
        }}
        onQuickReact={(emoji) => onToggleReaction?.(message.id, emoji)}
        onOpenFullPicker={() => setReactionPickerOpen(true)}
      />
      {/* Avatar — invisible on non-last to keep column alignment */}
      <div className={["shrink-0", isLast ? "visible" : "invisible"].join(" ")}>
        {message.sender?.avatarUrl && !avatarErr ? (
          <img
            src={message.sender.avatarUrl}
            alt={senderName}
            className="h-7 w-7 rounded-full object-cover"
            onError={() => setAvatarErr(true)}
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] border border-[hsl(var(--border))] flex items-center justify-center text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
            {(senderName?.[0] ?? "U").toUpperCase()}
          </div>
        )}
      </div>

      <MessageReactionPicker
        open={reactionPickerOpen}
        onOpenChange={setReactionPickerOpen}
        onPick={(emoji) => onToggleReaction?.(message.id, emoji)}
        anchorAlign="start"
      >
        <div className="flex flex-col items-start max-w-[72%] sm:max-w-[65%]">
          {isFirst && (
            <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1 ml-1 truncate max-w-full">
              {senderName}
            </span>
          )}

          {message.reply_to && !hasText && (
            <MessageQuote reply={message.reply_to} variant="inline" context="standalone" onJump={onJumpToMessage} />
          )}

          {hasText && (
            <div className={firstEntityRefAttached ? "grid" : "contents"}>
              {hasText && (
                <div
                  className={[
                    "px-3 py-2 text-sm leading-relaxed",
                    radius,
                    firstEntityRefAttached ? "rounded-b-none!" : "",
                    "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
                    isDeleted ? "opacity-50 italic" : "",
                  ].join(" ")}
                >
                  {message.reply_to && !isDeleted && (
                    <MessageQuote reply={message.reply_to} variant="inline" context="onMuted" onJump={onJumpToMessage} />
                  )}
                  {isDeleted ? (
                    <span>Mensaje eliminado</span>
                  ) : (
                    <p className="text-left whitespace-pre-wrap wrap-break-word">
                      <HighlightedText text={message.body} query={searchQuery} />
                    </p>
                  )}
                </div>
              )}
              {firstEntityRefAttached && (
                <EntityReferenceCard reference={entityRefs[0]} attached isOwn={false} />
              )}
            </div>
          )}

          {!isDeleted && onOpenThread && message.thread_reply_count > 0 && (
            <button
              type="button"
              onClick={() => onOpenThread?.()}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] hover:underline"
            >
              <MessageSquare className="h-3 w-3" />
              {message.thread_reply_count} {message.thread_reply_count === 1 ? "respuesta" : "respuestas"}
              {message.thread_last_reply_at && ` · ${formatMessageTime(message.thread_last_reply_at)}`}
            </button>
          )}

          {!isDeleted && attachments.length > 0 && (
            <AttachmentsBlock
              attachments={attachments}
              onOpen={onAttachmentClick}
              isOwn={false}
              messageId={message.id}
              currentUserId={currentUserId}
              onToggleReaction={onToggleReaction}
              onDeleteAttachment={onDeleteAttachment}
              deletingAttachmentId={deletingAttachmentId}
            />
          )}

          {!isDeleted && entityRefs.length > (firstEntityRefAttached ? 1 : 0) && (
            <div
              className={[
                entityRefsOnlyBubble ? "grid" : "flex flex-col",
                "gap-1",
                firstEntityRefAttached ? "mt-1" : (hasText ? "mt-0" : "mt-1"),
                entityRefsOnlyBubble ? [radius, "overflow-hidden", "bg-[hsl(var(--muted))]"].join(" ") : "",
              ].join(" ")}
            >
              {entityRefs.slice(firstEntityRefAttached ? 1 : 0).filter((ref) => !(ref.entityType === "file" && ref.mimeType)).map((ref, idx) => (
                <EntityReferenceCard
                  key={`${ref.entityType}:${ref.recordId}:${idx}`}
                  reference={ref}
                  attached={entityRefsOnlyBubble}
                  isOwn={false}
                />
              ))}
              {fileRefs.length > 0 && <FileReferenceGroup references={fileRefs} isOwn={false} onOpen={onAttachmentClick} />}
            </div>
          )}

          {!isDeleted && (
            <MessageReactions
              reactions={message.reactions}
              members={members}
              currentUserId={currentUserId}
              onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
            />
          )}

          {showMeta && (
            <div className="flex items-center gap-1 mt-1 px-0.5">
              {isPinned && (
                <Pin className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />
              )}
              <span className="chat-font-mono tabular-nums text-[10px] text-[hsl(var(--muted-foreground))]">
                {isPending ? "Enviando..." : formatMessageTime(message.created_at)}
              </span>
              {message.edited_at && !isPending && (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">editado</span>
              )}
            </div>
          )}
        </div>
      </MessageReactionPicker>

      {!selectionMode && showActions && (
        <MessageActions
          isOwn={false}
          hasBody={hasBody}
          onCopy={onCopy}
          onDelete={onDelete}
          onHideForMe={onHideForMe}
          onForward={onForward}
          onEnterSelection={onEnterSelection}
          canPin={canPin}
          isPinned={isPinned}
          onPin={onPin}
          onReact={() => setReactionPickerOpen(true)}
          canReply={canReply}
          onOpenThread={onOpenThread}
          onReply={onReply ? () => onReply(message) : undefined}
        />
      )}
    </div>
  );
}
