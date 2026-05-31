import { useNavigate } from "react-router-dom";
import { ChevronDown, User, Settings, Mail, LogOut } from "lucide-react";
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

function getInitials(firstName, lastName) {
  const f = (firstName ?? "").charAt(0).toUpperCase();
  const l = (lastName ?? "").charAt(0).toUpperCase();
  const result = (f + l).trim();
  return result || (firstName ?? "").charAt(0).toUpperCase() || "U";
}

export function UserMenu() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();

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
        <DropdownMenuItem
          onClick={() => navigate("/app/m/atlas.core/settings")}
          className="gap-2 cursor-pointer"
        >
          <Settings size={14} />
          Configuración
        </DropdownMenuItem>
        {(userProfile?.isAdmin ||
          userProfile?.permissions?.includes("platform.settings.manage")) && (
          <DropdownMenuItem
            onClick={() => navigate("/app/settings/smtp")}
            className="gap-2 cursor-pointer"
          >
            <Mail size={14} />
            SMTP
          </DropdownMenuItem>
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
