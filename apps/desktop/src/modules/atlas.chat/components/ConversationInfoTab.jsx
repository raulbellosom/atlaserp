// apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx
import { useState } from "react";
import {
  Button, ConfirmDialog, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  SelectField, TextareaField, CheckboxField,
} from "@atlas/ui";
import { Ban, Flag } from "lucide-react";
import { toast } from "sonner";
import { useBlockStatus, useBlockUser, useUnblockUser, useCreateReport } from "../hooks/useChatModeration";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Acoso o abuso" },
  { value: "inappropriate", label: "Contenido inapropiado" },
  { value: "other", label: "Otro" },
];

// Direct-conversation-only (spec Non-goal 7 — block/report never apply
// inside groups/channels). otherUserId is the contact's user_profile id.
export function ConversationInfoTab({ conversationId, otherUserId, otherDisplayName }) {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);

  const { data: blockStatus } = useBlockStatus(otherUserId);
  const blockedByMe = blockStatus?.data?.blockedByMe ?? false;

  const { mutate: blockMutate, isPending: blocking } = useBlockUser();
  const { mutate: unblockMutate, isPending: unblocking } = useUnblockUser();
  const { mutate: reportMutate, isPending: reporting } = useCreateReport();

  function handleBlockConfirmed() {
    blockMutate(otherUserId, {
      onSuccess: () => toast.success(`${otherDisplayName ?? "Usuario"} bloqueado.`),
      onError: () => toast.error("No se pudo bloquear al usuario."),
    });
    setConfirmBlock(false);
  }

  function handleUnblock() {
    unblockMutate(otherUserId, {
      onSuccess: () => toast.success(`${otherDisplayName ?? "Usuario"} desbloqueado.`),
      onError: () => toast.error("No se pudo desbloquear al usuario."),
    });
  }

  function handleSubmitReport() {
    reportMutate(
      { reportedUserId: otherUserId, conversationId, reason, note: note.trim() || undefined, alsoBlock },
      {
        onSuccess: () => {
          toast.success("Reporte enviado. Un administrador lo revisara.");
          setReportOpen(false);
          setNote("");
          setReason("spam");
          setAlsoBlock(false);
        },
        onError: () => toast.error("No se pudo enviar el reporte."),
      },
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="pt-4 border-t border-[hsl(var(--border))] space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Zona de peligro
        </p>
        {blockedByMe ? (
          <Button variant="outline" className="w-full justify-start" onClick={handleUnblock} disabled={unblocking}>
            <Ban className="h-3.5 w-3.5 mr-2" />
            Desbloquear a {otherDisplayName ?? "este usuario"}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start text-red-500 border-red-500/40 hover:bg-red-500/10"
            onClick={() => setConfirmBlock(true)}
            disabled={blocking}
          >
            <Ban className="h-3.5 w-3.5 mr-2" />
            Bloquear a {otherDisplayName ?? "este usuario"}
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full justify-start text-red-500 border-red-500/40 hover:bg-red-500/10"
          onClick={() => setReportOpen(true)}
        >
          <Flag className="h-3.5 w-3.5 mr-2" />
          Reportar usuario
        </Button>
      </div>

      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title="Bloquear usuario"
        description={`${otherDisplayName ?? "Este usuario"} ya no podra enviarte mensajes. Puedes desbloquearlo en cualquier momento.`}
        confirmLabel="Bloquear"
        onConfirm={handleBlockConfirmed}
      />

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar a {otherDisplayName ?? "usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <SelectField
              label="Motivo"
              value={reason}
              onValueChange={setReason}
              options={REPORT_REASONS}
            />
            <TextareaField
              label="Nota (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe brevemente lo ocurrido..."
              rows={3}
            />
            <CheckboxField
              label="Tambien bloquear a este usuario"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitReport} disabled={reporting}>Enviar reporte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
