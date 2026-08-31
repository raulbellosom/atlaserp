// apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx
import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  PageHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  SelectField,
  SearchInput,
  ConfirmDialog,
} from "@atlas/ui";
import { Plus, ArrowLeft, SlidersHorizontal } from "lucide-react";
import {
  useWallet,
  useWalletMovements,
  useConfirmMovement,
  useSkipMovement,
  usePfmCategories,
} from "../hooks/use-pfm-queries";
import { MovementRow } from "../components/MovementRow";
import { QuickAddMovementSheet } from "../components/QuickAddMovementSheet";
import { CreditCyclePanel } from "../components/CreditCyclePanel";
import { InvestmentPanel } from "../components/InvestmentPanel";
import { WalletFormSheet } from "../components/WalletFormSheet";
import { AdjustBalanceSheet } from "../components/AdjustBalanceSheet";
import {
  formatMoney,
  currentMonthKey,
  shiftMonth,
  formatMonthLabel,
} from "../lib/format";

export default function WalletDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonthKey());
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const { data: wallet, isLoading, isError, refetch } = useWallet(id);
  const query = useMemo(
    () => ({
      month,
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      limit: 100,
    }),
    [month, search, categoryId],
  );
  const { data: movements = [], isLoading: movLoading } = useWalletMovements(id, query);
  const { data: categories = [] } = usePfmCategories();
  const confirmMut = useConfirmMovement();
  const skipMut = useSkipMovement();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState />
      </div>
    );
  }
  if (isError || !wallet) {
    return (
      <div className="p-6">
        <ErrorState title="Cartera no encontrada" onRetry={refetch} />
      </div>
    );
  }

  const monthOptions = [0, -1, -2, -3, -4, -5].map((d) => {
    const key = shiftMonth(currentMonthKey(), d);
    return { value: key, label: formatMonthLabel(key) };
  });
  const categoryOptions = [
    { value: "", label: "Todas las categorias" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const canAdd = !wallet.ledgerAccountId && wallet.canWrite !== false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={wallet.name}
        description={`${formatMoney(wallet.currentBalance, wallet.currency)}${wallet.reference ? ` · ${wallet.reference}` : ""}`}
        actions={
          <div className="flex gap-2">
            {wallet.canWrite !== false && (
              <Button variant="outline" onClick={() => setAdjustOpen(true)}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Ajustar saldo
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate("/app/m/atlas.pfm/wallets")}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Carteras
            </Button>
          </div>
        }
      />

      {wallet.kind === "CREDIT" && (
        <CreditCyclePanel wallet={wallet} onEdit={() => setEditOpen(true)} />
      )}

      {wallet.kind === "INVESTMENT" && (
        <InvestmentPanel wallet={wallet} onEdit={() => setEditOpen(true)} />
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <SelectField label="Mes" options={monthOptions} value={month} onChange={setMonth} />
        <SelectField
          label="Categoria"
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
        />
        <SearchInput
          placeholder="Buscar comercio o nota"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px] flex-1"
        />
      </div>

      <Card variant="solid" className="divide-y divide-[hsl(var(--border))] px-4">
        {movLoading && (
          <div className="py-6">
            <LoadingState />
          </div>
        )}
        {!movLoading && movements.length === 0 && (
          <EmptyState title="Sin movimientos" description="Aun no hay movimientos para este filtro." />
        )}
        {movements.map((m) => (
          <MovementRow
            key={`${m.source ?? "native"}-${m.id}`}
            movement={m}
            currency={wallet.currency}
            onEdit={(mv) => {
              setEditingMovement(mv);
              setAddOpen(true);
            }}
            onConfirm={(mv) => setConfirmTarget(mv)}
            onSkip={(mv) => skipMut.mutate({ movementId: mv.id, walletId: wallet.id })}
          />
        ))}
      </Card>

      {canAdd && (
        <button
          type="button"
          onClick={() => {
            setEditingMovement(null);
            setAddOpen(true);
          }}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-(--brand-primary) text-white shadow-lg"
          aria-label="Nuevo movimiento"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <QuickAddMovementSheet
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) setEditingMovement(null);
        }}
        defaultWalletId={wallet.id}
        editingMovement={editingMovement}
      />

      <WalletFormSheet open={editOpen} onOpenChange={setEditOpen} wallet={wallet} />
      <AdjustBalanceSheet open={adjustOpen} onOpenChange={setAdjustOpen} wallet={wallet} />

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(v) => !v && setConfirmTarget(null)}
        title="Confirmar movimiento"
        description={`Se aplicara ${formatMoney(confirmTarget?.amount, wallet.currency)} al saldo.`}
        confirmLabel="Confirmar"
        onConfirm={async () => {
          await confirmMut.mutateAsync({ movementId: confirmTarget.id, walletId: wallet.id });
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}
