// apps/desktop/src/modules/atlas.chat/components/GroupsInCommonTab.jsx
import { useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@atlas/ui";
import { Users } from "lucide-react";
import { useGroupsInCommon } from "../hooks/useChatModeration";
import { getConversationTitleLabel } from "../lib/chatUtils";

// Direct-conversation-only (spec Section 8) — group/channel conversations
// where both the caller and the other member are active members.
export function GroupsInCommonTab({ otherUserId }) {
  const navigate = useNavigate();
  const { data, isLoading } = useGroupsInCommon(otherUserId);
  const groups = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <EmptyState
        className="flex-1 min-h-0"
        icon={Users}
        title="Sin grupos en comun"
        description="No comparten grupos en comun."
      />
    );
  }

  return (
    <div className="p-2 space-y-0.5">
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => navigate(`/app/m/atlas.chat/chat/inbox/${g.id}`)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[hsl(var(--muted))] text-left transition-colors"
        >
          <div className="h-9 w-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
               style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}>
            {g.avatarEmoji ?? (g.title?.[0]?.toUpperCase() ?? "?")}
          </div>
          <p className="text-sm font-medium truncate">{getConversationTitleLabel(g, null)}</p>
        </button>
      ))}
    </div>
  );
}
