import { LayoutGrid, Menu, Search, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Breadcrumbs } from "./Breadcrumbs";
import { useCommandStore } from "../stores/command";
import { ThemeToggle } from "./ThemeToggle";
import { CompanySwitcher } from "./CompanySwitcher";
import { useState } from "react";
import { ActivityBellTrigger, OfflineIndicator, SyncStatusBar } from "@atlas/ui";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { atlas } from "../lib/atlas";
import ActivityDetailSheet from "../modules/atlas.activity/ActivityDetailSheet";
import { useOfflineStore } from "@atlas/offline";

export function Topbar({
  onLauncherOpen,
  onMobileMenuToggle,
  onModuleMenuToggle,
  networkBusy = false,
  activeModuleKey = null,
  canInstall = false,
  manualInstallReady = false,
  onInstall,
}) {
  const { session, userProfile } = useAuth();
  const { openCommand } = useCommandStore();
  const navigate = useNavigate();
  const token = session?.access_token;
  const isOnline     = useOfflineStore((s) => s.isOnline);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const isSyncing    = useOfflineStore((s) => s.isSyncing);
  const lastSyncAt   = useOfflineStore((s) => s.lastSyncAt);
  const canReadNotifications = Boolean(
    userProfile?.isAdmin ||
    (userProfile?.permissions ?? []).includes("notifications.read"),
  );
  const canReadActivity = Boolean(
    userProfile?.isAdmin ||
    (userProfile?.permissions ?? []).includes("activity.read"),
  );
  const [selectedActivity, setSelectedActivity] = useState(null);

  function handleNotificationNavigate(href) {
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    // Links stored in activity/notification records omit the /app prefix
    const resolved = href.startsWith("/m/") ? `/app${href}` : href;
    navigate(resolved);
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-topbar safe-top bg-surface-1 border-b border-[hsl(var(--border))] flex flex-col justify-end">
      <div className="h-14 flex items-center px-4 gap-2">
        {/* Left section */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Fullscreen module menu trigger — always visible on all breakpoints */}
          {onModuleMenuToggle && (
            <button
              className="h-9 w-9 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer"
              onClick={onModuleMenuToggle}
              aria-label="Abrir navegacion del modulo"
            >
              <Menu size={18} />
            </button>
          )}
          {/* Mobile hamburger — only shown when a regular sidebar is active */}
          {onMobileMenuToggle && !onModuleMenuToggle && (
            <button
              className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer"
              onClick={onMobileMenuToggle}
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
          )}

          {/* Logo mark — click to go home */}
          <button
            onClick={() => navigate("/app/home")}
            title="Inicio"
            className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-opacity duration-150 hover:opacity-80 overflow-hidden"
          >
            <img
              src="/brand/atlas-logo-isotype.png"
              alt="Atlas ERP"
              className="w-full h-full object-contain"
              draggable={false}
            />
          </button>

          {/* App launcher */}
          <button
            onClick={onLauncherOpen}
            title="Aplicaciones (Ctrl+.)"
            className="h-9 w-9 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer"
          >
            <LayoutGrid size={16} />
          </button>

          {/* Breadcrumb */}
          <Breadcrumbs />
        </div>

        {/* Center section: command palette trigger — absolutely centered so it never shifts */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
          {/* Full bar — hidden on mobile */}
          <button
            onClick={openCommand}
            className="pointer-events-auto hidden sm:flex h-9 w-64 max-w-xs items-center gap-2 px-3 rounded-xl bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors duration-150 cursor-pointer"
          >
            <Search size={13} className="shrink-0" />
            <span className="flex-1 text-xs text-left">
              Buscar o ejecutar...
            </span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[hsl(var(--border))] text-[10px] font-mono text-[hsl(var(--muted-foreground))] leading-none shrink-0">
              Ctrl+K
            </kbd>
          </button>
          {/* Icon-only — mobile only */}
          <button
            onClick={openCommand}
            aria-label="Buscar"
            className="pointer-events-auto sm:hidden h-9 w-9 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer"
          >
            <Search size={16} />
          </button>
        </div>

        {/* Right section — pushed to the right */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <SyncStatusBar
            isOnline={isOnline}
            isSyncing={isSyncing}
            lastSyncAt={lastSyncAt}
          />
          <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
          {networkBusy && (
            <div className="hidden md:flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="h-1.5 w-1.5 rounded-full bg-(--brand-primary) animate-pulse" />
              Sincronizando...
            </div>
          )}
          {token && (
            <span className="hidden md:contents">
              <CompanySwitcher token={token} />
            </span>
          )}
          {/* ThemeToggle — hidden on mobile, accessible via UserMenu */}
          <span className="hidden sm:contents">
            <ThemeToggle />
          </span>
          {/* ActivityBell — hidden on mobile, accessible via UserMenu */}
          {token && canReadActivity && (
            <span className="hidden sm:contents">
              <ActivityBellTrigger
                sdk={atlas}
                token={token}
                onSelect={setSelectedActivity}
                onSeeAll={() => navigate("/app/m/atlas.activity")}
              />
            </span>
          )}
          <ActivityDetailSheet
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
            onNavigate={(href) => {
              setSelectedActivity(null);
              handleNotificationNavigate(href);
            }}
          />
          {token && canReadNotifications && (
            <NotificationBell
              token={token}
              onNavigate={handleNotificationNavigate}
              onSeeAll={() => navigate("/app/m/atlas.notifications")}
            />
          )}
          {canInstall && activeModuleKey && (
            <button
              onClick={onInstall}
              title="Instalar como app"
              className="h-9 w-9 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer"
              aria-label="Instalar modulo como app"
            >
              <Download size={16} />
            </button>
          )}
          <UserMenu
            activeModuleKey={activeModuleKey}
            canInstall={canInstall}
            manualInstallReady={manualInstallReady}
            onInstall={onInstall}
            canReadActivity={canReadActivity}
            onActivityOpen={() => navigate("/app/m/atlas.activity")}
          />
        </div>
      </div>
    </header>
  );
}
