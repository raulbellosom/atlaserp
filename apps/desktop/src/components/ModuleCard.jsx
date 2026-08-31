import { Star, WifiOff } from "lucide-react";
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
  UsersRound,
  Shield,
  Palette,
  FolderOpen,
  Building2,
  CreditCard,
  BarChart3,
  Files,
  FileText,
  Home,
  Truck,
  Package,
  Globe,
  BookOpen,
  ClipboardList,
  UserCheck,
  ShieldCheck,
  Menu,
  Activity,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Bell,
  Calendar,
  SquareKanban,
  Network,
  MapPin,
  SlidersHorizontal,
  LayoutTemplate,
  Wrench,
  Library,
  Boxes,
  Store,
  ListOrdered,
  ListTree,
  NotebookPen,
  ArrowRightLeft,
  HandCoins,
  Receipt,
  CalendarDays,
  TrendingUp,
  Gauge,
  MessageSquare,
  Inbox,
} from "lucide-react";
import { useRef } from "react";
import { cn, FleetVehicleIcon, useLongPress } from "@atlas/ui";
import {
  favoriteToggleLabel,
  shouldOpenInNewTab,
  isCoarsePointer,
} from "../lib/moduleLauncher";

// ---- Constants ----
const DEFAULT_MODULE_COLOR = "#6366f1";
const DEFAULT_MODULE_ACCENT = "#4f46e5";

export const MODULE_ICON_REGISTRY = {
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
  UsersRound,
  Shield,
  Palette,
  FolderOpen,
  Building2,
  CreditCard,
  BarChart3,
  Files,
  FileText,
  Home,
  Truck,
  Package,
  Globe,
  BookOpen,
  ClipboardList,
  UserCheck,
  ShieldCheck,
  Menu,
  Activity,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Bell,
  Calendar,
  SquareKanban,
  Network,
  MapPin,
  SlidersHorizontal,
  LayoutTemplate,
  Wrench,
  Library,
  Boxes,
  Store,
  ListOrdered,
  ListTree,
  NotebookPen,
  ArrowRightLeft,
  HandCoins,
  Receipt,
  CalendarDays,
  TrendingUp,
  Gauge,
  MessageSquare,
  Inbox,
  FleetVehicle: FleetVehicleIcon,
};

// ---- Helpers ----
function getGeneratedInitials(name) {
  if (typeof name !== "string" || !name.trim()) return "";
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase())
    .filter(Boolean);
  if (words.length >= 2) return `${words[0]}${words[1]}`;
  return words[0] ?? "";
}

export function toAlphaHexColor(color, alphaHex) {
  if (typeof color !== "string") return color;
  const trimmed = color.trim();
  if (!trimmed) return color;
  if (
    trimmed.startsWith("#") &&
    (trimmed.length === 4 || trimmed.length === 7)
  ) {
    return `${trimmed}${alphaHex}`;
  }
  return color;
}

export function resolveModuleVisuals(module) {
  const manifest = module?.manifest ?? {};
  const name = module?.name ?? module?.key ?? "Módulo";
  const color = module?.color ?? manifest?.color ?? DEFAULT_MODULE_COLOR;
  const accentColor =
    manifest?.accentColor ??
    module?.color ??
    manifest?.color ??
    DEFAULT_MODULE_ACCENT;
  const logoUrl = manifest?.logoUrl ?? module?.logoUrl ?? null;
  const requestedIcon = manifest?.icon ?? module?.icon ?? null;
  const iconComponent =
    requestedIcon && MODULE_ICON_REGISTRY[requestedIcon]
      ? MODULE_ICON_REGISTRY[requestedIcon]
      : null;
  const generatedInitials = getGeneratedInitials(name);
  const fallbackInitial = name.trim().charAt(0).toUpperCase();
  const initials =
    manifest?.initials ?? generatedInitials ?? fallbackInitial ?? "M";

  return { color, accentColor, logoUrl, iconComponent, initials };
}

