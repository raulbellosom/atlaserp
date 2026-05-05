import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
  Input,
  PageHeader,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  DateField,
  DateTimeField,
  NumberField,
  CurrencyField,
  SelectField,
  TextField,
} from "@atlas/ui";
import {
  Edit3,
  ArrowRightLeft,
  Calendar,
  CalendarDays,
  Coins,
  Component,
  FileText,
  HandCoins,
  Hash,
  Landmark,
  ListTree,
  Minus,
  Notebook,
  NotebookPen,
  Plus,
  Power,
  PowerOff,
  Receipt,
  Scale,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { CURRENCY_OPTIONS } from "../../../lib/localeCatalogs";

const ACCOUNT_TYPE_OPTIONS = [
  "ACTIVO",
  "PASIVO",
  "CAPITAL",
  "INGRESO",
  "EGRESO",
  "COSTO",
  "OTRO",
];

const SOURCE_TYPE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Egreso" },
  { value: "transfer", label: "Transferencia" },
];

function formatMoney(value, currency = "MXN") {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "$0.00";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseApiError(error, fallback) {
  const raw = String(error?.message ?? "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error === "string" && parsed.error.trim())
      return parsed.error;
  } catch {
    // ignore invalid JSON
  }
  return raw.length > 220 ? fallback : raw;
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeLineTotals(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.debit += toNumber(line.debit);
      acc.credit += toNumber(line.credit);
      return acc;
    },
    { debit: 0, credit: 0 },
  );
}

function defaultAccountForm() {
  return {
    code: "",
    name: "",
    type: ACCOUNT_TYPE_OPTIONS[0],
    currency: "MXN",
    initialBalance: "0",
  };
}

function defaultEntryForm() {
  return {
    occurredAt: "",
    concept: "",
    reference: "",
    currency: "MXN",
    sourceType: "manual",
    lines: [
      { accountId: "", debit: "", credit: "", note: "" },
      { accountId: "", debit: "", credit: "", note: "" },
    ],
  };
}

function defaultGuidedForm() {
  return {
    sourceType: "income",
    concept: "",
    reference: "",
    occurredAt: "",
    currency: "MXN",
    amount: "",
    fromAccountId: "",
    toAccountId: "",
    note: "",
  };
}

function defaultFxForm() {
  return {
    baseCurrency: "USD",
    quoteCurrency: "MXN",
    rateDate: "",
    rate: "",
    source: "manual",
  };
}

function formatFxDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

function normalizeCurrencyCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function resolveCurrencyOptions(value) {
  const code = normalizeCurrencyCode(value);
  if (!code) return CURRENCY_OPTIONS;
  if (CURRENCY_OPTIONS.some((option) => option.value === code))
    return CURRENCY_OPTIONS;
  return [
    { value: code, label: `${code} - Moneda personalizada` },
    ...CURRENCY_OPTIONS,
  ];
}

function resolveFinanceSection(path) {
  if (path === "/finance/accounts") return "accounts";
  if (path === "/finance/entries") return "entries";
  if (path === "/finance/fx-rates") return "fx-rates";
  return "summary";
}

const SECTION_META = {
  summary: {
    title: "Finanzas",
    description: "Resumen operativo y saldos convertidos para tu instancia.",
  },
  accounts: {
    title: "Plan de cuentas",
    description: "Gestiona cuentas contables activas y su configuracion base.",
  },
  entries: {
    title: "Polizas",
    description:
      "Registra movimientos contables con captura guiada o avanzada.",
  },
  "fx-rates": {
    title: "Tipos de cambio",
    description: "Administra tasas manuales para conversion historica.",
  },
};

