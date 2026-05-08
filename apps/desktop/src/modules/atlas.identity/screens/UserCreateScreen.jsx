import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SelectField,
  TextField,
} from "@atlas/ui";
import { ArrowLeft, KeyRound, Mail, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

const NO_ROLE_VALUE = "__none__";

export default function UserCreateScreen() {
  const { session, userProfile } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) =>
    Boolean(userProfile?.isAdmin || permissions.includes(key));
  const canManageUsers = hasPermission("identity.users.create");
  const canReadRoles = hasPermission("identity.roles.read");
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ["identity-roles"],
    queryFn: () => atlas.identity.listRoles(token),
    enabled: Boolean(token) && canReadRoles,
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roleId: NO_ROLE_VALUE,
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

  const createUserMutation = useMutation({
    mutationFn: (payload) => atlas.identity.createUser(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-users"] });
      toast.success("Usuario creado correctamente");
      navigate("/app/m/atlas.identity/identity/users");
    },
    onError: (err) => {
      try {
        const msg = JSON.parse(err?.message || "{}").error;
        toast.error(msg || "No se pudo crear el usuario");
      } catch {
        toast.error("No se pudo crear el usuario");
      }
    },
  });

  function handleSubmit() {
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
    };
    if (form.roleId && form.roleId !== NO_ROLE_VALUE) {
      payload.roleId = form.roleId;
    }
    createUserMutation.mutate(payload);
  }

  const isValid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Atlas Identity
          </p>
          <h1 className="text-2xl font-semibold mt-1">Nuevo usuario</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/app/m/atlas.identity/identity/users")}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </Button>
      </div>

      {!canManageUsers && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Sin permisos para crear usuarios.
            </p>
          </CardContent>
        </Card>
      )}

      {canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle>Datos del nuevo usuario</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <TextField
                icon={UserRound}
                label="Nombre"
                value={form.firstName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
                placeholder="Juan"
              />
              <TextField
                icon={UserRound}
                label="Apellidos"
                value={form.lastName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
                placeholder="García López"
              />
              <TextField
                icon={Mail}
                label="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="usuario@empresa.com"
              />
              <TextField
                icon={KeyRound}
                label="Contraseña"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Mínimo 8 caracteres"
              />
              <SelectField
                icon={Shield}
                label="Rol"
                value={form.roleId}
                options={roleOptions}
                placeholder="Seleccionar rol"
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, roleId: value }))
                }
                disabled={!canReadRoles}
              />
            </div>

            <div className="flex justify-end">
              <Button
                disabled={!isValid || createUserMutation.isPending}
                onClick={handleSubmit}
              >
                {createUserMutation.isPending
                  ? "Creando usuario..."
                  : "Crear usuario"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
