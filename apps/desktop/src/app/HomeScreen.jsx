import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Layers,
  ContactRound,
  Landmark,
  LayoutDashboard,
  Puzzle,
  Settings,
  Contact,
  Wallet,
  Users,
  Shield,
  Palette,
  FolderOpen,
  Building2,
  CreditCard,
  BarChart3,
  FileText,
  Home,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Skeleton, StatCard, Separator } from "@atlas/ui";
import { useAuth } from "../auth/AuthProvider";
import { atlas } from "../lib/atlas";
import {
  CATEGORY_LABELS,
  getModuleLaunchPath,
  groupModulesByCategory,
} from "../lib/runtimeModules";
import { useRuntimeModules } from "./useRuntimeModules";

const ICON_MAP = {
  LayoutDashboard, Puzzle, Settings, Contact, Wallet, Users, Shield,
  Palette, FolderOpen, Building2, Layers, ContactRound, Landmark,
  CreditCard, BarChart3, FileText, Home, Box,
};

function ModIcon({ name, size = 24, color }) {
  const Icon = ICON_MAP[name] ?? Box;
  return <Icon size={size} style={{ color }} />;
}

function trackModuleVisit(moduleKey) {
  try {
    const visits = JSON.parse(localStorage.getItem("atlas-module-visits") || "{}");
    visits[moduleKey] = Date.now();
    localStorage.setItem("atlas-module-visits", JSON.stringify(visits));
  } catch {}
}

function getSpanishDate() {
  try {
    const str = new Date().toLocaleDateString("es-MX", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return new Date().toLocaleDateString();
  }
}

export function HomeScreen() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { runtimeModules, availableModules, isLoading: modulesLoading, isError: modulesError } =
    useRuntimeModules();

  const blueprintsQuery = useQuery({
    queryKey: ["blueprints"],
    queryFn: atlas.blueprints.list,
    staleTime: 60000,
  });

  const recentModules = useMemo(() => {
    try {
      const visits = JSON.parse(localStorage.getItem("atlas-module-visits") || "{}");
      return availableModules
        .filter((m) => visits[m.key])
        .sort((a, b) => visits[b.key] - visits[a.key])
        .slice(0, 4);
    } catch {
      return [];
    }
  }, [availableModules]);

  const grouped = useMemo(
    () => groupModulesByCategory(availableModules),
    [availableModules],
  );

  function handleModuleClick(module) {
    trackModuleVisit(module.key);
    navigate(getModuleLaunchPath(module));
  }

  const firstName = userProfile?.firstName ?? userProfile?.displayName ?? "Usuario";
  const installedCount = runtimeModules.filter(
    (m) => m.status === "INSTALLED" && m.enabled,
  ).length;
  const blueprintCount =
    blueprintsQuery.data?.data?.length ?? blueprintsQuery.data?.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10 md:px-6">
      {/* Welcome header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            Bienvenido, {firstName}.
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {getSpanishDate()}
          </p>
        </div>

        {recentModules.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Recientes:
            </span>
            {recentModules.map((m) => (
              <button
                key={m.key}
                onClick={() => handleModuleClick(m)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-(--brand-soft) hover:border-(--brand-primary) text-xs font-medium text-[hsl(var(--foreground))] transition-all duration-150 cursor-pointer"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Modulos instalados"
          value={installedCount}
          icon={Puzzle}
          loading={modulesLoading}
        />
        <StatCard
          label="Blueprints activos"
          value={blueprintCount ?? "—"}
          icon={Layers}
          loading={blueprintsQuery.isLoading}
        />
        <StatCard
          label="Estado API"
          value={modulesError ? "Sin conexion" : "Conectada"}
          icon={modulesError ? WifiOff : Wifi}
          loading={modulesLoading}
        />
      </div>

      {/* Module grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] shrink-0">
            Aplicaciones
          </h2>
          <Separator className="flex-1" />
        </div>

        <div className="space-y-8">
          {modulesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            Object.entries(grouped).map(([category, modules]) => (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {modules.map((module) => (
                    <button
                      key={module.key}
                      onClick={() => handleModuleClick(module)}
                      className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:shadow-md hover:border-[hsl(var(--muted-foreground))]/30 transition-all duration-200 cursor-pointer p-5 text-left active:scale-[0.98]"
                    >
                      <div
                        className="rounded-xl flex items-center justify-center"
                        style={{ height: 48, width: 48, backgroundColor: `${module.color}22` }}
                      >
                        <ModIcon name={module.icon} size={22} color={module.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight">
                          {module.name}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2 leading-snug">
                          {module.summary}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          {!modulesLoading && availableModules.length === 0 && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No hay modulos habilitados para mostrar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
