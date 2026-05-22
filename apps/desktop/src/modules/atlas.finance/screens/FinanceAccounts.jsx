import { useState } from "react";
import { AtlasTable, Button, PageHeader } from "@atlas/ui";
import { Plus } from "lucide-react";
import { SECTION_META } from "../lib/finance-utils";
import { AccountSheet } from "../components/AccountSheet";

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || "http://localhost:4010";

const ACCOUNTS_BLUEPRINT = {
  key: "finance.accounts.table",
  schema: {
    apiPath: "/finance/accounts",
    primaryField: "name",
    searchable: true,
    searchPlaceholder: "Buscar cuenta...",
    columns: [
      { field: "code", label: "Codigo", sortable: true, link: true },
      { field: "name", label: "Nombre", sortable: true },
      { field: "accountType", label: "Tipo", sortable: true },
      { field: "currency", label: "Moneda", sortable: true },
      { field: "openingBalance", label: "Saldo inicial", sortable: false },
      { field: "enabled", label: "Estado", sortable: false },
    ],
    emptyState: { message: "No hay cuentas registradas. Crea cuentas para estructurar tu plan contable." },
  },
};

export function FinanceAccounts({ token }) {
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const pageMeta = SECTION_META.accounts;

  function openCreate() {
    setEditingAccount(null);
    setAccountSheetOpen(true);
  }

  function openEdit(account) {
    setEditingAccount(account);
    setAccountSheetOpen(true);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Finance"
        title={pageMeta.title}
        description={pageMeta.description}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Crear cuenta
          </Button>
        }
      />

      <AtlasTable
        blueprint={ACCOUNTS_BLUEPRINT}
        token={token}
        apiBaseUrl={API_BASE_URL}
        onCreate={openCreate}
        onEdit={openEdit}
        refreshSignal={refreshSignal}
      />

      <AccountSheet
        open={accountSheetOpen}
        onOpenChange={(v) => {
          setAccountSheetOpen(v);
          if (!v) setRefreshSignal((s) => s + 1);
        }}
        editingAccount={editingAccount}
        token={token}
      />
    </div>
  );
}
