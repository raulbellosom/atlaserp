import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Skeleton,
} from "@atlas/ui";
import { AnimatePresence, motion } from "motion/react";
import { Plus, UsersRound } from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useHrExplorer } from "../hooks/useHrExplorer";
import { HrToolbar } from "../components/HrToolbar";
import { HrTableView } from "../components/HrTableView";
import { HrCardView, HrGridView } from "../components/HrCardView";
import HrEmployeeDetail from "./HrEmployeeDetail";
import HrOrgChartScreen from "./HrOrgChartScreen";
import HrCatalogsScreen from "./HrCatalogsScreen";

// ── List skeleton ─────────────────────────────────────────────────────────────

function HrListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72 rounded-xl" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="ml-auto h-9 w-28 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-[hsl(var(--border))] last:border-0 px-4 py-3"
          >
            <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
            <Skeleton className="h-4 w-44 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="ml-auto h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card/grid skeleton ────────────────────────────────────────────────────────

function HrCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[hsl(var(--border))] p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-20" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="border-t border-[hsl(var(--border))]/50 pt-2.5 space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pagination helpers ────────────────────────────────────────────────────────

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const delta = 1;
  const pages = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  pages.push(1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

function HrPagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const pages = buildPageRange(page, totalPages);
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => page > 1 && onPage(page - 1)}
            aria-disabled={page === 1}
            className={
              page === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"
            }
          />
        </PaginationItem>
        {pages.map((p, i) =>
          p === "..." ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <span className="flex h-9 w-9 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                …
              </span>
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === page}
                onClick={() => onPage(p)}
                className="cursor-pointer"
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            onClick={() => page < totalPages && onPage(page + 1)}
            aria-disabled={page === totalPages}
            className={
              page === totalPages
                ? "pointer-events-none opacity-40"
                : "cursor-pointer"
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HrScreen() {
  const { session } = useAuth();
  const token = session?.access_token;
  const { "*": wildcard } = useParams();
  const navigate = useNavigate();

  const employeeId = wildcard?.startsWith("hr/employees/")
    ? wildcard.replace("hr/employees/", "")
    : null;
  const isOrgChartRoute = wildcard === "hr/org-chart";
  const isCatalogsRoute = wildcard === "hr/catalogs";
  const isDetailRoute = Boolean(employeeId);

  const listQuery = useQuery({
    queryKey: ["hr-employees"],
    queryFn: () => atlas.hr.listEmployees(token, { limit: 500 }),
    enabled: Boolean(token),
  });

  const allEmployees = listQuery.data?.data ?? [];

  const explorer = useHrExplorer(allEmployees);
  const {
    viewMode,
    search,
    filters,
    sort,
    page,
    totalPages,
    paginatedEmployees,
    totalFiltered,
    setViewMode,
    setSearch,
    setFilters,
    cycleSort,
    setPage,
  } = explorer;

  function handleNavigate(id) {
    navigate(`/app/m/atlas.hr/hr/employees/${id}`);
  }

  if (isOrgChartRoute) {
    return <HrOrgChartScreen />;
  }

  if (isCatalogsRoute) {
    return <HrCatalogsScreen />;
  }

  // detail route — render dossier
  if (isDetailRoute) {
    return (
      <div className="p-4 md:p-6 min-h-dvh">
        <HrEmployeeDetail employeeId={employeeId} />
      </div>
    );
  }

  // list route
  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas HR"
        title="Colaboradores"
        description="Directorio y expedientes del equipo."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/app/m/atlas.hr/hr/org-chart")}
            >
              Organigrama
            </Button>
            <Button
              onClick={() => navigate("/app/m/atlas.hr/hr/employees/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo colaborador
            </Button>
          </div>
        }
      />

      {listQuery.isLoading ? (
        viewMode === "cards" || viewMode === "grid" ? (
          <HrCardsSkeleton />
        ) : (
          <HrListSkeleton />
        )
      ) : (
        <>
          <HrToolbar
            viewMode={viewMode}
            search={search}
            filters={filters}
            sort={sort}
            onViewMode={setViewMode}
            onSearch={setSearch}
            onFilters={setFilters}
            onCycleSort={cycleSort}
          />

          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {totalFiltered} colaborador{totalFiltered !== 1 ? "es" : ""}
          </p>

          {allEmployees.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="Sin colaboradores"
              description="Agrega tu primer colaborador para comenzar a gestionar al equipo."
              action={{
                label: "Nuevo colaborador",
                onClick: () => navigate("/app/m/atlas.hr/hr/employees/new"),
              }}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {viewMode === "table" && (
                  <HrTableView
                    employees={paginatedEmployees}
                    sort={sort}
                    onCycleSort={cycleSort}
                    onNavigate={handleNavigate}
                  />
                )}
                {viewMode === "cards" && (
                  <HrCardView
                    employees={paginatedEmployees}
                    onNavigate={handleNavigate}
                  />
                )}
                {viewMode === "grid" && (
                  <HrGridView
                    employees={paginatedEmployees}
                    onNavigate={handleNavigate}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}

          <HrPagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
