// apps/desktop/src/modules/atlas.pfm/components/UpcomingChargesCard.jsx
import { useState } from "react";
import { SectionCard, Button, Badge, EmptyState } from "@atlas/ui";
import { Check, SkipForward } from "lucide-react";
import { useUpcoming, useConfirmMovement, useSkipMovement } from "../hooks/use-pfm-queries";
import { ConfirmChargeDialog } from "./ConfirmChargeDialog";
import { formatMoney } from "../lib/format";

export function UpcomingChargesCard() {
  const { data: items = [], isLoading } = useUpcoming(14);
  const confirmMut = useConfirmMovement();
  const skipMut = useSkipMovement();
  const [confirmTarget, setConfirmTarget] = useState(null);

  return (
    <SectionCard title="Proximos cargos (14 dias)">
      {!isLoading && items.length === 0 && (
        <EmptyState variant="compact" title="Nada pendiente por ahora" />
      )}
      <ul className="divide-y divide-[hsl(var(--border))]">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                {it.merchant || it.categoryName || "Cargo"}
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <span>{it.occurredOn}</span>
                <span>{it.walletName}</span>
                {it.fromRule && <Badge variant="outline">Recurrente</Badge>}
              </p>
            </div>
            <span
              className={
                it.direction === "EXPENSE"
                  ? "shrink-0 text-sm font-semibold text-red-500"
                  : "shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
              }
            >
              {it.direction === "EXPENSE" ? "-" : "+"}
              {formatMoney(it.amount, it.currency)}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Confirmar"
                onClick={() => setConfirmTarget(it)}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Omitir"
                onClick={() => skipMut.mutate({ movementId: it.id, walletId: it.walletId })}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmChargeDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(v) => !v && setConfirmTarget(null)}
        charge={confirmTarget}
        currency={confirmTarget?.currency}
        onConfirm={(amount) =>
          confirmMut.mutateAsync({
            movementId: confirmTarget.id,
            walletId: confirmTarget.walletId,
            amount,
          })
        }
      />
    </SectionCard>
  );
}
