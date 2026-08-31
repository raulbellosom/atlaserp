// apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx
import { Badge, Button } from "@atlas/ui";
import { Check, SkipForward, Pencil, SlidersHorizontal } from "lucide-react";
import { formatMoney } from "../lib/format";

export function MovementRow({ movement, currency, onEdit, onConfirm, onSkip }) {
  const isExpense = movement.direction === "EXPENSE";
  const amountText = `${isExpense ? "-" : "+"}${formatMoney(movement.amount, currency)}`;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
          {movement.merchant ||
            movement.note ||
            (movement.isAdjustment ? "Ajuste de saldo" : "Movimiento")}
        </p>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          {movement.isAdjustment && (
            <Badge variant="outline">
              <SlidersHorizontal className="mr-1 h-3 w-3" /> Ajuste
            </Badge>
          )}
          <span>{movement.occurredOn}</span>
          {movement.source === "ledger" && <Badge variant="outline">Libro de cuentas</Badge>}
          {movement.status === "PENDING" && <Badge variant="warning">Pendiente</Badge>}
          {movement.status === "SKIPPED" && <Badge variant="outline">Omitido</Badge>}
        </p>
      </div>
      <span
        className={
          isExpense
            ? "shrink-0 text-sm font-semibold text-red-500"
            : "shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
        }
      >
        {amountText}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {movement.status === "PENDING" && (
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Confirmar"
              onClick={() => onConfirm(movement)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Omitir"
              onClick={() => onSkip(movement)}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => onEdit(movement)}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
