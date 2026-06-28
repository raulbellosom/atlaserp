import { useState } from "react";
import { Button, EmptyState, Skeleton } from "@atlas/ui";
import { Plus, Search } from "lucide-react";
import { ChatConversationItem } from "./ChatConversationItem";
import { CreateChatModal } from "./CreateChatModal";
import { useAuth } from "../../../auth/AuthProvider";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";

export function ChatSidebar({ conversations, isLoading, activeId, onSelect, onCreated }) {
  const { userProfile } = useAuth();
  const { isUserOnline } = useGlobalPresence();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = (conversations ?? []).filter((c) => {
    if (!search.trim()) return true;
    const displayName =
      c.title ??
      (c.members ?? []).find((m) => m.userId !== userProfile?.id)?.displayName ??
      "";
    return displayName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <aside className="flex flex-col w-full h-full border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
        <h2 className="text-sm font-semibold">Chat</h2>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setShowCreate(true)}
          title="Nueva conversacion"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[hsl(var(--border))] shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Buscar conversaciones..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[hsl(var(--muted))] rounded-lg outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {isLoading && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-48" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !filtered.length && (
          <EmptyState
            className="py-8"
            title="Sin conversaciones"
            description={
              search
                ? "No se encontraron resultados."
                : "Inicia un nuevo chat con el botón +"
            }
          />
        )}

        {filtered.map((conv) => {
          const otherMember = conv.type === "direct"
            ? (conv.members ?? []).find((m) => m.userId !== userProfile?.id)
            : null;
          return (
            <ChatConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onClick={() => onSelect(conv)}
              currentUserId={userProfile?.id}
              isOnline={otherMember ? isUserOnline(otherMember.userId) : false}
            />
          );
        })}
      </div>

      <CreateChatModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(conv) => {
          setShowCreate(false);
          onCreated?.(conv);
        }}
      />
    </aside>
  );
}
