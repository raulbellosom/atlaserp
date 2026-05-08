import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  PageHeader,
  ConfirmDialog,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  Skeleton,
} from "@atlas/ui";
import { ContactRound, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useContactsExplorer } from "../hooks/useContactsExplorer";
import { ContactsToolbar } from "../components/ContactsToolbar";
import { ContactsTableView } from "../components/ContactsTableView";
import { ContactsCardView } from "../components/ContactsCardView";
import { ContactsGridView } from "../components/ContactsGridView";
import {
  ContactFormSheet,
  resolveContactsBlueprint,
} from "../components/ContactFormSheet";

// ── CSV export ───────────────────────────────────────────────────────────────

function exportContactsCSV(contacts) {
  const headers = [
    "Tipo",
    "Nombre",
    "Nombre legal",
    "Correo",
    "Telefono",
    "RFC / ID fiscal",
    "Estado",
  ];

  const rows = contacts.map((c) => [
    c.type ?? "",
    c.name ?? "",
    c.legalName ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.taxId ?? "",
    c.enabled ? "Activo" : "Inactivo",
  ]);

  const escape = (val) => {
    const s = String(val).replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  };

  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contactos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function ContactsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="ml-auto h-9 w-24 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-[hsl(var(--border))] last:border-0 px-4 py-3"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="ml-auto h-4 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function ContactsEmpty({ onNew }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-4 rounded-2xl border border-[hsl(var(--border))] py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--muted))]">
        <ContactRound className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-[hsl(var(--foreground))]">
          Sin contactos
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Crea tu primer contacto para empezar a gestionar clientes y
          proveedores.
        </p>
      </div>
      <Button onClick={onNew} size="sm">
        <UserPlus className="mr-2 h-4 w-4" />
        Nuevo contacto
      </Button>
    </div>
  );
}

// ── Pagination strip ──────────────────────────────────────────────────────────

