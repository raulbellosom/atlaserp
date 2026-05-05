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

export function AtlasApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openLauncher } = useLauncherStore();
  const { moduleMap } = useRuntimeModules();

  // Determine active module from /app/m/:moduleKey/...
  const activeModule = useMemo(() => {
    const match = location.pathname.match(/^\/app\/m\/([^/]+)/);
    if (!match) return null;
    return moduleMap.get(match[1]) ?? null;
  }, [location.pathname, moduleMap]);

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
    Boolean(activeModule) &&
    !isHome &&
    layoutMode === "default" &&
    (activeModule?.navigation?.length ?? 0) > 0;
  const networkBusy = isFetching > 0 || isMutating > 0;

  return (
    <div className="h-dvh overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Topbar
        onLauncherOpen={openLauncher}
        onMobileMenuToggle={showSidebar ? () => setMobileOpen((o) => !o) : undefined}
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
      <div className="flex h-full pt-14">
        {showSidebar && (
          <ModuleSidebar
            module={activeModule}
            currentPath={location.pathname}
            onNavigate={(path) => navigate(path)}
            collapsed={collapsed}
            onCollapse={toggleCollapsed}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />
        )}

        <main className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="flex-1">
            <Outlet />
          </div>
          <BrandFooter />
        </main>
      </div>

      <AppLauncher />
      <CommandPalette activeModule={activeModule} />
    </div>
  );
}