// ---- ModuleIcon: gradient icon with initials / logo / lucide icon ----
export function ModuleIcon({ module, size = "md" }) {
  const visuals = resolveModuleVisuals(module);
  const {
    color,
    accentColor,
    logoUrl,
    iconComponent: IconComponent,
    initials,
  } = visuals;

  const cls =
    {
      sm: "h-8 w-8 rounded-lg text-sm",
      md: "h-11 w-11 rounded-xl text-base",
      lg: "h-14 w-14 rounded-2xl text-2xl",
    }[size] ?? "h-11 w-11 rounded-xl text-base";

  return (
    <div
      className={cn(
        "flex items-center justify-center font-black text-white select-none shrink-0",
        cls,
      )}
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${accentColor} 100%)`,
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={module.name}
          className="h-full w-full object-contain rounded-[inherit]"
          draggable={false}
        />
      ) : IconComponent ? (
        <IconComponent className="h-1/2 w-1/2" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

// ---- FavoriteStarButton: always-visible star toggle used on cards/rows ----
function FavoriteStarButton({ moduleKey, isFavorite, onToggleFavorite, className }) {
  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={favoriteToggleLabel(isFavorite)}
      title={favoriteToggleLabel(isFavorite)}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(moduleKey);
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-amber-400 cursor-pointer",
        className,
      )}
    >
      <Star
        size={14}
        className={isFavorite ? "text-amber-400 fill-amber-400" : ""}
      />
    </button>
  );
}

// Wires long-press -> onLongPress({x,y}, key) on coarse pointers only, and
// returns a `guardClick` that swallows the post-long-press click so it does
// not also navigate.
function useCardLongPress(moduleKey, onLongPress) {
  const suppressClick = useRef(false);
  const handlers = useLongPress({
    disabled: !onLongPress || !isCoarsePointer(),
    ignoreInteractiveTarget: true,
    onLongPress: (e) => {
      suppressClick.current = true;
      onLongPress?.({ x: e.clientX, y: e.clientY }, moduleKey);
    },
  });
  const longPressHandlers = {
    ...handlers,
    onPointerDown: (e) => {
      suppressClick.current = false;
      handlers.onPointerDown?.(e);
    },
  };
  const guardClick = (e, run) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      return;
    }
    run();
  };
  return { longPressHandlers, guardClick };
}

// ---- ModuleCardGrid: grid card for navigation (HomeScreen, AppLauncher) ----
export function ModuleCardGrid({
  module,
  onClick,
  onContextMenu,
  onToggleFavorite,
  onLongPress,
  href,
  isFavorite,
  isOfflineBlocked,
}) {
  const visuals = resolveModuleVisuals(module);
  const { color, accentColor } = visuals;
  const { longPressHandlers, guardClick } = useCardLongPress(module.key, onLongPress);

  const rootClass = cn(
    "group relative flex flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden text-left transition-all duration-200",
    isOfflineBlocked
      ? "opacity-40 cursor-not-allowed pointer-events-none"
      : "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
  );

  const inner = (
    <>
      {/* Gradient header */}
      <div
        className="relative h-16 overflow-hidden shrink-0"
        style={{
          background: `linear-gradient(135deg, ${toAlphaHexColor(color, "22")} 0%, ${toAlphaHexColor(accentColor, "08")} 70%, transparent 100%)`,
        }}
      >
        <div
          className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.12]"
          style={{ background: accentColor }}
        />
        <div
          className="absolute right-8 top-2 h-8 w-8 rounded-full opacity-[0.08]"
          style={{ background: color }}
        />
        {isOfflineBlocked ? (
          <WifiOff
            size={11}
            className="absolute top-3 right-3 text-[hsl(var(--muted-foreground))]"
          />
        ) : (
          <FavoriteStarButton
            moduleKey={module.key}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            className="absolute top-1.5 right-1.5 z-20"
          />
        )}
      </div>

      {/* Icon overlapping header/body boundary */}
      <div className="px-4 -mt-5 relative z-10 shrink-0">
        <ModuleIcon module={module} size="sm" />
      </div>

      {/* Body */}
      <div className="px-4 pb-4 pt-2 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight truncate">
          {module.name}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 leading-snug">
          {module.summary || module.description}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        onContextMenu={onContextMenu}
        {...longPressHandlers}
        onClick={(e) => {
          if (shouldOpenInNewTab(e)) return;
          e.preventDefault();
          guardClick(e, () => onClick?.());
        }}
        aria-disabled={isOfflineBlocked || undefined}
        className={rootClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      onContextMenu={onContextMenu}
      {...longPressHandlers}
      onClick={(e) => guardClick(e, () => onClick?.())}
      disabled={isOfflineBlocked}
      className={rootClass}
    >
      {inner}
    </button>
  );
}

// ---- ModuleListRow: list row for navigation (HomeScreen, AppLauncher) ----
export function ModuleListRow({
  module,
  onClick,
  onContextMenu,
  onToggleFavorite,
  onLongPress,
  href,
  isFavorite,
  isOfflineBlocked,
}) {
  const { longPressHandlers, guardClick } = useCardLongPress(module.key, onLongPress);

  const rootClass = cn(
    "flex items-center gap-4 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200 px-4 py-3 text-left",
    isOfflineBlocked
      ? "opacity-40 cursor-not-allowed pointer-events-none"
      : "cursor-pointer hover:shadow-sm hover:border-[hsl(var(--muted-foreground))]/30 active:scale-[0.99]",
  );

  const inner = (
    <>
      <ModuleIcon module={module} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight">
          {module.name}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
          {module.summary || module.description}
        </p>
      </div>
      {isOfflineBlocked ? (
        <WifiOff
          size={13}
          className="text-[hsl(var(--muted-foreground))] shrink-0"
        />
      ) : (
        <FavoriteStarButton
          moduleKey={module.key}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          className="shrink-0 -mr-1"
        />
      )}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        onContextMenu={onContextMenu}
        {...longPressHandlers}
        onClick={(e) => {
          if (shouldOpenInNewTab(e)) return;
          e.preventDefault();
          guardClick(e, () => onClick?.());
        }}
        aria-disabled={isOfflineBlocked || undefined}
        className={rootClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      onContextMenu={onContextMenu}
      {...longPressHandlers}
      onClick={(e) => guardClick(e, () => onClick?.())}
      disabled={isOfflineBlocked}
      className={rootClass}
    >
      {inner}
    </button>
  );
}
