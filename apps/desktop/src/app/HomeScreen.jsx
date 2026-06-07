import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Star, WifiOff, Zap } from "lucide-react";
import { Skeleton, Separator, cn } from "@atlas/ui";
import { useOfflineStore, OFFLINE_MODULES } from "@atlas/offline";
import { useAuth } from "../auth/AuthProvider";
import { getModuleLaunchPath, getSortedDisplay } from "../lib/runtimeModules";
import { useRuntimeModules } from "./useRuntimeModules";
import { useAppViewPrefs } from "../hooks/useAppViewPrefs";
import { AppViewControls } from "../components/AppViewControls";
import { AppContextMenu } from "../components/AppContextMenu";
import {
  ModuleCardGrid,
  ModuleListRow,
  ModuleIcon,
} from "../components/ModuleCard";

function trackModuleVisit(moduleKey) {
  try {
    const visits = JSON.parse(
      localStorage.getItem("atlas-module-visits") || "{}",
    );
    visits[moduleKey] = Date.now();
    localStorage.setItem("atlas-module-visits", JSON.stringify(visits));
  } catch {}
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getSpanishDate() {
  try {
    const str = new Date().toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return new Date().toLocaleDateString();
  }
}

export function HomeScreen() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState(null);
  const {
    availableModules,
    isLoading: modulesLoading,
    isError: modulesError,
  } = useRuntimeModules();
  const { sortMode, viewMode, favorites, favoritesFirst, isFavorite } =
    useAppViewPrefs();

  const isOnline = useOfflineStore((s) => s.isOnline)
  const isOfflineBlocked = (module) => !isOnline && !OFFLINE_MODULES.includes(module.key)

  const favoriteModules = useMemo(
    () => availableModules.filter((m) => favorites.includes(m.key)),
    [availableModules, favorites],
  );

  const recentModules = useMemo(() => {
    try {
      const visits = JSON.parse(
        localStorage.getItem("atlas-module-visits") || "{}",
      );
      return availableModules
        .filter((m) => visits[m.key] && !favorites.includes(m.key))
        .sort((a, b) => visits[b.key] - visits[a.key])
        .slice(0, 5);
    } catch {
      return [];
    }
  }, [availableModules, favorites]);

  const sections = useMemo(
    () =>
      getSortedDisplay(availableModules, {
        sortMode,
        favorites,
        favoritesFirst,
      }),
    [availableModules, sortMode, favorites, favoritesFirst],
  );

  function handleModuleClick(module) {
    if (isOfflineBlocked(module)) return
    trackModuleVisit(module.key);
    navigate(getModuleLaunchPath(module));
  }

  function handleContextMenu(e, moduleKey) {
    const module = availableModules.find((m) => m.key === moduleKey);
    if (module && isOfflineBlocked(module)) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, moduleKey });
  }

  const firstName = userProfile?.firstName ?? userProfile?.displayName ?? "tú";
  const hasQuickAccess = favoriteModules.length > 0 || recentModules.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:px-6 space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">
            {getSpanishDate()}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            {getGreeting()}, {firstName}.
          </h1>
        </div>
        {modulesError && (
          <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1 shrink-0">
            <WifiOff size={11} />
            Sin conexión al servidor
          </div>
        )}
      </div>

      {/* Acceso rápido */}
      {hasQuickAccess && (
        <div className="space-y-4">
          {favoriteModules.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                  Favoritos
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {favoriteModules.map((module) => (
                  <button
                    key={module.key}
                    onClick={() => handleModuleClick(module)}
                    onContextMenu={(e) => handleContextMenu(e, module.key)}
                    disabled={isOfflineBlocked(module)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 transition-all duration-150 px-3 py-2.5 text-left",
                      isOfflineBlocked(module)
                        ? "opacity-40 cursor-not-allowed pointer-events-none"
                        : "hover:bg-amber-500/10 hover:border-amber-500/30 cursor-pointer active:scale-[0.98]",
                    )}
                  >
                    <div
                      className="rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        height: 32,
                        width: 32,
                      }}
                    >
                      <ModuleIcon module={module} size="sm" />
                    </div>
                    <p className="text-xs font-semibold text-[hsl(var(--foreground))] leading-tight truncate">
                      {module.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentModules.length > 0 && (
            <div className="space-y-2.5">
              {favoriteModules.length > 0 && (
                <div className="flex items-center gap-2">
                  <Zap
                    size={12}
                    className="text-[hsl(var(--muted-foreground))]"
                  />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                    Recientes
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {recentModules.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => handleModuleClick(m)}
                    onContextMenu={(e) => handleContextMenu(e, m.key)}
                    disabled={isOfflineBlocked(m)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs font-medium text-[hsl(var(--foreground))] transition-all duration-150",
                      isOfflineBlocked(m)
                        ? "opacity-40 cursor-not-allowed pointer-events-none"
                        : "hover:bg-[hsl(var(--muted))] cursor-pointer",
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: m.color }}
                    />
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aplicaciones */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))] shrink-0">
            Aplicaciones
          </h2>
          <Separator className="flex-1 min-w-8" />
          <AppViewControls />
        </div>

        <div className="space-y-8">
          {modulesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            sections.map((section, si) => (
              <div key={section.label ?? `section-${si}`}>
                {section.label && (
                  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
                    {section.label}
                  </p>
                )}
                {viewMode === "list" ? (
                  <div className="flex flex-col gap-1.5">
                    {section.modules.map((module) => (
                      <ModuleListRow
                        key={module.key}
                        module={module}
                        onClick={() => handleModuleClick(module)}
                        onContextMenu={(e) => handleContextMenu(e, module.key)}
                        isFavorite={isFavorite(module.key)}
                        isOfflineBlocked={isOfflineBlocked(module)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {section.modules.map((module) => (
                      <ModuleCardGrid
                        key={module.key}
                        module={module}
                        onClick={() => handleModuleClick(module)}
                        onContextMenu={(e) => handleContextMenu(e, module.key)}
                        isFavorite={isFavorite(module.key)}
                        isOfflineBlocked={isOfflineBlocked(module)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {!modulesLoading && availableModules.length === 0 && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No hay aplicaciones disponibles.
            </p>
          )}
        </div>
      </div>

      {contextMenu && (
        <AppContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          moduleKey={contextMenu.moduleKey}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
