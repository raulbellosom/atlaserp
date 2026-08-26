import { Hash, Users } from "lucide-react";

// Small corner badge signaling conversation type — rendered by each of the
// 3 places a conversation avatar shows (ChatConversationItem, ChatWindow,
// FloatingChatHub). Renders nothing for "direct" (a 1:1 chat's identity is
// the other person's own photo, which is signal enough) and for unknown
// types (defensive — a badge for a type we don't recognize would be
// misleading, not helpful).
export function ConversationTypeBadge({ type, className = "" }) {
  if (type === "channel") {
    return (
      <span className={`absolute bottom-0 right-0 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] ring-2 ring-[hsl(var(--background))] ${className}`}>
        <Hash className="h-2 w-2" />
      </span>
    );
  }
  if (type === "group") {
    return (
      <span className={`absolute bottom-0 right-0 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[hsl(var(--muted-foreground))] text-[hsl(var(--background))] ring-2 ring-[hsl(var(--background))] ${className}`}>
        <Users className="h-2 w-2" />
      </span>
    );
  }
  return null;
}
