import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Skeleton,
} from "@atlas/ui";
import { ArrowLeft, Shield } from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function getRoleIdFromPath(pathname) {
  const chunks = pathname.split("/").filter(Boolean);
  return chunks[chunks.length - 1] ?? "";
}

export default function RoleEditorScreen() {
  const { session, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const token = session?.access_token;
  const roleId = getRoleIdFromPath(location.pathname);
  const isAdmin = ["atlas.admin", "system.admin"].includes(userProfile?.role);
  const queryClient = useQueryClient();

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

  const role = useMemo(
    () => (rolesQuery.data?.data ?? []).find((item) => item.id === roleId) ?? null,
    [rolesQuery.data, roleId],
  );
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  const currentPermissionSet = useMemo(() => {
    if (selectedPermissions.length > 0) return selectedPermissions;
    return role?.permissionKeys ?? [];
  }, [role, selectedPermissions]);

  const groups = permissionsQuery.data?.data?.groups ?? [];

  const savePermissionsMutation = useMutation({
    mutationFn: () => atlas.identity.setRolePermissions(roleId, currentPermissionSet, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["identity-roles"] });
      setSelectedPermissions([]);
    },
  });

  function togglePermission(permissionKey, checked) {
    const base = selectedPermissions.length > 0 ? selectedPermissions : (role?.permissionKeys ?? []);
    const next = checked
      ? [...new Set([...base, permissionKey])]
      : base.filter((item) => item !== permissionKey);
    setSelectedPermissions(next);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Atlas Identity
          </p>
          <h1 className="text-2xl font-semibold mt-1">Editar rol</h1>
        </div>
        <Button variant="outline" onClick={() => navigate("/app/m/atlas.identity/identity/roles")}>
          <ArrowLeft className="h-4 w-4" />
          Volver a roles
        </Button>
      </div>

      {rolesQuery.isLoading || permissionsQuery.isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-8 w-80 rounded-lg" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </CardContent>
        </Card>
      ) : role ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{role.name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{role.description || "Sin descripcion"}</p>
              <div className="flex items-center gap-2">
                <Badge variant={role.enabled ? "success" : "secondary"}>
                  {role.enabled ? "Activo" : "Inactivo"}
                </Badge>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Clave: {role.key}</span>
                {!isAdmin && <Badge variant="secondary">Modo lectura</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permisos por modulo</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {groups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
                  No implementado: no hay permisos disponibles en el catalogo.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {groups.map((group) => (
                    <div key={group.groupKey} className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-(--brand-primary)" />
                        <p className="text-sm font-semibold">{group.groupLabel}</p>
                      </div>
                      <div className="space-y-2">
                        {group.permissions.map((permission) => {
                          const checked = currentPermissionSet.includes(permission.key);
                          return (
                            <div key={permission.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                              <div className="flex items-start gap-2">
                                {isAdmin ? (
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(next) => togglePermission(permission.key, Boolean(next))}
                                    className="mt-1"
                                  />
                                ) : (
                                  <Badge variant={checked ? "success" : "secondary"}>
                                    {checked ? "Permitido" : "Sin asignar"}
                                  </Badge>
                                )}
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold">{permission.name}</p>
                                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{permission.description}</p>
                                  {isAdmin && (
                                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                      Clave tecnica: {permission.key}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isAdmin && (
                <div className="flex justify-end">
                  <Button disabled={savePermissionsMutation.isPending} onClick={() => savePermissionsMutation.mutate()}>
                    {savePermissionsMutation.isPending ? "Guardando..." : "Guardar permisos"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Rol no encontrado o sin datos disponibles.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
