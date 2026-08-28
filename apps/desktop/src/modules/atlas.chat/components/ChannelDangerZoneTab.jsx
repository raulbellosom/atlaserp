// apps/desktop/src/modules/atlas.chat/components/ChannelDangerZoneTab.jsx
import { useState } from "react";
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Input, Label,
} from "@atlas/ui";
import { Trash2 } from "lucide-react";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { useDeleteConversation } from "../hooks/useCreateConversation";

// Bottom-of-tab "Zona de peligro" for a channel/group's Informacion tab —
// rendering (and the channel.manage gate) is the caller's job, same
// convention as ChannelRolesTab (ConversationProfilePanel only mounts this
// when canManageChannel is true). Deletion requires typing the exact
// conversation title, not just a click-through confirm — this is the only
// irreversible, delete-everything-for-everyone action in the whole chat
// module, so it gets a stronger safeguard than ConfirmDialog's single button.
export function ChannelDangerZoneTab({ conversationId, onDeleted }) {
  const { data: convData } = useChatConversationDetail(conversationId);
  const conversation = convData?.data;
  const isChannel = conversation?.type === "channel";
  const expectedName = (conversation?.title ?? "").trim();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { mutateAsync: deleteConversationMutate, isPending: isDeleting } = useDeleteConversation(conversationId);

  const canConfirm = expectedName.length > 0 && confirmText.trim() === expectedName;

  function handleOpenChange(next) {
    setOpen(next);
    if (!next) setConfirmText("");
  }

  async function handleDelete() {
    if (!canConfirm) return;
    try {
      await deleteConversationMutate();
      handleOpenChange(false);
      onDeleted?.();
    } catch {
      // useDeleteConversation's own onError already toasted the failure
    }
  }

  return (
    <div className="px-4 pb-4">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full justify-center text-red-500 border-red-500/40 hover:bg-red-500/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5 mr-2" />
        Eliminar {isChannel ? "canal" : "grupo"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar {isChannel ? "canal" : "grupo"}</DialogTitle>
            <DialogDescription>
              Esta accion es irreversible: {expectedName || "esta conversacion"} y todos sus mensajes dejaran de
              estar disponibles para todos los miembros.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="danger-zone-confirm-name">
              Escribe <span className="font-semibold">{expectedName}</span> para confirmar
            </Label>
            <Input
              id="danger-zone-confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedName}
              autoComplete="off"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!canConfirm || isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
