// apps/desktop/src/modules/atlas.chat/components/MessageReactionsModal.jsx
// Opened from a reaction pill (MessageReactions.jsx) — shows every reaction
// on a message, grouped by emoji, with each reactor's name/avatar resolved
// from the conversation's `members` list. The current user's own row in any
// group gets a "Quitar" button that calls `onRemoveOwn(emoji)`, which the
// caller wires to the same toggle-reaction mutation that already exists
// (toggling an existing reaction removes it — no new backend call).
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@atlas/ui";
import { X } from "lucide-react";

function ReactorRow({ userId, member, isOwn, onRemove }) {
  const [avatarErr, setAvatarErr] = useState(false);
  const displayName = member?.displayName ?? "Usuario";

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {member?.avatarUrl && !avatarErr ? (
        <img
          src={member.avatarUrl}
          alt={displayName}
          className="h-7 w-7 rounded-full object-cover shrink-0"
          onError={() => setAvatarErr(true)}
        />
      ) : (
        <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-[11px] font-semibold text-[hsl(var(--muted-foreground))] shrink-0">
          {displayName[0]?.toUpperCase() ?? "U"}
        </div>
      )}
      <p className="flex-1 min-w-0 text-sm truncate">{isOwn ? "Tu" : displayName}</p>
      {isOwn && (
        <button
          type="button"
          onClick={onRemove}
          title="Quitar mi reaccion"
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function MessageReactionsModal({ open, onOpenChange, reactions, members, currentUserId, onRemoveOwn }) {
  if (!reactions?.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reacciones</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto -mx-1 px-1">
          {reactions.map(({ emoji, userIds }, i) => (
            <div key={emoji} className={i > 0 ? "mt-3 pt-3 border-t border-[hsl(var(--border))]" : ""}>
              <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1">
                {emoji} <span className="tabular-nums">{userIds?.length ?? 0}</span>
              </p>
              {(userIds ?? []).map((userId) => (
                <ReactorRow
                  key={userId}
                  userId={userId}
                  member={members?.find((m) => m.userId === userId)}
                  isOwn={userId === currentUserId}
                  onRemove={() => onRemoveOwn(emoji)}
                />
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
