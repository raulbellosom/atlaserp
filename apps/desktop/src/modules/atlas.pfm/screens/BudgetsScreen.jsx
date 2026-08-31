// apps/desktop/src/modules/atlas.pfm/screens/BudgetsScreen.jsx
import { useState } from "react";
import {
  PageHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  TextField,
} from "@atlas/ui";
import { Plus, Target, PiggyBank } from "lucide-react";
import {
  useBudgets,
  useGoals,
  useSetBudgetEnabled,
  useContributeGoal,
} from "../hooks/use-pfm-queries";
import { BudgetBars } from "../components/BudgetBars";
import { GoalRings } from "../components/GoalRings";
import { BudgetFormSheet } from "../components/BudgetFormSheet";
import { GoalFormSheet } from "../components/GoalFormSheet";
import { formatMoney } from "../lib/format";

export default function BudgetsScreen() {
  const budgetsQ = useBudgets();
  const goalsQ = useGoals();
  const setBudgetEnabled = useSetBudgetEnabled();
  const contributeMut = useContributeGoal();

  const [budgetSheet, setBudgetSheet] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [disableBudget, setDisableBudget] = useState(null);
  const [goalSheet, setGoalSheet] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [contribute, setContribute] = useState(null); // { goal, sign }
  const [contribAmount, setContribAmount] = useState("");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Presupuestos y metas"
        description="Limites mensuales y objetivos de ahorro"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditGoal(null); setGoalSheet(true); }}>
              <PiggyBank className="mr-1.5 h-4 w-4" /> Nueva meta
            </Button>
            <Button onClick={() => { setEditBudget(null); setBudgetSheet(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo presupuesto
            </Button>
          </div>
        }
      />

      <Card variant="solid" className="mb-6 p-5">
        <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">
          Presupuestos del mes
        </h3>
        {budgetsQ.isLoading && <LoadingState />}
        {budgetsQ.isError && (
          <ErrorState title="No se pudieron cargar los presupuestos" onRetry={budgetsQ.refetch} />
        )}
        {!budgetsQ.isLoading && !budgetsQ.isError && (
          <BudgetBars
            budgets={budgetsQ.data}
            onEdit={(b) => { setEditBudget(b); setBudgetSheet(true); }}
            onDisable={(b) => setDisableBudget(b)}
          />
        )}
      </Card>

      <Card variant="solid" className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">Metas de ahorro</h3>
        {goalsQ.isLoading && <LoadingState />}
        {goalsQ.isError && (
          <ErrorState title="No se pudieron cargar las metas" onRetry={goalsQ.refetch} />
        )}
        {!goalsQ.isLoading && !goalsQ.isError && (
          <GoalRings
            goals={goalsQ.data}
            onEdit={(g) => { setEditGoal(g); setGoalSheet(true); }}
            onContribute={(g, sign) => { setContribAmount(""); setContribute({ goal: g, sign }); }}
          />
        )}
      </Card>

      <BudgetFormSheet open={budgetSheet} onOpenChange={setBudgetSheet} budget={editBudget} />
      <GoalFormSheet open={goalSheet} onOpenChange={setGoalSheet} goal={editGoal} />

      <ConfirmDialog
        open={Boolean(disableBudget)}
        onOpenChange={(v) => !v && setDisableBudget(null)}
        title="Quitar presupuesto"
        description={`Dejaras de recibir alertas para "${disableBudget?.categoryName ?? ""}".`}
        confirmLabel="Quitar"
        onConfirm={async () => {
          await setBudgetEnabled.mutateAsync({ id: disableBudget.id, enabled: false });
          setDisableBudget(null);
        }}
      />

      <Dialog open={Boolean(contribute)} onOpenChange={(v) => !v && setContribute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {contribute?.sign < 0 ? "Retirar de" : "Aportar a"} {contribute?.goal?.name}
            </DialogTitle>
          </DialogHeader>
          <TextField
            label="Monto"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={contribAmount}
            onChange={(e) => setContribAmount(e.target.value)}
          />
          {contribute?.goal && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Actual: {formatMoney(contribute.goal.currentAmount)} de{" "}
              {formatMoney(contribute.goal.targetAmount)}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContribute(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!(Number(contribAmount) > 0) || contributeMut.isPending}
              onClick={async () => {
                await contributeMut.mutateAsync({
                  id: contribute.goal.id,
                  amount: contribute.sign * Number(contribAmount),
                });
                setContribute(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