function ContactsPagination({ page, totalPages, onPage }) {
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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ContactsScreen() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [confirmDisable, setConfirmDisable] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmBulkDisable, setConfirmBulkDisable] = useState(false);

  // ── queries ──────────────────────────────────────────────────────────────

  const blueprintsQuery = useQuery({
    queryKey: ["blueprints", token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts"],
    queryFn: () => atlas.contacts.list(token, { limit: 200 }),
    enabled: Boolean(token),
  });

  const allContacts = contactsQuery.data?.data ?? [];

  const blueprint = useMemo(
    () => resolveContactsBlueprint(blueprintsQuery.data?.data ?? []),
    [blueprintsQuery.data],
  );

  // ── explorer hook ─────────────────────────────────────────────────────────

  const explorer = useContactsExplorer(allContacts);

  const {
    viewMode,
    search,
    filters,
    sort,
    page,
    paginatedContacts,
    filteredContacts,
    totalPages,
    totalFiltered,
    selectedSet,
    selectedCount,
    selectedIds,
    setViewMode,
    setSearch,
    setFilters,
    cycleSort,
    setPage,
    toggleSelect,
    clearSelection,
    selectVisible,
    deselectVisible,
    selectAll,
  } = explorer;

  // ── mutations ─────────────────────────────────────────────────────────────

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const createMutation = useMutation({
    mutationFn: (data) => atlas.contacts.create(data, token),
    onSuccess: () => {
      invalidate();
      setSheetOpen(false);
      toast.success("Contacto creado");
    },
    onError: () => toast.error("No se pudo crear el contacto"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => atlas.contacts.update(id, data, token),
    onSuccess: () => {
      invalidate();
      setSheetOpen(false);
      setEditingContact(null);
      toast.success("Contacto actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el contacto"),
  });

  const disableMutation = useMutation({
    mutationFn: (id) => atlas.contacts.setEnabled(id, false, token),
    onSuccess: () => {
      invalidate();
      setConfirmDisable(null);
      clearSelection();
      toast.success("Contacto deshabilitado");
    },
    onError: () => toast.error("No se pudo deshabilitar el contacto"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => atlas.contacts.delete(id, token),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
      clearSelection();
      toast.success("Contacto eliminado");
    },
    onError: () => toast.error("No se pudo eliminar el contacto"),
  });

  const bulkDisableMutation = useMutation({
    mutationFn: () =>
      Promise.allSettled(
        selectedIds.map((id) => atlas.contacts.setEnabled(id, false, token)),
      ),
    onSuccess: () => {
      invalidate();
      setConfirmBulkDisable(false);
      clearSelection();
      toast.success(`${selectedCount} contacto(s) deshabilitado(s)`);
    },
    onError: () => toast.error("No se pudieron deshabilitar los contactos"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      Promise.allSettled(
        selectedIds.map((id) => atlas.contacts.delete(id, token)),
      ),
    onSuccess: () => {
      invalidate();
      setConfirmBulkDelete(false);
      clearSelection();
      toast.success(`${selectedCount} contacto(s) eliminado(s)`);
    },
    onError: () => toast.error("No se pudieron eliminar los contactos"),
  });

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ── handlers ──────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingContact(null);
    setSheetOpen(true);
  }

  function openEdit(contact) {
    setEditingContact(contact);
    setSheetOpen(true);
  }

  function handleFormSubmit(data) {
    const payload = { ...data, email: data.email || undefined };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleBulkExport() {
    const selected = filteredContacts.filter((c) => selectedSet.has(c.id));
    exportContactsCSV(selected);
    toast.success(`${selected.length} contacto(s) exportado(s) a CSV`);
  }

  const allVisibleSelected =
    paginatedContacts.length > 0 &&
    paginatedContacts.every((c) => selectedSet.has(c.id));

  function handleSelectAllVisible() {
    if (allVisibleSelected) {
      deselectVisible();
    } else {
      selectVisible();
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const isLoading = contactsQuery.isLoading || blueprintsQuery.isLoading;
  const isEmpty = !isLoading && allContacts.length === 0;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Contacts"
          title="Contactos"
          description="Clientes, proveedores y personas vinculadas a tu empresa."
          actions={
            <Button onClick={openCreate}>
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo contacto
            </Button>
          }
        />

        {isLoading ? (
          <ContactsSkeleton />
        ) : isEmpty ? (
          <ContactsEmpty onNew={openCreate} />
        ) : (
          <>
            <ContactsToolbar
              viewMode={viewMode}
              search={search}
              filters={filters}
              sort={sort}
              selectedCount={selectedCount}
              totalFiltered={totalFiltered}
              onViewMode={setViewMode}
              onSearch={setSearch}
              onFilters={setFilters}
              onCycleSort={cycleSort}
              onSelectVisible={selectVisible}
              onSelectAll={selectAll}
              onClearSelection={clearSelection}
              onBulkDisable={() => setConfirmBulkDisable(true)}
              onBulkExport={handleBulkExport}
              onBulkDelete={() => setConfirmBulkDelete(true)}
            />

            {viewMode === "table" && (
              <ContactsTableView
                contacts={paginatedContacts}
                selectedSet={selectedSet}
                sort={sort}
                allVisibleSelected={allVisibleSelected}
                onToggleSelect={toggleSelect}
                onSelectAll={handleSelectAllVisible}
                onCycleSort={cycleSort}
                onEdit={openEdit}
                onDisable={(c) => setConfirmDisable(c)}
                onDelete={(c) => setConfirmDelete(c)}
              />
            )}

            {viewMode === "cards" && (
              <ContactsCardView
                contacts={paginatedContacts}
                selectedSet={selectedSet}
                onToggleSelect={toggleSelect}
                onEdit={openEdit}
                onDisable={(c) => setConfirmDisable(c)}
                onDelete={(c) => setConfirmDelete(c)}
              />
            )}

            {viewMode === "grid" && (
              <ContactsGridView
                contacts={paginatedContacts}
                selectedSet={selectedSet}
                onToggleSelect={toggleSelect}
                onEdit={openEdit}
                onDisable={(c) => setConfirmDisable(c)}
                onDelete={(c) => setConfirmDelete(c)}
              />
            )}

            <ContactsPagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
            />
          </>
        )}
      </div>

      {/* ── sheet ── */}
      <ContactFormSheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) setEditingContact(null);
        }}
        contact={editingContact}
        blueprint={blueprint}
        onSubmit={handleFormSubmit}
        isMutating={isMutating}
      />

      {/* ── single disable ── */}
      <ConfirmDialog
        open={Boolean(confirmDisable)}
        onOpenChange={(v) => !v && setConfirmDisable(null)}
        title="Deshabilitar contacto"
        description="El contacto quedara inactivo y no aparecera en listas por defecto."
        detail={confirmDisable?.name}
        confirmLabel="Deshabilitar"
        onConfirm={() => disableMutation.mutate(confirmDisable.id)}
        loading={disableMutation.isPending}
      />

      {/* ── single delete ── */}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Eliminar contacto"
        description="El contacto sera eliminado permanentemente. Esta accion no se puede deshacer."
        detail={confirmDelete?.name}
        confirmLabel="Eliminar"
        onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        loading={deleteMutation.isPending}
      />

      {/* ── bulk disable ── */}
      <ConfirmDialog
        open={confirmBulkDisable}
        onOpenChange={(v) => !v && setConfirmBulkDisable(false)}
        title="Deshabilitar contactos"
        description={`Se deshabilitaran ${selectedCount} contacto(s) seleccionado(s).`}
        confirmLabel="Deshabilitar"
        onConfirm={() => bulkDisableMutation.mutate()}
        loading={bulkDisableMutation.isPending}
      />

      {/* ── bulk delete ── */}
      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={(v) => !v && setConfirmBulkDelete(false)}
        title="Eliminar contactos"
        description={`Se eliminaran permanentemente ${selectedCount} contacto(s) seleccionado(s). Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar todo"
        onConfirm={() => bulkDeleteMutation.mutate()}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
