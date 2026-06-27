import { formatMessageTime } from "../lib/chatUtils";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ name, avatarUrl, size = "md", online = false }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClass} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-[hsl(var(--muted))] flex items-center justify-center font-semibold text-[hsl(var(--muted-foreground))]`}
        >
          {getInitials(name)}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[hsl(var(--background))]" />
      )}
    </div>
  );
}

export function ChatConversationItem({ conversation, isActive, onClick, currentUserId, isOnline = false }) {
  const otherMember = conversation.type === "direct"
    ? (conversation.members ?? []).find((m) => m.userId !== currentUserId)
    : null;

  const displayName =
    conversation.title ??
    otherMember?.displayName ??
    (conversation.type === "group" ? "Grupo" : "Conversacion directa");

  const avatarUrl = conversation.avatar_url ?? otherMember?.avatarUrl ?? null;
  const lastMsg = conversation.last_message;
  const unread = conversation.unread_count ?? 0;

  let lastMsgPreview = "";
  if (lastMsg) {
    if (lastMsg.messageType === "system") {
      lastMsgPreview = lastMsg.body;
    } else if (lastMsg.messageType === "image") {
      lastMsgPreview = "Imagen";
    } else if (lastMsg.messageType === "file") {
      lastMsgPreview = "Archivo adjunto";
    } else {
      lastMsgPreview = lastMsg.body ?? "";
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
        isActive
          ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
          : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
      ].join(" ")}
    >
      <Avatar name={displayName} avatarUrl={avatarUrl} online={isOnline} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {lastMsg?.createdAt && (
            <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
              {formatMessageTime(lastMsg.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
            {lastMsgPreview || "Sin mensajes"}
          </p>
          {unread > 0 && (
            <span className="inline-flex items-center justify-center h-4.5 min-w-[1.125rem] px-1 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[10px] font-semibold shrink-0">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
