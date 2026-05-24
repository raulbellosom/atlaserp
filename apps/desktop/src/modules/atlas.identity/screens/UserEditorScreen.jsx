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
  ComboboxField,
  ConfirmDialog,
  DateField,
  PhoneField,
  SelectField,
  Skeleton,
  SwitchField,
  TextField,
  TextareaField,
} from "@atlas/ui";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  Shield,
  Trash2,
  UserRound,
  VenusAndMars,
} from "lucide-react";
import { Country, State, City } from "country-state-city";
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
    email: draft?.email ?? user?.email ?? "",
    enabled: draft?.enabled ?? user?.enabled ?? false,
    roleId: draft?.roleId ?? membership?.roleId ?? NO_ROLE_VALUE,
    phone: draft?.phone ?? user?.phone ?? "",
    birthDate:
      draft?.birthDate ??
      (user?.birthDate
        ? new Date(user.birthDate).toISOString().slice(0, 10)
        : ""),
    gender: draft?.gender ?? user?.gender ?? "",
    bio: draft?.bio ?? user?.bio ?? "",
    country: draft?.country ?? user?.country ?? "",
    state: draft?.state ?? user?.state ?? "",
    city: draft?.city ?? user?.city ?? "",
    colony: draft?.colony ?? user?.colony ?? "",
    street: draft?.street ?? user?.street ?? "",
    extNumber: draft?.extNumber ?? user?.extNumber ?? "",
    intNumber: draft?.intNumber ?? user?.intNumber ?? "",
    postalCode: draft?.postalCode ?? user?.postalCode ?? "",
  };

  const countryOptions = useMemo(
    () =>
      Country.getAllCountries().map((c) => ({ value: c.isoCode, label: c.name })),
    [],
  );

  const stateOptions = useMemo(
    () =>
      effective.country
        ? State.getStatesOfCountry(effective.country).map((s) => ({
            value: s.isoCode,
            label: s.name,
          }))
        : [],
    [effective.country],
  );

  const cityOptions = useMemo(
    () =>
      effective.country && effective.state
        ? City.getCitiesOfState(effective.country, effective.state).map(
            (c) => ({ value: c.name, label: c.name }),
          )
        : [],
    [effective.country, effective.state],
  );

  function saveChanges() {
    if (!user) return;
    const payload = {
      firstName: effective.firstName,
      lastName: effective.lastName,
      enabled: effective.enabled,
      email: effective.email,
      phone: effective.phone || null,
      birthDate: effective.birthDate || null,
      gender: effective.gender || null,
      bio: effective.bio || null,
      country: effective.country || null,
      state: effective.state || null,
      city: effective.city || null,
      colony: effective.colony || null,
      street: effective.street || null,
      extNumber: effective.extNumber || null,
      intNumber: effective.intNumber || null,
      postalCode: effective.postalCode || null,
    };
    if (membership) {
      payload.membershipId = membership.id;
      payload.roleId =
        effective.roleId === NO_ROLE_VALUE ? null : effective.roleId;
    }
    updateUserMutation.mutate(payload, {
      onSuccess: () => toast.success("Usuario actualizado"),
      onError: () => toast.error("No se pudo actualizar el usuario"),
    });
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
        <div className="flex items-center gap-2">
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
                value={effective.email}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    email: e.target.value,
                  }))
                }
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

      {canReadUsers && user && !rolesQuery.isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <PhoneField
                label="Teléfono"
                icon={Phone}
                value={effective.phone}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({ ...(prev ?? {}), phone: e.target.value }))
                }
              />
              <DateField
                label="Fecha de nacimiento"
                icon={CalendarDays}
                value={effective.birthDate}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    birthDate: e.target.value,
                  }))
                }
              />
              <SelectField
                icon={VenusAndMars}
                label="Sexo"
                value={effective.gender}
                placeholder="Seleccionar"
                disabled={!canManageUsers}
                options={[
                  { value: "masculino", label: "Masculino" },
                  { value: "femenino", label: "Femenino" },
                  { value: "no_binario", label: "No binario" },
                  { value: "prefiero_no_decir", label: "Prefiero no decir" },
                ]}
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...(prev ?? {}), gender: value }))
                }
              />
            </div>

            <TextareaField
              label="Biografía"
              value={effective.bio}
              maxLength={500}
              disabled={!canManageUsers}
              onChange={(e) =>
                setDraft((prev) => ({ ...(prev ?? {}), bio: e.target.value }))
              }
            />

            <p className="text-[13px] font-medium text-[hsl(var(--foreground))]/80 flex items-center gap-1.5 pt-2">
              <MapPin className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              Dirección
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <ComboboxField
                label="País"
                options={countryOptions}
                value={effective.country}
                disabled={!canManageUsers}
                onChange={(val) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    country: val,
                    state: "",
                    city: "",
                    colony: "",
                  }))
                }
                placeholder="Seleccionar país..."
                searchPlaceholder="Buscar país..."
              />
              {stateOptions.length > 0 ? (
                <ComboboxField
                  label="Estado / Provincia"
                  options={stateOptions}
                  value={effective.state}
                  disabled={!canManageUsers}
                  onChange={(val) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      state: val,
                      city: "",
                      colony: "",
                    }))
                  }
                  placeholder="Seleccionar estado..."
                  searchPlaceholder="Buscar estado..."
                />
              ) : (
                <TextField
                  label="Estado / Provincia"
                  icon={MapPin}
                  value={effective.state}
                  disabled={!canManageUsers}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      state: e.target.value,
                    }))
                  }
                />
              )}
              {effective.country && cityOptions.length > 0 ? (
                <ComboboxField
                  label="Ciudad / Municipio"
                  options={cityOptions}
                  value={effective.city}
                  disabled={!canManageUsers}
                  onChange={(val) =>
                    setDraft((prev) => ({ ...(prev ?? {}), city: val }))
                  }
                  placeholder="Seleccionar ciudad..."
                  searchPlaceholder="Buscar ciudad..."
                  minSearchLength={2}
                />
              ) : (
                <TextField
                  label="Ciudad / Municipio"
                  icon={MapPin}
                  value={effective.city}
                  disabled={!canManageUsers}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      city: e.target.value,
                    }))
                  }
                />
              )}
              <TextField
                label="Colonia / Fraccionamiento"
                icon={MapPin}
                value={effective.colony}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    colony: e.target.value,
                  }))
                }
              />
              <TextField
                label="Calle"
                icon={MapPin}
                value={effective.street}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    street: e.target.value,
                  }))
                }
              />
              <TextField
                label="Número exterior"
                value={effective.extNumber}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    extNumber: e.target.value,
                  }))
                }
              />
              <TextField
                label="Número interior"
                value={effective.intNumber}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    intNumber: e.target.value,
                  }))
                }
              />
              <TextField
                label="Código postal"
                value={effective.postalCode}
                disabled={!canManageUsers}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    postalCode: e.target.value,
                  }))
                }
              />
            </div>

            {!canManageUsers && (
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
