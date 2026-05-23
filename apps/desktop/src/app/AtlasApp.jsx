import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { ModuleSidebar, BrandFooter } from "@atlas/ui";
import { useThemeStore } from "../stores/theme";
import { useLauncherStore } from "../stores/launcher";
import { Topbar } from "../components/Topbar";
import { AppLauncher } from "../components/AppLauncher";
import { CommandPalette } from "../components/CommandPalette";
import { useRuntimeModules } from "./useRuntimeModules";
import { getLayoutMode } from "../lib/runtimeModules";

function getSidebarCollapsed() {
  try {
    return JSON.parse(localStorage.getItem("atlas-sidebar-collapsed")) ?? false;
  } catch {
    return false;
  }
}

function persistSidebarCollapsed(val) {
  try {
    localStorage.setItem("atlas-sidebar-collapsed", JSON.stringify(val));
  } catch {}
}

// Skeleton shown while moduleMap is still loading on a module route
function SidebarSkeleton({ collapsed }) {
  return (
    <aside
      className={[
        "hidden lg:flex flex-col shrink-0 bg-[hsl(var(--surface-2))] border-r border-[hsl(var(--border))]",
        "h-[calc(100dvh-3.5rem)]",
        collapsed ? "w-14" : "w-60",
        "transition-[width] duration-300",
      ].join(" ")}
    >
      {/* Module header skeleton */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] h-14 px-3 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] animate-pulse shrink-0" />
        {!collapsed && (
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded bg-[hsl(var(--muted))] animate-pulse" />
            <div className="h-2.5 w-12 rounded bg-[hsl(var(--muted))] animate-pulse opacity-60" />
          </div>
        )}
      </div>
      {/* Nav item skeletons */}
      <nav className="flex-1 overflow-hidden p-2 space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={[
              "flex items-center gap-3 rounded-xl px-3 h-9",
              collapsed ? "justify-center px-0" : "",
            ].join(" ")}
          >
            <div className="h-4 w-4 rounded bg-[hsl(var(--muted))] animate-pulse shrink-0" />
            {!collapsed && (
              <div
                className="h-3 rounded bg-[hsl(var(--muted))] animate-pulse"
                style={{ width: `${[60, 80, 50, 70, 55][i]}%` }}
              />
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function AtlasApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openLauncher } = useLauncherStore();
  const { moduleMap, isPending: modulesLoading } = useRuntimeModules();

  // Module key derived directly from URL — available even before moduleMap loads
  const moduleKeyFromPath = useMemo(() => {
    const match = location.pathname.match(/^\/app\/m\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  // Resolved module — null while moduleMap is still loading
  const activeModule = useMemo(
    () =>
      moduleKeyFromPath ? (moduleMap.get(moduleKeyFromPath) ?? null) : null,
    [moduleKeyFromPath, moduleMap],
  );

  const isHome =
    location.pathname === "/app/home" ||
    location.pathname === "/app" ||
    location.pathname === "/app/";

  const [collapsed, setCollapsed] = useState(getSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    persistSidebarCollapsed(next);
  }

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Restore dark mode preference on mount
  useEffect(() => {
    useThemeStore.getState().init();
  }, []);

  const layoutMode = getLayoutMode(activeModule);
  const showSidebar =
    Boolean(moduleKeyFromPath) &&
    !isHome &&
    (activeModule
      ? layoutMode === "default" && (activeModule?.navigation?.length ?? 0) > 0
      : true);
  const sidebarLoading = showSidebar && modulesLoading && !activeModule;
  const networkBusy = isFetching > 0 || isMutating > 0;

  return (
    <div className="h-dvh overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Topbar
        onLauncherOpen={openLauncher}
        onMobileMenuToggle={
          showSidebar ? () => setMobileOpen((o) => !o) : undefined
        }
        networkBusy={networkBusy}
      />

      {/* Mobile backdrop */}
      {showSidebar && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Body: sidebar + scrollable main, fills viewport below the topbar */}
      <div className="flex flex-col h-full pt-topbar">
        <div className="flex flex-1 min-h-0">
          {showSidebar &&
            (sidebarLoading ? (
              <SidebarSkeleton collapsed={collapsed} />
            ) : (
              <ModuleSidebar
                module={activeModule}
                currentPath={location.pathname}
                onNavigate={(path) => navigate(path)}
                collapsed={collapsed}
                onCollapse={toggleCollapsed}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
              />
            ))}

          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-clip scrollbar-gutter-stable">
            <Outlet />
          </main>
        </div>
        <BrandFooter />
      </div>

      <AppLauncher />
      <CommandPalette activeModule={activeModule} />
    </div>
  );
}
