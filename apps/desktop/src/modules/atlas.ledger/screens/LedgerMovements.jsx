import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@atlas/ui";
import { ArrowDownUp, Filter, LayoutGrid, List, Plus, X, XCircle } from "lucide-react";
import { cn } from "@atlas/ui";
import { atlas } from "../../../lib/atlas";
import { LedgerFiltersBar } from "../components/LedgerFiltersBar";
import { MovementCancelModal } from "../components/MovementCancelModal";
import { MovementSheet } from "../components/MovementSheet";
import {
  directionLabel,
  fmtDate,
  formatMoney,
  parseApiError,
  statusLabel,
} from "../lib/ledger-utils";
import { toast } from "sonner";

const DEFAULT_FILTERS = { page: 1, pageSize: 50 };

// ── Direction indicator dot ───────────────────────────────────────────────────

function DirectionDot({ direction, cancelled }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        cancelled
          ? "bg-[hsl(var(--muted-foreground))]/40"
          : direction === "INCOME"
            ? "bg-emerald-500"
            : "bg-red-500",
      )}
    />
  );
}

// ── Movement amount display ───────────────────────────────────────────────────

function AmountCell({ mv }) {
  const isCancelled = mv.status === "CANCELLED";
  const currency = mv.account?.currency ?? "MXN";
  if (isCancelled) return <span className="tabular-nums text-[hsl(var(--muted-foreground))]">—</span>;
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        mv.direction === "INCOME" ? "text-emerald-600" : "text-red-500",
      )}
    >
      {mv.direction === "EXPENSE" ? "-" : "+"}
      {formatMoney(mv.amount, currency)}
    </span>
  );
}

// ── Table view ────────────────────────────────────────────────────────────────

