import { formatMessageTime, formatFileSize, isImageMime } from "../lib/chatUtils";

function AttachmentCard({ att, onSignedUrl }) {
  if (isImageMime(att.mimeType)) {
    return (
      <button
        type="button"
        onClick={() => onSignedUrl?.(att.id)}
        className="block mt-1 rounded-lg overflow-hidden max-w-[240px]"
      >
        <img
          src={`/api/placeholder/${att.width ?? 240}/${att.height ?? 160}`}
          alt={att.fileName}
          className="w-full object-cover rounded-lg"
          style={{ maxHeight: 200 }}
        />
        <p className="text-xs mt-0.5 opacity-70">{att.fileName}</p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSignedUrl?.(att.id)}
      className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.8)] transition-colors text-left max-w-[240px]"
    >
      <span className="text-lg">📎</span>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{att.fileName}</p>
        <p className="text-xs opacity-70">{formatFileSize(att.sizeBytes)}</p>
      </div>
    </button>
  );
}

export function ChatMessageBubble({ message, isOwn, onAttachmentClick }) {
  if (message.type === "date_separator") {
    return (
      <div className="flex items-center gap-3 my-4 px-4">
        <div className="flex-1 h-px bg-[hsl(var(--border))]" />
        <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium px-2">
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
          {message.body}
        </span>
      </div>
    );
  }

  const isDeleted = Boolean(message.deleted_at);
  const attachments = message.attachments ?? [];
  const senderName =
    message.sender?.displayName ??
    (message.sender_type === "guest" ? "Visitante" : "Usuario");

  return (
    <div
      className={[
        "flex gap-2 px-4 py-1",
        isOwn ? "flex-row-reverse" : "flex-row",
      ].join(" ")}
    >
      {!isOwn && (
        <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-semibold shrink-0 mt-1">
          {senderName?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      <div className={["flex flex-col max-w-[70%]", isOwn ? "items-end" : "items-start"].join(" ")}>
        {!isOwn && (
          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-0.5 ml-1">
            {senderName}
          </span>
        )}

        <div
          className={[
            "px-3 py-2 rounded-2xl text-sm leading-relaxed",
            isOwn
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-tr-sm"
              : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-tl-sm",
            isDeleted ? "opacity-50 italic" : "",
          ].join(" ")}
        >
          {isDeleted ? (
            <span>Mensaje eliminado</span>
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              {attachments.map((att) => (
                <AttachmentCard
                  key={att.id}
                  att={att}
                  onSignedUrl={onAttachmentClick}
                />
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 px-1">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {formatMessageTime(message.created_at)}
          </span>
          {message.edited_at && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">editado</span>
          )}
        </div>
      </div>
    </div>
  );
}
