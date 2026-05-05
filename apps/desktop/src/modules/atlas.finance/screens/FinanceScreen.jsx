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
  Checkbox,
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

const APPLY_SOURCE_DOC_TYPES = new Set(["PAYMENT", "ADVANCE", "CREDIT_NOTE"]);
const DOCUMENT_TYPE_LABELS = {
  INVOICE: "Factura",
  CREDIT_NOTE: "Nota de credito",
  DEBIT_NOTE: "Nota de debito",
  ADVANCE: "Anticipo",
  PAYMENT: "Pago",
};

const APPLICATION_STATUS_LABELS = {
  APPLIED: "Aplicada",
  REVERSED: "Revertida",
};

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

function formatDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDocumentTypeLabel(value) {
  const key = String(value ?? "").trim().toUpperCase();
  return DOCUMENT_TYPE_LABELS[key] || key || "-";
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

function computeApplyTotals(lines, sourceOpenAmount) {
  const applied = lines.reduce(
    (sum, line) =>
      sum +
      toNumber(
        line.sourceAmount !== undefined ? line.sourceAmount : line.amount,
      ),
    0,
  );
  const sourceOpen = toNumber(sourceOpenAmount);
  return {
    applied,
    unapplied: Math.max(0, Number((sourceOpen - applied).toFixed(2))),
  };
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

function defaultDocumentForm(direction = "AR") {
  const today = new Date().toISOString().slice(0, 10);
  return {
    direction,
    docType: "INVOICE",
    contactId: "",
    currency: "MXN",
    issueDate: today,
    dueDate: "",
    reference: "",
    notesMarkdown: "",
    subtotalAmount: "",
    totalAmount: "",
    selectedTaxRateIds: [],
  };
}

function defaultTaxRateForm() {
  return {
    key: "",
    name: "",
    kind: "TRANSFER",
    rate: "",
    direction: "AR",
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
  if (path === "/finance/ar") return "ar";
  if (path === "/finance/ap") return "ap";
  if (path === "/finance/aging") return "aging";
  if (path === "/finance/applications") return "applications";
  if (path === "/finance/accounts") return "accounts";
  if (path === "/finance/entries") return "entries";
  if (path === "/finance/taxes") return "taxes";
  if (path === "/finance/fx-rates") return "fx-rates";
  return "summary";
}

const SECTION_META = {
  summary: {
    title: "Finanzas",
    description: "Resumen operativo y saldos convertidos para tu instancia.",
  },
  ar: {
    title: "Cuentas por cobrar (CxC)",
    description: "Facturas, anticipos y pagos de clientes.",
  },
  ap: {
    title: "Cuentas por pagar (CxP)",
    description: "Facturas, anticipos y pagos a proveedores.",
  },
  aging: {
    title: "Aging",
    description: "Envejecimiento de saldos abiertos por contacto.",
  },
  applications: {
    title: "Aplicaciones",
    description: "Aplicacion FIFO de pagos/anticipos/notas de credito.",
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
  taxes: {
    title: "Impuestos y retenciones",
    description: "Catalogo fiscal base para AR/AP y calculo documental.",
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
  const [documentSheetOpen, setDocumentSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState(defaultAccountForm);
  const [guidedForm, setGuidedForm] = useState(defaultGuidedForm);
  const [fxForm, setFxForm] = useState(defaultFxForm);
  const [entryForm, setEntryForm] = useState(defaultEntryForm);
  const [documentForm, setDocumentForm] = useState(defaultDocumentForm("AR"));
  const [taxRateForm, setTaxRateForm] = useState(defaultTaxRateForm);
  const [pendingDocumentId, setPendingDocumentId] = useState(null);
  const [pendingApplyDocumentId, setPendingApplyDocumentId] = useState(null);
  const [pendingAccountId, setPendingAccountId] = useState(null);
  const [pendingEntryId, setPendingEntryId] = useState(null);
  const [pendingFxRateId, setPendingFxRateId] = useState(null);
  const [pendingTaxRateId, setPendingTaxRateId] = useState(null);
  const [applySheetOpen, setApplySheetOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySourceDocument, setApplySourceDocument] = useState(null);
  const [applyLines, setApplyLines] = useState([]);
  const [applyTargets, setApplyTargets] = useState([]);
  const [applyTotals, setApplyTotals] = useState({ applied: 0, unapplied: 0 });
  const [applyNote, setApplyNote] = useState("");
  const [journalSheetOpen, setJournalSheetOpen] = useState(false);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalSourceDocument, setJournalSourceDocument] = useState(null);
  const [journalLinks, setJournalLinks] = useState([]);
  const [applicationsDirectionFilter, setApplicationsDirectionFilter] =
    useState("all");
  const [applicationsStatusFilter, setApplicationsStatusFilter] =
    useState("all");
  const [applicationsContactFilter, setApplicationsContactFilter] =
    useState("all");
  const [applicationsFromDate, setApplicationsFromDate] = useState("");
  const [applicationsToDate, setApplicationsToDate] = useState("");
  const [pendingReverseApplicationId, setPendingReverseApplicationId] =
    useState(null);

  const routePath = wildcard ? `/${wildcard}` : "/";
  const activeSection = resolveFinanceSection(routePath);
  const pageMeta = SECTION_META[activeSection] ?? SECTION_META.summary;
  const needsAccounts =
    activeSection === "summary" ||
    activeSection === "accounts" ||
    activeSection === "entries" ||
    activeSection === "ar" ||
    activeSection === "ap" ||
    activeSection === "applications" ||
    accountSheetOpen ||
    guidedSheetOpen ||
    entrySheetOpen;
  const needsBalances = activeSection === "summary";
  const needsDashboard = activeSection === "summary";
  const needsEntries = activeSection === "entries";
  const needsFxRates = activeSection === "fx-rates";
  const needsTaxRates =
    activeSection === "taxes" ||
    activeSection === "ar" ||
    activeSection === "ap" ||
    documentSheetOpen;
  const needsContacts =
    activeSection === "ar" ||
    activeSection === "ap" ||
    activeSection === "applications" ||
    documentSheetOpen;
  const needsArDocuments = activeSection === "ar";
  const needsApDocuments = activeSection === "ap";
  const needsApplicationDocuments = activeSection === "applications";
  const needsAging = activeSection === "aging";

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

  const taxRatesQuery = useQuery({
    queryKey: ["finance-tax-rates"],
    queryFn: () => atlas.finance.listTaxRates(token, { limit: 200 }),
    enabled: Boolean(token) && needsTaxRates,
  });

  const contactsQuery = useQuery({
    queryKey: ["finance-contacts-options"],
    queryFn: () => atlas.contacts.list(token, { limit: 200 }),
    enabled: Boolean(token) && needsContacts,
  });

  const arDocumentsQuery = useQuery({
    queryKey: ["finance-documents", "AR"],
    queryFn: () =>
      atlas.finance.listDocuments(token, {
        direction: "AR",
        limit: 200,
      }),
    enabled: Boolean(token) && needsArDocuments,
  });

  const apDocumentsQuery = useQuery({
    queryKey: ["finance-documents", "AP"],
    queryFn: () =>
      atlas.finance.listDocuments(token, {
        direction: "AP",
        limit: 200,
      }),
    enabled: Boolean(token) && needsApDocuments,
  });

  const applicationDocumentsQuery = useQuery({
    queryKey: ["finance-documents-applications"],
    queryFn: () =>
      atlas.finance.listDocuments(token, {
        status: "OPEN",
        limit: 250,
      }),
    enabled: Boolean(token) && needsApplicationDocuments,
  });

  const applicationsHistoryQuery = useQuery({
    queryKey: [
      "finance-applications-history",
      applicationsDirectionFilter,
      applicationsStatusFilter,
      applicationsContactFilter,
      applicationsFromDate,
      applicationsToDate,
    ],
    queryFn: () =>
      atlas.finance.listApplications(token, {
        direction:
          applicationsDirectionFilter !== "all"
            ? applicationsDirectionFilter
            : undefined,
        status:
          applicationsStatusFilter !== "all"
            ? applicationsStatusFilter
            : undefined,
        contactId:
          applicationsContactFilter !== "all"
            ? applicationsContactFilter
            : undefined,
        from: applicationsFromDate || undefined,
        to: applicationsToDate || undefined,
        limit: 200,
      }),
    enabled: Boolean(token) && needsApplicationDocuments,
  });

  const agingQuery = useQuery({
    queryKey: ["finance-aging"],
    queryFn: () => atlas.finance.getAging(token, {}),
    enabled: Boolean(token) && needsAging,
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

  const createDocumentMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createDocument(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({ queryKey: ["finance-documents-applications"] });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      queryClient.invalidateQueries({ queryKey: ["finance-applications-history"] });
      setDocumentSheetOpen(false);
      setDocumentForm(defaultDocumentForm(documentForm.direction || "AR"));
      toast.success("Documento registrado");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo registrar el documento."));
    },
  });

  const toggleDocumentMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setDocumentEnabled(id, enabled, token),
    onMutate: ({ id }) => {
      setPendingDocumentId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({ queryKey: ["finance-documents-applications"] });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      queryClient.invalidateQueries({ queryKey: ["finance-applications-history"] });
      toast.success("Estado de documento actualizado");
    },
    onSettled: () => {
      setPendingDocumentId(null);
    },
    onError: (error) => {
      toast.error(
        parseApiError(error, "No se pudo actualizar el estado del documento."),
      );
    },
  });

  const applyFifoMutation = useMutation({
    mutationFn: ({ documentId, lines, note }) =>
      atlas.finance.applyDocument(
        documentId,
        {
          lines,
          note: note ?? null,
        },
        token,
      ),
    onMutate: ({ documentId }) => {
      setPendingApplyDocumentId(documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({ queryKey: ["finance-documents-applications"] });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      queryClient.invalidateQueries({ queryKey: ["finance-applications-history"] });
      toast.success("Aplicacion registrada");
    },
    onSettled: () => {
      setPendingApplyDocumentId(null);
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo aplicar el documento."));
    },
  });

  const createTaxRateMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createTaxRate(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-tax-rates"] });
      setTaxRateForm(defaultTaxRateForm());
      toast.success("Impuesto guardado");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo guardar el impuesto."));
    },
  });

  const toggleTaxRateMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setTaxRateEnabled(id, enabled, token),
    onMutate: ({ id }) => {
      setPendingTaxRateId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-tax-rates"] });
      toast.success("Estado de impuesto actualizado");
    },
    onSettled: () => {
      setPendingTaxRateId(null);
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo actualizar el impuesto."));
    },
  });

  const reverseApplicationMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      atlas.finance.reverseApplication(id, { reason: reason ?? null }, token),
    onMutate: ({ id }) => {
      setPendingReverseApplicationId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({ queryKey: ["finance-documents-applications"] });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      queryClient.invalidateQueries({ queryKey: ["finance-applications-history"] });
      toast.success("Aplicacion anulada");
    },
    onSettled: () => {
      setPendingReverseApplicationId(null);
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo anular la aplicacion."));
    },
  });

  const accounts = accountsQuery.data?.data ?? [];
  const balances = balancesQuery.data?.data;
  const entries = entriesQuery.data?.data ?? [];
  const fxRates = fxRatesQuery.data?.data ?? [];
  const taxRates = taxRatesQuery.data?.data ?? [];
  const contacts = contactsQuery.data?.data ?? [];
  const arDocuments = arDocumentsQuery.data?.data ?? [];
  const apDocuments = apDocumentsQuery.data?.data ?? [];
  const applicationDocuments = applicationDocumentsQuery.data?.data ?? [];
  const applicationsHistory = applicationsHistoryQuery.data?.data ?? [];
  const agingData = agingQuery.data?.data;
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
  const activeTaxRates = useMemo(
    () => taxRates.filter((row) => row.enabled),
    [taxRates],
  );
  const selectedDocumentTaxes = useMemo(
    () =>
      activeTaxRates.filter((tax) =>
        (documentForm.selectedTaxRateIds ?? []).includes(tax.id),
      ),
    [activeTaxRates, documentForm.selectedTaxRateIds],
  );
  const documentTaxPreview = useMemo(() => {
    const subtotal = toNumber(documentForm.subtotalAmount);
    const totals = selectedDocumentTaxes.reduce(
      (acc, tax) => {
        const rate = toNumber(tax.rate);
        const amount = Number(((subtotal * rate) / 100).toFixed(2));
        if (String(tax.kind) === "WITHHOLDING") {
          acc.withholdings += amount;
        } else {
          acc.transfers += amount;
        }
        return acc;
      },
      { transfers: 0, withholdings: 0 },
    );
    const netTaxes = Number((totals.transfers - totals.withholdings).toFixed(2));
    const suggestedTotal = Number((subtotal + netTaxes).toFixed(2));
    return {
      subtotal,
      transfers: Number(totals.transfers.toFixed(2)),
      withholdings: Number(totals.withholdings.toFixed(2)),
      netTaxes,
      suggestedTotal,
    };
  }, [selectedDocumentTaxes, documentForm.subtotalAmount]);
  const applyTargetById = useMemo(
    () =>
      new Map(
        applyTargets.map((target) => [
          target.id,
          {
            openAmount: toNumber(target.openAmount),
            currency: target.currency || "MXN",
            label:
              target.reference ||
              target.contact?.name ||
              target.contact?.legalName ||
              target.id,
          },
        ]),
      ),
    [applyTargets],
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

  function openCreateDocument(direction) {
    setDocumentForm(defaultDocumentForm(direction));
    setDocumentSheetOpen(true);
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

  function handleSubmitTaxRate(event) {
    event.preventDefault();
    const rate = toNumber(taxRateForm.rate);
    const payload = {
      key: taxRateForm.key.trim().toUpperCase(),
      name: taxRateForm.name.trim(),
      kind: taxRateForm.kind,
      rate,
      direction: taxRateForm.direction || null,
    };
    if (!payload.key || !payload.name) {
      toast.error("Clave y nombre del impuesto son obligatorios.");
      return;
    }
    if (!Number.isFinite(payload.rate) || payload.rate < 0) {
      toast.error("La tasa del impuesto es invalida.");
      return;
    }
    createTaxRateMutation.mutate(payload);
  }

  function toggleDocumentTaxSelection(taxRateId, checked) {
    setDocumentForm((prev) => {
      const current = new Set(prev.selectedTaxRateIds ?? []);
      if (checked) {
        current.add(taxRateId);
      } else {
        current.delete(taxRateId);
      }
      const nextSelectedTaxRateIds = [...current];
      const subtotal = toNumber(prev.subtotalAmount);
      let nextTotalAmount = prev.totalAmount;
      if (subtotal > 0) {
        const selected = activeTaxRates.filter((tax) =>
          nextSelectedTaxRateIds.includes(tax.id),
        );
        const totals = selected.reduce(
          (acc, tax) => {
            const amount = Number(
              ((subtotal * toNumber(tax.rate)) / 100).toFixed(2),
            );
            if (String(tax.kind) === "WITHHOLDING") acc.withholdings += amount;
            else acc.transfers += amount;
            return acc;
          },
          { transfers: 0, withholdings: 0 },
        );
        const suggestedTotal = Number(
          (subtotal + totals.transfers - totals.withholdings).toFixed(2),
        );
        nextTotalAmount = String(suggestedTotal);
      }
      return {
        ...prev,
        selectedTaxRateIds: nextSelectedTaxRateIds,
        totalAmount: nextTotalAmount,
      };
    });
  }

  function handleSubmitDocument(event) {
    event.preventDefault();
    const computedTotalAmount = toNumber(documentForm.totalAmount);
    const totalAmount =
      computedTotalAmount > 0
        ? computedTotalAmount
        : documentTaxPreview.suggestedTotal > 0
          ? documentTaxPreview.suggestedTotal
          : 0;
    if (totalAmount <= 0) {
      toast.error("El monto total debe ser mayor a cero.");
      return;
    }
    if (!documentForm.issueDate) {
      toast.error("La fecha de emision es obligatoria.");
      return;
    }

    const payload = {
      direction: documentForm.direction,
      docType: documentForm.docType,
      contactId: documentForm.contactId || null,
      currency: normalizeCurrencyCode(documentForm.currency || "MXN"),
      issueDate: documentForm.issueDate,
      dueDate: documentForm.dueDate || null,
      reference: documentForm.reference.trim() || null,
      notesMarkdown: documentForm.notesMarkdown.trim() || null,
      subtotalAmount:
        toNumber(documentForm.subtotalAmount) > 0
          ? toNumber(documentForm.subtotalAmount)
          : undefined,
      totalAmount,
      taxLines: (documentForm.selectedTaxRateIds ?? []).map((taxRateId) => ({
        taxRateId,
        baseAmount:
          toNumber(documentForm.subtotalAmount) > 0
            ? toNumber(documentForm.subtotalAmount)
            : undefined,
      })),
    };
    createDocumentMutation.mutate(payload);
  }

  async function openApplySheetForDocument(document) {
    setApplySourceDocument(document);
    setApplyLines([]);
    setApplyTargets([]);
    setApplyTotals({
      applied: 0,
      unapplied: toNumber(document?.openAmount),
    });
    setApplyNote("");
    setApplySheetOpen(true);
    setApplyLoading(true);
    try {
      const preview = await atlas.finance.previewApplication(
        document.id,
        { allocationMode: "fifo" },
        token,
      );
      const previewData = preview?.data ?? {};
      const targets = previewData.targets ?? [];
      const fxByTarget = previewData.fxByTarget ?? {};
      const lineByTarget = new Map(
        (previewData.lines ?? []).map((line) => [
          line.targetDocumentId,
          {
            amount: toNumber(line.amount),
            targetAmount: toNumber(line.targetAmount ?? line.amount),
            sourceAmount: toNumber(line.sourceAmount ?? line.amount),
            effectiveFxRate: toNumber(line.effectiveFxRate || 1),
            sourceCurrency:
              line.sourceCurrency ||
              previewData.source?.currency ||
              document?.currency ||
              "MXN",
            targetCurrency:
              line.targetCurrency ||
              targets.find((target) => target.id === line.targetDocumentId)
                ?.currency ||
              document?.currency ||
              "MXN",
          },
        ]),
      );
      const draftLines = targets.map((target) => {
        const targetFx = fxByTarget?.[target.id];
        return {
          targetDocumentId: target.id,
          amount: lineByTarget.get(target.id)?.amount ?? 0,
          targetAmount: lineByTarget.get(target.id)?.targetAmount ?? 0,
          sourceAmount: lineByTarget.get(target.id)?.sourceAmount ?? 0,
          effectiveFxRate:
            lineByTarget.get(target.id)?.effectiveFxRate ??
            toNumber(targetFx?.effectiveFxRate || 0),
          targetCurrency: target.currency || "MXN",
          sourceCurrency: document?.currency || "MXN",
        };
      });
      setApplyTargets(targets);
      setApplyLines(draftLines);
      setApplyTotals(
        computeApplyTotals(draftLines, document?.openAmount ?? previewData.source?.openAmount),
      );
    } catch (error) {
      toast.error(
        parseApiError(error, "No se pudo cargar la propuesta de aplicacion."),
      );
      setApplySheetOpen(false);
    } finally {
      setApplyLoading(false);
    }
  }

  function updateApplyLine(targetDocumentId, amountValue) {
    setApplyLines((prev) => {
      const next = prev.map((line) =>
        line.targetDocumentId === targetDocumentId
          ? (() => {
              const targetAmount = toNumber(amountValue);
              const fxRate = toNumber(line.effectiveFxRate || 0);
              const sourceAmount =
                fxRate > 0
                  ? Number((targetAmount / fxRate).toFixed(2))
                  : targetAmount;
              return {
                ...line,
                amount: targetAmount,
                targetAmount,
                sourceAmount,
              };
            })()
          : line,
      );
      const totals = computeApplyTotals(next, applySourceDocument?.openAmount);
      setApplyTotals(totals);
      return next;
    });
  }

  function resetApplyToFifo() {
    if (!applyTargets.length) return;
    const next = applyTargets.map((target) => ({
      targetDocumentId: target.id,
      amount: 0,
      targetAmount: 0,
      sourceAmount: 0,
      effectiveFxRate: target.currency === applySourceDocument?.currency ? 1 : 0,
      targetCurrency: target.currency || "MXN",
      sourceCurrency: applySourceDocument?.currency || "MXN",
    }));
    setApplyLines(next);
    setApplyTotals(computeApplyTotals(next, applySourceDocument?.openAmount));
  }

  function submitManualApply(event) {
    event.preventDefault();
    if (!applySourceDocument?.id) {
      toast.error("No hay documento origen para aplicar.");
      return;
    }

    const lines = applyLines
      .map((line) => ({
        targetDocumentId: line.targetDocumentId,
        amount: toNumber(line.amount),
        effectiveFxRate: toNumber(line.effectiveFxRate || 0),
        sourceCurrency: line.sourceCurrency,
        targetCurrency: line.targetCurrency,
      }))
      .filter((line) => line.amount > 0);

    if (!lines.length) {
      toast.error("Debes asignar al menos un monto mayor a cero.");
      return;
    }

    const missingFxLine = lines.find(
      (line) =>
        String(line.sourceCurrency || "") !== String(line.targetCurrency || "") &&
        line.effectiveFxRate <= 0,
    );
    if (missingFxLine) {
      toast.error(
        "Falta tipo de cambio para uno o mas documentos destino en la fecha actual.",
      );
      return;
    }

    applyFifoMutation.mutate(
      {
        documentId: applySourceDocument.id,
        lines: lines.map(({ targetDocumentId, amount }) => ({
          targetDocumentId,
          amount,
        })),
        note: applyNote.trim() || null,
      },
      {
        onSuccess: () => {
          setApplySheetOpen(false);
          setApplySourceDocument(null);
          setApplyLines([]);
          setApplyTargets([]);
          setApplyNote("");
        },
      },
    );
  }

  async function openJournalSheet(document) {
    setJournalSourceDocument(document);
    setJournalLinks([]);
    setJournalSheetOpen(true);
    setJournalLoading(true);
    try {
      const response = await atlas.finance.getDocumentJournalLinks(
        document.id,
        token,
      );
      setJournalLinks(response?.data ?? []);
    } catch (error) {
      toast.error(
        parseApiError(error, "No se pudo cargar la trazabilidad contable."),
      );
      setJournalSheetOpen(false);
    } finally {
      setJournalLoading(false);
    }
  }

  async function applyAutomaticFifo(document) {
    try {
      const preview = await atlas.finance.previewApplication(
        document.id,
        { allocationMode: "fifo" },
        token,
      );
      const lines = (preview?.data?.lines ?? [])
        .map((line) => ({
          targetDocumentId: line.targetDocumentId,
          amount: toNumber(line.amount),
        }))
        .filter((line) => line.amount > 0);
      if (!lines.length) {
        toast.error("No hay documentos abiertos compatibles para aplicar.");
        return;
      }
      applyFifoMutation.mutate({
        documentId: document.id,
        lines,
        note: "Aplicacion FIFO automatica",
      });
    } catch (error) {
      toast.error(parseApiError(error, "No se pudo preparar la aplicacion."));
    }
  }

  function reverseApplication(row) {
    if (!row?.id) return;
    if (row.status === "REVERSED") {
      toast.error("La aplicacion ya esta revertida.");
      return;
    }
    const reason = window.prompt(
      "Motivo de anulacion (opcional):",
      row.reversalReason || "",
    );
    if (reason === null) return;
    reverseApplicationMutation.mutate({
      id: row.id,
      reason: reason.trim() || null,
    });
  }

  function exportApplicationsHistoryCsv() {
    if (!applicationsHistory.length) {
      toast.error("No hay registros para exportar.");
      return;
    }

    const headers = [
      "Fecha",
      "Estado",
      "Direccion",
      "Tipo origen",
      "Referencia origen",
      "Contacto origen",
      "Tipo destino",
      "Referencia destino",
      "Contacto destino",
      "Monto origen",
      "Moneda origen",
      "Monto destino",
      "Moneda destino",
      "FX efectiva",
      "Revertida en",
      "Motivo reversa",
    ];

    const rows = applicationsHistory.map((row) => [
      formatDateInputValue(row.appliedAt),
      APPLICATION_STATUS_LABELS[row.status] || row.status || "",
      row.sourceDocument?.direction || "",
      formatDocumentTypeLabel(row.sourceDocument?.docType),
      row.sourceDocument?.reference || row.sourceDocumentId || "",
      row.sourceDocument?.contact?.name || "",
      formatDocumentTypeLabel(row.targetDocument?.docType),
      row.targetDocument?.reference || row.targetDocumentId || "",
      row.targetDocument?.contact?.name || "",
      toNumber(row.sourceAmount ?? row.appliedAmount).toFixed(2),
      row.sourceDocument?.currency || row.targetDocument?.currency || "MXN",
      toNumber(row.targetAmount ?? row.appliedAmount).toFixed(2),
      row.targetDocument?.currency || row.sourceDocument?.currency || "MXN",
      toNumber(row.effectiveFxRate || 0) > 0
        ? toNumber(row.effectiveFxRate).toFixed(6)
        : "",
      formatDateInputValue(row.reversedAt),
      row.reversalReason || "",
    ]);

    const csv = [headers, ...rows]
      .map((line) => line.map(toCsvCell).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `historial-aplicaciones-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("CSV generado");
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

  function buildGuidedDraftForAdvanced() {
    const sourceType = guidedForm.sourceType;
    const amount = toNumber(guidedForm.amount);
    const currency = (guidedForm.currency || "MXN").trim().toUpperCase();
    const note = guidedForm.note.trim();

    return {
      occurredAt: guidedForm.occurredAt,
      concept: guidedForm.concept.trim(),
      reference: guidedForm.reference.trim(),
      currency,
      sourceType,
      lines: [
        {
          accountId: guidedForm.toAccountId || "",
          debit: amount > 0 ? String(amount) : "",
          credit: "",
          note,
        },
        {
          accountId: guidedForm.fromAccountId || "",
          debit: "",
          credit: amount > 0 ? String(amount) : "",
          note,
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
    const draft = buildGuidedDraftForAdvanced();
    setEntryForm({
      occurredAt: draft.occurredAt,
      concept: draft.concept,
      reference: draft.reference,
      currency: draft.currency,
      sourceType: draft.sourceType,
      lines: draft.lines,
    });
    setGuidedSheetOpen(false);
    setEntrySheetOpen(true);
  }

  const guidedMeta = guidedPresetMeta(guidedForm.sourceType);
  const canCreateMoves = activeAccounts.length >= 2;

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      {(activeSection === "ar" || activeSection === "ap") && (
        <Button
          onClick={() => openCreateDocument(activeSection === "ar" ? "AR" : "AP")}
        >
          <Plus className="h-4 w-4" />
          Nuevo documento
        </Button>
      )}
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

        {activeSection === "ar" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documentos por cobrar</CardTitle>
              </CardHeader>
              <CardContent>
                {arDocumentsQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : arDocuments.length === 0 ? (
                  <EmptyState
                    title="Sin documentos AR"
                    description="Registra facturas, pagos o anticipos de clientes."
                    icon={HandCoins}
                    action={{
                      label: "Nuevo documento",
                      onClick: () => openCreateDocument("AR"),
                    }}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Tipo</th>
                          <th className="px-3 py-2 text-left font-medium">Contacto</th>
                          <th className="px-3 py-2 text-left font-medium">Referencia</th>
                          <th className="px-3 py-2 text-left font-medium">Emision</th>
                          <th className="px-3 py-2 text-left font-medium">Total</th>
                          <th className="px-3 py-2 text-left font-medium">Abierto</th>
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                          <th className="px-3 py-2 text-left font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arDocuments.map((doc) => (
                          <tr key={doc.id} className="border-t border-[hsl(var(--border))]">
                            <td className="px-3 py-2">
                              {formatDocumentTypeLabel(doc.docType)}
                            </td>
                            <td className="px-3 py-2">
                              {doc.contact?.name || "Sin contacto"}
                            </td>
                            <td className="px-3 py-2">{doc.reference || "-"}</td>
                            <td className="px-3 py-2">{formatDate(doc.issueDate)}</td>
                            <td className="px-3 py-2">
                              {formatMoney(doc.totalAmount, doc.currency)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(doc.openAmount, doc.currency)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  doc.status === "PAID"
                                    ? "success"
                                    : doc.status === "PARTIAL"
                                      ? "glass"
                                      : "secondary"
                                }
                              >
                                {doc.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <ActionMenu
                                items={[
                                  {
                                    label: "Ver polizas",
                                    icon: NotebookPen,
                                    onClick: () => openJournalSheet(doc),
                                  },
                                  ...(doc.enabled &&
                                  APPLY_SOURCE_DOC_TYPES.has(doc.docType) &&
                                  toNumber(doc.openAmount) > 0
                                    ? [
                                        {
                                          label: "Aplicar FIFO",
                                          icon: ArrowRightLeft,
                                          disabled:
                                            pendingApplyDocumentId === doc.id,
                                          onClick: () =>
                                            applyAutomaticFifo(doc),
                                        },
                                        {
                                          label: "Aplicar manual",
                                          icon: Edit3,
                                          disabled:
                                            pendingApplyDocumentId === doc.id,
                                          onClick: () =>
                                            openApplySheetForDocument(doc),
                                        },
                                      ]
                                    : []),
                                  doc.enabled
                                    ? {
                                        label: "Deshabilitar",
                                        icon: PowerOff,
                                        disabled: pendingDocumentId === doc.id,
                                        onClick: () =>
                                          toggleDocumentMutation.mutate({
                                            id: doc.id,
                                            enabled: false,
                                          }),
                                      }
                                    : {
                                        label: "Habilitar",
                                        icon: Power,
                                        disabled: pendingDocumentId === doc.id,
                                        onClick: () =>
                                          toggleDocumentMutation.mutate({
                                            id: doc.id,
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

        {activeSection === "ap" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documentos por pagar</CardTitle>
              </CardHeader>
              <CardContent>
                {apDocumentsQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : apDocuments.length === 0 ? (
                  <EmptyState
                    title="Sin documentos AP"
                    description="Registra facturas, pagos o anticipos a proveedores."
                    icon={Receipt}
                    action={{
                      label: "Nuevo documento",
                      onClick: () => openCreateDocument("AP"),
                    }}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Tipo</th>
                          <th className="px-3 py-2 text-left font-medium">Contacto</th>
                          <th className="px-3 py-2 text-left font-medium">Referencia</th>
                          <th className="px-3 py-2 text-left font-medium">Emision</th>
                          <th className="px-3 py-2 text-left font-medium">Total</th>
                          <th className="px-3 py-2 text-left font-medium">Abierto</th>
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                          <th className="px-3 py-2 text-left font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apDocuments.map((doc) => (
                          <tr key={doc.id} className="border-t border-[hsl(var(--border))]">
                            <td className="px-3 py-2">
                              {formatDocumentTypeLabel(doc.docType)}
                            </td>
                            <td className="px-3 py-2">
                              {doc.contact?.name || "Sin contacto"}
                            </td>
                            <td className="px-3 py-2">{doc.reference || "-"}</td>
                            <td className="px-3 py-2">{formatDate(doc.issueDate)}</td>
                            <td className="px-3 py-2">
                              {formatMoney(doc.totalAmount, doc.currency)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(doc.openAmount, doc.currency)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  doc.status === "PAID"
                                    ? "success"
                                    : doc.status === "PARTIAL"
                                      ? "glass"
                                      : "secondary"
                                }
                              >
                                {doc.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <ActionMenu
                                items={[
                                  {
                                    label: "Ver polizas",
                                    icon: NotebookPen,
                                    onClick: () => openJournalSheet(doc),
                                  },
                                  ...(doc.enabled &&
                                  APPLY_SOURCE_DOC_TYPES.has(doc.docType) &&
                                  toNumber(doc.openAmount) > 0
                                    ? [
                                        {
                                          label: "Aplicar FIFO",
                                          icon: ArrowRightLeft,
                                          disabled:
                                            pendingApplyDocumentId === doc.id,
                                          onClick: () =>
                                            applyAutomaticFifo(doc),
                                        },
                                        {
                                          label: "Aplicar manual",
                                          icon: Edit3,
                                          disabled:
                                            pendingApplyDocumentId === doc.id,
                                          onClick: () =>
                                            openApplySheetForDocument(doc),
                                        },
                                      ]
                                    : []),
                                  doc.enabled
                                    ? {
                                        label: "Deshabilitar",
                                        icon: PowerOff,
                                        disabled: pendingDocumentId === doc.id,
                                        onClick: () =>
                                          toggleDocumentMutation.mutate({
                                            id: doc.id,
                                            enabled: false,
                                          }),
                                      }
                                    : {
                                        label: "Habilitar",
                                        icon: Power,
                                        disabled: pendingDocumentId === doc.id,
                                        onClick: () =>
                                          toggleDocumentMutation.mutate({
                                            id: doc.id,
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

        {activeSection === "aging" && (
          <div className="space-y-4">
            {agingQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <StatCard
                  label="0-30 dias"
                  value={formatMoney(agingData?.summary?.b0_30 ?? 0)}
                  icon={Calendar}
                />
                <StatCard
                  label="31-60 dias"
                  value={formatMoney(agingData?.summary?.b31_60 ?? 0)}
                  icon={CalendarDays}
                />
                <StatCard
                  label="61-90 dias"
                  value={formatMoney(agingData?.summary?.b61_90 ?? 0)}
                  icon={CalendarDays}
                />
                <StatCard
                  label="+90 dias"
                  value={formatMoney(agingData?.summary?.b90_plus ?? 0)}
                  icon={CalendarDays}
                />
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aging por contacto</CardTitle>
              </CardHeader>
              <CardContent>
                {agingQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : (agingData?.contacts ?? []).length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Sin saldos abiertos para analizar.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Contacto</th>
                          <th className="px-3 py-2 text-left font-medium">0-30</th>
                          <th className="px-3 py-2 text-left font-medium">31-60</th>
                          <th className="px-3 py-2 text-left font-medium">61-90</th>
                          <th className="px-3 py-2 text-left font-medium">+90</th>
                          <th className="px-3 py-2 text-left font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(agingData?.contacts ?? []).map((row) => (
                          <tr key={row.contactId || row.contactName} className="border-t border-[hsl(var(--border))]">
                            <td className="px-3 py-2">{row.contactName}</td>
                            <td className="px-3 py-2">{formatMoney(row.b0_30, row.currency)}</td>
                            <td className="px-3 py-2">{formatMoney(row.b31_60, row.currency)}</td>
                            <td className="px-3 py-2">{formatMoney(row.b61_90, row.currency)}</td>
                            <td className="px-3 py-2">{formatMoney(row.b90_plus, row.currency)}</td>
                            <td className="px-3 py-2">{formatMoney(row.totalOpen, row.currency)}</td>
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

        {activeSection === "applications" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Pagos y anticipos pendientes de aplicar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {applicationDocumentsQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : applicationDocuments.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    No hay documentos abiertos para aplicar.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Direccion</th>
                          <th className="px-3 py-2 text-left font-medium">Tipo</th>
                          <th className="px-3 py-2 text-left font-medium">Contacto</th>
                          <th className="px-3 py-2 text-left font-medium">Abierto</th>
                          <th className="px-3 py-2 text-left font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applicationDocuments
                          .filter(
                            (doc) =>
                              doc.enabled &&
                              APPLY_SOURCE_DOC_TYPES.has(doc.docType) &&
                              toNumber(doc.openAmount) > 0,
                          )
                          .map((doc) => (
                            <tr key={doc.id} className="border-t border-[hsl(var(--border))]">
                              <td className="px-3 py-2">{doc.direction}</td>
                              <td className="px-3 py-2">
                                {formatDocumentTypeLabel(doc.docType)}
                              </td>
                              <td className="px-3 py-2">
                                {doc.contact?.name || "Sin contacto"}
                              </td>
                              <td className="px-3 py-2">
                                {formatMoney(doc.openAmount, doc.currency)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => applyAutomaticFifo(doc)}
                                    loading={pendingApplyDocumentId === doc.id}
                                  >
                                    Aplicar FIFO
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openApplySheetForDocument(doc)}
                                    disabled={pendingApplyDocumentId === doc.id}
                                  >
                                    Aplicar manual
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openJournalSheet(doc)}
                                  >
                                    Ver polizas
                                  </Button>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historial de aplicaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-3">
                  <SelectField
                    label="Direccion"
                    icon={ArrowRightLeft}
                    value={applicationsDirectionFilter}
                    onValueChange={(value) =>
                      setApplicationsDirectionFilter(value)
                    }
                    options={[
                      { value: "all", label: "Todas" },
                      { value: "AR", label: "AR (CxC)" },
                      { value: "AP", label: "AP (CxP)" },
                    ]}
                  />
                  <SelectField
                    label="Estado"
                    icon={Component}
                    value={applicationsStatusFilter}
                    onValueChange={(value) => setApplicationsStatusFilter(value)}
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "APPLIED", label: "Aplicadas" },
                      { value: "REVERSED", label: "Revertidas" },
                    ]}
                  />
                  <SelectField
                    label="Contacto"
                    icon={HandCoins}
                    value={applicationsContactFilter}
                    onValueChange={(value) => setApplicationsContactFilter(value)}
                    options={[
                      { value: "all", label: "Todos" },
                      ...contacts.map((contact) => ({
                        value: contact.id,
                        label: contact.name,
                      })),
                    ]}
                  />
                  <DateField
                    label="Desde"
                    icon={Calendar}
                    value={applicationsFromDate}
                    onChange={(event) =>
                      setApplicationsFromDate(event.target.value)
                    }
                  />
                  <DateField
                    label="Hasta"
                    icon={CalendarDays}
                    value={applicationsToDate}
                    onChange={(event) => setApplicationsToDate(event.target.value)}
                  />
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setApplicationsDirectionFilter("all");
                        setApplicationsStatusFilter("all");
                        setApplicationsContactFilter("all");
                        setApplicationsFromDate("");
                        setApplicationsToDate("");
                      }}
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportApplicationsHistoryCsv}
                    disabled={
                      applicationsHistoryQuery.isLoading ||
                      applicationsHistory.length === 0
                    }
                  >
                    Exportar CSV
                  </Button>
                </div>

                {applicationsHistoryQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : applicationsHistory.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Aun no hay aplicaciones registradas.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Fecha</th>
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                          <th className="px-3 py-2 text-left font-medium">Origen</th>
                          <th className="px-3 py-2 text-left font-medium">Destino</th>
                          <th className="px-3 py-2 text-left font-medium">Monto origen</th>
                          <th className="px-3 py-2 text-left font-medium">Monto destino</th>
                          <th className="px-3 py-2 text-left font-medium">FX</th>
                          <th className="px-3 py-2 text-left font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applicationsHistory.map((row) => (
                          <tr key={row.id} className="border-t border-[hsl(var(--border))]">
                            <td className="px-3 py-2">{formatDate(row.appliedAt)}</td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  row.status === "REVERSED" ? "secondary" : "success"
                                }
                              >
                                {APPLICATION_STATUS_LABELS[row.status] || row.status || "-"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {formatDocumentTypeLabel(
                                    row.sourceDocument?.docType,
                                  )}{" "}
                                  -{" "}
                                  {row.sourceDocument?.reference ||
                                    row.sourceDocument?.contact?.name ||
                                    row.sourceDocumentId}
                                </span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {row.sourceDocument?.direction || "-"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {formatDocumentTypeLabel(
                                    row.targetDocument?.docType,
                                  )}{" "}
                                  -{" "}
                                  {row.targetDocument?.reference ||
                                    row.targetDocument?.contact?.name ||
                                    row.targetDocumentId}
                                </span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {row.targetDocument?.direction || "-"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(
                                row.sourceAmount ?? row.appliedAmount,
                                row.sourceDocument?.currency ||
                                  row.targetDocument?.currency ||
                                  "MXN",
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(
                                row.targetAmount ?? row.appliedAmount,
                                row.targetDocument?.currency ||
                                  row.sourceDocument?.currency ||
                                  "MXN",
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {toNumber(row.effectiveFxRate) > 0
                                ? `${toNumber(row.effectiveFxRate).toFixed(6)}`
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    openJournalSheet(
                                      row.sourceDocument || {
                                        id: row.sourceDocumentId,
                                        reference: row.sourceDocument?.reference,
                                      },
                                    )
                                  }
                                >
                                  Poliza origen
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    openJournalSheet(
                                      row.targetDocument || {
                                        id: row.targetDocumentId,
                                        reference: row.targetDocument?.reference,
                                      },
                                    )
                                  }
                                >
                                  Poliza destino
                                </Button>
                                {row.status !== "REVERSED" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => reverseApplication(row)}
                                    loading={pendingReverseApplicationId === row.id}
                                  >
                                    Anular
                                  </Button>
                                ) : null}
                              </div>
                              {row.reversedAt ? (
                                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                                  Revertida: {formatDate(row.reversedAt)}
                                </p>
                              ) : null}
                              {row.reversalReason ? (
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                  Motivo: {row.reversalReason}
                                </p>
                              ) : null}
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

        {activeSection === "taxes" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registrar impuesto</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 md:grid-cols-5 gap-3"
                  onSubmit={handleSubmitTaxRate}
                >
                  <TextField
                    label="Clave"
                    icon={Hash}
                    value={taxRateForm.key}
                    onChange={(event) =>
                      setTaxRateForm((prev) => ({
                        ...prev,
                        key: event.target.value,
                      }))
                    }
                    placeholder="IVA16"
                    required
                  />
                  <TextField
                    label="Nombre"
                    icon={Notebook}
                    value={taxRateForm.name}
                    onChange={(event) =>
                      setTaxRateForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    placeholder="IVA general"
                    required
                  />
                  <SelectField
                    label="Tipo"
                    icon={Scale}
                    value={taxRateForm.kind}
                    onValueChange={(value) =>
                      setTaxRateForm((prev) => ({ ...prev, kind: value }))
                    }
                    options={[
                      { value: "TRANSFER", label: "Trasladado" },
                      { value: "WITHHOLDING", label: "Retencion" },
                    ]}
                    required
                  />
                  <NumberField
                    label="Tasa %"
                    icon={Coins}
                    value={taxRateForm.rate}
                    onChange={(event) =>
                      setTaxRateForm((prev) => ({
                        ...prev,
                        rate: event.target.value,
                      }))
                    }
                    min="0"
                    step="0.0001"
                    placeholder="16"
                    required
                  />
                  <SelectField
                    label="Direccion"
                    icon={ArrowRightLeft}
                    value={taxRateForm.direction}
                    onValueChange={(value) =>
                      setTaxRateForm((prev) => ({ ...prev, direction: value }))
                    }
                    options={[
                      { value: "AR", label: "AR (CxC)" },
                      { value: "AP", label: "AP (CxP)" },
                    ]}
                    required
                  />
                  <div className="md:col-span-5 flex justify-end">
                    <Button type="submit" loading={createTaxRateMutation.isPending}>
                      Guardar impuesto
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Catalogo de impuestos</CardTitle>
              </CardHeader>
              <CardContent>
                {taxRatesQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : taxRates.length === 0 ? (
                  <EmptyState
                    title="Sin impuestos"
                    description="Registra el primer impuesto o retencion para usarlo en documentos."
                    icon={FileText}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--muted))/0.35]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Clave</th>
                          <th className="px-3 py-2 text-left font-medium">Nombre</th>
                          <th className="px-3 py-2 text-left font-medium">Tipo</th>
                          <th className="px-3 py-2 text-left font-medium">Tasa</th>
                          <th className="px-3 py-2 text-left font-medium">Direccion</th>
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                          <th className="px-3 py-2 text-left font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxRates.map((tax) => (
                          <tr key={tax.id} className="border-t border-[hsl(var(--border))]">
                            <td className="px-3 py-2 font-mono text-xs">{tax.key}</td>
                            <td className="px-3 py-2">{tax.name}</td>
                            <td className="px-3 py-2">
                              {tax.kind === "WITHHOLDING" ? "Retencion" : "Trasladado"}
                            </td>
                            <td className="px-3 py-2">{Number(tax.rate).toFixed(4)}%</td>
                            <td className="px-3 py-2">{tax.direction || "AR/AP"}</td>
                            <td className="px-3 py-2">
                              <Badge variant={tax.enabled ? "success" : "secondary"}>
                                {tax.enabled ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <ActionMenu
                                items={[
                                  tax.enabled
                                    ? {
                                        label: "Deshabilitar",
                                        icon: PowerOff,
                                        disabled: pendingTaxRateId === tax.id,
                                        onClick: () =>
                                          toggleTaxRateMutation.mutate({
                                            id: tax.id,
                                            enabled: false,
                                          }),
                                      }
                                    : {
                                        label: "Habilitar",
                                        icon: Power,
                                        disabled: pendingTaxRateId === tax.id,
                                        onClick: () =>
                                          toggleTaxRateMutation.mutate({
                                            id: tax.id,
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
        open={applySheetOpen}
        onOpenChange={(open) => {
          if (applyFifoMutation.isPending) return;
          setApplySheetOpen(open);
          if (!open) {
            setApplySourceDocument(null);
            setApplyTargets([]);
            setApplyLines([]);
            setApplyTotals({ applied: 0, unapplied: 0 });
            setApplyNote("");
          }
        }}
      >
        <SheetContent className="sm:max-w-4xl lg:max-w-5xl">
          <SheetHeader>
            <SheetTitle>Aplicacion manual de documento</SheetTitle>
          </SheetHeader>
          <form className="space-y-4 py-4" onSubmit={submitManualApply}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Badge variant="glass">
                Documento: {applySourceDocument?.reference || applySourceDocument?.id || "-"}
              </Badge>
              <Badge variant="glass">
                Tipo: {formatDocumentTypeLabel(applySourceDocument?.docType)}
              </Badge>
              <Badge variant="glass">
                Abierto:{" "}
                {formatMoney(
                  applySourceDocument?.openAmount ?? 0,
                  applySourceDocument?.currency || "MXN",
                )}
              </Badge>
            </div>

            {applyLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : applyTargets.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No hay documentos destino disponibles para aplicar.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))/0.35]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Destino</th>
                      <th className="px-3 py-2 text-left font-medium">Abierto destino</th>
                      <th className="px-3 py-2 text-left font-medium">Aplicar destino</th>
                      <th className="px-3 py-2 text-left font-medium">Equivalente origen</th>
                      <th className="px-3 py-2 text-left font-medium">FX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applyLines.map((line) => {
                      const target = applyTargetById.get(line.targetDocumentId);
                      return (
                        <tr
                          key={line.targetDocumentId}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2">
                            {target?.label || line.targetDocumentId}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(
                              target?.openAmount ?? 0,
                              target?.currency || "MXN",
                            )}
                          </td>
                          <td className="px-3 py-2 w-48">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.amount}
                              onChange={(event) =>
                                updateApplyLine(
                                  line.targetDocumentId,
                                  event.target.value,
                                )
                              }
                              className="h-10"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(
                              line.sourceAmount ?? line.amount ?? 0,
                              applySourceDocument?.currency || "MXN",
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {toNumber(line.effectiveFxRate) > 0
                              ? `${toNumber(line.effectiveFxRate).toFixed(6)}`
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Badge variant="glass">
                Aplicado:{" "}
                {formatMoney(
                  applyTotals.applied,
                  applySourceDocument?.currency || "MXN",
                )}
              </Badge>
              <Badge
                variant={
                  applyTotals.unapplied > 0
                    ? "secondary"
                    : "success"
                }
              >
                Pendiente:{" "}
                {formatMoney(
                  applyTotals.unapplied,
                  applySourceDocument?.currency || "MXN",
                )}
              </Badge>
              <Badge
                variant={
                  applyTotals.applied >
                  toNumber(applySourceDocument?.openAmount)
                    ? "destructive"
                    : "glass"
                }
              >
                LÃ­mite:{" "}
                {formatMoney(
                  applySourceDocument?.openAmount ?? 0,
                  applySourceDocument?.currency || "MXN",
                )}
              </Badge>
            </div>

            <TextField
              label="Nota de aplicacion"
              icon={Notebook}
              value={applyNote}
              onChange={(event) => setApplyNote(event.target.value)}
              placeholder="Observacion interna opcional"
            />

            <SheetFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setApplySheetOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetApplyToFifo}
                disabled={applyLoading || applyFifoMutation.isPending}
              >
                Limpiar
              </Button>
              <Button
                type="submit"
                loading={applyFifoMutation.isPending}
                disabled={
                  applyLoading ||
                  applyTotals.applied <= 0 ||
                  applyTotals.applied >
                    toNumber(applySourceDocument?.openAmount)
                }
              >
                Confirmar aplicacion
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={journalSheetOpen}
        onOpenChange={(open) => {
          setJournalSheetOpen(open);
          if (!open) {
            setJournalSourceDocument(null);
            setJournalLinks([]);
          }
        }}
      >
        <SheetContent className="sm:max-w-3xl lg:max-w-4xl">
          <SheetHeader>
            <SheetTitle>
              Trazabilidad contable {journalSourceDocument?.reference ? `- ${journalSourceDocument.reference}` : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {journalLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : journalLinks.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Este documento aun no tiene polizas vinculadas.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))/0.35]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Evento</th>
                      <th className="px-3 py-2 text-left font-medium">Poliza</th>
                      <th className="px-3 py-2 text-left font-medium">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium">Concepto</th>
                      <th className="px-3 py-2 text-left font-medium">Lineas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalLinks.map((link) => (
                      <tr key={link.id} className="border-t border-[hsl(var(--border))]">
                        <td className="px-3 py-2">{link.eventType}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {link.journalEntry?.entryNumber || "-"}
                        </td>
                        <td className="px-3 py-2">
                          {formatDate(link.journalEntry?.occurredAt)}
                        </td>
                        <td className="px-3 py-2">
                          {link.journalEntry?.concept || "-"}
                        </td>
                        <td className="px-3 py-2">
                          {(link.journalEntry?.lines ?? []).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <SheetFooter className="gap-2">
              <Button variant="outline" onClick={() => setJournalSheetOpen(false)}>
                Cerrar
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

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
            <Button
              type="button"
              variant="outline"
              onClick={() => setGuidedSheetOpen(false)}
            >
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
        open={documentSheetOpen}
        onOpenChange={(open) => {
          if (createDocumentMutation.isPending) return;
          setDocumentSheetOpen(open);
          if (!open) {
            setDocumentForm(defaultDocumentForm(documentForm.direction || "AR"));
          }
        }}
      >
        <SheetContent className="sm:max-w-3xl lg:max-w-4xl">
          <SheetHeader>
            <SheetTitle>Nuevo documento financiero</SheetTitle>
          </SheetHeader>
          <form
            id="finance-document-form"
            className="space-y-4 py-4"
            onSubmit={handleSubmitDocument}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SelectField
                label="Direccion"
                icon={ArrowRightLeft}
                value={documentForm.direction}
                onValueChange={(value) =>
                  setDocumentForm((prev) => ({ ...prev, direction: value }))
                }
                options={[
                  { value: "AR", label: "AR (CxC)" },
                  { value: "AP", label: "AP (CxP)" },
                ]}
                required
              />
              <SelectField
                label="Tipo"
                icon={FileText}
                value={documentForm.docType}
                onValueChange={(value) =>
                  setDocumentForm((prev) => ({ ...prev, docType: value }))
                }
                options={[
                  { value: "INVOICE", label: "Factura" },
                  { value: "DEBIT_NOTE", label: "Nota de debito" },
                  { value: "CREDIT_NOTE", label: "Nota de credito" },
                  { value: "PAYMENT", label: "Pago" },
                  { value: "ADVANCE", label: "Anticipo" },
                ]}
                required
              />
              <SelectField
                label="Moneda"
                icon={Coins}
                value={documentForm.currency}
                onValueChange={(value) =>
                  setDocumentForm((prev) => ({
                    ...prev,
                    currency: normalizeCurrencyCode(value),
                  }))
                }
                options={resolveCurrencyOptions(documentForm.currency)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SelectField
                label="Contacto"
                icon={HandCoins}
                value={documentForm.contactId}
                onValueChange={(value) =>
                  setDocumentForm((prev) => ({ ...prev, contactId: value }))
                }
                options={contacts.map((contact) => ({
                  value: contact.id,
                  label: `${contact.name}${contact.type ? ` (${contact.type})` : ""}`,
                }))}
                placeholder="Selecciona contacto"
              />
              <CurrencyField
                label="Subtotal"
                icon={Scale}
                value={documentForm.subtotalAmount}
                onChange={(value) =>
                  setDocumentForm((prev) => ({
                    ...prev,
                    subtotalAmount: value,
                  }))
                }
                currency={documentForm.currency || "MXN"}
                allowNegative={false}
                min={0}
              />
              <CurrencyField
                label="Monto total"
                icon={Scale}
                value={documentForm.totalAmount}
                onChange={(value) =>
                  setDocumentForm((prev) => ({ ...prev, totalAmount: value }))
                }
                currency={documentForm.currency || "MXN"}
                allowNegative={false}
                min={0}
                required
              />
            </div>

            <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                  Impuestos y retenciones
                </p>
                <Badge variant="glass">
                  {selectedDocumentTaxes.length} seleccionados
                </Badge>
              </div>

              {taxRatesQuery.isLoading ? (
                <Skeleton className="h-16 w-full rounded-xl" />
              ) : activeTaxRates.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No hay impuestos activos. Puedes crearlos en Finanzas &gt; Impuestos.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeTaxRates
                    .filter(
                      (tax) =>
                        !tax.direction || tax.direction === documentForm.direction,
                    )
                    .map((tax) => {
                      const checked = (documentForm.selectedTaxRateIds ?? []).includes(
                        tax.id,
                      );
                      return (
                        <label
                          key={tax.id}
                          className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) =>
                              toggleDocumentTaxSelection(tax.id, Boolean(value))
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {tax.key} - {tax.name}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                              {tax.kind === "WITHHOLDING"
                                ? "Retencion"
                                : "Trasladado"}{" "}
                              {Number(tax.rate).toFixed(4)}%
                            </p>
                          </div>
                        </label>
                      );
                    })}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Badge variant="glass">
                  Subtotal:{" "}
                  {formatMoney(
                    documentTaxPreview.subtotal,
                    documentForm.currency || "MXN",
                  )}
                </Badge>
                <Badge variant="success">
                  Trasladados:{" "}
                  {formatMoney(
                    documentTaxPreview.transfers,
                    documentForm.currency || "MXN",
                  )}
                </Badge>
                <Badge variant="secondary">
                  Retenciones:{" "}
                  {formatMoney(
                    documentTaxPreview.withholdings,
                    documentForm.currency || "MXN",
                  )}
                </Badge>
                <Badge variant="glass">
                  Sugerido:{" "}
                  {formatMoney(
                    documentTaxPreview.suggestedTotal,
                    documentForm.currency || "MXN",
                  )}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DateField
                label="Emision"
                icon={Calendar}
                value={documentForm.issueDate}
                onChange={(event) =>
                  setDocumentForm((prev) => ({
                    ...prev,
                    issueDate: event.target.value,
                  }))
                }
                required
              />
              <DateField
                label="Vencimiento"
                icon={CalendarDays}
                value={documentForm.dueDate}
                onChange={(event) =>
                  setDocumentForm((prev) => ({
                    ...prev,
                    dueDate: event.target.value,
                  }))
                }
              />
              <TextField
                label="Referencia"
                icon={Hash}
                value={documentForm.reference}
                onChange={(event) =>
                  setDocumentForm((prev) => ({
                    ...prev,
                    reference: event.target.value,
                  }))
                }
                placeholder="FAC-0001"
              />
            </div>

            <TextField
              label="Observaciones"
              icon={Notebook}
              value={documentForm.notesMarkdown}
              onChange={(event) =>
                setDocumentForm((prev) => ({
                  ...prev,
                  notesMarkdown: event.target.value,
                }))
              }
              placeholder="Notas del documento"
            />
          </form>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setDocumentSheetOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="finance-document-form"
              loading={createDocumentMutation.isPending}
            >
              Guardar documento
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
