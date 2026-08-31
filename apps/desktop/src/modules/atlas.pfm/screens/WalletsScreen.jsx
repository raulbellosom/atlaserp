// apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  ConfirmDialog,
  resolveLucideIcon,
} from "@atlas/ui";
import { Plus, Users, Pencil, EyeOff, Wallet } from "lucide-react";
import { useWallets, useSetWalletEnabled } from "../hooks/use-pfm-queries";
import { WalletFormSheet } from "../components/WalletFormSheet";
import { WalletMembersDialog } from "../components/WalletMembersDialog";
import { CreditUsageBlock } from "../components/CreditUsageBlock";
import { formatMoney, WALLET_KIND_LABEL, formatRatePct } from "../lib/format";

export default function WalletsScreen() {
  const navigate = useNavigate();
  const { data: wallets = [], isLoading, isError, refetch } = useWallets();
  const setEnabled = useSetWalletEnabled();

  const [formOpen, setFormOpen] = useState(false);
  const [editWallet, setEditWallet] = useState(null);
  const [membersWallet, setMembersWallet] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="Carteras"
        description="Efectivo, debito y credito"
        actions={
          <Button
            onClick={() => {
              setEditWallet(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nueva cartera
          </Button>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState title="No se pudieron cargar las carteras" onRetry={refetch} />}
      {!isLoading && !isError && wallets.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="Aun no tienes carteras"
          description="Crea tu primera cartera para empezar a registrar ingresos y gastos."
          action={{ label: "Nueva cartera", onClick: () => setFormOpen(true) }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wallets.map((w) => {
          const accent = w.color || "#0ea5e9";
          const WalletIcon = resolveLucideIcon(w.icon) ?? Wallet;
          return (
          <Card
            key={w.id}
            variant="interactive"
            className="relative overflow-hidden p-5"
            onClick={() => navigate(`/app/m/atlas.pfm/wallets/${w.id}`)}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-[0.12]"
              style={{ background: `radial-gradient(120% 80% at 0% 0%, ${accent}, transparent 70%)` }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 h-full w-1"
              style={{ backgroundColor: accent }}
            />
            <div className="relative flex items-start justify-between">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ backgroundColor: accent }}
              >
                <WalletIcon className="h-4 w-4" />
              </span>
              {w.isOwner && (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Colaboradores"
                    onClick={() => setMembersWallet(w)}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar"
                    onClick={() => {
                      setEditWallet(w);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Desactivar"
                    onClick={() => setDeactivateTarget(w)}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="relative mt-3 truncate text-sm font-semibold text-[hsl(var(--foreground))]">
              {w.name}
            </p>
            <p className="relative mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
              {WALLET_KIND_LABEL[w.kind]}
              {w.reference && <span className="tabular-nums">· {w.reference}</span>}
              {w.ledgerAccountId && <Badge variant="outline">Libro de cuentas</Badge>}
            </p>
            {w.kind === "CREDIT" ? (
              <div className="relative">
                <CreditUsageBlock wallet={w} />
              </div>
            ) : (
              <div className="relative">
                <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-[hsl(var(--foreground))]">
                  {formatMoney(w.currentBalance, w.currency)}
                </p>
                {w.kind === "INVESTMENT" && w.expectedRate != null && (
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    Rendimiento esperado: {formatRatePct(w.expectedRate)} anual
                  </p>
                )}
              </div>
            )}
          </Card>
          );
        })}
      </div>

      <WalletFormSheet open={formOpen} onOpenChange={setFormOpen} wallet={editWallet} />
      <WalletMembersDialog
        open={Boolean(membersWallet)}
        onOpenChange={(v) => !v && setMembersWallet(null)}
        wallet={membersWallet}
      />
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(v) => !v && setDeactivateTarget(null)}
        title="Desactivar cartera"
        description={`"${deactivateTarget?.name ?? ""}" dejara de aparecer. Sus movimientos se conservan.`}
        confirmLabel="Desactivar"
        onConfirm={async () => {
          await setEnabled.mutateAsync({ id: deactivateTarget.id, enabled: false });
          setDeactivateTarget(null);
        }}
      />
    </div>
  );
}
