// apps/desktop/src/modules/atlas.pfm/components/AssistantActionCard.jsx
import { useState } from "react";
import { Button, Badge } from "@atlas/ui";
import { Check, X } from "lucide-react";
import { useCreateMovement } from "../hooks/use-pfm-queries";
import { describeProposedAction } from "../lib/assistant-format";

// Renders a `proposedAction` from the assistant and lets the user register it
// through the NORMAL movement endpoint (the assistant never writes).
export function AssistantActionCard({ action, onDone }) {
  const createMut = useCreateMovement();
  const [state, setState] = useState("idle"); // idle | done | discarded | error

  if (!action || action.type !== "create_movement") return null;

  async function register() {
    setState("idle");
    try {
      await createMut.mutateAsync({
        walletId: action.walletId,
        direction: action.direction,
        amount: Number(action.amount),
        occurredOn: action.occurredOn,
        categoryId: action.categoryId ?? null,
        merchant: action.merchant ?? null,
        note: action.note ?? null,
        status: "POSTED",
      });
      setState("done");
      onDone?.("done");
    } catch {
      setState("error");
    }
  }

  const locked = state === "done" || state === "discarded";

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-[hsl(var(--foreground))]">Registrar movimiento</span>
        {state === "done" && <Badge variant="success">Registrado</Badge>}
        {state === "discarded" && <Badge variant="outline">Descartado</Badge>}
      </div>
      <p className="text-[hsl(var(--muted-foreground))]">{describeProposedAction(action)}</p>
      {state === "error" && (
        <p className="mt-1 text-red-600 dark:text-red-400">
          No se pudo registrar. Intenta desde la cartera.
        </p>
      )}
      {!locked && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={register} disabled={createMut.isPending}>
            <Check className="mr-1 h-3.5 w-3.5" /> Registrar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setState("discarded");
              onDone?.("discarded");
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Descartar
          </Button>
        </div>
      )}
    </div>
  );
}
