import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  ConfirmDialog,
  PageHeader,
  DataTable,
  ActionMenu,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@atlas/ui";
import { Power, PowerOff, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

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

export default function UsersScreen() {
  const navigate = useNavigate();
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) =>
    Boolean(userProfile?.isAdmin || permissions.includes(key));
  const canReadUsers = Boolean(
    hasPermission("identity.read") || hasPermission("identity.manage"),
  );
  const canManageUsers = Boolean(hasPermission("identity.manage"));
  const queryClient = useQueryClient();

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

  const users = usersQuery.data?.data ?? [];
  const USERS_FILTERS = useMemo(
    () => [
      {
        key: "enabled",
        label: "Estado",
        options: [
          { value: "true", label: "Activo" },
          { value: "false", label: "Inactivo" },
        ],
        match: (row, value) => String(row.enabled) === value,
      },
    ],
    [],
  );

  const columns = useMemo(
    () => [
      {
        id: "user",
        header: "Usuario",
        accessorFn: (row) => row.displayName ?? row.email,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage
                  src={u.avatarUrl ?? undefined}
                  alt={u.displayName}
                />
                <AvatarFallback className="text-xs font-semibold bg-(--brand-soft) text-(--brand-primary)">
                  {getInitials(u.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-sm font-medium truncate block hover:underline cursor-pointer text-left"
                  onClick={() =>
                    navigate(`/app/m/atlas.identity/identity/users/${u.id}`)
                  }
                >
                  {u.displayName || "Usuario"}
                </button>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                  {u.email}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Rol",
        accessorFn: (row) => row.memberships?.[0]?.roleName ?? "Sin rol",
        cell: ({ row }) => {
          const u = row.original;
          const membership = u.memberships?.[0] ?? null;
          return (
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="text-xs text-[hsl(var(--foreground))]">
                {membership?.roleName ?? "Sin rol"}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "enabled",
        header: "Estado",
        size: 100,
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? "success" : "secondary"}>
            {row.original.enabled ? "Activo" : "Inactivo"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 48,
        cell: ({ row }) => {
          if (!canManageUsers) return null;
          const u = row.original;
          return (
            <ActionMenu
              items={[
                u.enabled
                  ? {
                      label: "Desactivar",
                      icon: PowerOff,
                      onClick: () =>
                        updateUserMutation.mutate({
                          id: u.id,
                          patch: { enabled: false },
                        }),
                    }
                  : {
                      label: "Activar",
                      icon: Power,
                      onClick: () =>
                        updateUserMutation.mutate({
                          id: u.id,
                          patch: { enabled: true },
                        }),
                    },
                {
                  label: "Editar",
                  icon: Shield,
                  onClick: () =>
                    navigate(`/app/m/atlas.identity/identity/users/${u.id}`),
                },
                ...(u.id !== userProfile?.id
                  ? [
                      {
                        label: "Eliminar",
                        icon: Trash2,
                        variant: "destructive",
                        onClick: () => setDeleteTarget(u),
                      },
                    ]
                  : []),
              ]}
            />
          );
        },
      },
    ],
    [canManageUsers, navigate, updateUserMutation],
  );

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Identity"
          title="Usuarios"
          description="Gestiona los usuarios y sus roles dentro de la instancia."
          actions={
            canManageUsers && (
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

        <DataTable
          columns={columns}
          data={users}
          filters={USERS_FILTERS}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          onRetry={() => {
            usersQuery.refetch();
          }}
          searchPlaceholder="Buscar usuario..."
          emptyTitle="Sin usuarios"
          emptyDescription="No hay usuarios registrados en esta instancia."
          emptyIcon={Users}
        />
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
