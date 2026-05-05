import { LayoutGrid, Menu, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Breadcrumbs } from "./Breadcrumbs";
import { useCommandStore } from "../stores/command";
import { ThemeToggle } from "./ThemeToggle";
import { CompanySwitcher } from "./CompanySwitcher";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

export function Topbar({ onLauncherOpen, onMobileMenuToggle, networkBusy = false }) {
  const { session } = useAuth();
  const { openCommand } = useCommandStore();
  const navigate = useNavigate();
  const token = session?.access_token;

  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-50 flex items-center px-4 gap-2 bg-surface-1 border-b border-[hsl(var(--border))]">
      {/* Left section */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Mobile hamburger — only shown when a sidebar is active */}
        {onMobileMenuToggle && (
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
          <span className="flex-1 text-xs text-left">Buscar o ejecutar...</span>
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
        {networkBusy && (
          <div className="hidden md:flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))]">
            <span className="h-1.5 w-1.5 rounded-full bg-(--brand-primary) animate-pulse" />
            Sincronizando...
          </div>
        )}
        {token && <span className="hidden md:contents"><CompanySwitcher token={token} /></span>}
        <span className="hidden sm:contents"><ThemeToggle /></span>
        {token && <NotificationBell token={token} />}
        <UserMenu />
      </div>
    </header>
  );
}
