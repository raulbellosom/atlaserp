import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  ComboboxField,
  SelectField,
  EmptyState,
  ErrorState,
  LoadingState,
  ConfirmDialog,
} from "@atlas/ui";
import { Users, UserPlus, Link2 } from "lucide-react";
import { atlas } from "../../../lib/atlas";
import { filesError } from "../lib/files-error";

const ROLES = [
  { value: "VIEWER", label: "Puede ver" },
  { value: "EDITOR", label: "Puede editar" },
];
const SCOPES = [
  { value: "RESTRICTED", label: "Personas seleccionadas" },
  { value: "COMPANY", label: "Personas de la empresa con permiso" },
];
export function FileSharingDialog({
  file,
  token,
  userId,
  onClose,
  onCopyLink,
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [revoke, setRevoke] = useState(null);
  const access = useQuery({
    queryKey: ["file-access", file.id, userId],
    queryFn: () => atlas.files.getAccess(file.id, token),
    staleTime: 0,
    gcTime: 0,
  });
  const data = access.data?.data;
  const members = useQuery({
    queryKey: ["file-members", file.id, userId, search],
    queryFn: () => atlas.files.accessMembers(file.id, search, token),
    enabled: Boolean(data?.canManage),
    staleTime: 0,
    gcTime: 0,
  });
  const update = useMutation({
    mutationFn: (body) => atlas.files.updateAccess(file.id, body, token),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["file-access", file.id, userId],
      });
      queryClient.invalidateQueries({ queryKey: ["files-list"] });
      queryClient.invalidateQueries({ queryKey: ["file-invitations"] });
      setPerson("");
      setRevoke(null);
    },
  });
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !update.isPending) onClose();
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Compartir documento
            </DialogTitle>
            <DialogDescription className="truncate">
              {file.originalName}
            </DialogDescription>
          </DialogHeader>
          {access.isLoading ? (
            <LoadingState message="Cargando acceso…" />
          ) : access.isError ? (
            <ErrorState
              title="No se pudo consultar el acceso"
              description={filesError(access.error)}
              onRetry={() => access.refetch()}
            />
          ) : (
            <div className="space-y-5">
              {data.canManage ? (
                <>
                  <SelectField
                    id="file-scope"
                    label="Acceso general"
                    options={SCOPES}
                    value={data.scope}
                    onChange={(scope) => update.mutate({ scope })}
                    disabled={update.isPending}
                  />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Los permisos del módulo y la pertenencia a la empresa siguen
                    siendo necesarios. Los administradores conservan acceso.
                  </p>
                  <div className="space-y-3 rounded-xl border p-4">
                    <ComboboxField
                      id="file-recipient"
                      label="Invitar a una persona de la empresa"
                      placeholder="Buscar nombre o correo…"
                      options={(members.data?.data ?? [])
                        .filter((u) => u.id !== data.owner?.id)
                        .map((u) => ({
                          value: u.id,
                          label: `${u.displayName} · ${u.email}`,
                        }))}
                      onSearchChange={setSearch}
                      value={person}
                      onChange={setPerson}
                      emptyText={
                        members.isFetching
                          ? "Buscando…"
                          : "Sin personas disponibles"
                      }
                    />
                    {members.isError && (
                      <p role="alert" className="text-sm text-destructive">
                        No se pudieron cargar las personas. Vuelve a buscar.
                      </p>
                    )}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <SelectField
                          id="invite-role"
                          label="Permiso"
                          value={role}
                          onChange={setRole}
                          options={ROLES}
                          disabled={update.isPending}
                        />
                      </div>
                      <Button
                        onClick={() => update.mutate({ userId: person, role })}
                        disabled={!person || update.isPending}
                      >
                        <UserPlus className="h-4 w-4" />
                        Invitar
                      </Button>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      La invitación aparecerá en Archivos → Invitaciones.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {file.entityType === "AtlasFile"
                    ? "El propietario o un administrador gestiona el acceso a este documento."
                    : "Este adjunto conserva el acceso de su módulo de origen."}
                </p>
              )}
              {data.owner && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{data.owner.displayName}</span>
                  <Badge variant="secondary">Propietario</Badge>
                </div>
              )}
              {data.canManage &&
                (data.shares.length ? (
                  <ul className="space-y-3">
                    {data.shares.map((share) => (
                      <li
                        key={share.id}
                        className="flex flex-wrap items-center gap-2 border-t pt-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {share.user?.displayName ?? "Usuario"}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {share.status === "ACCEPTED"
                              ? "Aceptada"
                              : share.status === "DECLINED"
                                ? "Rechazada"
                                : "Pendiente de aceptar"}
                          </p>
                        </div>
                        <SelectField
                          id={`share-${share.id}`}
                          label={`Permiso de ${share.user?.displayName ?? "usuario"}`}
                          value={share.role}
                          options={ROLES}
                          onChange={(next) =>
                            update.mutate({ userId: share.userId, role: next })
                          }
                          disabled={update.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevoke(share)}
                          disabled={update.isPending}
                        >
                          Retirar
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    variant="compact"
                    title="Todavía no hay invitaciones a este documento."
                  />
                ))}
              {update.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {filesError(update.error)}
                </p>
              )}
              <Button variant="outline" onClick={() => onCopyLink(file)}>
                <Link2 className="h-4 w-4" />
                Copiar enlace de Atlas
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(revoke)}
        onOpenChange={(open) => {
          if (!open) setRevoke(null);
        }}
        title="Retirar acceso"
        description="Se eliminará la invitación y el acceso concedido. Si el acceso general permite a la empresa entrar, esa persona conservará ese acceso general."
        confirmLabel="Retirar"
        onConfirm={() =>
          update.mutateAsync({
            userId: revoke.userId,
            role: revoke.role,
            revoke: true,
          })
        }
      />
    </>
  );
}
