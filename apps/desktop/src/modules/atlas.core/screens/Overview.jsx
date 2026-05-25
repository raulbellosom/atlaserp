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
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { useRuntimeModules } from "../../../app/useRuntimeModules";
import { ModuleIcon } from "../../../components/ModuleCard";
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

const ERROR_STAGE_LABEL = {
  validation: "Validación",
  dependency_sync: "Dependencias",
  orm_migration: "Migración ORM",
  manifest_migration: "Migración manifiesto",
  install: "Instalación",
  route_loader: "Carga de rutas",
  unknown: "Desconocido",
};

function summarizeModuleIssue(mod) {
  if (mod.compatibilityStatus === "BLOCKED") {
    const missing = (mod.compatibilityBlocking ?? [])
      .map((dep) => dep.name || dep.key)
      .filter(Boolean);
    if (missing.length > 0) {
      return `Dependencias pendientes: ${missing.join(", ")}.`;
    }
    return "Dependencias requeridas no disponibles.";
  }

  if (mod.status === "DISABLED") {
    return "El módulo está deshabilitado.";
  }

  if (mod.status !== "ERROR") {
    return null;
  }

  const lastError = mod.lastError ?? mod.lifecycleConfig?.lastError ?? null;
  if (!lastError) {
    return "Se detectó un error de instalación o carga.";
  }

  const message = String(lastError.message ?? "").trim();
  if (!message) {
    return "Se detectó un error de instalación o carga.";
  }

  const checksumMatch = message.match(/Checksum mismatch for\s+([^:]+):/i);
  if (checksumMatch?.[1]) {
    return `Checksum de migración inválido en ${checksumMatch[1]}.`;
  }

  const migrationFileMatch = message.match(/SQL execution failed for '([^']+)'/i);
  if (migrationFileMatch?.[1]) {
    return `Falló la ejecución de la migración ${migrationFileMatch[1]}.`;
  }

  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

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

  const dashboardModules = useMemo(
    () => runtimeModules.filter((m) => isModuleAvailable(m)),
    [runtimeModules],
  );

  const enableMod = useMutation({
    mutationFn: (key) => atlas.modules.enable(key, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["modules"] });
      await queryClient.invalidateQueries({ queryKey: ["runtime-modules"] });
      toast.success("Módulo habilitado");
    },
    onError: () => toast.error("No se pudo habilitar el módulo"),
  });

  const disableMod = useMutation({
    mutationFn: (key) => atlas.modules.disable(key, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["modules"] });
      await queryClient.invalidateQueries({ queryKey: ["runtime-modules"] });
      toast.success("Módulo deshabilitado");
    },
    onError: () => toast.error("No se pudo deshabilitar el módulo"),
  });

  const uninstallMod = useMutation({
    mutationFn: (key) => atlas.modules.uninstall(key, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["modules"] });
      await queryClient.invalidateQueries({ queryKey: ["runtime-modules"] });
      setConfirm(null);
      toast.success("Módulo desinstalado");
    },
    onError: () => toast.error("No se pudo desinstalar el módulo"),
  });

  // Stats
  const installedCount = dashboardModules.length;
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
      dashboardModules.filter((m) => m.compatibilityStatus === "BLOCKED"),
    [dashboardModules],
  );

  const problemModulesDetailed = useMemo(
    () =>
      problemModules.map((mod) => {
        const stage =
          mod.lastError?.stage ??
          mod.lifecycleConfig?.lastError?.stage ??
          null;
        return {
          ...mod,
          issueSummary: summarizeModuleIssue(mod),
          stageLabel: stage ? ERROR_STAGE_LABEL[stage] ?? stage : null,
        };
      }),
    [problemModules],
  );

  // Quick launch: installed non-core modules with navigation
  const quickLaunch = useMemo(
    () =>
      dashboardModules
        .filter((m) => !m.core && (m.navigation?.length ?? 0) > 0)
        .slice(0, 6),
    [dashboardModules],
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Módulo",
        cell: ({ row }) => {
          const mod = row.original;
          const hasIssue =
            mod.status === "DISABLED" ||
            mod.status === "ERROR" ||
            mod.compatibilityStatus === "BLOCKED";
          return (
            <div className="flex items-center gap-2.5">
              <ModuleIcon module={mod} size="sm" />
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
          <div className="rounded-2xl border border-white/45 bg-white/55 p-4 space-y-2 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">
                {problemModules.length} módulo
                {problemModules.length > 1 ? "s" : ""} requiere
                {problemModules.length === 1 ? "" : "n"} atención
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {problemModulesDetailed.map((m) => (
                <div
                  key={m.key}
                  className="rounded-xl border border-white/55 bg-white/65 px-2.5 py-2 backdrop-blur-md"
                >
                  <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--foreground))] font-semibold">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: STATUS_DOT[m.status] ?? "#94a3b8",
                      }}
                    />
                    <span>{m.name}</span>
                    <span className="text-[hsl(var(--muted-foreground))] font-medium">
                      {" - "}
                      {m.status === "DISABLED"
                        ? "Deshabilitado"
                        : m.compatibilityStatus === "BLOCKED"
                          ? "Bloqueado"
                          : "Error"}
                    </span>
                    {m.stageLabel && (
                      <span className="rounded-md border border-white/60 bg-white/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        {m.stageLabel}
                      </span>
                    )}
                  </div>
                  {m.issueSummary && (
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] break-words">
                      {m.issueSummary}
                    </p>
                  )}
                </div>
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
                  <ModuleIcon module={mod} size="sm" />
                  <span className="font-medium">{mod.name}</span>
                  <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={dashboardModules}
          isLoading={modulesLoading}
          isError={modulesError}
          onRetry={async () => {
            await queryClient.invalidateQueries({ queryKey: ["modules"] });
            await queryClient.invalidateQueries({
              queryKey: ["runtime-modules"],
            });
          }}
          searchPlaceholder="Buscar módulo..."
          emptyTitle="Sin modulos instalados"
          emptyDescription="No hay modulos instalados y activos en el sistema."
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


