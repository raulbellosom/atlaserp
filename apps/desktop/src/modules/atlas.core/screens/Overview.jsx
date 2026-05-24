import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  DataTable,
  Badge,
  ActionMenu,
  ConfirmDialog,
  Button,
  cn,
} from "@atlas/ui";
import {
  Power,
  PowerOff,
  Trash2,
  ChevronRight,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { useRuntimeModules } from "../../../app/useRuntimeModules";
import { atlas } from "../../../lib/atlas";
import {
  getModuleLaunchPath,
  isModuleAvailable,
} from "../../../lib/runtimeModules";

const KIND_LABEL = {
  CORE: "Core",
  FEATURE: "Módulo",
  INTEGRATION: "Integración",
  WEBSITE: "Sitio",
};

const STATUS_DOT = {
  INSTALLED: "#22c55e",
  DISABLED: "#f59e0b",
  UNINSTALLED: "#94a3b8",
  ERROR: "#ef4444",
};

const STATUS_LABEL = {
  INSTALLED: "Instalado",
  DISABLED: "Deshabilitado",
  UNINSTALLED: "Sin instalar",
  ERROR: "Error",
};

export default function Overview() {
  const { userProfile, session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // runtimeModules = manifest + API merged, with color, status, compatibilityStatus, etc.
  const {
    runtimeModules,
    isLoading: modulesLoading,
    isError: modulesError,
  } = useRuntimeModules();

  const blueprints = useQuery({
    queryKey: ["blueprints", token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
  });

  const [confirm, setConfirm] = useState(null);

  const enableMod = useMutation({
    mutationFn: (key) => atlas.modules.enable(key, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      toast.success("Módulo habilitado");
    },
    onError: () => toast.error("No se pudo habilitar el módulo"),
  });

  const disableMod = useMutation({
    mutationFn: (key) => atlas.modules.disable(key, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      toast.success("Módulo deshabilitado");
    },
    onError: () => toast.error("No se pudo deshabilitar el módulo"),
  });

  const uninstallMod = useMutation({
    mutationFn: (key) => atlas.modules.uninstall(key, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      setConfirm(null);
      toast.success("Módulo desinstalado");
    },
    onError: () => toast.error("No se pudo desinstalar el módulo"),
  });

  // Stats
  const installedCount = useMemo(
    () =>
      runtimeModules.filter((m) => m.status === "INSTALLED" && m.enabled)
        .length,
    [runtimeModules],
  );
  const disabledCount = useMemo(
    () => runtimeModules.filter((m) => m.status === "DISABLED").length,
    [runtimeModules],
  );
  const blueprintCount =
    blueprints.data?.data?.length ?? blueprints.data?.length ?? 0;
  const apiOk = !modulesError;

  // Modules that need attention
  const problemModules = useMemo(
    () =>
      runtimeModules.filter(
        (m) =>
          m.status === "DISABLED" ||
          m.status === "ERROR" ||
          m.compatibilityStatus === "BLOCKED",
      ),
    [runtimeModules],
  );

  // Quick launch: installed non-core modules with navigation
  const quickLaunch = useMemo(
    () =>
      runtimeModules
        .filter(
          (m) =>
            isModuleAvailable(m) && !m.core && (m.navigation?.length ?? 0) > 0,
        )
        .slice(0, 6),
    [runtimeModules],
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Módulo",
        cell: ({ row }) => {
          const mod = row.original;
          const color = mod.color ?? "#6366f1";
          const hasIssue =
            mod.status === "DISABLED" ||
            mod.status === "ERROR" ||
            mod.compatibilityStatus === "BLOCKED";
          return (
            <div className="flex items-center gap-2.5">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {mod.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{mod.name}</p>
                  {hasIssue && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {mod.key} · v{mod.version}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "kind",
        header: "Tipo",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {KIND_LABEL[row.original.kind] ?? row.original.kind}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
          const mod = row.original;
          const isInstalled = mod.status === "INSTALLED" && mod.enabled;
          return (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  isInstalled && "shadow-[0_0_5px_rgba(34,197,94,0.65)]",
                )}
                style={{ backgroundColor: STATUS_DOT[mod.status] ?? "#94a3b8" }}
              />
              <span className="text-xs font-medium">
                {STATUS_LABEL[mod.status] ?? mod.status}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 120,
        cell: ({ row }) => {
          const mod = row.original;
          const canOpen = isModuleAvailable(mod);
          const isEnabled = mod.enabled && mod.status === "INSTALLED";

          const menuItems = [];
          if (!mod.core) {
            if (isEnabled) {
              menuItems.push({
                label: "Deshabilitar",
                icon: PowerOff,
                onClick: () => disableMod.mutate(mod.key),
              });
            } else if (mod.status === "DISABLED") {
              menuItems.push({
                label: "Habilitar",
                icon: Power,
                onClick: () => enableMod.mutate(mod.key),
              });
            }
            if (mod.status !== "UNINSTALLED") {
              menuItems.push({
                label: "Desinstalar",
                icon: Trash2,
                variant: "destructive",
                onClick: () => setConfirm(mod.key),
              });
            }
          }

          return (
            <div className="flex items-center justify-end gap-1">
              {canOpen && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => navigate(getModuleLaunchPath(mod))}
                >
                  Abrir
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              )}
              {menuItems.length > 0 && <ActionMenu items={menuItems} />}
            </div>
          );
        },
      },
    ],
    [disableMod, enableMod, navigate],
  );

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Core"
          title="Centro de mando"
          description={
            userProfile
              ? `Bienvenido, ${userProfile.firstName ?? userProfile.displayName}.`
              : undefined
          }
        />

        {/* Problems alert */}
        {problemModules.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">
                {problemModules.length} módulo
                {problemModules.length > 1 ? "s" : ""} requiere
                {problemModules.length === 1 ? "" : "n"} atención
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {problemModules.map((m) => (
                <span
                  key={m.key}
                  className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-lg px-2 py-1 font-medium"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: STATUS_DOT[m.status] ?? "#94a3b8",
                    }}
                  />
                  {m.name}
                  {" — "}
                  {m.status === "DISABLED"
                    ? "Deshabilitado"
                    : m.compatibilityStatus === "BLOCKED"
                      ? "Bloqueado"
                      : "Error"}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Instalados
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {modulesLoading ? "—" : installedCount}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                módulos
              </span>
            </div>
            <div className="h-1 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width:
                    runtimeModules.length > 0
                      ? `${(installedCount / runtimeModules.length) * 100}%`
                      : "0%",
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Deshabilitados
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {modulesLoading ? "—" : disabledCount}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                módulos
              </span>
            </div>
            <div className="h-1 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{
                  width:
                    runtimeModules.length > 0
                      ? `${(disabledCount / runtimeModules.length) * 100}%`
                      : "0%",
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Blueprints
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {blueprints.isLoading ? "—" : blueprintCount}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                activos
              </span>
            </div>
            <div className="h-1 rounded-full bg-[hsl(var(--muted))]" />
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4 space-y-2 transition-colors",
              apiOk
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                : "border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Sistema
            </p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  apiOk
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                    : "bg-red-500",
                )}
              />
              <span className="text-sm font-semibold">
                {modulesLoading
                  ? "Verificando..."
                  : apiOk
                    ? "Operativo"
                    : "Sin conexión"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick launch */}
        {quickLaunch.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Acceso rápido
            </p>
            <div className="flex flex-wrap gap-2">
              {quickLaunch.map((mod) => (
                <button
                  key={mod.key}
                  onClick={() => navigate(getModuleLaunchPath(mod))}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] transition-colors text-sm cursor-pointer group"
                >
                  <span
                    className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      backgroundColor: `${mod.color}20`,
                      color: mod.color,
                    }}
                  >
                    {mod.name.charAt(0)}
                  </span>
                  <span className="font-medium">{mod.name}</span>
                  <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={runtimeModules}
          isLoading={modulesLoading}
          isError={modulesError}
          onRetry={() =>
            queryClient.invalidateQueries({ queryKey: ["modules"] })
          }
          searchPlaceholder="Buscar módulo..."
          emptyTitle="Sin módulos"
          emptyDescription="No hay módulos registrados en el sistema."
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="¿Desinstalar módulo?"
        description="El módulo será desinstalado. Esta acción no se puede deshacer."
        detail={confirm}
        confirmLabel="Desinstalar"
        onConfirm={() => uninstallMod.mutate(confirm)}
        loading={uninstallMod.isPending}
      />
    </div>
  );
}
