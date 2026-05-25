import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterBar,
  MobileFiltersSheet,
  PageHeader,
  SearchInput,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  TextField,
  ViewModeSwitch,
} from "@atlas/ui";
import { KeyRound, Pencil, Power, PowerOff, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

const FILTER_DEFS = [
  {
    key: "enabled",
    label: "Estado",
    options: [
      { value: "true", label: "Activo" },
      { value: "false", label: "Inactivo" },
    ],
  },
];

// ── Table view ─────────────────────────────────────────────────────────────────

function RolesTableView({ roles, onNavigate, onToggle, onEdit, onDelete, canManage }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_60px_80px_48px] gap-3 px-4 py-2.5 bg-[hsl(var(--muted))]/40 border-b border-[hsl(var(--border))] text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        <span>Rol</span>
        <span>Clave</span>
        <span>Permisos</span>
        <span>Estado</span>
        <span />
      </div>
      {roles.map((role, i) => (
        <div
          key={role.id}
          className={[
            "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[hsl(var(--muted))]/30",
            "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_60px_80px_48px] md:gap-3 md:items-center",
            i < roles.length - 1 ? "border-b border-[hsl(var(--border))]" : "",
          ].join(" ")}
        >
          {/* Name + badges */}
          <div className="min-w-0 flex flex-1 items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-[--brand-primary]/15 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-[--brand-primary]" />
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onNavigate(role.id)}
                className="text-sm font-medium truncate block hover:underline cursor-pointer text-left text-[hsl(var(--foreground))]"
              >
                {role.name}
              </button>
              {role.system && (
                <Badge variant="glass" className="text-[10px] mt-0.5">
                  Sistema
                </Badge>
              )}
            </div>
          </div>
          {/* Key */}
          <div className="hidden md:block min-w-0">
            <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono truncate block">
              {role.key}
            </span>
          </div>
          {/* Permission count */}
          <div className="hidden md:flex items-center">
            <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              {role.permissionKeys?.length ?? 0}
            </span>
          </div>
          {/* Status */}
          <div className="hidden md:flex">
            <Badge variant={role.enabled ? "success" : "secondary"}>
              {role.enabled ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          {/* Actions */}
          {canManage && (
            <div className="md:justify-self-end shrink-0">
              <ActionMenu
                items={[
                  {
                    label: "Ver permisos",
                    icon: KeyRound,
                    onClick: () => onNavigate(role.id),
                  },
                  ...(!role.system
                    ? [
                        {
                          label: "Editar",
                          icon: Pencil,
                          onClick: () => onEdit(role),
                        },
                        role.enabled
                          ? {
                              label: "Desactivar",
                              icon: PowerOff,
                              onClick: () => onToggle(role.id, false),
                            }
                          : {
                              label: "Activar",
                              icon: Power,
                              onClick: () => onToggle(role.id, true),
                            },
                        {
                          label: "Eliminar",
                          icon: Trash2,
                          variant: "destructive",
                          onClick: () => onDelete(role),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Card view ──────────────────────────────────────────────────────────────────

function RolesCardView({ roles, onNavigate, onToggle, onEdit, onDelete, canManage }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {roles.map((role) => (
        <div
          key={role.id}
          onClick={() => onNavigate(role.id)}
          className="glass group relative flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] p-4 text-left transition-all hover:border-[--brand-primary]/40 hover:shadow-md cursor-pointer"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[--brand-primary]/15 flex items-center justify-center shrink-0 ring-1 ring-[--brand-primary]/20">
              <Shield className="h-5 w-5 text-[--brand-primary]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[hsl(var(--foreground))] leading-tight truncate">
                {role.name}
              </p>
              <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                {role.key}
              </p>
            </div>
            {canManage && !role.system && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ActionMenu
                  items={[
                    {
                      label: "Editar",
                      icon: Pencil,
                      onClick: () => onEdit(role),
                    },
                    role.enabled
                      ? {
                          label: "Desactivar",
                          icon: PowerOff,
                          onClick: () => onToggle(role.id, false),
                        }
                      : {
                          label: "Activar",
                          icon: Power,
                          onClick: () => onToggle(role.id, true),
                        },
                    {
                      label: "Eliminar",
                      icon: Trash2,
                      variant: "destructive",
                      onClick: () => onDelete(role),
                    },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Description */}
          {role.description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed line-clamp-2">
              {role.description}
            </p>
          )}

          {/* Footer */}
          <div className="border-t border-[hsl(var(--border))]/50 pt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <KeyRound className="h-3 w-3 shrink-0" />
              <span className="tabular-nums">
                {role.permissionKeys?.length ?? 0} permisos
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {role.system && (
                <Badge variant="glass" className="text-[10px]">
                  Sistema
                </Badge>
              )}
              <Badge
                variant={role.enabled ? "success" : "secondary"}
                className="text-[10px]"
              >
                {role.enabled ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Grid view ──────────────────────────────────────────────────────────────────

function RolesGridView({ roles, onNavigate, onToggle, onEdit, onDelete, canManage }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {roles.map((role) => (
        <div
          key={role.id}
          onClick={() => onNavigate(role.id)}
          className="glass group relative flex flex-col items-center gap-2 rounded-2xl border border-[hsl(var(--border))] p-3 text-center transition-all hover:border-[--brand-primary]/40 cursor-pointer"
        >
          <div className="h-12 w-12 rounded-xl bg-[--brand-primary]/15 flex items-center justify-center ring-1 ring-[--brand-primary]/20">
            <Shield className="h-6 w-6 text-[--brand-primary]" />
          </div>
          <div className="w-full min-w-0">
            <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
              {role.name}
            </p>
            <div className="mt-1 flex justify-center">
              <Badge
                variant={role.enabled ? "success" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {role.enabled ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
          {canManage && !role.system && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ActionMenu
                items={[
                  {
                    label: "Editar",
                    icon: Pencil,
                    onClick: () => onEdit(role),
                  },
                  role.enabled
                    ? {
                        label: "Desactivar",
                        icon: PowerOff,
                        onClick: () => onToggle(role.id, false),
                      }
                    : {
                        label: "Activar",
                        icon: Power,
                        onClick: () => onToggle(role.id, true),
                      },
                  {
                    label: "Eliminar",
                    icon: Trash2,
                    variant: "destructive",
                    onClick: () => onDelete(role),
                  },
                ]}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function RolesSkeleton({ viewMode }) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-2xl border border-[hsl(var(--border))] p-3"
          >
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  if (viewMode === "card") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[hsl(var(--border))] p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3.5 w-44" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-[hsl(var(--border))] last:border-0 px-4 py-3"
        >
          <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28 ml-auto hidden md:block" />
          <Skeleton className="h-6 w-14 rounded-full hidden md:block" />
        </div>
      ))}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function RolesScreen() {
  const navigate = useNavigate();
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) =>
    Boolean(userProfile?.isAdmin || permissions.includes(key));
  const hasAnyPermission = (keys) => keys.some((k) => hasPermission(k));
  const canReadRoles = hasPermission("identity.roles.read");
  const canCreateRoles = hasPermission("identity.roles.create");
  const canManageRoles = hasAnyPermission([
    "identity.roles.update",
    "identity.roles.delete",
  ]);
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState("card");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const rolesQuery = useQuery({
    queryKey: ["identity-roles"],
    queryFn: () => atlas.identity.listRoles(token),
    enabled: Boolean(token) && canReadRoles,
  });

  const createRoleMutation = useMutation({
    mutationFn: (data) => atlas.identity.createRole(data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      setSheetOpen(false);
      toast.success("Rol creado");
    },
    onError: () => toast.error("No se pudo crear el rol"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }) => atlas.identity.updateRole(id, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      setEditTarget(null);
      toast.success("Rol actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el rol"),
  });

  const toggleRoleMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.identity.setRoleEnabled(id, enabled, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      toast.success("Estado actualizado");
    },
    onError: () => toast.error("No se pudo cambiar el estado"),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => atlas.identity.deleteRole(id, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      setDeleteTarget(null);
      toast.success("Rol eliminado");
    },
    onError: (err) =>
      toast.error(err?.message || "No se pudo eliminar el rol"),
  });

  const allRoles = rolesQuery.data?.data ?? [];

  const filteredRoles = (() => {
    let result = allRoles;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.key?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q),
      );
    }
    if (filters.enabled !== undefined && filters.enabled !== "") {
      const want = filters.enabled === "true";
      result = result.filter((r) => r.enabled === want);
    }
    return result;
  })();

  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm({ defaultValues: { key: "", name: "", description: "" } });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm({ defaultValues: { name: "", description: "" } });

  function onCreateSubmit(data) {
    createRoleMutation.mutate(data);
  }

  function openEditSheet(role) {
    resetEdit({ name: role.name, description: role.description ?? "" });
    setEditTarget(role);
  }

  function onEditSubmit(data) {
    if (!editTarget) return;
    updateRoleMutation.mutate({ id: editTarget.id, data });
  }

  const handleNavigate = (id) =>
    navigate(`/app/m/atlas.identity/identity/roles/${id}`);
  const handleToggle = (id, enabled) =>
    toggleRoleMutation.mutate({ id, enabled });

  const viewProps = {
    roles: filteredRoles,
    onNavigate: handleNavigate,
    onToggle: handleToggle,
    onEdit: openEditSheet,
    onDelete: setDeleteTarget,
    canManage: canManageRoles,
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Identity"
          title="Roles y permisos"
          description="Define roles y asigna permisos para controlar el acceso en tu instancia."
          actions={
            canCreateRoles && (
              <Button
                onClick={() => {
                  resetCreate();
                  setSheetOpen(true);
                }}
              >
                <Shield className="h-4 w-4" />
                Nuevo rol
              </Button>
            )
          }
        />

        {!canReadRoles ? (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-sm px-4 py-3 text-[hsl(var(--muted-foreground))]">
            No tienes permisos para consultar roles.
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Buscar rol..."
                className="flex-1 min-w-0 sm:max-w-sm"
              />
              <div className="hidden md:flex items-center gap-2">
                <FilterBar
                  filters={FILTER_DEFS}
                  value={filters}
                  onChange={setFilters}
                />
              </div>
              <MobileFiltersSheet
                activeCount={Object.values(filters).filter(Boolean).length}
                onClear={() => setFilters({})}
              >
                <FilterBar
                  filters={FILTER_DEFS}
                  value={filters}
                  onChange={setFilters}
                />
              </MobileFiltersSheet>
              <div className="sm:ml-auto">
                <ViewModeSwitch
                  value={viewMode}
                  onChange={setViewMode}
                  modes={["table", "card", "grid"]}
                  storageKey="roles-view-mode"
                />
              </div>
            </div>

            {/* Content */}
            {rolesQuery.isLoading ? (
              <RolesSkeleton viewMode={viewMode} />
            ) : rolesQuery.isError ? (
              <ErrorState
                title="Error al cargar roles"
                onRetry={() => rolesQuery.refetch()}
              />
            ) : filteredRoles.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="Sin roles"
                description={
                  search || filters.enabled
                    ? "No hay roles que coincidan con los filtros aplicados."
                    : "No hay roles registrados en esta instancia."
                }
              />
            ) : viewMode === "card" ? (
              <RolesCardView {...viewProps} />
            ) : viewMode === "grid" ? (
              <RolesGridView {...viewProps} />
            ) : (
              <RolesTableView {...viewProps} />
            )}
          </>
        )}
      </div>

      {/* Create role sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          if (!createRoleMutation.isPending) setSheetOpen(v);
        }}
      >
        <SheetContent className="sm:max-w-md lg:max-w-xl xl:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Nuevo rol</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <form
              id="create-role-form"
              onSubmit={handleCreateSubmit(onCreateSubmit)}
              className="space-y-4"
            >
              <TextField
                label="Clave interna"
                required
                placeholder="ej. ventas.supervisor"
                error={createErrors.key?.message}
                {...registerCreate("key", {
                  required: "La clave es obligatoria",
                })}
              />
              <TextField
                label="Nombre visible"
                required
                placeholder="Supervisor de ventas"
                error={createErrors.name?.message}
                {...registerCreate("name", {
                  required: "El nombre es obligatorio",
                })}
              />
              <TextField
                label="Descripcion"
                placeholder="Gestiona equipo y operaciones comerciales (opcional)"
                {...registerCreate("description")}
              />
            </form>
          </div>
          <SheetFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={createRoleMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-role-form"
              disabled={createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? "Creando..." : "Crear rol"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Eliminar rol"
        description={
          (deleteTarget?.memberCount ?? 0) > 0
            ? `El rol "${deleteTarget?.name}" tiene ${deleteTarget.memberCount} ${deleteTarget.memberCount === 1 ? "usuario asignado" : "usuarios asignados"}. Al eliminarlo quedaran sin rol y perderan todos los permisos asociados a este rol.`
            : `¿Confirmas que quieres eliminar "${deleteTarget?.name}"? Esta accion no se puede deshacer.`
        }
        confirmLabel={
          (deleteTarget?.memberCount ?? 0) > 0
            ? "Eliminar de todas formas"
            : "Eliminar"
        }
        onConfirm={() => deleteRoleMutation.mutate(deleteTarget.id)}
        loading={deleteRoleMutation.isPending}
      />

      {/* Edit role sheet */}
      <Sheet
        open={Boolean(editTarget)}
        onOpenChange={(v) => {
          if (!updateRoleMutation.isPending && !v) setEditTarget(null);
        }}
      >
        <SheetContent className="sm:max-w-md lg:max-w-xl xl:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Editar rol</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <form
              id="edit-role-form"
              onSubmit={handleEditSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <TextField
                label="Nombre visible"
                required
                placeholder="Supervisor de ventas"
                error={editErrors.name?.message}
                {...registerEdit("name", {
                  required: "El nombre es obligatorio",
                })}
              />
              <TextField
                label="Descripcion"
                placeholder="Describe las responsabilidades de este rol (opcional)"
                {...registerEdit("description")}
              />
            </form>
          </div>
          <SheetFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={updateRoleMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="edit-role-form"
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
