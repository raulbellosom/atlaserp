import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, User, Settings, LogOut, Monitor, Download, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@atlas/ui";
import { useAuth } from "../auth/AuthProvider";
import { ATLAS_DESKTOP_DOWNLOAD_URL } from "../lib/appConfig.js";

const DESKTOP_REMINDER_KEY = "atlas_desktop_reminder_dismissed_at";
const REMINDER_INTERVAL_MS = 2.5 * 24 * 60 * 60 * 1000;

function shouldShowDesktopReminder() {
  try {
    const ts = localStorage.getItem(DESKTOP_REMINDER_KEY);
    if (!ts) return true;
    return Date.now() - Number(ts) > REMINDER_INTERVAL_MS;
  } catch {
    return false;
  }
}

function dismissDesktopReminder() {
  try {
    localStorage.setItem(DESKTOP_REMINDER_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

function getInitials(firstName, lastName) {
  const f = (firstName ?? "").charAt(0).toUpperCase();
  const l = (lastName ?? "").charAt(0).toUpperCase();
  const result = (f + l).trim();
  return result || (firstName ?? "").charAt(0).toUpperCase() || "U";
}

export function UserMenu() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [showReminder, setShowReminder] = useState(() => shouldShowDesktopReminder());

  function handleDesktopDownload() {
    window.open(ATLAS_DESKTOP_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
    dismissDesktopReminder();
    setShowReminder(false);
  }

  function handleDismissReminder(e) {
    e.stopPropagation();
    dismissDesktopReminder();
    setShowReminder(false);
  }

  const initials = getInitials(userProfile?.firstName, userProfile?.lastName);
  const displayName =
    (userProfile?.displayName ??
      `${userProfile?.firstName ?? ""} ${userProfile?.lastName ?? ""}`.trim()) ||
    "Usuario";
  const email = userProfile?.email ?? "";
  const firstName = userProfile?.firstName ?? "Usuario";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer outline-none">
          <Avatar className="h-7 w-7">
            {userProfile?.avatarUrl && (
              <AvatarImage src={userProfile.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback
              className="text-[11px] font-bold"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--brand-primary-foreground)",
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-[hsl(var(--foreground))] max-w-20 truncate hidden sm:block">
            {firstName}
          </span>
          <ChevronDown
            size={13}
            className="text-[hsl(var(--muted-foreground))]"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Non-clickable user info header */}
        <div className="px-2 py-2.5 border-b border-[hsl(var(--border))] mb-1">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
            {displayName}
          </p>
          {email && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
              {email}
            </p>
          )}
        </div>
        <DropdownMenuItem
          onClick={() => navigate("/app/profile")}
          className="gap-2 cursor-pointer"
        >
          <User size={14} />
          Mi perfil
        </DropdownMenuItem>
        {(userProfile?.isAdmin ||
          userProfile?.permissions?.includes("platform.settings.manage")) && (
          <DropdownMenuItem
            onClick={() => navigate("/app/m/atlas.core/settings")}
            className="gap-2 cursor-pointer"
          >
            <Settings size={14} />
            Configuración
          </DropdownMenuItem>
        )}
        {showReminder && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Monitor size={12} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                  <p className="text-xs font-medium text-[hsl(var(--foreground))]">App de escritorio</p>
                </div>
                <button
                  onClick={handleDismissReminder}
                  className="flex items-center justify-center h-4 w-4 rounded-full text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors shrink-0"
                  aria-label="Descartar"
                >
                  <X size={10} />
                </button>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-snug">
                Descarga la app nativa para Windows y conéctala a esta instancia.
              </p>
              <button
                onClick={handleDesktopDownload}
                className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
              >
                <Download size={11} />
                Descargar para Windows
              </button>
            </div>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="gap-2 cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <LogOut size={14} />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

