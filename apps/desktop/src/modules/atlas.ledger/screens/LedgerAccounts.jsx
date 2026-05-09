import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
} from "@atlas/ui";
import { BookOpen, Edit3, Plus, Power, PowerOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { AccountSheet } from "../components/AccountSheet";
import { accountTypeLabel, formatMoney, parseApiError } from "../lib/ledger-utils";

export function LedgerAccounts({ token }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const accountsQuery = useQuery({
    queryKey: ["ledger-accounts"],
    queryFn: () => atlas.ledger.listAccounts(token, { enabled: true }),
    enabled: Boolean(token),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }) => atlas.ledger.setAccountEnabled(id, enabled, token),
    onMutate: ({ id }) => setPendingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-summary"] });
      toast.success("Estado de cuenta actualizado");
    },
    onSettled: () => setPendingId(null),
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo actualizar la cuenta."));
    },
  });

  const accounts = accountsQuery.data?.data ?? [];

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Ledger"
          title="Cuentas"
          description="Gestiona las cuentas del libro auxiliar."
          actions={
            <Button onClick={() => { setEditingAccount(null); setSheetOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nueva cuenta
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan de cuentas auxiliares</CardTitle>
          </CardHeader>
          <CardContent>
            {accountsQuery.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : accounts.length === 0 ? (
              <EmptyState
                title="Sin cuentas"
                description="Crea la primera cuenta para comenzar a registrar movimientos."
                icon={BookOpen}
                action={{ label: "Nueva cuenta", onClick: () => { setEditingAccount(null); setSheetOpen(true); } }}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))/0.35]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nombre</th>
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium">Moneda</th>
                      <th className="px-3 py-2 text-right font-medium">Saldo actual</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                      <th className="px-3 py-2 text-left font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr
                        key={account.id}
                        className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))/0.2] cursor-pointer"
                        onClick={() => navigate(`/app/m/atlas.ledger/ledger/accounts/${account.id}`)}
                      >
                        <td className="px-3 py-2 font-medium">{account.name}</td>
                        <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                          {accountTypeLabel(account.type)}
                        </td>
                        <td className="px-3 py-2">{account.currency}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(account.currentBalance, account.currency)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={account.enabled ? "success" : "secondary"}>
                            {account.enabled ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                        <td
                          className="px-3 py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ActionMenu
                            items={[
                              {
                                label: "Editar",
                                icon: Edit3,
                                onClick: () => { setEditingAccount(account); setSheetOpen(true); },
                              },
                              account.enabled
                                ? {
                                    label: "Deshabilitar",
                                    icon: PowerOff,
                                    disabled: pendingId === account.id,
                                    onClick: () => toggleMutation.mutate({ id: account.id, enabled: false }),
                                  }
                                : {
                                    label: "Habilitar",
                                    icon: Power,
                                    disabled: pendingId === account.id,
                                    onClick: () => toggleMutation.mutate({ id: account.id, enabled: true }),
                                  },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AccountSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingAccount={editingAccount}
        token={token}
      />
    </div>
  );
}
