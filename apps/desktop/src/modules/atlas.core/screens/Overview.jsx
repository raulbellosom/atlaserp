import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  Button,
  cn,
} from "@atlas/ui";
import {
  ChevronRight,
  AlertTriangle,
  ArrowUpRight,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { useRuntimeModules } from "../../../app/useRuntimeModules";
import { ModuleIcon } from "../../../components/ModuleCard";
import {
  getModuleLaunchPath,
  isModuleAvailable,
} from "../../../lib/runtimeModules";

const STATUS_DOT = {
  INSTALLED: "#22c55e",
  DISABLED: "#f59e0b",
  UNINSTALLED: "#94a3b8",
  ERROR: "#ef4444",
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
  if (mod.status === "DISABLED") return "El módulo está deshabilitado.";
  if (mod.status !== "ERROR") return null;

  const lastError = mod.lastError ?? mod.lifecycleConfig?.lastError ?? null;
  if (!lastError) return "Se detectó un error de instalación o carga.";

  const message = String(lastError.message ?? "").trim();
  if (!message) return "Se detectó un error de instalación o carga.";

  const checksumMatch = message.match(/Checksum mismatch for\s+([^:]+):/i);
  if (checksumMatch?.[1]) return `Checksum de migración inválido en ${checksumMatch[1]}.`;

  const migrationFileMatch = message.match(/SQL execution failed for '([^']+)'/i);
  if (migrationFileMatch?.[1]) return `Falló la ejecución de la migración ${migrationFileMatch[1]}.`;

  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

export default function Overview() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    runtimeModules,
    isLoading: modulesLoading,
    isError: modulesError,
  } = useRuntimeModules();

  const dashboardModules = useMemo(
    () => runtimeModules.filter((m) => isModuleAvailable(m)),
    [runtimeModules],
  );

  const installedCount = dashboardModules.length;

  const disabledCount = useMemo(
    () => runtimeModules.filter((m) => m.status === "DISABLED").length,
    [runtimeModules],
  );

  const apiOk = !modulesError;

  const problemModulesDetailed = useMemo(
    () =>
      dashboardModules
        .filter((m) => m.compatibilityStatus === "BLOCKED")
        .map((mod) => {
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
    [dashboardModules],
  );

  const quickLaunch = useMemo(
    () =>
      dashboardModules
        .filter((m) => !m.core && (m.navigation?.length ?? 0) > 0)
        .slice(0, 8),
    [dashboardModules],
  );

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Core"
        title="Centro de mando"
        description={
          userProfile
            ? `Bienvenido, ${userProfile.firstName ?? userProfile.displayName}.`
            : undefined
        }
        actions={
          <Button
            variant="outline"
            onClick={() => navigate("/app/m/atlas.core/modules")}
          >
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            Catálogo de módulos
          </Button>
        }
      />

      {/* Problem alerts */}
      {problemModulesDetailed.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--border))] dark:border-white/45 bg-[hsl(var(--card))] dark:bg-white/55 p-4 space-y-2 shadow-[0_10px_35px_rgba(15,23,42,0.08)] dark:backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">
              {problemModulesDetailed.length} módulo
              {problemModulesDetailed.length > 1 ? "s" : ""} requiere
              {problemModulesDetailed.length === 1 ? "" : "n"} atención
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {problemModulesDetailed.map((m) => (
              <div
                key={m.key}
                className="rounded-xl border border-[hsl(var(--border))] dark:border-white/55 bg-[hsl(var(--muted))]/40 dark:bg-white/65 px-2.5 py-2 dark:backdrop-blur-md"
              >
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--foreground))] font-semibold">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_DOT[m.status] ?? "#94a3b8" }}
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
                    <span className="rounded-md border border-[hsl(var(--border))] dark:border-white/60 bg-[hsl(var(--background))] dark:bg-white/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      {m.stageLabel}
                    </span>
                  )}
                </div>
                {m.issueSummary && (
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] wrap-break-word">
                    {m.issueSummary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Instalados
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums leading-none">
              {modulesLoading ? "—" : installedCount}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">módulos</span>
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
            <span className="text-xs text-[hsl(var(--muted-foreground))]">módulos</span>
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

        <div
          className={cn(
            "rounded-2xl border p-4 space-y-2 transition-colors",
            apiOk
              ? "border-emerald-300 bg-emerald-100/80 dark:border-emerald-800/40 dark:bg-emerald-950/20"
              : "border-red-300 bg-red-100/80 dark:border-red-800/40 dark:bg-red-950/20",
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
              {modulesLoading ? "Verificando..." : apiOk ? "Operativo" : "Sin conexión"}
            </span>
          </div>
          {!apiOk && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-7 px-2 text-xs"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["modules"] });
                queryClient.invalidateQueries({ queryKey: ["runtime-modules"] });
              }}
            >
              Reintentar
            </Button>
          )}
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
                type="button"
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
    </div>
  );
}
