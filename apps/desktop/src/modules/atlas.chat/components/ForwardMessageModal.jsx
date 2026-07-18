import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@atlas/ui";
import { Search, Share2, Check } from "lucide-react";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function getConvAvatar(conv, currentUserId) {
  if (conv.avatar_url) return conv.avatar_url;
  if (conv.type === "direct") {
    return (conv.members ?? []).find((m) => m.userId !== currentUserId)?.avatarUrl ?? null;
  }
  return null;
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function ConvButton({ conv, currentUserId, isSelected, onClick }) {
  const [avatarErr, setAvatarErr] = useState(false);
  const name = getConversationDisplayName(conv, currentUserId);
  const avatarUrl = getConvAvatar(conv, currentUserId);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left",
        isSelected
          ? "bg-[hsl(var(--primary)/0.12)] ring-1 ring-inset ring-[hsl(var(--primary)/0.5)]"
          : "hover:bg-[hsl(var(--muted))]",
      ].join(" ")}
    >
      {/* Avatar with checkmark overlay */}
      <div className="relative shrink-0">
        {avatarUrl && !avatarErr ? (
          <img
            src={avatarUrl}
            alt={name}
            className={[
              "h-11 w-11 rounded-full object-cover transition-opacity",
              isSelected ? "opacity-70" : "",
            ].join(" ")}
            onError={() => setAvatarErr(true)}
          />
        ) : (
          <div
            className={[
              "h-11 w-11 rounded-full flex items-center justify-center font-semibold text-sm transition-opacity",
              isSelected ? "opacity-70" : "",
            ].join(" ")}
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}
          >
            {getInitials(name)}
          </div>
        )}

        {/* Checkmark badge — solid background, always visible */}
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center transition-all duration-150",
            isSelected
              ? "bg-[hsl(var(--primary))] scale-100 opacity-100"
              : "bg-[hsl(var(--border))] scale-75 opacity-0",
          ].join(" ")}
          style={{ boxShadow: "0 0 0 2px hsl(var(--card))" }}
        >
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        </span>
      </div>

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <p className={[
          "text-sm font-medium truncate transition-colors",
          isSelected ? "text-[hsl(var(--primary))]" : "",
        ].join(" ")}>
          {name}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
          {isSelected
            ? "Seleccionado para reenviar"
            : (conv.last_message?.body ?? "Sin mensajes")}
        </p>
      </div>
    </button>
  );
}

export function ForwardMessageModal({ open, onClose, message, conversations }) {
  const { userProfile, session } = useAuth();
  const queryClient = useQueryClient();
  const token = session?.access_token;

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSending, setIsSending] = useState(false);

  const filtered = (conversations ?? []).filter((c) => {
    if (!search.trim()) return true;
    const name = getConversationDisplayName(c, userProfile?.id);
    return name.toLowerCase().includes(search.toLowerCase());
  });

  function toggleConv(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClose() {
    if (isSending) return;
    setSelectedIds(new Set());
    setSearch("");
    onClose();
  }

  const handleForward = useCallback(async () => {
    if (!message?.body || !selectedIds.size || isSending) return;

    // Sort selected conversations by their position in the list to preserve chronology
    const orderedIds = (conversations ?? [])
      .filter((c) => selectedIds.has(c.id))
      .map((c) => c.id);

    setIsSending(true);
    try {
      for (const convId of orderedIds) {
        await atlas.chat.sendMessage(
          convId,
          { body: message.body, messageType: "text", attachmentIds: [] },
          token,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      handleClose();
    } catch (err) {
      console.error("[forward] failed to send", err);
    } finally {
      setIsSending(false);
    }
  }, [message, selectedIds, isSending, conversations, token, queryClient]);

  const canForward = Boolean(message?.body);
  const count = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 shrink-0" />
            Reenviar mensaje
          </DialogTitle>
        </DialogHeader>

        {!canForward ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">
            Solo se pueden reenviar mensajes con texto.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Message preview */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1.5">
                Mensaje a reenviar
              </p>
              <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed line-clamp-3 whitespace-pre-wrap wrap-break-word">
                {message.body}
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar conversacion..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[hsl(var(--muted))] rounded-xl border border-[hsl(var(--border))] outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.35)] transition-shadow"
              />
            </div>

            {/* Hint when multiple can be selected */}
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-1">
              Puedes seleccionar varias conversaciones.{count > 0 ? ` ${count} seleccionada${count !== 1 ? "s" : ""}.` : ""}
            </p>

            {/* Conversation list */}
            <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
              <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
                {filtered.map((conv) => (
                  <ConvButton
                    key={conv.id}
                    conv={conv}
                    currentUserId={userProfile?.id}
                    isSelected={selectedIds.has(conv.id)}
                    onClick={() => toggleConv(conv.id)}
                  />
                ))}
                {!filtered.length && (
                  <div className="py-10 text-center">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      No se encontraron conversaciones.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="sm:min-w-24" onClick={handleClose} disabled={isSending}>
                Cancelar
              </Button>
              <Button
                className="sm:min-w-36"
                onClick={handleForward}
                disabled={count === 0 || isSending}
              >
                {isSending
                  ? "Enviando..."
                  : count > 1
                    ? `Reenviar a ${count} chats`
                    : "Reenviar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
