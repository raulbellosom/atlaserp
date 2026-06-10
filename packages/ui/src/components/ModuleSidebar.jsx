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
  ChevronDown,
  X,
  Network,
  BookOpen,
  Truck,
  Wrench,
  ClipboardList,
  UserCheck,
  Library,
  Menu,
  Globe,
  Tag,
  SlidersHorizontal,
  Activity,
  Bell,
  Package,
  Boxes,
  ShoppingBag,
  ShoppingCart,
  Store,
  ListOrdered,
  Calendar,
  UsersRound,
  ShieldCheck,
  LayoutTemplate,
  SquareKanban,
  Download,
} from "lucide-react";
import { useState, useMemo } from "react";
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
  Network,
  BookOpen,
  Truck,
  Wrench,
  ClipboardList,
  UserCheck,
  Library,
  Menu,
  Globe,
  Tag,
  SlidersHorizontal,
  Activity,
  Bell,
  Package,
  Boxes,
  ShoppingBag,
  ShoppingCart,
  Store,
  ListOrdered,
  Calendar,
  UsersRound,
  ShieldCheck,
  LayoutTemplate,
  SquareKanban,
};

const ICON_ALIAS_MAP = {
  truck: "Truck",
  wrench: "Wrench",
  clipboardlist: "ClipboardList",
  usercheck: "UserCheck",
  bookopen: "BookOpen",
  library: "Library",
  layers: "Layers",
  menu: "Menu",
  globe: "Globe",
  forminput: "ClipboardList",
};

function NavIcon({ name, size = 15, ...props }) {
  const raw = typeof name === "string" ? name.trim() : "";
  const normalizedKey = raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const aliasName = ICON_ALIAS_MAP[normalizedKey] ?? raw;
  const pascalName = raw
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
  const Icon =
    ICON_MAP[raw] ?? ICON_MAP[aliasName] ?? ICON_MAP[pascalName] ?? Box;
  return <Icon size={size} {...props} />;
}

function buildFullPath(moduleKey, path) {
  if (!path) return "";
  if (path.startsWith("/app/")) return path;
  return path === "/" ? `/app/m/${moduleKey}` : `/app/m/${moduleKey}${path}`;
}

