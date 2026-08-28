import { X, Image, Video, Mic, FileText, Link2, CornerUpLeft } from "lucide-react";

const KIND_LABEL = {
  image: "Foto",
  video: "Video",
  audio: "Nota de voz",
  file: "Archivo",
  entity: "Referencia",
};
const KIND_ICON = { image: Image, video: Video, audio: Mic, file: FileText, entity: Link2 };

// The quoted-message chip. `variant="inline"` renders inside a bubble above the
// body (tap jumps to the original). `variant="compose"` renders above the
// composer with a cancel button. `reply` is the API preview object:
// { id, senderUserId, senderName, bodyPreview, kind, isDeleted }.
export function MessageQuote({ reply, variant = "inline", isOwn = false, onJump, onCancel }) {
  if (!reply) return null;

  const accent = isOwn ? "rgba(255,255,255,0.65)" : "var(--brand-primary)";
  const Icon = KIND_ICON[reply.kind];
  const label = reply.isDeleted
    ? "Mensaje eliminado"
    : reply.bodyPreview || KIND_LABEL[reply.kind] || "Mensaje";

  const body = (
    <div
      className={[
        "flex flex-col gap-0.5 pl-2 pr-2 py-1 rounded-md min-w-0 text-left",
        isOwn ? "bg-white/10" : "bg-black/5",
      ].join(" ")}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span className="text-[11px] font-semibold truncate" style={{ color: accent }}>
        {reply.senderName}
      </span>
      <span
        className={[
          "text-xs truncate flex items-center gap-1",
          reply.isDeleted ? "italic opacity-60" : "opacity-80",
        ].join(" ")}
      >
        {Icon && !reply.bodyPreview && !reply.isDeleted && <Icon className="h-3 w-3 shrink-0" />}
        {label}
      </span>
    </div>
  );

  if (variant === "compose") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(var(--border))]">
        <CornerUpLeft className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <div className="min-w-0 flex-1">{body}</div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar respuesta"
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={reply.isDeleted ? undefined : () => onJump?.(reply.id)}
      className={[
        "w-full mb-1 block",
        reply.isDeleted ? "cursor-default" : "cursor-pointer hover:opacity-90",
      ].join(" ")}
    >
      {body}
    </button>
  );
}
