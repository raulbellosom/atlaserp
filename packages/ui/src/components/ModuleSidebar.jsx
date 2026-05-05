import {
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
  Layers,
  ContactRound,
  Landmark,
  CreditCard,
  BarChart3,
  FileText,
  Home,
  Box,
  MapPin,
  ListTree,
  NotebookPen,
  ArrowRightLeft,
  HandCoins,
  Receipt,
  CalendarDays,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "../lib/utils.js";

const ICON_MAP = {
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
  Layers,
  ContactRound,
  Landmark,
  CreditCard,
  BarChart3,
  FileText,
  Home,
  Box,
  MapPin,
  ListTree,
  NotebookPen,
  ArrowRightLeft,
  HandCoins,
  Receipt,
  CalendarDays,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
};

function NavIcon({ name, size = 15, ...props }) {
  const Icon = ICON_MAP[name] ?? Box;
  return <Icon size={size} {...props} />;
}

export function ModuleSidebar({
  module,
  currentPath,
  onNavigate,
  collapsed,
  onCollapse,
  mobileOpen = false,
  onMobileClose,
}) {
  if (!module) return null;

  const navItems = (module.navigation ?? []).map((item) => ({
    ...item,
    fullPath:
      item.path === "/"
        ? `/app/m/${module.key}`
        : `/app/m/${module.key}${item.path}`,
  }));

  // Pick only the most specific (longest) nav item that matches currentPath
  const activeFullPath =
    [...navItems]
      .sort((a, b) => b.fullPath.length - a.fullPath.length)
      .find((item) => {
        if (item.path === "/") return currentPath === item.fullPath;
        return (
          currentPath === item.fullPath ||
          currentPath.startsWith(item.fullPath + "/")
        );
      })?.fullPath ?? null;

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 bg-surface-2 border-r border-[hsl(var(--border))] overflow-hidden",
        // Mobile: fixed overlay drawer
        "fixed top-14 left-0 h-[calc(100dvh-3.5rem)] w-72 z-40",
        "transition-transform duration-300 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop (lg+): static flex child — height comes from parent flex container
        "lg:static lg:z-auto",
        "lg:translate-x-0 lg:transition-[width] lg:duration-300 lg:ease-in-out",
        collapsed ? "lg:w-14" : "lg:w-60",
      )}
    >
      {/* Module header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] h-14 px-3 shrink-0">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${module.color}20` }}
        >
          <NavIcon
            name={module.icon}
            size={16}
            style={{ color: module.color }}
          />
        </div>
        {/* Text fades + clips, icon never moves */}
        <div
          className={cn(
            "min-w-0 flex-1 overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out whitespace-nowrap",
            collapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100",
          )}
        >
          <p className="text-sm font-semibold truncate leading-tight text-[hsl(var(--foreground))]">
            {module.name}
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-tight mt-0.5">
            Módulo
          </p>
        </div>
        {/* Mobile-only close button */}
        <button
          className="lg:hidden ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors shrink-0 cursor-pointer"
          onClick={onMobileClose}
          aria-label="Cerrar menu"
        >
          <X size={15} />
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.fullPath === activeFullPath;
          return (
            <button
              key={item.fullPath}
              onClick={() => onNavigate(item.fullPath)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm",
                "transition-colors duration-150 cursor-pointer outline-none overflow-hidden",
                "hover:bg-[hsl(var(--muted))]",
                isActive
                  ? "text-[hsl(var(--foreground))] font-medium"
                  : "text-[hsl(var(--muted-foreground))]",
              )}
              style={
                isActive
                  ? {
                      borderLeft: `2px solid ${module.color}`,
                      backgroundColor: `${module.color}14`,
                    }
                  : { borderLeft: "2px solid transparent" }
              }
            >
              {/* Icon — always fixed position, never moves */}
              <NavIcon
                name={item.icon}
                size={15}
                className="shrink-0"
                style={{ color: isActive ? module.color : undefined }}
              />
              {/* Label — fades out in place, no layout shift */}
              <span
                className={cn(
                  "truncate whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out",
                  collapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100",
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 p-2 border-t border-[hsl(var(--border))]">
        <button
          onClick={onCollapse}
          title={
            collapsed ? "Expandir panel lateral" : "Colapsar panel lateral"
          }
          className={cn(
            "w-full h-8 flex items-center justify-center rounded-lg cursor-pointer",
            "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
            "hover:bg-[hsl(var(--muted))] transition-colors duration-150",
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