export function ModuleSidebar({
  module,
  currentPath,
  onNavigate,
  collapsed,
  onCollapse,
  mobileOpen = false,
  onMobileClose,
  canInstall = false,
  onInstall,
}) {
  if (!module) return null;

  // uid is a stable unique identifier: fullPath for leaf items, label-based fallback for groups without a path.
  const navItems = (module.navigation ?? []).map((item, index) => {
    const fullPath = buildFullPath(module.key, item.path);
    return {
      ...item,
      fullPath,
      uid: fullPath || `${module.key}:group:${item.label ?? index}`,
      children: (item.children ?? []).map((child) => ({
        ...child,
        fullPath: buildFullPath(module.key, child.path),
      })),
    };
  });

  // Pick only the most specific (longest) nav item / child that matches currentPath
  const activeFullPath = useMemo(() => {
    const allPaths = [];
    for (const item of navItems) {
      allPaths.push({ fullPath: item.fullPath, path: item.path });
      for (const child of item.children ?? []) {
        allPaths.push({ fullPath: child.fullPath, path: child.path });
      }
    }
    return (
      [...allPaths]
        .sort((a, b) => b.fullPath.length - a.fullPath.length)
        .find((item) => {
          if (!item.fullPath) return false;
          return (
            currentPath === item.fullPath ||
            currentPath.startsWith(item.fullPath + "/")
          );
        })?.fullPath ?? null
    );
  }, [navItems, currentPath]);

  // Groups that contain the active path are auto-expanded on mount
  const initialOpenGroups = useMemo(() => {
    const open = new Set();
    for (const item of navItems) {
      if (!item.children?.length) continue;
      const hasActive = item.children.some(
        (child) =>
          currentPath === child.fullPath ||
          currentPath.startsWith(child.fullPath + "/"),
      );
      if (hasActive) open.add(item.uid);
    }
    return open;
  }, []); // intentionally empty deps — only initializes once on mount

  const [openGroups, setOpenGroups] = useState(initialOpenGroups);

  function toggleGroup(uid) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 bg-surface-2 border-r border-[hsl(var(--border))] overflow-hidden",
        // Mobile: fixed overlay drawer
        "fixed top-14 left-0 h-[calc(100dvh-3.5rem)] w-72 z-40",
        "transition-transform duration-300 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop (lg+): static flex child
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
          {typeof module.logoUrl === "string" && module.logoUrl.trim() ? (
            <span className="h-6 w-6 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]/85 flex items-center justify-center overflow-hidden shadow-sm">
              <img
                src={module.logoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <NavIcon
              name={module.icon}
              size={16}
              style={{ color: module.color }}
            />
          )}
        </div>
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
        {/* Install as app button — shown when browser supports PWA install */}
        {canInstall && !collapsed && (
          <button
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors shrink-0 cursor-pointer ml-auto"
            onClick={onInstall}
            title="Instalar como app"
            aria-label="Instalar modulo como app"
          >
            <Download size={13} />
          </button>
        )}
        {/* Mobile-only close button */}
        <button
          className={cn(
            "lg:hidden flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors shrink-0 cursor-pointer",
            canInstall ? "" : "ml-auto",
          )}
          onClick={onMobileClose}
          aria-label="Cerrar menu"
        >
          <X size={15} />
        </button>
        {/* Mobile install button — shown next to close when installable */}
        {canInstall && (
          <button
            className="lg:hidden flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors shrink-0 cursor-pointer"
            onClick={onInstall}
            title="Instalar como app"
            aria-label="Instalar modulo como app"
          >
            <Download size={13} />
          </button>
        )}
      </div>

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const hasChildren = item.children?.length > 0;

          if (!hasChildren) {
            // Flat nav item (unchanged behavior)
            const isActive = item.fullPath === activeFullPath;
            return (
              <a
                key={item.uid}
                href={item.fullPath}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.button === 1) return;
                  e.preventDefault();
                  onNavigate(item.fullPath);
                }}
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
                <NavIcon
                  name={item.icon}
                  size={15}
                  className="shrink-0"
                  style={{ color: isActive ? module.color : undefined }}
                />
                <span
                  className={cn(
                    "truncate whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out",
                    collapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100",
                  )}
                >
                  {item.label}
                </span>
              </a>
            );
          }

          // Group header with children
          const isOpen = openGroups.has(item.uid);
          const isGroupActive = item.children.some(
            (child) =>
              child.fullPath === activeFullPath ||
              currentPath.startsWith(child.fullPath + "/"),
          );

          return (
            <div key={item.uid}>
              {/* Group header button */}
              <button
                onClick={() => toggleGroup(item.uid)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm",
                  "transition-colors duration-150 cursor-pointer outline-none overflow-hidden",
                  "hover:bg-[hsl(var(--muted))]",
                  isGroupActive && !isOpen
                    ? "text-[hsl(var(--foreground))] font-medium"
                    : "text-[hsl(var(--muted-foreground))]",
                )}
                style={
                  isGroupActive && !isOpen
                    ? {
                        borderLeft: `2px solid ${module.color}`,
                        backgroundColor: `${module.color}14`,
                      }
                    : { borderLeft: "2px solid transparent" }
                }
              >
                <NavIcon
                  name={item.icon}
                  size={15}
                  className="shrink-0"
                  style={{
                    color: isGroupActive && !isOpen ? module.color : undefined,
                  }}
                />
                <span
                  className={cn(
                    "flex-1 truncate whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out text-left",
                    collapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100",
                  )}
                >
                  {item.label}
                </span>
                {/* Chevron — only visible when sidebar is expanded */}
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 transition-[opacity,transform] duration-200 ease-in-out text-[hsl(var(--muted-foreground))]",
                    collapsed ? "opacity-0 w-0" : "opacity-100",
                    isOpen ? "rotate-180" : "rotate-0",
                  )}
                />
              </button>

              {/* Child items — tree-line style */}
              {isOpen && !collapsed && (
                <div className="mt-0.5 pl-2.5">
                  <div className="border-l border-[hsl(var(--border))] space-y-0.5 pl-2">
                    {item.children.map((child) => {
                      const isChildActive =
                        child.fullPath === activeFullPath ||
                        currentPath.startsWith(child.fullPath + "/");
                      return (
                        <a
                          key={child.fullPath}
                          href={child.fullPath}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey || e.button === 1) return;
                            e.preventDefault();
                            onNavigate(child.fullPath);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 h-8 rounded-lg text-sm px-2",
                            "transition-colors duration-150 cursor-pointer outline-none overflow-hidden",
                            "hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
                            isChildActive
                              ? "text-[hsl(var(--foreground))] font-medium"
                              : "text-[hsl(var(--muted-foreground))]",
                          )}
                          style={
                            isChildActive
                              ? { backgroundColor: `${module.color}12` }
                              : {}
                          }
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0 transition-colors duration-150",
                              isChildActive ? "opacity-100" : "opacity-40",
                            )}
                            style={{
                              backgroundColor: isChildActive
                                ? module.color
                                : "hsl(var(--muted-foreground))",
                            }}
                          />
                          <span className="truncate">{child.label}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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
