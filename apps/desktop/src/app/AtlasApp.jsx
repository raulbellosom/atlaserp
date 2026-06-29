import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useIsFetching, useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModuleSidebar, BrandFooter } from "@atlas/ui";
import { OfflineProvider } from "@atlas/offline";
import { useThemeStore } from "../stores/theme";
import { useLauncherStore } from "../stores/launcher";
import { Topbar } from "../components/Topbar";
import { AppLauncher } from "../components/AppLauncher";
import { CommandPalette } from "../components/CommandPalette";
import { useRuntimeModules } from "./useRuntimeModules";
import { getLayoutMode, matchesFullscreenPath } from "../lib/runtimeModules";
import { ModuleBundleLoader } from '../shell/ModuleBundleLoader.jsx'
import { getApiUrl } from "../lib/runtimeConfig.js";
import { useAuth } from "../auth/AuthProvider";
import { usePwaManifest } from "../hooks/usePwaManifest.js";
import { usePwaInstall } from "../hooks/usePwaInstall.js";
import { usePushAutoSubscribe } from "../hooks/usePushAutoSubscribe.js";
import { toast } from "sonner";
import { atlas } from '../lib/atlas.js'
import { FloatingChatHub } from '../modules/atlas.chat/components/FloatingChatHub.jsx'
import { MODULE_SIDEBAR_SLOTS } from './sidebar-slots.js'

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
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { openLauncher } = useLauncherStore();

  const { data: instanceConfigData } = useQuery({
    queryKey: ['instance-config'],
    queryFn: () => atlas.instanceConfig.get(session?.access_token),
    enabled: Boolean(session?.access_token),
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    const name = instanceConfigData?.data?.instanceName
    document.title = name ? `${name} — Atlas ERP` : 'Atlas ERP'
  }, [instanceConfigData?.data?.instanceName])
  const { moduleMap, isPending: modulesLoading } = useRuntimeModules();
  const seenRealtimeNotificationIds = useRef(new Set());
  const apiBaseUrl = getApiUrl();
  const handleTransportReady = useCallback((t) => atlas.setOfflineTransport(t), [])

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
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState(false);
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    persistSidebarCollapsed(next);
  }

  // Auto-close mobile drawer and sidebar overlay on route change
  useEffect(() => {
    setMobileOpen(false);
    setSidebarOverlayOpen(false);
  }, [location.pathname]);

  // Restore dark mode preference on mount
  useEffect(() => {
    useThemeStore.getState().init();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    function resolveLink(href) {
      if (!href || typeof href !== "string") return null;
      if (/^https?:\/\//i.test(href)) return href;
      return href.startsWith("/m/") ? `/app${href}` : href;
    }

    function handleServiceWorkerMessage(event) {
      const message = event?.data;
      if (!message || typeof message !== "object") return;

      if (message.type === "atlas.notifications.push") {
        const notificationId = message.notificationId ?? null;
        if (
          notificationId &&
          seenRealtimeNotificationIds.current.has(notificationId)
        ) {
          return;
        }
        if (notificationId) {
          seenRealtimeNotificationIds.current.add(notificationId);
          if (seenRealtimeNotificationIds.current.size > 200) {
            seenRealtimeNotificationIds.current.clear();
          }
        }

        // Don't show an in-app toast for chat messages when the user is
        // already inside the chat module — they can see the message directly.
        if (
          message.eventType === "chat.message.new" &&
          window.location.pathname.includes("/m/atlas.chat")
        ) {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notifications-inbox"] });
          return;
        }

        const title =
          typeof message.title === "string" && message.title.trim()
            ? message.title
            : "Nueva notificacion";
        const body =
          typeof message.body === "string" && message.body.trim()
            ? message.body
            : "";
        const link = resolveLink(message.link);

        toast(title, {
          description: body || undefined,
          action: link
            ? {
                label: "Abrir",
                onClick: () => {
                  if (/^https?:\/\//i.test(link)) {
                    window.open(link, "_blank", "noopener,noreferrer");
                    return;
                  }
                  navigate(link);
                },
              }
            : undefined,
        });

        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["notifications-inbox"] });
        return;
      }

      if (message.type === "atlas.notifications.click") {
        const link = resolveLink(message.link);
        if (!link) return;
        if (/^https?:\/\//i.test(link)) {
          window.open(link, "_blank", "noopener,noreferrer");
          return;
        }
        navigate(link);
      }
    }

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener(
        "message",
        handleServiceWorkerMessage,
      );
    };
  }, [navigate, queryClient, session?.access_token]);

  const layoutMode = getLayoutMode(activeModule);

  // Normalize the current sub-path for fullscreen matching
  const normalizedSubPath = useMemo(() => {
    if (!moduleKeyFromPath) return null;
    const prefix = `/app/m/${moduleKeyFromPath}`;
    const full = location.pathname;
    if (full === prefix) return "/";
    if (full.startsWith(`${prefix}/`)) return full.slice(prefix.length);
    return null;
  }, [location.pathname, moduleKeyFromPath]);

  // True when the active route is declared fullscreen in the manifest
  const isFullscreen = useMemo(
    () => matchesFullscreenPath(activeModule, normalizedSubPath),
    [activeModule, normalizedSubPath],
  );

  usePwaManifest(moduleKeyFromPath, activeModule);
  const { canInstall, install, manualInstallReady } =
    usePwaInstall(moduleKeyFromPath);
  usePushAutoSubscribe();

  const showSidebar =
    !isFullscreen &&
    Boolean(moduleKeyFromPath) &&
    !isHome &&
    (activeModule
      ? layoutMode === "default" && (activeModule?.navigation?.length ?? 0) > 0
      : true);
  const sidebarLoading = showSidebar && modulesLoading && !activeModule;
  const networkBusy = isFetching > 0 || isMutating > 0;

  const sidebarSlot = useMemo(() => {
    if (!activeModule) return null
    const Slot = MODULE_SIDEBAR_SLOTS[activeModule.key]
    return Slot ? <Slot /> : null
  }, [activeModule?.key])

  return (
    <OfflineProvider apiBaseUrl={apiBaseUrl} onTransportReady={handleTransportReady}>
      <ModuleBundleLoader>
        <div className="h-dvh overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Topbar
        onLauncherOpen={openLauncher}
        onMobileMenuToggle={showSidebar ? () => setMobileOpen((o) => !o) : undefined}
        onModuleMenuToggle={
          isFullscreen && activeModule
            ? () => setSidebarOverlayOpen((o) => !o)
            : undefined
        }
        networkBusy={networkBusy}
        activeModuleKey={moduleKeyFromPath}
        canInstall={canInstall}
        manualInstallReady={manualInstallReady}
        onInstall={install}
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
                key={activeModule?.key}
                module={activeModule}
                currentPath={location.pathname}
                onNavigate={(path) => navigate(path)}
                collapsed={collapsed}
                onCollapse={toggleCollapsed}
                mobileOpen={mobileOpen}
                sidebarSlot={sidebarSlot}
                onMobileClose={() => setMobileOpen(false)}
                canInstall={canInstall}
                onInstall={install}
              />
            ))}

          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            <main className="flex-1 overflow-y-auto overflow-x-clip scrollbar-gutter-stable">
              <Outlet />
            </main>
            <BrandFooter className="hidden lg:flex" />
          </div>
        </div>
      </div>

      {/* Fullscreen mode: sidebar overlay (trigger is in the Topbar) */}
      {isFullscreen && activeModule && (
        <>
          {/* Backdrop */}
          {sidebarOverlayOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px]"
              onClick={() => setSidebarOverlayOpen(false)}
            />
          )}

          {/* Slide-in sidebar panel.
              contained={true} makes ModuleSidebar fill this container (h-full w-full)
              instead of using fixed positioning — keeps a single shadow source and
              lets overflow-hidden clip content correctly. */}
          <aside
            className={[
              "fixed left-0 bottom-0 z-50 w-72 overflow-hidden",
              "shadow-[4px_0_24px_rgba(0,0,0,0.12)]",
              "transition-transform duration-200 ease-out",
              sidebarOverlayOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
            ].join(" ")}
            style={{ top: "calc(var(--topbar-height, 3.5rem) + env(safe-area-inset-top, 0px))" }}
          >
            <ModuleSidebar
              module={activeModule}
              currentPath={location.pathname}
              onNavigate={(path) => {
                navigate(path);
                setSidebarOverlayOpen(false);
              }}
              collapsed={false}
              onCollapse={() => setSidebarOverlayOpen(false)}
              contained={true}
              mobileOpen={true}
              sidebarSlot={sidebarSlot}
              onMobileClose={() => setSidebarOverlayOpen(false)}
              canInstall={canInstall}
              onInstall={install}
            />
          </aside>
        </>
      )}

        <AppLauncher />
        <CommandPalette activeModule={activeModule} />
        <FloatingChatHub />
      </div>
      </ModuleBundleLoader>
    </OfflineProvider>
  );
}
