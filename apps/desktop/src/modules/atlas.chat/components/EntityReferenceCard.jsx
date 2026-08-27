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
