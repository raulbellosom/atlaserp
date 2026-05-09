import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextareaField,
} from "@atlas/ui";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { parseApiError } from "../lib/ledger-utils";

export function MovementCancelModal({ open, onOpenChange, movement, accountId, token }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const cancelMutation = useMutation({
    mutationFn: () => atlas.ledger.cancelMovement(movement?.id, { reason }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger-account-movements", accountId] });
      queryClient.invalidateQueries({ queryKey: ["ledger-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-summary"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-movements"] });
      onOpenChange(false);
      setReason("");
      toast.success("Movimiento cancelado");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo cancelar el movimiento."));
    },
  });

  function handleOpenChange(isOpen) {
    if (cancelMutation.isPending) return;
    if (!isOpen) setReason("");
    onOpenChange(isOpen);
  }

  function handleConfirm() {
    if (reason.trim().length < 5) {
      toast.error("El motivo debe tener al menos 5 caracteres.");
      return;
    }
    cancelMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <DialogTitle>Cancelar movimiento</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {movement && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Movimiento <strong>#{movement.sequenceNumber}</strong> — {movement.concept}
            </p>
          )}
          <TextareaField
            label="Motivo de cancelacion"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Indique el motivo (min. 5 caracteres)"
            rows={3}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Volver
          </Button>
          <Button variant="destructive" onClick={handleConfirm} loading={cancelMutation.isPending}>
            Cancelar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
