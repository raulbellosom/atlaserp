// "Permisos adicionales" — additive per-user permission grants (ALLOW-only).
// Effective permissions for a user are (role) ∪ (these grants); this card never
// removes what the role provides — those rows show locked with a "Del rol" badge.
// Spec: docs/superpowers/specs/2026-09-08-per-user-permission-grants.md
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
  UnsavedChangesBar,
} from "@atlas/ui";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import PermissionFeatureTree from "./PermissionFeatureTree";

export default function UserPermissionGrantsCard({ userId, token, canManage }) {
  const queryClient = useQueryClient();
  const [pendingKeys, setPendingKeys] = useState(null);

  const permissionsQuery = useQuery({
    queryKey: ["identity-permissions"],
    queryFn: () => atlas.identity.listPermissions(token),
    enabled: Boolean(token),
  });

  const grantsQuery = useQuery({
    queryKey: ["identity-user-grants", userId],
    queryFn: () => atlas.identity.getUserPermissionGrants(userId, token),
    enabled: Boolean(token && userId),
  });

  const allPermissions = permissionsQuery.data?.data?.permissions ?? [];
  const grantedKeys = useMemo(
    () => grantsQuery.data?.data?.grantedKeys ?? [],
    [grantsQuery.data],
  );
  const roleKeys = useMemo(
    () => new Set(grantsQuery.data?.data?.roleKeys ?? []),
    [grantsQuery.data],
  );
  const savedKeys = useMemo(() => new Set(grantedKeys), [grantedKeys]);

  useEffect(() => {
    setPendingKeys(new Set(grantedKeys));
  }, [grantedKeys]);

  const isDirty = useMemo(() => {
    if (!pendingKeys) return false;
    if (pendingKeys.size !== savedKeys.size) return true;
    for (const k of pendingKeys) if (!savedKeys.has(k)) return true;
    return false;
  }, [pendingKeys, savedKeys]);

  const saveMutation = useMutation({
    mutationFn: (keys) =>
      atlas.identity.setUserPermissionGrants(userId, { permissionKeys: keys }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-user-grants", userId] });
      queryClient.invalidateQueries({ queryKey: ["identity-users"] });
      toast.success("Permisos actualizados");
    },
    onError: (err) => toast.error(err?.message ?? "No se pudieron guardar los permisos"),
  });

  function togglePermission(key) {
    if (!canManage || roleKeys.has(key)) return;
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function bulkToggle(keys, checked) {
    if (!canManage) return;
    setPendingKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (roleKeys.has(key)) continue;
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  const isLoading = permissionsQuery.isLoading || grantsQuery.isLoading;
  const isError = permissionsQuery.isError || grantsQuery.isError;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[hsl(var(--primary))]" />
          Permisos adicionales
        </CardTitle>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Permisos extra para esta persona, ademas de los que ya da su rol. Aqui
          no se pueden quitar los permisos del rol.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Error al cargar permisos"
            onRetry={() => {
              permissionsQuery.refetch();
              grantsQuery.refetch();
            }}
          />
        ) : allPermissions.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Sin permisos disponibles"
            description="No hay permisos definidos en el sistema."
          />
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <Badge variant="secondary" className="tabular-nums">
                {pendingKeys?.size ?? savedKeys.size} concedidos
              </Badge>
              {!canManage && (
                <Badge variant="secondary" className="text-[10px]">
                  Solo lectura
                </Badge>
              )}
            </div>
            <PermissionFeatureTree
              allPermissions={allPermissions}
              pendingKeys={pendingKeys ?? savedKeys}
              baselineKeys={savedKeys}
              lockedKeys={roleKeys}
              onTogglePermission={togglePermission}
              onBulkToggle={bulkToggle}
              disabled={!canManage || saveMutation.isPending}
            />
          </>
        )}
      </CardContent>

      {isDirty && canManage && (
        <UnsavedChangesBar
          className="px-6"
          message="Cambios sin guardar en permisos"
          saving={saveMutation.isPending}
          saveLabel="Guardar permisos"
          onDiscard={() => setPendingKeys(new Set(savedKeys))}
          onSave={() => saveMutation.mutate([...(pendingKeys ?? [])])}
        />
      )}
    </Card>
  );
}
