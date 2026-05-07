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
import { parseApiError, toNumber } from "../lib/finance-utils";

/**
 * ReminderSheet — send a reminder for a single document or bulk documents.
 *
 * Props:
 *   open          boolean
 *   onOpenChange  (bool) => void
 *   document      FinanceDocument | null  (single mode)
 *   documentIds   string[] | null         (bulk mode, overrides document)
 *   label         string                  e.g. "CxC" for bulk title
 *   token         string
 */
export function ReminderSheet({
  open,
  onOpenChange,
  document,
  documentIds,
  label,
  token,
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const isBulk = Array.isArray(documentIds) && documentIds.length > 0;

  const sendReminderMutation = useMutation({
    mutationFn: ({ id, msg }) =>
      atlas.finance.sendDocumentReminder(id, { message: msg ?? null }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", token] });
      onOpenChange(false);
      setMessage("");
      toast.success("Recordatorio enviado");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo enviar el recordatorio."));
    },
  });

  const sendBulkReminderMutation = useMutation({
    mutationFn: ({ ids, msg }) =>
      atlas.finance.sendBulkDocumentReminders(
        { documentIds: ids, message: msg ?? null },
        token,
      ),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", token] });
      const created = response?.data?.created ?? 0;
      onOpenChange(false);
      setMessage("");
      toast.success(`Recordatorios enviados: ${created}`);
    },
    onError: (error) => {
      toast.error(
        parseApiError(error, "No se pudieron enviar recordatorios masivos."),
      );
    },
  });

  function handleOpen(isOpen) {
    if (!isOpen) setMessage("");
    onOpenChange(isOpen);
  }

  function handleConfirm() {
    const msg = message.trim() || null;
    if (isBulk) {
      sendBulkReminderMutation.mutate({ ids: documentIds, msg });
    } else if (document?.id) {
      sendReminderMutation.mutate({ id: document.id, msg });
    }
  }

  const isPending =
    sendReminderMutation.isPending || sendBulkReminderMutation.isPending;
  const title = isBulk
    ? `Recordatorios masivos${label ? ` (${label})` : ""}`
    : "Enviar recordatorio";
  const description = isBulk
    ? `Se enviará un recordatorio a ${documentIds.length} documento(s) con saldo abierto.`
    : document
      ? `Recordatorio para documento ${document.reference || document.id || ""}.`
      : "";

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">
              Mensaje personalizado (opcional)
            </label>
            <textarea
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensaje adicional para el destinatario..."
            />
          </div>
        </div>
        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button loading={isPending} onClick={handleConfirm}>
            Enviar{isBulk ? " recordatorios" : " recordatorio"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
