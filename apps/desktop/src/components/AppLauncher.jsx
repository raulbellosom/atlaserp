import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { useLauncherStore } from "../stores/launcher";
import {
  CATEGORY_LABELS,
  getModuleLaunchPath,
  groupModulesByCategory,
} from "../lib/runtimeModules";
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
};

function ModIcon({ name, size = 22, color }) {
  const Icon = ICON_MAP[name] ?? Box;
  return <Icon size={size} style={{ color }} />;
}

export function AppLauncher() {
  const { isOpen, closeLauncher, toggleLauncher } = useLauncherStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { availableModules } = useRuntimeModules();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableModules;
    return availableModules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.summary ?? "").toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q),
    );
  }, [query, availableModules]);

  const grouped = useMemo(() => groupModulesByCategory(filtered), [filtered]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        closeLauncher();
        setQuery("");
      }
      if (e.ctrlKey && e.key === ".") {
        e.preventDefault();
        toggleLauncher();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [closeLauncher, toggleLauncher]);

  function handleModuleClick(module) {
    navigate(getModuleLaunchPath(module));
    closeLauncher();
    setQuery("");
  }

  function handleGoHome() {
    navigate("/app/home");
    closeLauncher();
    setQuery("");
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-100 flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              closeLauncher();
              setQuery("");
            }}
          />

          <motion.div
            className="relative glass-strong rounded-2xl w-full max-w-2xl mx-4 mt-[10dvh] max-h-[80dvh] flex flex-col overflow-hidden"
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
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar aplicacion..."
                className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
              />
              <button
                onClick={handleGoHome}
                className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer text-xs font-medium"
              >
                <Home size={13} />
                Inicio
              </button>
              <button
                onClick={() => {
                  closeLauncher();
                  setQuery("");
                }}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-6">
              {Object.keys(grouped).length === 0 ? (
                <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">
                  Sin resultados para "{query}"
                </p>
              ) : (
                Object.entries(grouped).map(([category, modules]) => (
                  <div key={category}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
                      {CATEGORY_LABELS[category] ?? category}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {modules.map((module) => (
                        <button
                          key={module.key}
                          onClick={() => handleModuleClick(module)}
                          className="flex flex-col items-center gap-2 rounded-xl p-4 hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer text-center"
                        >
                          <div
                            className="h-12 w-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${module.color}26` }}
                          >
                            <ModIcon name={module.icon} size={22} color={module.color} />
                          </div>
                          <p className="text-xs font-semibold text-[hsl(var(--foreground))] leading-tight">
                            {module.name}
                          </p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2 leading-snug w-full">
                            {module.summary}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
