// apps/desktop/src/modules/atlas.pfm/screens/RecurringScreen.jsx
import { useState } from "react";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  ConfirmDialog,
} from "@atlas/ui";
import { Plus, Repeat, Pencil, Power } from "lucide-react";
import { useRecurringRules, useSetRecurringRuleEnabled } from "../hooks/use-pfm-queries";
import { RecurringRuleSheet } from "../components/RecurringRuleSheet";
import { formatMoney } from "../lib/format";

const FREQ_LABEL = { DAILY: "dia", WEEKLY: "semana", MONTHLY: "mes", YEARLY: "ano" };

function cadence(rule) {
  const n = rule.rrule?.interval ?? 1;
  const unit = FREQ_LABEL[rule.rrule?.freq] ?? "mes";
  return n === 1 ? `Cada ${unit}` : `Cada ${n} ${unit}s`;
}

export default function RecurringScreen() {
  const { data: rules = [], isLoading, isError, refetch } = useRecurringRules();
  const setEnabled = useSetRecurringRuleEnabled();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Cargos recurrentes"
        description="Suscripciones y pagos fijos"
        actions={
          <Button
            onClick={() => {
              setEditRule(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState title="No se pudieron cargar los cargos recurrentes" onRetry={refetch} />
      )}
      {!isLoading && !isError && rules.length === 0 && (
        <EmptyState
          icon={Repeat}
          title="Sin cargos recurrentes"
          description="Agrega tus suscripciones y pagos fijos para verlos en el calendario y en Proximos cargos."
          action={{ label: "Nuevo cargo recurrente", onClick: () => setSheetOpen(true) }}
        />
      )}

      <div className="space-y-3">
        {rules.map((r) => (
          <Card key={r.id} variant="solid" className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
                {r.label}
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <span>{cadence(r)}</span>
                <span>proximo {String(r.nextRunAt).slice(0, 10)}</span>
                {r.autoPost ? (
                  <Badge variant="secondary">Automatico</Badge>
                ) : (
                  <Badge variant="outline">Requiere confirmar</Badge>
                )}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[hsl(var(--foreground))]">
              {r.amountMode === "FIXED" ? formatMoney(r.amount) : "Variable"}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Editar"
                onClick={() => {
                  setEditRule(r);
                  setSheetOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Desactivar"
                onClick={() => setDisableTarget(r)}
              >
                <Power className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <RecurringRuleSheet open={sheetOpen} onOpenChange={setSheetOpen} rule={editRule} />
      <ConfirmDialog
        open={Boolean(disableTarget)}
        onOpenChange={(v) => !v && setDisableTarget(null)}
        title="Desactivar cargo recurrente"
        description={`"${disableTarget?.label ?? ""}" dejara de generar movimientos y se quitara del calendario.`}
        confirmLabel="Desactivar"
        onConfirm={async () => {
          await setEnabled.mutateAsync({ id: disableTarget.id, enabled: false });
          setDisableTarget(null);
        }}
      />
    </div>
  );
}
