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
import { Edit3, LayoutList, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  ACCOUNT_TYPE_OPTIONS,
  SECTION_META,
  formatMoney,
  parseApiError,
} from "../lib/finance-utils";
import { AccountSheet } from "../components/AccountSheet";

export function FinanceAccounts({ token }) {
  const queryClient = useQueryClient();
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [pendingAccountId, setPendingAccountId] = useState(null);

  const accountsQuery = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: () => atlas.finance.listAccounts(token, { limit: 200 }),
    enabled: Boolean(token),
  });

  const toggleAccountMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setAccountEnabled(id, enabled, token),
    onMutate: ({ id }) => setPendingAccountId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["finance-balances"] });
      toast.success("Estado de cuenta actualizado");
    },
    onSettled: () => setPendingAccountId(null),
    onError: (error) => {
      toast.error(
        parseApiError(error, "No se pudo actualizar el estado de la cuenta."),
      );
    },
  });

  const accounts = accountsQuery.data?.data ?? [];
  const pageMeta = SECTION_META.accounts;

  const headerActions = (
    <Button
      onClick={() => {
        setEditingAccount(null);
        setAccountSheetOpen(true);
      }}
    >
      <Plus className="h-4 w-4" />
      Crear cuenta
    </Button>
  );

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Finance"
          title={pageMeta.title}
          description={pageMeta.description}
          actions={headerActions}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan de cuentas</CardTitle>
          </CardHeader>
          <CardContent>
            {accountsQuery.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : accounts.length === 0 ? (
              <EmptyState
                title="Sin cuentas"
                description="Crea cuentas para estructurar tu plan contable."
                icon={LayoutList}
                action={{
                  label: "Crear cuenta",
                  onClick: () => {
                    setEditingAccount(null);
                    setAccountSheetOpen(true);
                  },
                }}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))/0.35]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Codigo
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Nombre
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Moneda
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Saldo inicial
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Estado
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => {
                      const typeLabel =
                        ACCOUNT_TYPE_OPTIONS.find(
                          (o) => o.value === account.accountType,
                        )?.label ||
                        account.accountType ||
                        "-";
                      return (
                        <tr
                          key={account.id}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2 font-mono">
                            {account.code || "-"}
                          </td>
                          <td className="px-3 py-2">{account.name}</td>
                          <td className="px-3 py-2">{typeLabel}</td>
                          <td className="px-3 py-2">
                            {account.currency || "MXN"}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(
                              account.openingBalance,
                              account.currency,
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                account.enabled ? "success" : "secondary"
                              }
                            >
                              {account.enabled ? "Activa" : "Inactiva"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <ActionMenu
                              items={[
                                {
                                  label: "Editar",
                                  icon: Edit3,
                                  onClick: () => {
                                    setEditingAccount(account);
                                    setAccountSheetOpen(true);
                                  },
                                },
                                account.enabled
                                  ? {
                                      label: "Deshabilitar",
                                      icon: PowerOff,
                                      disabled: pendingAccountId === account.id,
                                      onClick: () =>
                                        toggleAccountMutation.mutate({
                                          id: account.id,
                                          enabled: false,
                                        }),
                                    }
                                  : {
                                      label: "Habilitar",
                                      icon: Power,
                                      disabled: pendingAccountId === account.id,
                                      onClick: () =>
                                        toggleAccountMutation.mutate({
                                          id: account.id,
                                          enabled: true,
                                        }),
                                    },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AccountSheet
        open={accountSheetOpen}
        onOpenChange={setAccountSheetOpen}
        editingAccount={editingAccount}
        token={token}
      />
    </div>
  );
}
