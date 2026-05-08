import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  TextField,
} from "@atlas/ui";
import { ArrowLeft, KeyRound, Pencil, Power, PowerOff, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import PermissionFeatureTree from "../components/PermissionFeatureTree";

function getRoleIdFromPath(pathname) {
  const chunks = pathname.split("/").filter(Boolean);
  return chunks[chunks.length - 1] ?? "";
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function RoleEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl border border-[hsl(var(--border))] px-5 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden"
        >
          <div className="px-4 py-3 bg-[hsl(var(--muted))]/40 border-b">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function RoleEditorScreen() {
  const { session, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const token = session?.access_token;
  const roleId = getRoleIdFromPath(location.pathname);

  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) =>
    Boolean(userProfile?.isAdmin || permissions.includes(key));
  const canReadRoles = hasPermission("identity.roles.read");
  const canManageRoles = hasPermission("identity.roles.update");
  const canReadPermissions = hasPermission("identity.permissions.read");
  const canManagePermissions = hasPermission("identity.permissions.update");

  const queryClient = useQueryClient();
  const [pendingKeys, setPendingKeys] = useState(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ["identity-roles"],
    queryFn: () => atlas.identity.listRoles(token),
    enabled: Boolean(token) && canReadRoles,
  });

  const permissionsQuery = useQuery({
    queryKey: ["identity-permissions"],
    queryFn: () => atlas.identity.listPermissions(token),
    enabled: Boolean(token) && canReadPermissions,
  });

  const roles = rolesQuery.data?.data ?? [];
  const permData = permissionsQuery.data?.data ?? {};
  const allPermissions = permData.permissions ?? [];

  const role = useMemo(
    () => roles.find((r) => r.id === roleId) ?? null,
    [roles, roleId],
  );

  useEffect(() => {
    if (role) {
      setPendingKeys(new Set(role.permissionKeys ?? []));
    } else {
      setPendingKeys(null);
    }
  }, [roleId, role?.permissionKeys?.join(",")]);

  const savedKeys = useMemo(
    () => new Set(role?.permissionKeys ?? []),
    [role],
  );

  const isDirty = useMemo(() => {
    if (!pendingKeys || !role) return false;
    if (pendingKeys.size !== savedKeys.size) return true;
    for (const k of pendingKeys) if (!savedKeys.has(k)) return true;
    return false;
  }, [pendingKeys, savedKeys, role]);

  const toggleRoleMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.identity.setRoleEnabled(id, enabled, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      toast.success("Estado actualizado");
    },
    onError: () => toast.error("No se pudo cambiar el estado"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }) => atlas.identity.updateRole(id, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      setEditSheetOpen(false);
      toast.success("Rol actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el rol"),
  });

  const savePermsMutation = useMutation({
    mutationFn: ({ id, keys }) =>
      atlas.identity.setRolePermissions(id, [...keys], token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      toast.success("Permisos guardados");
    },
    onError: () => toast.error("No se pudieron guardar los permisos"),
  });

  function togglePermission(key) {
    if (!canManagePermissions) return;
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePermissionGroup(keys, checked) {
    if (!canManagePermissions) return;
    setPendingKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { name: "", description: "" } });

  function openEditSheet() {
    if (!role) return;
    reset({ name: role.name, description: role.description ?? "" });
    setEditSheetOpen(true);
  }

  function onEditSubmit(data) {
    if (!role) return;
    updateRoleMutation.mutate({ id: role.id, data });
  }

  const isLoading =
    rolesQuery.isLoading ||
    (canReadPermissions && permissionsQuery.isLoading);
  const isError =
    rolesQuery.isError || (canReadPermissions && permissionsQuery.isError);

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Identity · Roles"
          title={role?.name ?? (rolesQuery.isLoading ? "Cargando..." : "Rol no encontrado")}
          description={role?.description || (role ? "Sin descripcion" : "")}
          actions={
            <Button
              variant="outline"
              onClick={() =>
                navigate("/app/m/atlas.identity/identity/roles")
              }
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a roles
            </Button>
          }
        />

        {isLoading ? (
          <RoleEditorSkeleton />
        ) : isError ? (
          <ErrorState
            title="Error al cargar datos"
            onRetry={() => {
              rolesQuery.refetch();
              if (canReadPermissions) permissionsQuery.refetch();
            }}
          />
        ) : !role ? (
          <EmptyState
            icon={Shield}
            title="Rol no encontrado"
            description="Este rol no existe o no esta disponible."
            action={{
              label: "Volver a roles",
              onClick: () =>
                navigate("/app/m/atlas.identity/identity/roles"),
            }}
          />
        ) : (
          <>
            {/* ── Role info card ─────────────────────────────────────────── */}
            <div className="glass rounded-2xl border border-[hsl(var(--border))] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-xl bg-[--brand-primary]/15 flex items-center justify-center shrink-0 ring-1 ring-[--brand-primary]/20">
                    <Shield className="h-5 w-5 text-[--brand-primary]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[hsl(var(--foreground))] truncate">
                      {role.name}
                    </p>
                    <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                      {role.key}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {role.system && (
                    <Badge variant="glass">Sistema</Badge>
                  )}
                  <Badge variant={role.enabled ? "success" : "secondary"}>
                    {role.enabled ? "Activo" : "Inactivo"}
                  </Badge>
                  {canManageRoles && !role.system && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openEditSheet}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleRoleMutation.isPending}
                        onClick={() =>
                          toggleRoleMutation.mutate({
                            id: role.id,
                            enabled: !role.enabled,
                          })
                        }
                      >
                        {role.enabled ? (
                          <>
                            <PowerOff className="h-3.5 w-3.5" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <Power className="h-3.5 w-3.5" />
                            Activar
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Stat strip */}
              <div className="mt-4 pt-3 border-t border-[hsl(var(--border))]/50 flex items-center gap-5 text-xs text-[hsl(var(--muted-foreground))]">
                <div className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 shrink-0" />
                  <span className="tabular-nums">
                    {pendingKeys?.size ?? savedKeys.size} permisos asignados
                  </span>
                </div>
                {!canManagePermissions && (
                  <Badge variant="secondary" className="text-[10px]">
                    Solo lectura
                  </Badge>
                )}
              </div>
            </div>

            {/* ── Permission tree ────────────────────────────────────────── */}
            {!canReadPermissions ? (
              <EmptyState
                icon={KeyRound}
                title="Sin acceso al catalogo de permisos"
                description="Necesitas el permiso identity.permissions.read para ver el catalogo."
              />
            ) : allPermissions.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title="Sin permisos disponibles"
                description="No hay permisos definidos en el sistema."
              />
            ) : (
              <PermissionFeatureTree
                key={roleId}
                allPermissions={allPermissions}
                pendingKeys={pendingKeys ?? savedKeys}
                onTogglePermission={togglePermission}
                onBulkToggle={togglePermissionGroup}
                disabled={
                  !canManagePermissions || savePermsMutation.isPending
                }
              />
            )}
          </>
        )}
      </div>

      {/* ── Floating save bar ────────────────────────────────────────────────── */}
      {isDirty && canManagePermissions && (
        <div className="sticky bottom-0 z-20 p-4 md:p-6 pt-0">
          <div className="glass-strong flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] px-5 py-3.5 shadow-2xl">
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              Cambios sin guardar en permisos
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                disabled={savePermsMutation.isPending}
                onClick={() => setPendingKeys(new Set(savedKeys))}
              >
                Descartar
              </Button>
              <Button
                size="sm"
                disabled={savePermsMutation.isPending}
                onClick={() =>
                  savePermsMutation.mutate({
                    id: role.id,
                    keys: pendingKeys,
                  })
                }
              >
                {savePermsMutation.isPending
                  ? "Guardando..."
                  : "Guardar permisos"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit role sheet ──────────────────────────────────────────────────── */}
      <Sheet
        open={editSheetOpen}
        onOpenChange={(v) => {
          if (!updateRoleMutation.isPending) setEditSheetOpen(v);
        }}
      >
        <SheetContent className="sm:max-w-md lg:max-w-xl xl:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Editar rol</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <form
              id="edit-role-form"
              onSubmit={handleSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <TextField
                label="Nombre visible"
                required
                placeholder="Supervisor de ventas"
                error={errors.name?.message}
                {...register("name", {
                  required: "El nombre es obligatorio",
                })}
              />
              <TextField
                label="Descripcion"
                placeholder="Describe las responsabilidades de este rol (opcional)"
                {...register("description")}
              />
            </form>
          </div>
          <SheetFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditSheetOpen(false)}
              disabled={updateRoleMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="edit-role-form"
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending
                ? "Guardando..."
                : "Guardar cambios"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
