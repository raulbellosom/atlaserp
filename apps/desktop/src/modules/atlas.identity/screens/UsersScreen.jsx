import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  MobileFiltersSheet,
  PageHeader,
  SearchInput,
  Skeleton,
  ViewModeSwitch,
} from "@atlas/ui";
import { Power, PowerOff, Shield, Trash2, UserPlus, Users } from "lucide-react";
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

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function UserAvatar({ user, size = "md" }) {
  const initials = getInitials(user.displayName || user.email);
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 text-base rounded-2xl"
      : size === "sm"
        ? "h-7 w-7 text-[10px] rounded-lg"
        : "h-9 w-9 text-xs rounded-xl";
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={user.displayName}
      className={`${sizeClass} shrink-0 object-cover`}
    />
  ) : (
    <div
      className={`${sizeClass} shrink-0 flex items-center justify-center font-bold bg-[--brand-primary]/20 dark:bg-[--brand-primary]/20 ring-1 ring-[--brand-primary]/50 dark:ring-[--brand-primary]/30 text-[hsl(195,98%,20%)] dark:text-[--brand-primary]`}
    >
      {initials}
    </div>
  );
}

// ── Table view ────────────────────────────────────────────────────────────────

function UsersTableView({
  users,
  onNavigate,
  onToggle,
  onDeleteRequest,
  canUpdate,
  canDelete,
  self: selfId,
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      {/* header */}
      <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_80px_48px] gap-3 px-4 py-2.5 bg-[hsl(var(--muted))]/40 border-b border-[hsl(var(--border))] text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        <span>Usuario</span>
        <span>Rol</span>
        <span>Estado</span>
        <span />
      </div>
      {users.map((u, i) => (
        <div
          key={u.id}
          className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[hsl(var(--muted))]/30 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_80px_48px] md:gap-3 md:items-center ${i < users.length - 1 ? "border-b border-[hsl(var(--border))]" : ""}`}
        >
          <div className="min-w-0 flex flex-1 items-center gap-3">
            <UserAvatar user={u} size="md" />
            <div className="min-w-0">
              <button
                type="button"
                className="text-sm font-medium truncate block hover:underline cursor-pointer text-left text-[hsl(var(--foreground))]"
                onClick={() => onNavigate(u.id)}
              >
                {u.displayName || "Usuario"}
              </button>
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                {u.email}
              </p>
            </div>
          </div>
          <div className="hidden md:flex min-w-0 items-center gap-2">
            <Shield className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
            <span className="text-xs text-[hsl(var(--foreground))] truncate">
              {u.memberships?.[0]?.roleName ?? "Sin rol"}
            </span>
          </div>
          <div className="hidden md:flex">
            <Badge variant={u.enabled ? "success" : "secondary"}>
              {u.enabled ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          {canUpdate && (
            <div className="md:justify-self-end">
              <ActionMenu
                items={[
                  u.enabled
                    ? {
                        label: "Desactivar",
                        icon: PowerOff,
                        onClick: () => onToggle(u.id, false),
                      }
                    : {
                        label: "Activar",
                        icon: Power,
                        onClick: () => onToggle(u.id, true),
                      },
                  {
                    label: "Editar",
                    icon: Shield,
                    onClick: () => onNavigate(u.id),
                  },
                  ...(canDelete && u.id !== selfId
                    ? [
                        {
                          label: "Eliminar",
                          icon: Trash2,
                          variant: "destructive",
                          onClick: () => onDeleteRequest(u),
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

// ── Card view ─────────────────────────────────────────────────────────────────

function UsersCardView({
  users,
  onNavigate,
  onToggle,
  onDeleteRequest,
  canUpdate,
  canDelete,
  self: selfId,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {users.map((u) => (
        <div
          key={u.id}
          className="glass group relative flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] p-4"
        >
          <div className="flex items-start gap-3">
            <UserAvatar user={u} size="lg" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="font-semibold text-[hsl(var(--foreground))] truncate block text-left hover:underline cursor-pointer"
                onClick={() => onNavigate(u.id)}
              >
                {u.displayName || "Usuario"}
              </button>
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                {u.email}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Badge
                  variant={u.enabled ? "success" : "secondary"}
                  className="text-xs"
                >
                  {u.enabled ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
            {canUpdate && (
              <ActionMenu
                items={[
                  u.enabled
                    ? {
                        label: "Desactivar",
                        icon: PowerOff,
                        onClick: () => onToggle(u.id, false),
                      }
                    : {
                        label: "Activar",
                        icon: Power,
                        onClick: () => onToggle(u.id, true),
                      },
                  {
                    label: "Editar",
                    icon: Shield,
                    onClick: () => onNavigate(u.id),
                  },
                  ...(canDelete && u.id !== selfId
                    ? [
                        {
                          label: "Eliminar",
                          icon: Trash2,
                          variant: "destructive",
                          onClick: () => onDeleteRequest(u),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
          <div className="border-t border-[hsl(var(--border))]/50 pt-2.5 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {u.memberships?.[0]?.roleName ?? "Sin rol"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Grid view ─────────────────────────────────────────────────────────────────

function UsersGridView({
  users,
  onNavigate,
  onToggle,
  onDeleteRequest,
  canUpdate,
  canDelete,
  self: selfId,
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {users.map((u) => (
        <div
          key={u.id}
          className="glass group relative flex flex-col items-center gap-2 rounded-2xl border border-[hsl(var(--border))] p-3 text-center"
        >
          <UserAvatar user={u} size="lg" />
          <div className="w-full min-w-0">
            <button
              type="button"
              className="truncate text-xs font-semibold text-[hsl(var(--foreground))] block text-center w-full hover:underline cursor-pointer"
              onClick={() => onNavigate(u.id)}
            >
              {u.displayName || "Usuario"}
            </button>
            <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
              {u.memberships?.[0]?.roleName ?? "Sin rol"}
            </p>
            <div className="mt-1 flex justify-center">
              <Badge
                variant={u.enabled ? "success" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {u.enabled ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
          {canUpdate && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionMenu
                items={[
                  u.enabled
                    ? {
                        label: "Desactivar",
                        icon: PowerOff,
                        onClick: () => onToggle(u.id, false),
                      }
                    : {
                        label: "Activar",
                        icon: Power,
                        onClick: () => onToggle(u.id, true),
                      },
                  {
                    label: "Editar",
                    icon: Shield,
                    onClick: () => onNavigate(u.id),
                  },
                  ...(canDelete && u.id !== selfId
                    ? [
                        {
                          label: "Eliminar",
                          icon: Trash2,
                          variant: "destructive",
                          onClick: () => onDeleteRequest(u),
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

// ── Loading skeleton ──────────────────────────────────────────────────────────

function UsersSkeleton({ viewMode }) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-2xl border border-[hsl(var(--border))] p-3"
          >
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    );
  }
  if (viewMode === "card") {
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
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-[hsl(var(--border))] last:border-0 px-4 py-3"
        >
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-24 ml-auto hidden md:block" />
          <Skeleton className="h-6 w-16 rounded-full hidden md:block" />
        </div>
      ))}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const navigate = useNavigate();
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) =>
    Boolean(userProfile?.isAdmin || permissions.includes(key));
  const canReadUsers = Boolean(hasPermission("identity.users.read"));
  const canCreateUsers = Boolean(hasPermission("identity.users.create"));
  const canUpdateUsers = Boolean(hasPermission("identity.users.update"));
  const canDeleteUsers = Boolean(hasPermission("identity.users.delete"));
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const usersQuery = useQuery({
    queryKey: ["identity-users"],
    queryFn: () => atlas.identity.listUsers(token),
    enabled: Boolean(token) && canReadUsers,
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, patch }) => atlas.identity.updateUser(id, patch, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-users"] });
      toast.success("Usuario actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el usuario"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => atlas.identity.deleteUser(id, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-users"] });
      toast.success("Usuario eliminado");
      setDeleteTarget(null);
    },
    onError: (err) => {
      try {
        const msg = JSON.parse(err?.message || "{}").error;
        toast.error(msg || "No se pudo eliminar el usuario");
      } catch {
        toast.error("No se pudo eliminar el usuario");
      }
    },
  });

  const allUsers = usersQuery.data?.data ?? [];

  const filteredUsers = useMemo(() => {
    let result = allUsers;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (u) =>
          u.displayName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.memberships?.some((m) => m.roleName?.toLowerCase().includes(q)),
      );
    }
    if (filters.enabled !== undefined && filters.enabled !== "") {
      const want = filters.enabled === "true";
      result = result.filter((u) => u.enabled === want);
    }
    return result;
  }, [allUsers, search, filters]);

  const handleNavigate = (id) =>
    navigate(`/app/m/atlas.identity/identity/users/${id}`);
  const handleToggle = (id, enabled) =>
    updateUserMutation.mutate({ id, patch: { enabled } });

  const viewProps = {
    users: filteredUsers,
    onNavigate: handleNavigate,
    onToggle: handleToggle,
    onDeleteRequest: setDeleteTarget,
    canUpdate: canUpdateUsers,
    canDelete: canDeleteUsers,
    self: userProfile?.id,
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Identity"
            title="Usuarios"
            description="Gestiona los usuarios y sus roles dentro de la instancia."
            actions={
            canCreateUsers && (
              <Button
                onClick={() =>
                  navigate("/app/m/atlas.identity/identity/users/new")
                }
              >
                <UserPlus className="h-4 w-4" />
                Nuevo usuario
              </Button>
            )
          }
        />

        {!canReadUsers && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-sm px-4 py-3 text-[hsl(var(--muted-foreground))]">
            No tienes permisos para consultar usuarios.
          </div>
        )}

        {canReadUsers && (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Buscar usuario..."
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
                />
              </div>
            </div>

            {/* Content */}
            {usersQuery.isLoading ? (
              <UsersSkeleton viewMode={viewMode} />
            ) : usersQuery.isError ? (
              <EmptyState
                icon={Users}
                title="Error al cargar usuarios"
                description="No se pudieron cargar los usuarios. Intenta nuevamente."
                action={{
                  label: "Reintentar",
                  onClick: () => usersQuery.refetch(),
                }}
              />
            ) : filteredUsers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Sin usuarios"
                description={
                  search || filters.enabled
                    ? "No hay usuarios que coincidan con los filtros aplicados."
                    : "No hay usuarios registrados en esta instancia."
                }
              />
            ) : viewMode === "card" ? (
              <UsersCardView {...viewProps} />
            ) : viewMode === "grid" ? (
              <UsersGridView {...viewProps} />
            ) : (
              <UsersTableView {...viewProps} />
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="¿Eliminar usuario?"
        description="Esta acción es irreversible. Se eliminará la cuenta del usuario y no podrá recuperarse."
        detail={deleteTarget?.displayName || deleteTarget?.email}
        confirmLabel="Eliminar"
        onConfirm={() =>
          toast.promise(deleteUserMutation.mutateAsync(deleteTarget.id), {
            loading: "Eliminando usuario...",
            success: "Usuario eliminado",
            error: (e) => {
              try {
                return (
                  JSON.parse(e?.message || "{}").error ||
                  "No se pudo eliminar el usuario"
                );
              } catch {
                return "No se pudo eliminar el usuario";
              }
            },
          })
        }
        loading={deleteUserMutation.isPending}
      />
    </div>
  );
}
