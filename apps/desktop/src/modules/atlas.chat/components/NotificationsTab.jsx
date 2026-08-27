// apps/desktop/src/modules/atlas.chat/components/NotificationsTab.jsx
import { CheckboxField } from "@atlas/ui";
import { toast } from "sonner";
import { useMuteConversation } from "../hooks/useChatModeration";

// Mutes only the realtime new-message toast (RealtimeProvider.jsx) — unread
// counts/badges are unaffected, matching WhatsApp (spec Non-goal 3).
export function NotificationsTab({ conversationId, isMuted }) {
  const { mutate: muteMutate, isPending } = useMuteConversation();

  function handleToggle(e) {
    muteMutate(
      { conversationId, muted: e.target.checked },
      {
        onError: () => toast.error("No se pudo actualizar la configuracion de notificaciones."),
      },
    );
  }

  return (
    <div className="p-4 space-y-2">
      <CheckboxField
        label="Silenciar conversacion"
        checked={Boolean(isMuted)}
        onChange={handleToggle}
        disabled={isPending}
      />
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        No recibiras notificaciones emergentes de mensajes nuevos en esta conversacion.
      </p>
    </div>
  );
}