export default function FinanceScreen() {
  const { "*": wildcard } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [guidedSheetOpen, setGuidedSheetOpen] = useState(false);
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState(defaultAccountForm);
  const [guidedForm, setGuidedForm] = useState(defaultGuidedForm);
  const [fxForm, setFxForm] = useState(defaultFxForm);
  const [entryForm, setEntryForm] = useState(defaultEntryForm);
  const [pendingAccountId, setPendingAccountId] = useState(null);
  const [pendingEntryId, setPendingEntryId] = useState(null);
  const [pendingFxRateId, setPendingFxRateId] = useState(null);

  const routePath = wildcard ? `/${wildcard}` : "/";
  const activeSection = resolveFinanceSection(routePath);
  const pageMeta = SECTION_META[activeSection] ?? SECTION_META.summary;
  const needsAccounts =
    activeSection === "summary" ||
    activeSection === "accounts" ||
    activeSection === "entries" ||
    accountSheetOpen ||
    guidedSheetOpen ||
    entrySheetOpen;
  const needsBalances = activeSection === "summary";
  const needsDashboard = activeSection === "summary";
  const needsEntries = activeSection === "entries";
  const needsFxRates = activeSection === "fx-rates";

  const accountsQuery = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: () => atlas.finance.listAccounts(token, { limit: 200 }),
    enabled: Boolean(token) && needsAccounts,
  });

  const balancesQuery = useQuery({
    queryKey: ["finance-balances"],
    queryFn: () => atlas.finance.getBalances(token),
    enabled: Boolean(token) && needsBalances,
  });

  const dashboardQuery = useQuery({
    queryKey: ["finance-dashboard"],
    queryFn: () => atlas.finance.getDashboard(token),
    enabled: Boolean(token) && needsDashboard,
  });

  const entriesQuery = useQuery({
    queryKey: ["finance-entries"],
    queryFn: () => atlas.finance.listEntries(token, { limit: 150 }),
    enabled: Boolean(token) && needsEntries,
  });

  const fxRatesQuery = useQuery({
    queryKey: ["finance-fx-rates"],
    queryFn: () => atlas.finance.listFxRates(token, { limit: 200 }),
    enabled: Boolean(token) && needsFxRates,
  });

  const createAccountMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createAccount(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      setAccountSheetOpen(false);
      setEditingAccount(null);
      setAccountForm(defaultAccountForm());
      toast.success("Cuenta creada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo crear la cuenta."));
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      atlas.finance.updateAccount(id, payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      setAccountSheetOpen(false);
      setEditingAccount(null);
      setAccountForm(defaultAccountForm());
      toast.success("Cuenta actualizada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo actualizar la cuenta."));
    },
  });

  const toggleAccountMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setAccountEnabled(id, enabled, token),
    onMutate: ({ id }) => {
      setPendingAccountId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast.success("Estado de cuenta actualizado");
    },
    onSettled: () => {
      setPendingAccountId(null);
    },
    onError: (error) => {
      toast.error(
        parseApiError(error, "No se pudo actualizar el estado de la cuenta."),
      );
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createEntry(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-balances"] });
      setEntrySheetOpen(false);
      setEntryForm(defaultEntryForm());
      toast.success("Poliza registrada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo registrar la poliza."));
    },
  });

  const toggleEntryMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setEntryEnabled(id, enabled, token),
    onMutate: ({ id }) => {
      setPendingEntryId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-balances"] });
      toast.success("Estado de poliza actualizado");
    },
    onSettled: () => {
      setPendingEntryId(null);
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo actualizar la poliza."));
    },
  });

  const createFxRateMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createFxRate(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-fx-rates"] });
      setFxForm(defaultFxForm());
      toast.success("Tipo de cambio guardado");
    },
    onError: (error) => {
      toast.error(
        parseApiError(error, "No se pudo guardar el tipo de cambio."),
      );
    },
  });

  const toggleFxRateMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setFxRateEnabled(id, enabled, token),
    onMutate: ({ id }) => {
      setPendingFxRateId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-fx-rates"] });
      toast.success("Estado de tipo de cambio actualizado");
    },
    onSettled: () => {
      setPendingFxRateId(null);
    },
    onError: (error) => {
      toast.error(
        parseApiError(
          error,
          "No se pudo actualizar el estado del tipo de cambio.",
        ),
      );
    },
  });

  const accounts = accountsQuery.data?.data ?? [];
  const balances = balancesQuery.data?.data;
  const entries = entriesQuery.data?.data ?? [];
  const fxRates = fxRatesQuery.data?.data ?? [];
  const dashboard = dashboardQuery.data?.data;
  const dashboardTrend = dashboard?.trend ?? [];
  const dashboardVariance = dashboard?.variance;

  const balanceTotals = balances?.totals ?? {
    debit: "0.00",
    credit: "0.00",
    net: "0.00",
  };
  const balanceTotalsBase = balances?.totalsBase ?? {
    debit: "0.00",
    credit: "0.00",
    net: "0.00",
    currency: "MXN",
  };
  const dashboardCurrency =
    dashboard?.currency ?? balanceTotalsBase.currency ?? "MXN";

  const accountTypeStats = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      const key = String(account.type || "SIN_TIPO");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([type, total]) => ({ type, total }));
  }, [accounts]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.enabled),
    [accounts],
  );
  const lineTotals = useMemo(
    () => computeLineTotals(entryForm.lines),
    [entryForm.lines],
  );
  const entryBalanced =
    Math.abs(lineTotals.debit - lineTotals.credit) < 0.000001;

  function openCreateAccount() {
    setEditingAccount(null);
    setAccountForm(defaultAccountForm());
    setAccountSheetOpen(true);
  }

  function openEditAccount(account) {
    setEditingAccount(account);
    setAccountForm({
      code: account.code ?? "",
      name: account.name ?? "",
      type: account.type ?? ACCOUNT_TYPE_OPTIONS[0],
      currency: account.currency ?? "MXN",
      initialBalance: String(account.initialBalance ?? "0"),
    });
    setAccountSheetOpen(true);
  }

  function handleSubmitAccount(event) {
    event.preventDefault();
    const payload = {
      code: accountForm.code.trim(),
      name: accountForm.name.trim(),
      type: accountForm.type,
      currency: accountForm.currency.trim().toUpperCase() || "MXN",
      initialBalance: toNumber(accountForm.initialBalance),
    };
    if (!payload.code || !payload.name) {
      toast.error("Codigo y nombre son obligatorios.");
      return;
    }
    if (editingAccount) {
      updateAccountMutation.mutate({ id: editingAccount.id, payload });
      return;
    }
    createAccountMutation.mutate(payload);
  }

  function updateLine(index, patch) {
    setEntryForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function addLine() {
    setEntryForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { accountId: "", debit: "", credit: "", note: "" },
      ],
    }));
  }

  function removeLine(index) {
    setEntryForm((prev) => {
      if (prev.lines.length <= 2) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
      };
    });
  }

  function handleSubmitEntry(event) {
    event.preventDefault();
    const concept = entryForm.concept.trim();
    if (!concept) {
      toast.error("El concepto es obligatorio.");
      return;
    }

    const lines = entryForm.lines.map((line) => ({
      accountId: line.accountId,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      note: line.note?.trim() || undefined,
      currency: entryForm.currency,
    }));

    if (lines.some((line) => !line.accountId)) {
      toast.error("Todas las lineas deben tener cuenta.");
      return;
    }

    if (!entryBalanced) {
      toast.error("La poliza debe estar balanceada (debitos = creditos).");
      return;
    }

    const payload = {
      occurredAt: entryForm.occurredAt
        ? new Date(entryForm.occurredAt).toISOString()
        : undefined,
      concept,
      reference: entryForm.reference.trim() || undefined,
      currency: entryForm.currency,
      sourceType: entryForm.sourceType,
      lines,
    };

    createEntryMutation.mutate(payload);
  }

  function handleSubmitFxRate(event) {
    event.preventDefault();
    const payload = {
      baseCurrency: fxForm.baseCurrency.trim().toUpperCase(),
      quoteCurrency: fxForm.quoteCurrency.trim().toUpperCase(),
      rateDate: fxForm.rateDate,
      rate: toNumber(fxForm.rate),
      source: fxForm.source.trim() || "manual",
    };

    if (!payload.baseCurrency || !payload.quoteCurrency) {
      toast.error("Moneda base y moneda destino son obligatorias.");
      return;
    }
    if (!payload.rateDate) {
      toast.error("La fecha del tipo de cambio es obligatoria.");
      return;
    }
    if (payload.baseCurrency === payload.quoteCurrency) {
      toast.error("La moneda base y destino deben ser diferentes.");
      return;
    }
    if (!Number.isFinite(payload.rate) || payload.rate <= 0) {
      toast.error("La tasa debe ser mayor a cero.");
      return;
    }

    createFxRateMutation.mutate(payload);
  }

  function guidedPresetMeta(sourceType) {
    if (sourceType === "income") {
      return {
        title: "Ingreso",
        fromLabel: "Cuenta origen / contrapartida",
        toLabel: "Cuenta destino del ingreso",
      };
    }
    if (sourceType === "expense") {
      return {
        title: "Egreso",
        fromLabel: "Cuenta de salida",
        toLabel: "Cuenta destino del gasto",
      };
    }
    return {
      title: "Transferencia",
      fromLabel: "Cuenta origen",
      toLabel: "Cuenta destino",
    };
  }

  function buildGuidedPayload() {
    const sourceType = guidedForm.sourceType;
    const concept = guidedForm.concept.trim();
    if (!concept) {
      throw new Error("El concepto es obligatorio.");
    }
    const amount = toNumber(guidedForm.amount);
    if (amount <= 0) {
      throw new Error("El monto debe ser mayor a cero.");
    }
    const fromAccountId = guidedForm.fromAccountId;
    const toAccountId = guidedForm.toAccountId;
    if (!fromAccountId || !toAccountId) {
      throw new Error("Debes seleccionar cuenta origen y cuenta destino.");
    }
    if (fromAccountId === toAccountId) {
      throw new Error("La cuenta origen y destino deben ser diferentes.");
    }
    const currency = (guidedForm.currency || "MXN").trim().toUpperCase();
    const note = guidedForm.note.trim();

    return {
      occurredAt: guidedForm.occurredAt
        ? new Date(guidedForm.occurredAt).toISOString()
        : undefined,
      concept,
      reference: guidedForm.reference.trim() || undefined,
      currency,
      sourceType,
      lines: [
        {
          accountId: toAccountId,
          debit: amount,
          credit: 0,
          note: note || undefined,
          currency,
        },
        {
          accountId: fromAccountId,
          debit: 0,
          credit: amount,
          note: note || undefined,
          currency,
        },
      ],
    };
  }

  function submitGuidedEntry(event) {
    event.preventDefault();
    try {
      const payload = buildGuidedPayload();
      createEntryMutation.mutate(payload, {
        onSuccess: () => {
          setGuidedSheetOpen(false);
          setGuidedForm(defaultGuidedForm());
        },
      });
    } catch (error) {
      toast.error(error.message || "No se pudo preparar la captura guiada.");
    }
  }

  function openGuidedInAdvanced() {
    try {
      const payload = buildGuidedPayload();
      setEntryForm({
        occurredAt: guidedForm.occurredAt,
        concept: payload.concept,
        reference: payload.reference ?? "",
        currency: payload.currency,
        sourceType: payload.sourceType,
        lines: payload.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit ? String(line.debit) : "",
          credit: line.credit ? String(line.credit) : "",
          note: line.note ?? "",
        })),
      });
      setGuidedSheetOpen(false);
      setEntrySheetOpen(true);
    } catch (error) {
      toast.error(error.message || "No se pudo abrir en editor avanzado.");
    }
  }

  const guidedMeta = guidedPresetMeta(guidedForm.sourceType);
  const canCreateMoves = activeAccounts.length >= 2;

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      {(activeSection === "summary" || activeSection === "accounts") && (
        <Button variant="outline" onClick={openCreateAccount}>
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      )}
      {(activeSection === "summary" || activeSection === "entries") && (
        <>
          <Button
            variant="outline"
            onClick={() => setGuidedSheetOpen(true)}
            disabled={!canCreateMoves}
          >
            <HandCoins className="h-4 w-4" />
            Captura guiada
          </Button>
          <Button
            onClick={() => setEntrySheetOpen(true)}
            disabled={!canCreateMoves}
          >
            <NotebookPen className="h-4 w-4" />
            Nueva poliza
          </Button>
        </>
      )}
    </div>
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

        {activeSection === "summary" && (
          <div className="space-y-4">
            {accountsQuery.isLoading ||
            balancesQuery.isLoading ||
            dashboardQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatCard
                  label="Cuentas activas"
                  value={String(activeAccounts.length)}
                  icon={ListTree}
                />
                <StatCard
                  label={`Debitos acumulados (${balanceTotalsBase.currency})`}
                  value={formatMoney(
                    balanceTotalsBase.debit,
                    balanceTotalsBase.currency,
                  )}
                  icon={Scale}
                />
                <StatCard
                  label={`Balance neto (${balanceTotalsBase.currency})`}
                  value={formatMoney(
                    balanceTotalsBase.net,
                    balanceTotalsBase.currency,
                  )}
                  icon={Landmark}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Ingresos del periodo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-xl font-semibold">
                    {formatMoney(
                      dashboard?.kpi?.income ?? "0",
                      dashboardCurrency,
                    )}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Variacion: {dashboardVariance?.income?.percent ?? 0}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Egresos del periodo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-xl font-semibold">
                    {formatMoney(
                      dashboard?.kpi?.expense ?? "0",
                      dashboardCurrency,
                    )}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Variacion: {dashboardVariance?.expense?.percent ?? 0}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Resultado neto del periodo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-xl font-semibold">
                    {formatMoney(
                      dashboard?.kpi?.netIncome ?? "0",
                      dashboardCurrency,
                    )}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Variacion: {dashboardVariance?.netIncome?.percent ?? 0}%
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Tendencia del periodo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardTrend.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Sin movimientos en el rango actual.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">
                            Fecha
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Ingresos
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Egresos
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Neto
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardTrend.slice(-14).map((point) => (
                          <tr
                            key={point.date}
                            className="border-t border-[hsl(var(--border))]"
                          >
                            <td className="px-3 py-2">{point.date}</td>
                            <td className="px-3 py-2">
                              {formatMoney(point.income, dashboardCurrency)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(point.expense, dashboardCurrency)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(point.net, dashboardCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {accountTypeStats.length === 0 ? (
              <EmptyState
                title="Sin cuentas contables"
                description="Crea tu primera cuenta para iniciar el libro mayor."
                icon={Wallet}
                action={{ label: "Nueva cuenta", onClick: openCreateAccount }}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Distribucion por tipo de cuenta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {accountTypeStats.map((item) => (
                      <Badge key={item.type} variant="glass">
                        {item.type}: {item.total}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Saldos convertidos a {balanceTotalsBase.currency}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {balancesQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : (balances?.data ?? []).length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Aun no hay saldos para mostrar.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">
                            Cuenta
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Neto original
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Neto convertido ({balanceTotalsBase.currency})
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(balances?.data ?? []).map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-[hsl(var(--border))]"
                          >
                            <td className="px-3 py-2">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {row.code} - {row.name}
                                </span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {row.type}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(row.totals?.net)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(
                                row.totalsBase?.net ?? "0",
                                row.totalsBase?.currency ??
                                  balanceTotalsBase.currency,
                              )}
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
        )}

        {activeSection === "accounts" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Plan de cuentas</CardTitle>
              </CardHeader>
              <CardContent>
                {accountsQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : accounts.length === 0 ? (
                  <EmptyState
                    title="No hay cuentas registradas"
                    description="Agrega cuentas para empezar a capturar polizas."
                    icon={ListTree}
                    action={{
                      label: "Crear cuenta",
                      onClick: openCreateAccount,
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
                          <th className="px-3 py-2 text-left font-medium">
                            Tipo
                          </th>
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
                        {accounts.map((account) => (
                          <tr
                            key={account.id}
                            className="border-t border-[hsl(var(--border))]"
                          >
                            <td className="px-3 py-2 font-mono">
                              {account.code}
                            </td>
                            <td className="px-3 py-2">{account.name}</td>
                            <td className="px-3 py-2">{account.type}</td>
                            <td className="px-3 py-2">{account.currency}</td>
                            <td className="px-3 py-2">
                              {formatMoney(account.initialBalance)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  account.enabled ? "success" : "secondary"
                                }
                              >
                                {account.enabled ? "Activa" : "Deshabilitada"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditAccount(account)}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <ActionMenu
                                  items={[
                                    account.enabled
                                      ? {
                                          label: "Deshabilitar",
                                          icon: PowerOff,
                                          disabled:
                                            pendingAccountId === account.id,
                                          onClick: () =>
                                            toggleAccountMutation.mutate({
                                              id: account.id,
                                              enabled: false,
                                            }),
                                        }
                                      : {
                                          label: "Habilitar",
                                          icon: Power,
                                          disabled:
                                            pendingAccountId === account.id,
                                          onClick: () =>
                                            toggleAccountMutation.mutate({
                                              id: account.id,
                                              enabled: true,
                                            }),
                                        },
                                  ]}
                                />
                              </div>
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
        )}

        {activeSection === "entries" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Polizas contables</CardTitle>
              </CardHeader>
              <CardContent>
                {entriesQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : entries.length === 0 ? (
                  <EmptyState
                    title="No hay polizas"
                    description="Registra tu primera poliza balanceada para iniciar movimientos."
                    icon={NotebookPen}
                    action={{
                      label: "Nueva poliza",
                      onClick: () => setEntrySheetOpen(true),
                    }}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">
                            Folio
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Fecha
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Concepto
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Total original
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Total convertido
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
                        {entries.map((entry) => {
                          const totalOriginal = toNumber(
                            entry.totalsOriginal?.debit,
                          );
                          const totalBase = toNumber(entry.totalsBase?.debit);
                          return (
                            <tr
                              key={entry.id}
                              className="border-t border-[hsl(var(--border))]"
                            >
                              <td className="px-3 py-2 font-mono text-xs">
                                {entry.entryNumber}
                              </td>
                              <td className="px-3 py-2">
                                {formatDate(entry.occurredAt)}
                              </td>
                              <td className="px-3 py-2">{entry.concept}</td>
                              <td className="px-3 py-2">
                                {formatMoney(totalOriginal)}
                              </td>
                              <td className="px-3 py-2">
                                {formatMoney(
                                  totalBase,
                                  entry.totalsBase?.currency ??
                                    dashboardCurrency,
                                )}{" "}
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {entry.totalsBase?.currency ?? "MXN"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  variant={
                                    entry.enabled ? "success" : "secondary"
                                  }
                                >
                                  {entry.enabled ? "Activa" : "Deshabilitada"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                <ActionMenu
                                  items={[
                                    entry.enabled
                                      ? {
                                          label: "Deshabilitar",
                                          icon: PowerOff,
                                          disabled: pendingEntryId === entry.id,
                                          onClick: () =>
                                            toggleEntryMutation.mutate({
                                              id: entry.id,
                                              enabled: false,
                                            }),
                                        }
                                      : {
                                          label: "Habilitar",
                                          icon: Power,
                                          disabled: pendingEntryId === entry.id,
                                          onClick: () =>
                                            toggleEntryMutation.mutate({
                                              id: entry.id,
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Libro mayor reciente (lineas)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {entriesQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : entries.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Sin lineas de poliza para mostrar.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">
                            Folio
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Cuenta
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Importe original
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Importe base
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Tasa
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Fecha tasa
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.flatMap((entry) =>
                          (entry.lines ?? []).map((line) => (
                            <tr
                              key={`${entry.id}-${line.id}`}
                              className="border-t border-[hsl(var(--border))]"
                            >
                              <td className="px-3 py-2 font-mono text-xs">
                                {entry.entryNumber}
                              </td>
                              <td className="px-3 py-2">
                                {line.account?.code
                                  ? `${line.account.code} - `
                                  : ""}
                                {line.account?.name ?? "Cuenta"}
                              </td>
                              <td className="px-3 py-2">
                                {formatMoney(
                                  line.original?.debit ||
                                    line.original?.credit ||
                                    "0",
                                )}{" "}
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {line.original?.currency ??
                                    line.currency ??
                                    "MXN"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {formatMoney(
                                  Math.abs(
                                    toNumber(
                                      line.converted?.net ??
                                        line.baseAmount ??
                                        "0",
                                    ),
                                  ),
                                  line.converted?.currency ??
                                    entry.baseCurrency ??
                                    dashboardCurrency,
                                )}{" "}
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {line.converted?.currency ??
                                    entry.baseCurrency ??
                                    "MXN"}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {line.fxRate ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                                {formatDate(line.fxTrace?.rateDate)}
                              </td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === "fx-rates" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Registrar tipo de cambio manual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  id="finance-fx-rate-form"
                  className="grid grid-cols-1 md:grid-cols-5 gap-3"
                  onSubmit={handleSubmitFxRate}
                >
                  <SelectField
                    label="Base"
                    icon={Coins}
                    value={fxForm.baseCurrency}
                    onValueChange={(value) =>
                      setFxForm((prev) => ({
                        ...prev,
                        baseCurrency: normalizeCurrencyCode(value),
                      }))
                    }
                    options={resolveCurrencyOptions(fxForm.baseCurrency)}
                    required
                  />
                  <SelectField
                    label="Destino"
                    icon={ArrowRightLeft}
                    value={fxForm.quoteCurrency}
                    onValueChange={(value) =>
                      setFxForm((prev) => ({
                        ...prev,
                        quoteCurrency: normalizeCurrencyCode(value),
                      }))
                    }
                    options={resolveCurrencyOptions(fxForm.quoteCurrency)}
                    required
                  />
                  <DateField
                    label="Fecha"
                    icon={Calendar}
                    value={fxForm.rateDate}
                    onChange={(event) =>
                      setFxForm((prev) => ({
                        ...prev,
                        rateDate: event.target.value,
                      }))
                    }
                    required
                  />
                  <NumberField
                    label="Tasa"
                    icon={Scale}
                    step="0.000001"
                    min="0"
                    value={fxForm.rate}
                    onChange={(event) =>
                      setFxForm((prev) => ({
                        ...prev,
                        rate: event.target.value,
                      }))
                    }
                    placeholder="17.200000"
                    required
                  />
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      className="w-full"
                      loading={createFxRateMutation.isPending}
                    >
                      Guardar tasa
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Historial de tipos de cambio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fxRatesQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : fxRates.length === 0 ? (
                  <EmptyState
                    title="Sin tipos de cambio"
                    description="Registra la primera tasa manual para tu empresa."
                    icon={ArrowRightLeft}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">
                            Par
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Fecha
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Tasa
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Fuente
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
                        {fxRates.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-[hsl(var(--border))]"
                          >
                            <td className="px-3 py-2 font-mono">
                              {row.baseCurrency}/{row.quoteCurrency}
                            </td>
                            <td className="px-3 py-2">
                              {formatFxDate(row.rateDate)}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {Number(row.rate).toFixed(6)}
                            </td>
                            <td className="px-3 py-2">
                              {row.source || "manual"}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={row.enabled ? "success" : "secondary"}
                              >
                                {row.enabled ? "Activa" : "Deshabilitada"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <ActionMenu
                                items={[
                                  row.enabled
                                    ? {
                                        label: "Deshabilitar",
                                        icon: PowerOff,
                                        disabled: pendingFxRateId === row.id,
                                        onClick: () =>
                                          toggleFxRateMutation.mutate({
                                            id: row.id,
                                            enabled: false,
                                          }),
                                      }
                                    : {
                                        label: "Habilitar",
                                        icon: Power,
                                        disabled: pendingFxRateId === row.id,
                                        onClick: () =>
                                          toggleFxRateMutation.mutate({
                                            id: row.id,
                                            enabled: true,
                                          }),
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
        )}
      </div>

      <Sheet
        open={guidedSheetOpen}
        onOpenChange={(open) => {
          if (createEntryMutation.isPending) return;
          setGuidedSheetOpen(open);
          if (!open) setGuidedForm(defaultGuidedForm());
        }}
      >
        <SheetContent className="sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
          <SheetHeader>
            <SheetTitle>Captura guiada</SheetTitle>
          </SheetHeader>
          <form
            id="finance-guided-form"
            className="space-y-4 py-4"
            onSubmit={submitGuidedEntry}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={
                  guidedForm.sourceType === "income" ? "default" : "outline"
                }
                onClick={() =>
                  setGuidedForm((prev) => ({ ...prev, sourceType: "income" }))
                }
              >
                <HandCoins className="h-4 w-4" />
                Ingreso
              </Button>
              <Button
                type="button"
                variant={
                  guidedForm.sourceType === "expense" ? "default" : "outline"
                }
                onClick={() =>
                  setGuidedForm((prev) => ({ ...prev, sourceType: "expense" }))
                }
              >
                <Receipt className="h-4 w-4" />
                Egreso
              </Button>
              <Button
                type="button"
                variant={
                  guidedForm.sourceType === "transfer" ? "default" : "outline"
                }
                onClick={() =>
                  setGuidedForm((prev) => ({ ...prev, sourceType: "transfer" }))
                }
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transferencia
              </Button>
            </div>

            <div className="rounded-xl border border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
              Flujo activo:{" "}
              <span className="font-medium text-[hsl(var(--foreground))]">
                {guidedMeta.title}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                label="Concepto"
                icon={Notebook}
                value={guidedForm.concept}
                onChange={(event) =>
                  setGuidedForm((prev) => ({
                    ...prev,
                    concept: event.target.value,
                  }))
                }
                placeholder={`${guidedMeta.title} registrado`}
                required
              />
              <TextField
                label="Referencia"
                icon={Hash}
                value={guidedForm.reference}
                onChange={(event) =>
                  setGuidedForm((prev) => ({
                    ...prev,
                    reference: event.target.value,
                  }))
                }
                placeholder="REF-001"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CurrencyField
                label="Monto"
                icon={Scale}
                value={guidedForm.amount}
                onChange={(value) =>
                  setGuidedForm((prev) => ({ ...prev, amount: value }))
                }
                currency={guidedForm.currency || "MXN"}
                allowNegative={false}
                min={0}
                placeholder="0.00"
                required
              />
              <SelectField
                label="Moneda"
                icon={Coins}
                value={guidedForm.currency}
                onValueChange={(value) =>
                  setGuidedForm((prev) => ({
                    ...prev,
                    currency: normalizeCurrencyCode(value),
                  }))
                }
                options={resolveCurrencyOptions(guidedForm.currency)}
                required
              />
              <DateTimeField
                label="Fecha"
                icon={CalendarDays}
                value={guidedForm.occurredAt}
                onChange={(event) =>
                  setGuidedForm((prev) => ({
                    ...prev,
                    occurredAt: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SelectField
                label={guidedMeta.fromLabel}
                icon={Wallet}
                value={guidedForm.fromAccountId}
                onValueChange={(value) =>
                  setGuidedForm((prev) => ({ ...prev, fromAccountId: value }))
                }
                options={activeAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.code} - ${account.name}`,
                }))}
                placeholder="Selecciona cuenta"
                required
              />
              <SelectField
                label={guidedMeta.toLabel}
                icon={Wallet}
                value={guidedForm.toAccountId}
                onValueChange={(value) =>
                  setGuidedForm((prev) => ({ ...prev, toAccountId: value }))
                }
                options={activeAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.code} - ${account.name}`,
                }))}
                placeholder="Selecciona cuenta"
                required
              />
            </div>

            <TextField
              label="Nota"
              icon={FileText}
              value={guidedForm.note}
              onChange={(event) =>
                setGuidedForm((prev) => ({ ...prev, note: event.target.value }))
              }
              placeholder="Detalle opcional"
            />
          </form>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setGuidedSheetOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openGuidedInAdvanced}
            >
              Abrir en editor avanzado
            </Button>
            <Button
              type="submit"
              form="finance-guided-form"
              loading={createEntryMutation.isPending}
            >
              Guardar {guidedMeta.title.toLowerCase()}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={accountSheetOpen}
        onOpenChange={(open) => {
          if (
            createAccountMutation.isPending ||
            updateAccountMutation.isPending
          )
            return;
          setAccountSheetOpen(open);
          if (!open) {
            setEditingAccount(null);
            setAccountForm(defaultAccountForm());
          }
        }}
      >
        <SheetContent className="sm:max-w-md lg:max-w-xl xl:max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {editingAccount ? "Editar cuenta" : "Nueva cuenta"}
            </SheetTitle>
          </SheetHeader>
          <form
            id="finance-account-form"
            className="space-y-3 py-4"
            onSubmit={handleSubmitAccount}
          >
            <TextField
              label="Codigo"
              icon={Hash}
              value={accountForm.code}
              onChange={(event) =>
                setAccountForm((prev) => ({
                  ...prev,
                  code: event.target.value,
                }))
              }
              placeholder="1101"
              required
            />
            <TextField
              label="Nombre"
              icon={Wallet}
              value={accountForm.name}
              onChange={(event) =>
                setAccountForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Caja general"
              required
            />
            <SelectField
              label="Tipo"
              icon={Component}
              value={accountForm.type}
              onValueChange={(value) =>
                setAccountForm((prev) => ({ ...prev, type: value }))
              }
              options={ACCOUNT_TYPE_OPTIONS.map((option) => ({
                value: option,
                label: option,
              }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Moneda"
                icon={Coins}
                value={accountForm.currency}
                onValueChange={(value) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    currency: normalizeCurrencyCode(value),
                  }))
                }
                options={resolveCurrencyOptions(accountForm.currency)}
                required
              />
              <CurrencyField
                label="Saldo inicial"
                icon={Scale}
                value={accountForm.initialBalance}
                onChange={(value) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    initialBalance: value,
                  }))
                }
                currency={accountForm.currency || "MXN"}
                allowNegative
                allowDecimal
                fractionDigits={2}
              />
            </div>
          </form>
          <SheetFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAccountSheetOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="finance-account-form"
              loading={
                createAccountMutation.isPending ||
                updateAccountMutation.isPending
              }
            >
              {editingAccount ? "Guardar cambios" : "Crear cuenta"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={entrySheetOpen}
        onOpenChange={(open) => {
          if (createEntryMutation.isPending) return;
          setEntrySheetOpen(open);
          if (!open) setEntryForm(defaultEntryForm());
        }}
      >
        <SheetContent className="sm:max-w-6xl w-[min(96vw,1200px)]">
          <SheetHeader>
            <SheetTitle>Nueva poliza</SheetTitle>
          </SheetHeader>
          <form
            id="finance-entry-form"
            className="space-y-4 py-4"
            onSubmit={handleSubmitEntry}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                label="Concepto"
                icon={Notebook}
                value={entryForm.concept}
                onChange={(event) =>
                  setEntryForm((prev) => ({
                    ...prev,
                    concept: event.target.value,
                  }))
                }
                placeholder="Pago de proveedor"
                required
              />
              <TextField
                label="Referencia"
                icon={Hash}
                value={entryForm.reference}
                onChange={(event) =>
                  setEntryForm((prev) => ({
                    ...prev,
                    reference: event.target.value,
                  }))
                }
                placeholder="FAC-1044"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DateTimeField
                label="Fecha"
                icon={CalendarDays}
                value={entryForm.occurredAt}
                onChange={(event) =>
                  setEntryForm((prev) => ({
                    ...prev,
                    occurredAt: event.target.value,
                  }))
                }
              />
              <SelectField
                label="Moneda"
                icon={Coins}
                value={entryForm.currency}
                onValueChange={(value) =>
                  setEntryForm((prev) => ({
                    ...prev,
                    currency: normalizeCurrencyCode(value),
                  }))
                }
                options={resolveCurrencyOptions(entryForm.currency)}
                required
              />
              <SelectField
                label="Origen"
                icon={ArrowRightLeft}
                value={entryForm.sourceType}
                onValueChange={(value) =>
                  setEntryForm((prev) => ({ ...prev, sourceType: value }))
                }
                options={SOURCE_TYPE_OPTIONS}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Lineas de poliza</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addLine}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar linea
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))/0.35]">
                    <tr>
                      <th className="px-2 py-2.5 text-left font-medium">
                        Cuenta
                      </th>
                      <th className="px-2 py-2.5 text-left font-medium">
                        Debito
                      </th>
                      <th className="px-2 py-2.5 text-left font-medium">
                        Credito
                      </th>
                      <th className="px-2 py-2.5 text-left font-medium">
                        Nota
                      </th>
                      <th className="px-2 py-2.5 text-left font-medium">
                        Accion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryForm.lines.map((line, index) => (
                      <tr
                        key={`line-${index}`}
                        className="border-t border-[hsl(var(--border))]"
                      >
                        <td className="px-2 py-2.5 min-w-56">
                          <div className="relative">
                            <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <Select
                              value={line.accountId}
                              onValueChange={(value) =>
                                updateLine(index, { accountId: value })
                              }
                            >
                              <SelectTrigger className="h-10 pl-9">
                                <SelectValue placeholder="Selecciona cuenta" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeAccounts.map((account) => (
                                  <SelectItem
                                    key={account.id}
                                    value={account.id}
                                  >
                                    {account.code} - {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 min-w-40">
                          <CurrencyField
                            icon={Plus}
                            value={line.debit}
                            onChange={(value) =>
                              updateLine(index, { debit: value })
                            }
                            currency={entryForm.currency || "MXN"}
                            allowNegative={false}
                            allowDecimal
                            fractionDigits={2}
                            className="h-10"
                          />
                        </td>
                        <td className="px-2 py-2.5 min-w-40">
                          <CurrencyField
                            icon={Minus}
                            value={line.credit}
                            onChange={(value) =>
                              updateLine(index, { credit: value })
                            }
                            currency={entryForm.currency || "MXN"}
                            allowNegative={false}
                            allowDecimal
                            fractionDigits={2}
                            className="h-10"
                          />
                        </td>
                        <td className="px-2 py-2.5 min-w-48">
                          <div className="relative">
                            <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <Input
                              value={line.note}
                              onChange={(event) =>
                                updateLine(index, { note: event.target.value })
                              }
                              className="h-10 pl-9"
                              placeholder="Detalle opcional"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeLine(index)}
                            disabled={entryForm.lines.length <= 2}
                          >
                            Quitar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="glass">
                  Debito: {formatMoney(lineTotals.debit)}
                </Badge>
                <Badge variant="glass">
                  Credito: {formatMoney(lineTotals.credit)}
                </Badge>
                <Badge variant={entryBalanced ? "success" : "destructive"}>
                  {entryBalanced ? "Balanceada" : "No balanceada"}
                </Badge>
              </div>
            </div>
          </form>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setEntrySheetOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="finance-entry-form"
              loading={createEntryMutation.isPending}
              disabled={!entryBalanced || activeAccounts.length < 2}
            >
              Guardar poliza
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
