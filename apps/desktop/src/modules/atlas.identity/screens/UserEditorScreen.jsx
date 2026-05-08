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
  ConfirmDialog,
  SelectField,
  Skeleton,
  SwitchField,
  TextField,
} from "@atlas/ui";
import { ArrowLeft, Mail, Shield, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

const NO_ROLE_VALUE = "__none__";

function getUserIdFromPath(pathname) {
  const chunks = pathname.split("/").filter(Boolean);
  return chunks[chunks.length - 1] ?? "";
}

export default function UserEditorScreen() {
  const { session, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const token = session?.access_token;
  const userId = getUserIdFromPath(location.pathname);
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) =>
    Boolean(userProfile?.isAdmin || permissions.includes(key));
  const canReadUsers = hasPermission("identity.users.read");
  const canManageUsers = hasPermission("identity.users.update");
  const canReadRoles = hasPermission("identity.roles.read");
  const queryClient = useQueryClient();
  const isSelf = userId === userProfile?.id;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["identity-users"],
    queryFn: () => atlas.identity.listUsers(token),
    enabled: Boolean(token) && canReadUsers,
  });
  const rolesQuery = useQuery({
    queryKey: ["identity-roles"],
    queryFn: () => atlas.identity.listRoles(token),
    enabled: Boolean(token) && canReadRoles,
  });

  const user = useMemo(
    () =>
      (usersQuery.data?.data ?? []).find((item) => item.id === userId) ?? null,
    [usersQuery.data, userId],
  );
  const membership = user?.memberships?.[0] ?? null;

  const [draft, setDraft] = useState(null);

  const updateUserMutation = useMutation({
    mutationFn: (payload) => atlas.identity.updateUser(userId, payload, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["identity-users"] });
      setDraft(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: () => atlas.identity.deleteUser(userId, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["identity-users"] });
      toast.success("Usuario eliminado");
      navigate("/app/m/atlas.identity/identity/users");
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

  const roleOptions = useMemo(
    () => [
      { value: NO_ROLE_VALUE, label: "Sin rol" },
      ...(rolesQuery.data?.data ?? []).map((role) => ({
        value: role.id,
        label: role.name,
      })),
    ],
    [rolesQuery.data],
  );

  const effective = {
    firstName: draft?.firstName ?? user?.firstName ?? "",
    lastName: draft?.lastName ?? user?.lastName ?? "",
    enabled: draft?.enabled ?? user?.enabled ?? false,
    roleId: draft?.roleId ?? membership?.roleId ?? NO_ROLE_VALUE,
  };

  function saveChanges() {
    if (!user) return;
    const payload = {
      firstName: effective.firstName,
      lastName: effective.lastName,
      enabled: effective.enabled,
    };
    if (membership) {
      payload.membershipId = membership.id;
      payload.roleId =
        effective.roleId === NO_ROLE_VALUE ? null : effective.roleId;
    }
    updateUserMutation.mutate(payload);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Atlas Identity
          </p>
          <h1 className="text-2xl font-semibold mt-1">Editar usuario</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/app/m/atlas.identity/identity/users")}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </Button>
        {canManageUsers && user && !isSelf && (
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Eliminar usuario
          </Button>
        )}
      </div>

      {!canReadUsers && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No tienes permisos para consultar usuarios.
            </p>
          </CardContent>
        </Card>
      )}

      {canReadUsers && (usersQuery.isLoading || rolesQuery.isLoading) && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-8 w-72 rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </CardContent>
        </Card>
      )}

      {canReadUsers && usersQuery.isError && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">
              No se pudo cargar el usuario.
            </p>
          </CardContent>
        </Card>
      )}

      {canReadUsers && !usersQuery.isLoading && !usersQuery.isError && !user && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Usuario no encontrado.
            </p>
          </CardContent>
        </Card>
      )}

      {canReadUsers && user && !rolesQuery.isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>{user.displayName || "Usuario"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={effective.enabled ? "success" : "secondary"}>
                {effective.enabled ? "Activo" : "Inactivo"}
              </Badge>
              {membership?.companyName && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Empresa: {membership.companyName}
                </span>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <TextField
                icon={UserRound}
                label="Nombre"
                value={effective.firstName}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    firstName: e.target.value,
                  }))
                }
              />
              <TextField
                icon={UserRound}
                label="Apellidos"
                value={effective.lastName}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    lastName: e.target.value,
                  }))
                }
              />
              <TextField
                icon={Mail}
                label="Correo"
                value={user.email ?? ""}
                disabled
              />
              <SelectField
                icon={Shield}
                label="Rol"
                value={effective.roleId}
                options={roleOptions}
                placeholder="Seleccionar rol"
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...(prev ?? {}), roleId: value }))
                }
                disabled={!canManageUsers || !canReadRoles || !membership}
              />
            </div>

            <SwitchField
              id="user-enabled"
              label="Usuario activo"
              checked={effective.enabled}
              disabled={!canManageUsers}
              onChange={(checked) =>
                setDraft((prev) => ({ ...(prev ?? {}), enabled: checked }))
              }
            />

            {canManageUsers ? (
              <div className="flex justify-end">
                <Button
                  disabled={
                    updateUserMutation.isPending ||
                    !effective.firstName ||
                    !effective.lastName
                  }
                  onClick={saveChanges}
                >
                  {updateUserMutation.isPending
                    ? "Guardando..."
                    : "Guardar cambios"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Modo lectura: necesitas permiso identity.users.update para editar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar usuario?"
        description="Esta acción es irreversible. Se eliminará la cuenta del usuario y no podrá recuperarse."
        detail={user?.displayName || user?.email}
        confirmLabel="Eliminar"
        onConfirm={() =>
          toast.promise(deleteUserMutation.mutateAsync(), {
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
