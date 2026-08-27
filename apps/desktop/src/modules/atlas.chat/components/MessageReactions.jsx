// apps/desktop/src/modules/atlas.chat/components/MessageReactions.jsx
// Renders the pill row under a message bubble. `reactions` is the message's
// own `reactions` field from the API — `{ emoji, userIds }[]` or null/undefined
// for a message with none (already aggregated server-side, backend phase).
//
// Clicking a pill no longer toggles the reaction instantly — it opens
// MessageReactionsModal, which shows every reactor (grouped by emoji) and
// lets the current user remove their own reaction from there. This trades
// one click for two on the toggle-off path, deliberately, so "who reacted"
// is discoverable instead of hidden behind a raw count.
import { useState } from "react";
import { MessageReactionsModal } from "./MessageReactionsModal";

export function MessageReactions({ reactions, members, currentUserId, onToggle }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!reactions?.length) return null;

  return (
    <>
      <div className="flex flex-wrap gap-1 mt-1">
        {reactions.map(({ emoji, userIds }) => {
          const mine = currentUserId && userIds?.includes(currentUserId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => setModalOpen(true)}
              className={[
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                mine
                  ? "bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "bg-[hsl(var(--muted))] border-transparent hover:border-[hsl(var(--border))]",
              ].join(" ")}
            >
              <span>{emoji}</span>
              <span className="tabular-nums">{userIds?.length ?? 0}</span>
            </button>
          );
        })}
      </div>
      <MessageReactionsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        reactions={reactions}
        members={members}
        currentUserId={currentUserId}
        onRemoveOwn={onToggle}
      />
    </>
  );
}
