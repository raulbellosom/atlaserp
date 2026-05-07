import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@atlas/ui";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { parseApiError } from "../lib/finance-utils";

export function ReverseApplicationSheet({
  open,
  onOpenChange,
  application,
  token,
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const reverseApplicationMutation = useMutation({
    mutationFn: ({ id, reason: r }) =>
      atlas.finance.reverseApplication(id, { reason: r ?? null }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-documents-applications"],
      });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-applications-history"],
      });
      onOpenChange(false);
      setReason("");
      toast.success("Aplicación anulada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo anular la aplicación."));
    },
  });

  function handleOpen(isOpen) {
    if (!isOpen) setReason("");
    onOpenChange(isOpen);
  }

  function handleConfirm() {
    if (!application?.id) return;
    reverseApplicationMutation.mutate({
      id: application.id,
      reason: reason.trim() || null,
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Anular aplicación</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Esta acción revertirá la aplicación y restituirá los saldos abiertos
            de los documentos involucrados.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">
              Motivo de anulación (opcional)
            </label>
            <textarea
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descripción del motivo..."
            />
          </div>
        </div>
        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            loading={reverseApplicationMutation.isPending}
            onClick={handleConfirm}
          >
            Confirmar anulación
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
