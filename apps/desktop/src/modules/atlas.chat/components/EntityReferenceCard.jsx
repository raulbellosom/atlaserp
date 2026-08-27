import { useNavigate } from "react-router-dom";
import { User, Paperclip, Landmark, IdCard, ExternalLink } from "lucide-react";

const ICON_BY_TYPE = { contact: User, file: Paperclip, ledger_account: Landmark, hr_employee: IdCard };

export function EntityReferenceCard({ reference }) {
  const navigate = useNavigate();
  const Icon = ICON_BY_TYPE[reference.entityType] ?? ExternalLink;

  return (
    <button
      type="button"
      onClick={() => navigate(reference.url)}
      className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-2.5 py-1.5 text-left hover:bg-[hsl(var(--muted))] transition-colors max-w-full"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <div className="min-w-0">
        <p className="chat-font-display text-xs font-semibold truncate">{reference.title}</p>
        {reference.subtitle && (
          <p className="chat-font-mono text-[10px] text-[hsl(var(--muted-foreground))] truncate">{reference.subtitle}</p>
        )}
      </div>
    </button>
  );
}
