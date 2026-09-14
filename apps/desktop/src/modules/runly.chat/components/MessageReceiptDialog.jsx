// apps/desktop/src/modules/runly.chat/components/MessageReceiptDialog.jsx
//
// "Info del mensaje": Enviado + Visto por, opened from the message action menu
// (own messages only — see messageActions.jsx). Backed by GET
// /chat/messages/:id/receipt, which reuses the existing per-member
// last_read_at watermark (chat_conversation_members.last_read_at) as the
// "visto" timestamp — there is no separate delivery/receipt tracking in this
// system, so this panel never fabricates an "Entregado" state it can't back
// with real data (see chat-conversation-reads-service.js's getMessageReceipt).
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Skeleton, ErrorState } from "@runly/ui";
import { Check, CheckCheck } from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { runly } from "../../../lib/atlas";
import { AvatarCircle } from "./AvatarCircle";

function formatFull(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SeenRow({ member }) {
  const seen = Boolean(member.seenAt);
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <AvatarCircle size="sm" name={member.displayName ?? "Usuario"} avatarUrl={member.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{member.displayName ?? "Usuario"}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {seen ? `Visto ${formatFull(member.seenAt)}` : "Aun no visto"}
        </p>
      </div>
      {seen ? (
        <CheckCheck className="h-4 w-4 text-(--brand-primary) shrink-0" />
      ) : (
        <Check className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
      )}
    </div>
  );
}

// `message` needs only `.id` and `.created_at` — pass the full message object
// from ChatMessageBubble/ChatMessageList.
export function MessageReceiptDialog({ open, onOpenChange, message }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const messageId = message?.id ?? null;

  const { data, isError } = useQuery({
    queryKey: ["chat-message-receipt", messageId],
    queryFn: () => runly.chat.getMessageReceipt(messageId, token),
    enabled: open && Boolean(token) && Boolean(messageId),
    staleTime: 10_000,
  });

  // NOT query.isLoading — that's `isPending && isFetching`, which reads FALSE
  // while the query is disabled (e.g. `token` momentarily unset during an auth
  // refresh right as the dialog opens). Gating on that would flash the "sin
  // miembros" empty state instead of a skeleton for a message that hasn't
  // actually been fetched yet — the same disabled-query pitfall
  // useChatMessageSearch.js's `isSearching: active && query.isFetching` guards
  // against. Show the skeleton for as long as there's neither data nor an
  // error, independent of whether react-query itself considers a fetch to be
  // in flight.
  const isLoading = !data && !isError;
  const seenBy = data?.seenBy ?? [];
  const seenCount = seenBy.filter((m) => m.seenAt).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
          <DialogTitle>Info del mensaje</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-2.5">
            <Check className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
            <div>
              <p className="text-sm font-medium">Enviado</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {formatFull(data?.createdAt ?? message?.created_at)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
              {isLoading ? "Visto por" : `Visto por (${seenCount}/${seenBy.length})`}
            </p>

            {isError && (
              <ErrorState
                className="py-4"
                title="No se pudo cargar"
                description="Intenta de nuevo."
              />
            )}

            {isLoading && !isError && (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1">
                    <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !isError && seenBy.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] py-2">
                No hay mas miembros en esta conversacion.
              </p>
            )}

            {!isLoading &&
              !isError &&
              seenBy.map((m) => <SeenRow key={m.userId} member={m} />)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
