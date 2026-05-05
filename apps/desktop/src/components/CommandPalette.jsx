import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
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
  Shield,
  Palette,
  FolderOpen,
  Building2,
  CreditCard,
  BarChart3,
  FileText,
  Home,
  User,
} from "lucide-react";
import { useCommandStore } from "../stores/command";
import { getModuleLaunchPath } from "../lib/runtimeModules";
import { useRuntimeModules } from "../app/useRuntimeModules";

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
  User,
};

function CmdIcon({ name, size = 14, color }) {
  const Icon = ICON_MAP[name] ?? Box;
  return <Icon size={size} style={{ color }} />;
}

const STATIC_PAGES = [
  {
    key: "home",
    label: "Inicio",
    path: "/app/home",
    icon: "Home",
    description: "Pantalla de inicio",
  },
  {
    key: "profile",
    label: "Mi perfil",
    path: "/app/profile",
    icon: "User",
    description: "Perfil de usuario",
  },
];

export function CommandPalette({ activeModule }) {
  const { isOpen, openCommand, closeCommand } = useCommandStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { availableModules } = useRuntimeModules();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const actionItems = activeModule
      ? (activeModule.navigation ?? [])
          .filter((nav) => !q || nav.label.toLowerCase().includes(q))
          .map((nav) => ({
            key: `action-${nav.path}`,
            label: nav.label,
            description: `${activeModule.name} -> ${nav.label}`,
            icon: nav.icon,
            color: activeModule.color,
            section: "Acciones",
            action() {
              const fullPath =
                nav.path === "/"
                  ? `/app/m/${activeModule.key}`
                  : `/app/m/${activeModule.key}${nav.path}`;
              navigate(fullPath);
              closeCommand();
              setQuery("");
            },
          }))
      : [];

    const moduleItems = availableModules
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          (m.summary ?? "").toLowerCase().includes(q),
      )
      .map((m) => ({
        key: `mod-${m.key}`,
        label: m.name,
        description: m.summary,
        icon: m.icon,
        color: m.color,
        section: "Modulos",
        action() {
          navigate(getModuleLaunchPath(m));
          closeCommand();
          setQuery("");
        },
      }));

    const pageItems = STATIC_PAGES.filter(
      (p) => !q || p.label.toLowerCase().includes(q),
    ).map((p) => ({
      key: `page-${p.key}`,
      label: p.label,
      description: p.description,
      icon: p.icon,
      color: "hsl(var(--muted-foreground))",
      section: "Paginas",
      action() {
        navigate(p.path);
        closeCommand();
        setQuery("");
      },
    }));

    return [...actionItems, ...moduleItems, ...pageItems];
  }, [query, availableModules, activeModule, navigate, closeCommand]);

  const grouped = useMemo(() => {
    const groups = {};
    results.forEach((item) => {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    });
    return groups;
  }, [results]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  useEffect(() => {
    function handleKey(e) {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        if (isOpen) closeCommand();
        else openCommand();
      }
      if (!isOpen) return;
      if (e.key === "Escape") {
        closeCommand();
        setQuery("");
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results[selectedIndex]) {
        results[selectedIndex].action();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, openCommand, closeCommand, results, selectedIndex]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setQuery("");
    setSelectedIndex(0);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-110 flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              closeCommand();
              setQuery("");
            }}
          />

          <motion.div
            className="relative glass-strong rounded-2xl w-full max-w-xl mx-4 mt-[15dvh] flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
              <Search
                size={15}
                className="text-[hsl(var(--muted-foreground))] shrink-0"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar modulos, acciones, paginas..."
                className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
              />
              <button
                onClick={() => {
                  closeCommand();
                  setQuery("");
                }}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[50dvh] p-2">
              {results.length === 0 ? (
                <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">
                  Sin resultados
                </p>
              ) : (
                Object.entries(grouped).map(([section, items]) => (
                  <div key={section} className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-3 py-1.5">
                      {section}
                    </p>
                    {items.map((item) => {
                      const idx = results.indexOf(item);
                      const isSelected = idx === selectedIndex;
                      return (
                        <button
                          key={item.key}
                          onClick={item.action}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors duration-100 cursor-pointer text-left ${
                            isSelected
                              ? "bg-[hsl(var(--muted))]"
                              : "hover:bg-[hsl(var(--muted))]"
                          }`}
                        >
                          <div
                            className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${item.color}20` }}
                          >
                            <CmdIcon name={item.icon} size={14} color={item.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 px-4 py-2 border-t border-[hsl(var(--border))] flex items-center gap-4 text-[10px] text-[hsl(var(--muted-foreground))]">
              <span>
                <kbd className="font-mono mr-1">Up/Down</kbd>navegar
              </span>
              <span>
                <kbd className="font-mono mr-1">Enter</kbd>seleccionar
              </span>
              <span>
                <kbd className="font-mono mr-1">Esc</kbd>cerrar
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
