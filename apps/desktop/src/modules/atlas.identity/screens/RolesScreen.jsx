import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  TextField,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@atlas/ui";
import {
  KeyRound,
  Pencil,
  Power,
  PowerOff,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export default function RolesScreen() {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const isAdmin = ["atlas.admin", "system.admin"].includes(userProfile?.role);
  const queryClient = useQueryClient();

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [pendingKeys, setPendingKeys] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ["identity-roles"],
    queryFn: () => atlas.identity.listRoles(token),
    enabled: Boolean(token),
  });

  const permissionsQuery = useQuery({
    queryKey: ["identity-permissions"],
    queryFn: () => atlas.identity.listPermissions(token),
    enabled: Boolean(token),
  });

  const roles = rolesQuery.data?.data ?? [];
  const permData = permissionsQuery.data?.data ?? {};
  const allPermissions = permData.permissions ?? [];
  const groups = permData.groups ?? [];

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  useEffect(() => {
    if (selectedRole) {
      setPendingKeys(new Set(selectedRole.permissionKeys ?? []));
    } else {
      setPendingKeys(null);
    }
  }, [selectedRoleId, selectedRole?.permissionKeys?.join(",")]);

  const savedKeys = useMemo(
    () => new Set(selectedRole?.permissionKeys ?? []),
    [selectedRole],
  );

  const isDirty = useMemo(() => {
    if (!pendingKeys || !selectedRole) return false;
    if (pendingKeys.size !== savedKeys.size) return true;
    for (const k of pendingKeys) if (!savedKeys.has(k)) return true;
    return false;
  }, [pendingKeys, savedKeys, selectedRole]);

  const createRoleMutation = useMutation({
    mutationFn: (data) => atlas.identity.createRole(data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      setSheetOpen(false);
      toast.success("Rol creado");
    },
    onError: () => toast.error("No se pudo crear el rol"),
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
    if (!isAdmin) return;
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { key: "", name: "", description: "" },
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm({
    defaultValues: { name: "", description: "" },
  });

  function onCreateSubmit(data) {
    createRoleMutation.mutate(data);
  }

  function openEditSheet(role) {
    resetEdit({ name: role.name, description: role.description ?? "" });
    setEditSheetOpen(true);
  }

  function onEditSubmit(data) {
    if (!selectedRole) return;
    updateRoleMutation.mutate({ id: selectedRole.id, data });
  }

  const isLoading = rolesQuery.isLoading || permissionsQuery.isLoading;
  const isError = rolesQuery.isError || permissionsQuery.isError;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Identity"
          title="Roles y permisos"
          description="Define roles y asigna permisos para controlar el acceso en tu instancia."
          actions={
            isAdmin && (
              <Button
                onClick={() => {
                  reset();
                  setSheetOpen(true);
                }}
              >
                <Shield className="h-4 w-4" />
                Nuevo rol
              </Button>
            )
          }
        />

        {!isAdmin && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-sm px-4 py-3 text-[hsl(var(--muted-foreground))]">
            Solo administradores pueden modificar roles y permisos. Estás en
            modo lectura.
          </div>
        )}

        {isLoading ? (
          <div className="grid lg:grid-cols-[280px_1fr] gap-6">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <ErrorState
            title="Error al cargar roles"
            onRetry={() => {
              rolesQuery.refetch();
              permissionsQuery.refetch();
            }}
          />
        ) : (
          <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
            {/* Roles list */}
            <div className="flex flex-col gap-1 rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--background))]">
              <div className="px-3 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  Roles ({roles.length})
                </p>
              </div>
              {roles.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="Sin roles"
                  description="Crea tu primer rol."
                  variant="compact"
                />
              ) : (
                <div className="divide-y divide-[hsl(var(--border))]">
                  {roles.map((role) => {
                    const isSelected = role.id === selectedRoleId;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() =>
                          setSelectedRoleId(isSelected ? null : role.id)
                        }
                        className={[
                          "w-full text-left px-3 py-3 transition-colors cursor-pointer",
                          "hover:bg-[hsl(var(--muted))]/60",
                          isSelected
                            ? "border-l-2 border-l-(--brand-primary) bg-(--brand-soft) pl-2.5"
                            : "border-l-2 border-l-transparent",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {role.name}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                              {role.key}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
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
                        {(role.permissionKeys?.length ?? 0) > 0 && (
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                            {role.permissionKeys.length} permiso
                            {role.permissionKeys.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Permission panel */}
            <div className="space-y-4">
              {!selectedRole ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Selecciona un rol"
                  description="Haz clic en un rol de la lista para ver y editar sus permisos."
                />
              ) : (
                <>
                  {/* Role header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3">
                    <div>
                      <p className="font-semibold">{selectedRole.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {selectedRole.description || "Sin descripción"}
                      </p>
                    </div>
                    {isAdmin && !selectedRole.system && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditSheet(selectedRole)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleRoleMutation.isPending}
                          onClick={() =>
                            toggleRoleMutation.mutate({
                              id: selectedRole.id,
                              enabled: !selectedRole.enabled,
                            })
                          }
                        >
                          {selectedRole.enabled ? (
                            <>
                              <PowerOff className="h-3.5 w-3.5" /> Desactivar
                            </>
                          ) : (
                            <>
                              <Power className="h-3.5 w-3.5" /> Activar
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Permission groups */}
                  {groups.length === 0 && allPermissions.length === 0 ? (
                    <EmptyState
                      icon={KeyRound}
                      title="Sin permisos disponibles"
                      description="No hay permisos definidos en el sistema."
                    />
                  ) : (
                    <PermissionGroups
                      groups={groups}
                      allPermissions={allPermissions}
                      pendingKeys={pendingKeys ?? savedKeys}
                      onToggle={togglePermission}
                      disabled={!isAdmin || savePermsMutation.isPending}
                    />
                  )}

                  {/* Floating save bar */}
                  {isDirty && (
                    <div className="sticky bottom-4 z-10">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 backdrop-blur px-4 py-3 shadow-lg">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                          Tienes cambios sin guardar en los permisos.
                        </p>
                        <div className="flex items-center gap-2">
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
                                id: selectedRole.id,
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
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit role sheet */}
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
                label="Descripción"
                placeholder="Describe las responsabilidades de este rol (opcional)"
                {...registerEdit("description")}
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
              id="role-form"
              onSubmit={handleSubmit(onCreateSubmit)}
              className="space-y-4"
            >
              <TextField
                label="Clave interna"
                required
                placeholder="ej. ventas.supervisor"
                error={errors.key?.message}
                {...register("key", { required: "La clave es obligatoria" })}
              />
              <TextField
                label="Nombre visible"
                required
                placeholder="Supervisor de ventas"
                error={errors.name?.message}
                {...register("name", { required: "El nombre es obligatorio" })}
              />
              <TextField
                label="Descripción"
                placeholder="Gestiona equipo y operaciones comerciales (opcional)"
                {...register("description")}
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
              form="role-form"
              disabled={createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? "Creando..." : "Crear rol"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PermissionGroups({
  groups,
  allPermissions,
  pendingKeys,
  onToggle,
  disabled,
}) {
  const byGroup = useMemo(() => {
    const map = new Map();
    for (const p of allPermissions) {
      const key = p.groupKey ?? "other";
      if (!map.has(key))
        map.set(key, { label: p.groupLabel ?? key, items: [] });
      map.get(key).items.push(p);
    }
    const order = groups.map((g) => g.key);
    return [...map.entries()].sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [allPermissions, groups]);

  return (
    <div className="space-y-3">
      {byGroup.map(([groupKey, group]) => (
        <Card key={groupKey} className="p-0 overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(var(--muted))]/40 border-b border-[hsl(var(--border))]">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
              {group.label}
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
            {group.items
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((perm) => {
                const checked = pendingKeys.has(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={[
                      "flex items-start gap-3 px-4 py-3 transition-colors",
                      "border-b border-[hsl(var(--border))]",
                      "lg:border-r lg:nth-[2n]:border-r-0",
                      "2xl:nth-[2n]:border-r 2xl:nth-[3n]:border-r-0",
                      disabled
                        ? "opacity-60"
                        : "cursor-pointer hover:bg-[hsl(var(--muted))]/40",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => onToggle(perm.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[hsl(var(--border))] accent-(--brand-primary) cursor-pointer disabled:cursor-default"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {perm.name || perm.key}
                      </p>
                      {perm.description && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">
                          {perm.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
          </div>
        </Card>
      ))}
    </div>
  );
}