function TableView({ movements, onCancel }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-[hsl(var(--muted))/0.4]">
            <th className="px-3 py-2.5 text-left font-medium text-xs text-[hsl(var(--muted-foreground))] w-4"></th>
            <th className="px-3 py-2.5 text-left font-medium text-xs text-[hsl(var(--muted-foreground))]">Fecha</th>
            <th className="px-3 py-2.5 text-left font-medium text-xs text-[hsl(var(--muted-foreground))]">Cuenta</th>
            <th className="px-3 py-2.5 text-left font-medium text-xs text-[hsl(var(--muted-foreground))]">Concepto</th>
            <th className="px-3 py-2.5 text-left font-medium text-xs text-[hsl(var(--muted-foreground))] hidden md:table-cell">Referencia</th>
            <th className="px-3 py-2.5 text-right font-medium text-xs text-[hsl(var(--muted-foreground))]">Monto</th>
            <th className="px-3 py-2.5 text-left font-medium text-xs text-[hsl(var(--muted-foreground))] hidden sm:table-cell">Estado</th>
            <th className="px-3 py-2.5 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {movements.map((mv) => {
            const isCancelled = mv.status === "CANCELLED";
            return (
              <tr
                key={mv.id}
                className={cn(
                  "border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))/0.2] transition-colors",
                  isCancelled && "opacity-50",
                )}
              >
                <td className="px-3 py-2.5">
                  <DirectionDot direction={mv.direction} cancelled={isCancelled} />
                </td>
                <td className="px-3 py-2.5 tabular-nums text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                  {fmtDate(mv.occurredAt)}
                </td>
                <td className="px-3 py-2.5 max-w-25 truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {mv.account?.name ?? "-"}
                </td>
                <td className="px-3 py-2.5 max-w-55">
                  <p className="truncate font-medium">{mv.concept}</p>
                  {mv.name && <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{mv.name}</p>}
                </td>
                <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] hidden md:table-cell">
                  {mv.reference ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <AmountCell mv={mv} />
                </td>
                <td className="px-3 py-2.5 hidden sm:table-cell">
                  <Badge variant={isCancelled ? "secondary" : "outline"} className="text-[10px]">
                    {statusLabel(mv.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  {!isCancelled && (
                    <button
                      className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
                      title="Cancelar"
                      onClick={() => onCancel(mv)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Card view ─────────────────────────────────────────────────────────────────

function CardView({ movements, onCancel }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {movements.map((mv) => {
        const isCancelled = mv.status === "CANCELLED";
        const currency = mv.account?.currency ?? "MXN";
        return (
          <div
            key={mv.id}
            className={cn(
              "rounded-xl border border-[hsl(var(--border))] p-4 space-y-2 glass-subtle transition-opacity",
              isCancelled && "opacity-50",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <DirectionDot direction={mv.direction} cancelled={isCancelled} />
                <span className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                  {mv.account?.name ?? "-"}
                </span>
              </div>
              <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0 tabular-nums">
                {fmtDate(mv.occurredAt)}
              </span>
            </div>

            <div>
              <p className="font-medium text-sm leading-snug line-clamp-2">{mv.concept}</p>
              {mv.name && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{mv.name}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[hsl(var(--border))]/60">
              <AmountCell mv={mv} />
              <div className="flex items-center gap-2">
                <Badge variant={isCancelled ? "secondary" : "outline"} className="text-[10px]">
                  {statusLabel(mv.status)}
                </Badge>
                {!isCancelled && (
                  <button
                    className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
                    title="Cancelar"
                    onClick={() => onCancel(mv)}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Active filter chips ───────────────────────────────────────────────────────

function FilterChips({ filters, onChange, onReset }) {
  const chips = [];
  if (filters.dateFrom) chips.push({ key: "dateFrom", label: `Desde: ${filters.dateFrom}` });
  if (filters.dateTo) chips.push({ key: "dateTo", label: `Hasta: ${filters.dateTo}` });
  if (filters.status) chips.push({ key: "status", label: filters.status === "ACTIVE" ? "Activos" : "Cancelados" });
  if (filters.search) chips.push({ key: "search", label: `"${filters.search}"` });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">Filtros activos:</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onChange({ [chip.key]: undefined })}
            className="hover:opacity-70 transition-opacity"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors underline-offset-2 hover:underline"
      >
        Limpiar todo
      </button>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function LedgerMovements({ token }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [direction, setDirection] = useState("ALL");
  const [viewMode, setViewMode] = useState("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [movementSheetOpen, setMovementSheetOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState({ open: false, movement: null });

  const queryFilters = {
    ...filters,
    direction: direction !== "ALL" ? direction : undefined,
  };

  const movementsQuery = useQuery({
    queryKey: ["ledger-movements", queryFilters],
    queryFn: () => atlas.ledger.listAllMovements(token, queryFilters),
    enabled: Boolean(token),
  });

  const movements = movementsQuery.data?.data?.items ?? [];
  const summary = movementsQuery.data?.data?.summary ?? {};

  function handleFiltersChange(partial) {
    setFilters((prev) => ({ ...prev, ...partial, page: 1 }));
  }

  function handleFiltersReset() {
    setFilters(DEFAULT_FILTERS);
  }

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.status || filters.search;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-4">

        {/* Page header */}
        <PageHeader
          eyebrow="Atlas Ledger"
          title="Movimientos"
          description="Historial completo de entradas del libro auxiliar."
          actions={
            <Button onClick={() => setMovementSheetOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva entrada
            </Button>
          }
        />

        {/* Summary pills */}
        {!movementsQuery.isLoading && (summary.totalCount > 0) && (
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[hsl(var(--muted-foreground))] text-xs">Abonos</span>
              <span className="font-semibold tabular-nums text-emerald-600 text-sm">
                +{formatMoney(summary.totalIncome)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-[hsl(var(--muted-foreground))] text-xs">Cargos</span>
              <span className="font-semibold tabular-nums text-red-500 text-sm">
                -{formatMoney(summary.totalExpense)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              {summary.totalCount} movimientos
              {summary.cancelledCount > 0 && ` · ${summary.cancelledCount} cancelados`}
            </div>
          </div>
        )}

        <Card>
          <CardContent className="pt-4 space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Direction tabs */}
              <Tabs value={direction} onValueChange={setDirection} className="shrink-0">
                <TabsList>
                  <TabsTrigger value="ALL">Todos</TabsTrigger>
                  <TabsTrigger value="INCOME">
                    <span className="hidden sm:inline">Abonos</span>
                    <span className="sm:hidden">+</span>
                  </TabsTrigger>
                  <TabsTrigger value="EXPENSE">
                    <span className="hidden sm:inline">Cargos</span>
                    <span className="sm:hidden">-</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-1.5 ml-auto">
                {/* Filter toggle */}
                <Button
                  variant={filtersOpen ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={cn("gap-1.5", hasActiveFilters && "border-[hsl(var(--primary))]/50")}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Filtros</span>
                  {hasActiveFilters && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
                  )}
                </Button>

                {/* View mode toggle */}
                <div className="flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={cn(
                      "px-2.5 py-1.5 transition-colors",
                      viewMode === "table"
                        ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50",
                    )}
                    title="Vista tabla"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={cn(
                      "px-2.5 py-1.5 transition-colors border-l border-[hsl(var(--border))]",
                      viewMode === "cards"
                        ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50",
                    )}
                    title="Vista tarjetas"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Expandable filter panel */}
            {filtersOpen && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-4">
                <LedgerFiltersBar
                  filters={filters}
                  onChange={handleFiltersChange}
                />
              </div>
            )}

            {/* Active filter chips */}
            <FilterChips
              filters={filters}
              onChange={handleFiltersChange}
              onReset={handleFiltersReset}
            />

            {/* Content */}
            {movementsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : movements.length === 0 ? (
              <EmptyState
                title="Sin movimientos"
                description={hasActiveFilters ? "No hay movimientos que coincidan con los filtros." : "Registra la primera entrada para comenzar."}
                icon={ArrowDownUp}
                action={
                  !hasActiveFilters
                    ? { label: "Nueva entrada", onClick: () => setMovementSheetOpen(true) }
                    : { label: "Limpiar filtros", onClick: handleFiltersReset }
                }
              />
            ) : viewMode === "table" ? (
              <TableView
                movements={movements}
                onCancel={(mv) => setCancelModal({ open: true, movement: mv })}
              />
            ) : (
              <CardView
                movements={movements}
                onCancel={(mv) => setCancelModal({ open: true, movement: mv })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <MovementSheet
        open={movementSheetOpen}
        onOpenChange={setMovementSheetOpen}
        account={null}
        token={token}
      />
      <MovementCancelModal
        open={cancelModal.open}
        onOpenChange={(isOpen) => setCancelModal((s) => ({ ...s, open: isOpen }))}
        movement={cancelModal.movement}
        accountId={cancelModal.movement?.accountId}
        token={token}
      />
    </div>
  );
}
