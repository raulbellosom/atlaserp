import { useState, useEffect, useRef } from "react";
import { PageHeader, Button, EmptyState, Skeleton, Badge } from "@atlas/ui";
import { MessageSquare } from "lucide-react";
import { ChatMessageList } from "../components/ChatMessageList";
import { MessageComposer } from "../components/MessageComposer";
import { useExternalInbox, useExternalMessages, useSendExternalMessage } from "../hooks/useExternalInbox";
import { subscribeToMessages } from "../lib/supabaseRealtime";
import { useQueryClient } from "@tanstack/react-query";
import { formatMessageTime } from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

const STATUS_OPTIONS = [
  { value: "open", label: "Abiertos" },
  { value: "pending", label: "Pendientes" },
  { value: "closed", label: "Cerrados" },
];

function ExternalConversationItem({ conv, isActive, onClick }) {
  const statusColor = conv.status === "closed" ? "secondary" : conv.status === "pending" ? "warning" : "success";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
        isActive
          ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
          : "hover:bg-[hsl(var(--muted))]",
      ].join(" ")}
    >
      <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center shrink-0">
        <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">
            {conv.guest_name ?? conv.guest_email ?? "Visitante"}
          </p>
          <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
            {conv.last_message?.createdAt ? formatMessageTime(conv.last_message.createdAt) : ""}
          </span>
        </div>
        {conv.guest_page_url && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
            {conv.guest_page_url}
          </p>
        )}
        {conv.last_message?.body && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
            {conv.last_message.body}
          </p>
        )}
      </div>
    </button>
  );
}

function ExternalChatPane({ conversation }) {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const unsubRef = useRef(null);

  const { data: messagesData, isLoading } = useExternalMessages(conversation?.id);
  const { mutateAsync: sendMsg } = useSendExternalMessage(conversation?.id);

  useEffect(() => {
    if (!conversation?.id) return;
    unsubRef.current = subscribeToMessages(conversation.id, () => {
      queryClient.invalidateQueries({ queryKey: ["chat-external-messages", conversation.id] });
    });
    return () => unsubRef.current?.();
  }, [conversation?.id, queryClient]);

  async function handleClose() {
    if (!conversation?.id) return;
    await atlas.chat.closeExternal(conversation.id, token);
    queryClient.invalidateQueries({ queryKey: ["chat-external-inbox"] });
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
        <div className="text-center space-y-2">
          <MessageSquare className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm">Selecciona una conversacion</p>
        </div>
      </div>
    );
  }

  const guestName = conversation.guest_name ?? conversation.guest_email ?? "Visitante";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{guestName}</p>
          {conversation.guest_page_url && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              {conversation.guest_page_url}
            </p>
          )}
        </div>
        <Badge variant={conversation.status === "closed" ? "secondary" : "default"}>
          {conversation.status}
        </Badge>
        {conversation.status !== "closed" && (
          <Button size="sm" variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
        )}
      </div>

      <ChatMessageList
        messages={messagesData?.data ?? []}
        isLoading={isLoading}
        currentUserId={userProfile?.id}
        typingUsers={[]}
      />

      {conversation.status !== "closed" && (
        <MessageComposer
          onSend={(data) => sendMsg(data)}
          placeholder="Responder al visitante..."
        />
      )}
    </div>
  );
}

export function ExternalInboxScreen() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [selected, setSelected] = useState(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const { session, userProfile } = useAuth();
  const token = session?.access_token;

  // Sync availability from user profile once it loads from the server
  useEffect(() => {
    if (typeof userProfile?.availableForChat === "boolean") {
      setIsAvailable(userProfile.availableForChat);
    }
  }, [userProfile?.availableForChat]);

  const { data, isLoading } = useExternalInbox(statusFilter);
  const conversations = data?.data ?? [];

  async function handleToggleAvailability() {
    if (!token) return;
    setTogglingAvailability(true);
    try {
      const next = !isAvailable;
      await atlas.chat.toggleAvailability(next, token);
      setIsAvailable(next);
    } catch {
      // non-fatal — UI stays unchanged if request fails
    } finally {
      setTogglingAvailability(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)]">
      <div className="shrink-0 px-4 pt-4 pb-0 flex items-start justify-between gap-4">
        <PageHeader title="Bandeja externa" description="Conversaciones de soporte en vivo" />
        <button
          type="button"
          onClick={handleToggleAvailability}
          disabled={togglingAvailability}
          className={[
            "mt-1 shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
            isAvailable
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              : "bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.8)]",
          ].join(" ")}
          title={isAvailable ? "Estás disponible para chat — clic para desactivar" : "No disponible para chat — clic para activar"}
        >
          <span className={["w-2 h-2 rounded-full", isAvailable ? "bg-emerald-400" : "bg-[hsl(var(--muted-foreground))]"].join(" ")} />
          {isAvailable ? "Disponible" : "No disponible"}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 mt-4 border-t border-[hsl(var(--border))]">
        {/* Sidebar */}
        <aside className="flex flex-col w-72 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
          {/* Status tabs */}
          <div className="flex border-b border-[hsl(var(--border))] shrink-0">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={[
                  "flex-1 py-2.5 text-xs font-medium transition-colors",
                  statusFilter === opt.value
                    ? "text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {isLoading && (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && !conversations.length && (
              <EmptyState
                className="py-8"
                title="Sin conversaciones"
                description={`No hay conversaciones ${statusFilter === "open" ? "abiertas" : statusFilter === "pending" ? "pendientes" : "cerradas"}.`}
              />
            )}
            {conversations.map((conv) => (
              <ExternalConversationItem
                key={conv.id}
                conv={conv}
                isActive={selected?.id === conv.id}
                onClick={() => setSelected(conv)}
              />
            ))}
          </div>
        </aside>

        {/* Main pane */}
        <ExternalChatPane conversation={selected} />
      </div>
    </div>
  );
}
