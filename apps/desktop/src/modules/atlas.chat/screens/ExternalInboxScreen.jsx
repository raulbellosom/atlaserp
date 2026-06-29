import { useState, useEffect, useRef, useCallback } from "react";
import { PageHeader, Button, EmptyState, Skeleton, Badge } from "@atlas/ui";
import { MessageSquare, Search, ExternalLink, Clock, UserCheck } from "lucide-react";
import { ChatMessageList } from "../components/ChatMessageList";
import { MessageComposer } from "../components/MessageComposer";
import { ChatTemplatePopover } from "../components/ChatTemplatePopover";
import { useExternalInbox, useExternalMessages, useSendExternalMessage } from "../hooks/useExternalInbox";
import { subscribeToBroadcast } from "../lib/supabaseRealtime";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

function formatRelative(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "ayer";
  if (diffD < 7) return d.toLocaleDateString("es-MX", { weekday: "short" });
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function formatExact(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch { /* non-fatal */ }
}

// ------------------------------------------------------------------
// Conversation list item
// ------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "open", label: "Abiertos" },
  { value: "pending", label: "Pendientes" },
  { value: "closed", label: "Cerrados" },
];

function ExternalConversationItem({ conv, isActive, onClick }) {
  const name = conv.guest_name ?? conv.guest_email ?? "Visitante";
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
      <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center shrink-0 text-sm font-semibold text-violet-600 dark:text-violet-300 uppercase">
        {name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{name}</p>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 tabular-nums">
            {formatRelative(conv.last_message?.createdAt ?? conv.created_at)}
          </span>
        </div>
        {conv.guest_page_url && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
            {conv.guest_page_url.replace(/^https?:\/\//, "")}
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

// ------------------------------------------------------------------
// Visitor info panel (right column)
// ------------------------------------------------------------------

function VisitorInfoPanel({ conversation }) {
  if (!conversation) return null;
  const name = conversation.guest_name ?? conversation.guest_email ?? "Visitante";
  const email = conversation.guest_email;
  const pageUrl = conversation.guest_page_url;
  const createdAt = conversation.created_at;

  return (
    <aside className="w-64 shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] flex flex-col overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Guest identity */}
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-medium mb-2">Visitante</p>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-sm font-semibold text-violet-600 dark:text-violet-300 uppercase shrink-0">
              {name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{name}</p>
              {email && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{email}</p>}
            </div>
          </div>
        </div>

        {/* Source URL */}
        {pageUrl && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-medium mb-1">Pagina de origen</p>
            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{pageUrl.replace(/^https?:\/\//, "")}</span>
            </a>
          </div>
        )}

        {/* Session start */}
        {createdAt && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-medium mb-1">Inicio de sesion</p>
            <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{formatExact(createdAt)}</span>
            </div>
          </div>
        )}

        {/* Status */}
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-medium mb-1">Estado</p>
          <Badge variant={conversation.status === "closed" ? "secondary" : conversation.status === "pending" ? "warning" : "success"}>
            {conversation.status === "open" ? "Abierta" : conversation.status === "pending" ? "Pendiente" : "Cerrada"}
          </Badge>
        </div>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------
// Chat pane (center column)
// ------------------------------------------------------------------

function ExternalChatPane({ conversation }) {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const composerRef = useRef(null);
  const unsubRef = useRef(null);
  const prevCountRef = useRef(0);

  const { data: messagesData, isLoading } = useExternalMessages(conversation?.id);
  const { mutateAsync: sendMsg } = useSendExternalMessage(conversation?.id);

  // Sound notification when new guest message arrives (tab not focused)
  useEffect(() => {
    if (!conversation?.id) return;
    unsubRef.current = subscribeToBroadcast(
      `chat:conv:${conversation.id}`,
      "new_guest_message",
      () => {
        if (document.visibilityState === "hidden") playNotificationBeep();
      },
    );
    return () => unsubRef.current?.();
  }, [conversation?.id]);

  // Track message count to play sound when inbox is in background
  useEffect(() => {
    const count = messagesData?.data?.length ?? 0;
    if (count > prevCountRef.current && prevCountRef.current > 0 && document.visibilityState === "hidden") {
      playNotificationBeep();
    }
    prevCountRef.current = count;
  }, [messagesData?.data?.length]);

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
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3 shrink-0">
        <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-semibold text-violet-600 dark:text-violet-300 uppercase shrink-0">
          {guestName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{guestName}</p>
          {conversation.guest_page_url && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              {conversation.guest_page_url.replace(/^https?:\/\//, "")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={conversation.status === "closed" ? "secondary" : conversation.status === "pending" ? "warning" : "success"}>
            {conversation.status}
          </Badge>
          {conversation.status !== "closed" && (
            <Button size="sm" variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      <ChatMessageList
        messages={messagesData?.data ?? []}
        isLoading={isLoading}
        currentUserId={userProfile?.id}
        typingUsers={[]}
      />

      {conversation.status !== "closed" && (
        <div className="shrink-0">
          {/* Template button row above composer */}
          <div className="flex items-center gap-2 px-3 pt-2">
            <ChatTemplatePopover onSelect={(body) => composerRef.current?.setBody?.(body)} />
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Plantillas</span>
          </div>
          <MessageComposer
            ref={composerRef}
            onSend={(data) => sendMsg(data)}
            placeholder="Responder al visitante..."
            conversationId={conversation.id}
          />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Main screen
// ------------------------------------------------------------------

export function ExternalInboxScreen() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const { session, userProfile } = useAuth();
  const token = session?.access_token;

  useEffect(() => {
    if (typeof userProfile?.availableForChat === "boolean") {
      setIsAvailable(userProfile.availableForChat);
    }
  }, [userProfile?.availableForChat]);

  const { data, isLoading } = useExternalInbox(statusFilter);
  const conversations = data?.data ?? [];

  const filtered = search
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        return (
          (c.guest_name ?? "").toLowerCase().includes(q) ||
          (c.guest_email ?? "").toLowerCase().includes(q) ||
          (c.guest_page_url ?? "").toLowerCase().includes(q)
        );
      })
    : conversations;

  async function handleToggleAvailability() {
    if (!token) return;
    setTogglingAvailability(true);
    try {
      const next = !isAvailable;
      await atlas.chat.toggleAvailability(next, token);
      setIsAvailable(next);
    } catch { /* non-fatal */ }
    finally { setTogglingAvailability(false); }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-4 pt-4 pb-3 flex items-start justify-between gap-4 border-b border-[hsl(var(--border))]">
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
          title={isAvailable ? "Disponible — clic para desactivar" : "No disponible — clic para activar"}
        >
          <span className={["w-2 h-2 rounded-full", isAvailable ? "bg-emerald-400" : "bg-[hsl(var(--muted-foreground))]"].join(" ")} />
          {isAvailable ? "Disponible" : "No disponible"}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: conversation list */}
        <aside className="flex flex-col w-72 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
          {/* Search */}
          <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 bg-[hsl(var(--muted))] rounded-lg px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex border-b border-[hsl(var(--border))] shrink-0">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={[
                  "flex-1 py-2 text-xs font-medium transition-colors",
                  statusFilter === opt.value
                    ? "text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
              </div>
            ))}
            {!isLoading && filtered.length === 0 && (
              <EmptyState
                className="py-8"
                title="Sin conversaciones"
                description={search ? "Sin resultados para tu busqueda." : `No hay conversaciones ${statusFilter === "open" ? "abiertas" : statusFilter === "pending" ? "pendientes" : "cerradas"}.`}
              />
            )}
            {filtered.map((conv) => (
              <ExternalConversationItem
                key={conv.id}
                conv={conv}
                isActive={selected?.id === conv.id}
                onClick={() => setSelected(conv)}
              />
            ))}
          </div>
        </aside>

        {/* Center: chat pane */}
        <ExternalChatPane conversation={selected} />

        {/* Right: visitor info */}
        <VisitorInfoPanel conversation={selected} />
      </div>
    </div>
  );
}
