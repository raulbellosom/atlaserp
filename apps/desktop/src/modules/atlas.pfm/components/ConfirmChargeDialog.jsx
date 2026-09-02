// apps/desktop/src/modules/atlas.pfm/components/ConfirmChargeDialog.jsx
//
// Confirm a PENDING charge, optionally adjusting the amount before it posts.
// Variable recurring charges (electricidad, agua, tarjeta...) rarely land on the
// exact projected figure, so the confirm step lets the user correct it.
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  TextField,
} from "@atlas/ui";
import { formatMoney } from "../lib/format";

export function ConfirmChargeDialog({ open, onOpenChange, charge, currency, onConfirm }) {
  const originalAmount = Number(charge?.amount ?? 0);
  const [amount, setAmount] = useState(String(originalAmount));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setAmount(String(Number(charge?.amount ?? 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, charge?.id]);

  if (!charge) return null;

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const changed = valid && Math.abs(parsed - originalAmount) > 0.005;
  const label = charge.merchant || charge.categoryName || charge.note || "este cargo";
  const target = charge.walletName ? ` a ${charge.walletName}` : "";

  async function handleConfirm() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onConfirm(changed ? Math.round(parsed * 100) / 100 : undefined);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar cargo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Se registrara{" "}
            <span className="font-medium text-[hsl(var(--foreground))]">{label}</span>
            {target}.
          </p>
          <TextField
            label="Monto"
            type="number"
            step="0.01"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={!valid && amount !== "" ? "Ingresa un monto mayor a cero" : undefined}
            hint={
              changed
                ? `Proyectado: ${formatMoney(originalAmount, currency)}`
                : "Ajusta el monto si el cargo real fue distinto"
            }
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!valid || busy} onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
