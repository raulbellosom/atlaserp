import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coreModules, featureModules } from "@atlas/maps";
import {
  Badge,
  Button,
  PageHeader,
  SearchInput,
  FilterBar,
  EmptyState,
  ErrorState,
  ConfirmDialog,
  Skeleton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
} from "@atlas/ui";
import {
  Home,
  Package,
  Power,
  PowerOff,
  Trash2,
  Lock,
  ExternalLink,
  Info,
  LayoutGrid,
  List,
  ArrowUpRight,
  Building2,
  Tag,
  GitBranch,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import {
  CATEGORY_LABELS,
  getModuleLaunchPath,
  isModuleAvailable,
  mergeRuntimeModules,
} from "../../../lib/runtimeModules";

const MANIFEST_BY_KEY = new Map(
  [...coreModules, ...featureModules].map((m) => [m.key, m]),
);

const STATUS_DOT = {
  INSTALLED: "#22c55e",
  DISABLED: "#f59e0b",
  UNINSTALLED: "#94a3b8",
  ERROR: "#ef4444",
};

const STATUS_VARIANT = {
  INSTALLED: "success",
  DISABLED: "warning",
  UNINSTALLED: "secondary",
  ERROR: "destructive",
};

const KIND_LABEL = {
  CORE: "Sistema",
  FEATURE: "Módulo",
  INTEGRATION: "Integración",
  WEBSITE: "Sitio web",
};

function statusLabel(module) {
  if (module.core) return "Core";
  if (module.status === "INSTALLED" && module.enabled) return "Instalado";
  if (module.status === "DISABLED") return "Deshabilitado";
  if (module.status === "UNINSTALLED") return "Sin instalar";
  return module.status;
}

function getPublisher(module) {
  if (module.core || module.kind === "CORE") return "Atlas ERP";
  return module.publisher ?? "Comunidad";
}

function getCategoryLabel(module) {
  return CATEGORY_LABELS[module.category] ?? module.category ?? "General";
}

function isLocked(module) {
  return module.core || module.uninstallable === false;
}

// ---- Module icon: supports future logoUrl ----
function ModuleIcon({ module, size = "md" }) {
  const color = module.color ?? "#6366f1";
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
        background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)`,
      }}
    >
      {module.logoUrl ? (
        <img
          src={module.logoUrl}
          alt={module.name}
          className="h-full w-full object-contain rounded-[inherit]"
          draggable={false}
        />
      ) : (
        <span>{module.name.charAt(0)}</span>
      )}
    </div>
  );
}

// ---- Status pill ----
function StatusPill({ module, className }) {
  const isInstalled = module.status === "INSTALLED" && module.enabled;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          isInstalled && "shadow-[0_0_6px_rgba(34,197,94,0.7)]",
        )}
        style={{ backgroundColor: STATUS_DOT[module.status] ?? "#94a3b8" }}
      />
      <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {statusLabel(module)}
      </span>
    </div>
  );
}

// ---- Card primary action (inline on card) ----
function CardAction({
  module,
  canInstallModules,
  canDisableModules,
  onAction,
  onOpen,
}) {
  const canOpen = isModuleAvailable(module);
  const canInstall =
    module.status === "UNINSTALLED" &&
    canInstallModules &&
    module.compatibilityStatus !== "BLOCKED";
  const canEnable =
    module.status === "DISABLED" && !isLocked(module) && canDisableModules;

  if (canOpen) {
    return (
      <Button
        size="sm"
        className="shrink-0 h-7 px-2.5 text-xs gap-1"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(module);
        }}
      >
        Abrir
        <ArrowUpRight className="h-3 w-3" />
      </Button>
    );
  }
  if (canEnable) {
    return (
      <Button
        size="sm"
        className="shrink-0 h-7 px-2.5 text-xs gap-1"
        onClick={(e) => {
          e.stopPropagation();
          onAction("enable", module);
        }}
      >
        Activar
        <Power className="h-3 w-3" />
      </Button>
    );
  }
  if (canInstall) {
    return (
      <Button
        size="sm"
        className="shrink-0 h-7 px-2.5 text-xs gap-1"
        onClick={(e) => {
          e.stopPropagation();
          onAction("install", module);
        }}
      >
        Instalar
      </Button>
    );
  }
  return null;
}

const TYPE_FILTERS = [
  {
    key: "type",
    label: "Tipo",
    options: [
      { value: "core", label: "Core" },
      { value: "feature", label: "Módulo" },
    ],
  },
  {
    key: "compat",
    label: "Compatibilidad",
    options: [
      { value: "ok", label: "Compatible" },
      { value: "blocked", label: "Bloqueado" },
    ],
  },
];

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  { value: "INSTALLED", label: "Instalados" },
  { value: "DISABLED", label: "Deshabilitados" },
  { value: "UNINSTALLED", label: "Sin instalar" },
];

export default function ModuleCatalog() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const isAdmin = Boolean(userProfile?.isAdmin);
  const hasPermission = (key) => isAdmin || permissions.includes(key);
  const canReadModules = hasPermission("core.modules.read");
  const canInstallModules = hasPermission("core.modules.create");
  const canDisableModules = hasPermission("core.modules.update");
  const canUninstallModules = hasPermission("core.modules.delete");

  const modulesQuery = useQuery({
    queryKey: ["modules", token],
    queryFn: () => atlas.modules.list(token),
    enabled: Boolean(token) && canReadModules,
    staleTime: 60000,
  });
  const runtimeModules = useMemo(
    () => mergeRuntimeModules(modulesQuery.data),
    [modulesQuery.data],
  );
  const isLoading = modulesQuery.isLoading;
  const isError = modulesQuery.isError;

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [filterValues, setFilterValues] = useState({});
  const [viewMode, setViewMode] = useState("grid");
  const [selectedModule, setSelectedModule] = useState(null);
  const [confirmUninstall, setConfirmUninstall] = useState(null);
  const [purgeOnUninstall, setPurgeOnUninstall] = useState(false);

  const lifecycleMutation = useMutation({
    mutationFn: async ({ action, module, purge = false }) => {
      const key = module.key;
      if (action === "install") {
        const manifest = module.manifest ?? MANIFEST_BY_KEY.get(key);
        if (!manifest) throw new Error("Manifiesto no disponible.");
        return atlas.modules.install(manifest, token);
      }
      if (action === "disable") return atlas.modules.disable(key, token);
      if (action === "enable") return atlas.modules.enable(key, token);
      if (action === "uninstall") {
        if (purge)
          return atlas.modules.uninstallExplicit(key, "purge-data", "ACEPTO", token);
        return atlas.modules.uninstall(key, token);
      }
    },
    onSuccess: async (_, { action }) => {
      await queryClient.invalidateQueries({ queryKey: ["modules"] });
      await queryClient.invalidateQueries({ queryKey: ["runtime-modules"] });
      await queryClient.invalidateQueries({ queryKey: ["blueprints"] });
      setConfirmUninstall(null);
      setPurgeOnUninstall(false);
      const labels = {
        install: "instalado",
        disable: "deshabilitado",
        enable: "habilitado",
        uninstall: "desinstalado",
      };
      toast.success(`Módulo ${labels[action] ?? "actualizado"}`);
    },
    onError: (err) => {
      try {
        const msg = JSON.parse(err?.message ?? "{}").error;
        toast.error(msg ?? "No se pudo actualizar el módulo");
      } catch {
        toast.error("No se pudo actualizar el módulo");
      }
    },
  });

  function handleAction(action, module) {
    lifecycleMutation.mutate({ action, module });
  }

  const sortedModules = useMemo(
    () =>
      [...runtimeModules].sort((a, b) => {
        if (a.core !== b.core) return a.core ? -1 : 1;
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      }),
    [runtimeModules],
  );

  const counts = useMemo(
    () => ({
      all: sortedModules.length,
      INSTALLED: sortedModules.filter(
        (m) => m.status === "INSTALLED" && m.enabled,
      ).length,
      DISABLED: sortedModules.filter((m) => m.status === "DISABLED").length,
      UNINSTALLED: sortedModules.filter((m) => m.status === "UNINSTALLED")
        .length,
    }),
    [sortedModules],
  );

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedModules.filter((m) => {
      if (
        q &&
        !m.name.toLowerCase().includes(q) &&
        !m.key.toLowerCase().includes(q) &&
        !(m.summary ?? "").toLowerCase().includes(q)
      )
        return false;
      if (activeTab !== "all") {
        if (
          activeTab === "INSTALLED" &&
          !(m.status === "INSTALLED" && m.enabled)
        )
          return false;
        if (activeTab !== "INSTALLED" && m.status !== activeTab) return false;
      }
      if (filterValues.type) {
        const t = m.core ? "core" : "feature";
        if (t !== filterValues.type) return false;
      }
      if (filterValues.compat) {
        const blocked = m.compatibilityStatus === "BLOCKED";
        if (filterValues.compat === "ok" && blocked) return false;
        if (filterValues.compat === "blocked" && !blocked) return false;
      }
      return true;
    });
  }, [sortedModules, search, activeTab, filterValues]);

  const runtimeByKey = useMemo(
    () => new Map(runtimeModules.map((m) => [m.key, m])),
    [runtimeModules],
  );

  useEffect(() => {
    if (!selectedModule?.key) return;
    const fresh = runtimeByKey.get(selectedModule.key);
    if (!fresh || fresh === selectedModule) return;
    setSelectedModule(fresh);
  }, [runtimeByKey, selectedModule]);

  const redirectMessage = location.state?.moduleWarning;

  useEffect(() => {
    if (!redirectMessage) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [redirectMessage, navigate, location.pathname]);

  function openModule(module) {
    if (!isModuleAvailable(module)) return;
    navigate(getModuleLaunchPath(module));
    setSelectedModule(null);
  }

  // ---- Sheet action panel ----
  function SheetActions({ module }) {
    const inFlight =
      lifecycleMutation.isPending &&
      lifecycleMutation.variables?.module?.key === module.key;
    const locked = isLocked(module);
    const canOpen = isModuleAvailable(module);
    const canInstall = module.status === "UNINSTALLED";
    const canDisable =
      module.status === "INSTALLED" && module.enabled && !locked;
    const canEnable = module.status === "DISABLED" && !locked;
    const canUninstall =
      (module.status === "INSTALLED" || module.status === "DISABLED") &&
      !locked;
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Acciones del módulo
        </p>
        {canOpen && (
          <Button
            className="w-full"
            disabled={inFlight}
            onClick={() => openModule(module)}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir módulo
          </Button>
        )}
        {canInstall && (
          <Button
            className="w-full"
            disabled={!canInstallModules || inFlight}
            onClick={() =>
              lifecycleMutation.mutate({ action: "install", module })
            }
          >
            {inFlight ? "Instalando..." : "Instalar módulo"}
          </Button>
        )}
        {canEnable && (
          <Button
            className="w-full"
            disabled={!canDisableModules || inFlight}
            onClick={() =>
              lifecycleMutation.mutate({ action: "enable", module })
            }
          >
            <Power className="h-4 w-4" />
            {inFlight ? "Habilitando..." : "Habilitar"}
          </Button>
        )}
        {canDisable && (
          <Button
            className="w-full"
            variant="outline"
            disabled={!canDisableModules || inFlight}
            onClick={() =>
              lifecycleMutation.mutate({ action: "disable", module })
            }
          >
            <PowerOff className="h-4 w-4" />
            {inFlight ? "Deshabilitando..." : "Deshabilitar"}
          </Button>
        )}
        {canUninstall && (
          <Button
            className="w-full"
            variant="destructive"
            disabled={!canUninstallModules || inFlight}
            onClick={() => {
              setConfirmUninstall(module);
              setSelectedModule(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Desinstalar módulo
          </Button>
        )}
        {locked && !canOpen && (
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded-xl px-3 py-2.5">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Módulo core protegido — no puede modificarse.
          </div>
        )}
        <Button
          className="w-full"
          variant="ghost"
          onClick={() => {
            navigate("/app/home");
            setSelectedModule(null);
          }}
        >
          <Home className="h-4 w-4" />
          Ir al inicio
        </Button>
      </div>
    );
  }

  // ---- Skeleton loading ----
  const skeletons = Array.from({ length: 6 });

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-5">
        <PageHeader
          eyebrow="Atlas Core"
          title="Catálogo de módulos"
          description="Gestiona el ciclo de vida de los módulos de tu instancia Atlas."
        />

        {redirectMessage && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 text-sm px-4 py-3">
            {redirectMessage}
          </div>
        )}

        {!canInstallModules && !canDisableModules && !canUninstallModules && (
          <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-sm px-4 py-2.5 text-[hsl(var(--muted-foreground))]">
            <Info className="h-4 w-4 shrink-0" />
            La gestion del ciclo de vida depende de permisos de core.modules.
          </div>
        )}

        {/* Status tabs */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-0.5">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 gap-0.5">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs gap-1.5"
                >
                  {tab.label}
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[10px] font-medium px-1 tabular-nums">
                    {counts[tab.value] ?? 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Toolbar: search + filters + view toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar módulo, categoría o clave..."
            className="w-full sm:max-w-sm"
          />
          <FilterBar
            filters={TYPE_FILTERS}
            value={filterValues}
            onChange={setFilterValues}
          />

          <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
            {filteredModules.length} resultado
            {filteredModules.length !== 1 ? "s" : ""}
          </span>

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-[hsl(var(--border))] p-0.5 bg-[hsl(var(--muted))]/40">
            <button
              aria-label="Vista cuadrícula"
              onClick={() => setViewMode("grid")}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                viewMode === "grid"
                  ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Vista lista"
              onClick={() => setViewMode("list")}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                viewMode === "list"
                  ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!canReadModules ? (
          <EmptyState
            icon={Lock}
            title="Sin acceso al catalogo"
            description="Necesitas core.modules.read para consultar el catalogo administrativo."
          />
        ) : isLoading ? (
          viewMode === "grid" ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {skeletons.map((_, i) => (
                <Skeleton key={i} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {skeletons.map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )
        ) : isError ? (
          <ErrorState
            title="Error al cargar módulos"
            onRetry={() =>
              queryClient.invalidateQueries({ queryKey: ["modules"] })
            }
          />
        ) : filteredModules.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Sin resultados"
            description="Ningún módulo coincide con los filtros actuales."
            action={{
              label: "Limpiar filtros",
              onClick: () => {
                setSearch("");
                setFilterValues({});
                setActiveTab("all");
              },
            }}
          />
        ) : viewMode === "grid" ? (
          // ---- GRID VIEW ----
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredModules.map((module) => {
              const color = module.color ?? "#6366f1";
              const blocked = module.compatibilityStatus === "BLOCKED";
              const isDisabled = module.status === "DISABLED";
              const inFlight =
                lifecycleMutation.isPending &&
                lifecycleMutation.variables?.module?.key === module.key;

              return (
                <div
                  key={module.key}
                  onClick={() => setSelectedModule(module)}
                  className={cn(
                    "group relative cursor-pointer rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col",
                    "transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]",
                    isDisabled && "opacity-70",
                  )}
                >
                  {/* Gradient header */}
                  <div
                    className="relative h-[72px] overflow-hidden shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${color}22 0%, ${color}08 70%, transparent 100%)`,
                    }}
                  >
                    {/* Decorative blobs */}
                    <div
                      className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12]"
                      style={{ background: color }}
                    />
                    <div
                      className="absolute right-8 top-2 h-10 w-10 rounded-full opacity-[0.08]"
                      style={{ background: color }}
                    />
                    {/* Status top-right */}
                    <div className="absolute top-3 right-3">
                      <StatusPill module={module} />
                    </div>
                    {/* Lock badge top-left */}
                    {module.core && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--background))]/70 backdrop-blur-sm border border-[hsl(var(--border))] rounded-full px-1.5 py-0.5">
                          <Lock className="h-2.5 w-2.5" />
                          Core
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Module icon overlapping header/body boundary */}
                  <div className="px-4 -mt-5 relative z-10 shrink-0">
                    <ModuleIcon module={module} size="md" />
                  </div>

                  {/* Card body */}
                  <div className="flex flex-col flex-1 pt-2 px-4 pb-4 space-y-2.5">
                    {/* Name + publisher */}
                    <div>
                      <p className="text-sm font-bold leading-tight truncate">
                        {module.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                          {getPublisher(module)}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed line-clamp-3 flex-1">
                      {module.description ||
                        module.summary ||
                        "Sin descripción disponible para este módulo."}
                    </p>

                    {/* Footer: meta + action */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {/* Category */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-full px-1.5 py-0.5 shrink-0">
                          <Tag className="h-2.5 w-2.5" />
                          {getCategoryLabel(module)}
                        </span>
                        {/* Version */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-full px-1.5 py-0.5 shrink-0">
                          <GitBranch className="h-2.5 w-2.5" />v{module.version}
                        </span>
                        {/* Blocked */}
                        {blocked && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-1.5 py-0.5 shrink-0">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Bloqueado
                          </span>
                        )}
                      </div>
                      {!inFlight && (
                        <CardAction
                          module={module}
                          canInstallModules={canInstallModules}
                          canDisableModules={canDisableModules}
                          onAction={handleAction}
                          onOpen={openModule}
                        />
                      )}
                      {inFlight && (
                        <span className="text-xs text-[hsl(var(--muted-foreground))] animate-pulse shrink-0">
                          Procesando...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ---- LIST VIEW ----
          <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden divide-y divide-[hsl(var(--border))]">
            {filteredModules.map((module, idx) => {
              const color = module.color ?? "#6366f1";
              const blocked = module.compatibilityStatus === "BLOCKED";
              const isDisabled = module.status === "DISABLED";
              const inFlight =
                lifecycleMutation.isPending &&
                lifecycleMutation.variables?.module?.key === module.key;

              return (
                <div
                  key={module.key}
                  onClick={() => setSelectedModule(module)}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 cursor-pointer bg-[hsl(var(--card))]",
                    "transition-colors duration-150 hover:bg-[hsl(var(--muted))]/50",
                    isDisabled && "opacity-70",
                    idx === 0 && "rounded-t-2xl",
                    idx === filteredModules.length - 1 && "rounded-b-2xl",
                  )}
                >
                  {/* Icon */}
                  <ModuleIcon module={module} size="sm" />

                  {/* Name + key */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {module.name}
                      </p>
                      {module.core && (
                        <Lock className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                      {getPublisher(module)} · {module.key}
                    </p>
                  </div>

                  {/* Category */}
                  <span className="hidden md:inline-flex text-[11px] text-[hsl(var(--muted-foreground))] font-medium border border-[hsl(var(--border))] rounded-full px-2 py-0.5 shrink-0">
                    {getCategoryLabel(module)}
                  </span>

                  {/* Version */}
                  <span className="hidden lg:inline text-[11px] text-[hsl(var(--muted-foreground))] font-mono shrink-0">
                    v{module.version}
                  </span>

                  {/* Status */}
                  <StatusPill
                    module={module}
                    className="hidden sm:flex shrink-0"
                  />

                  {/* Blocked badge */}
                  {blocked && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-1.5 py-0.5 shrink-0">
                      <AlertCircle className="h-2.5 w-2.5" />
                      Bloqueado
                    </span>
                  )}

                  {/* Action */}
                  <div
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!inFlight ? (
                      <CardAction
                        module={module}
                        canInstallModules={canInstallModules}
                        canDisableModules={canDisableModules}
                        onAction={handleAction}
                        onOpen={openModule}
                      />
                    ) : (
                      <span className="text-xs text-[hsl(var(--muted-foreground))] animate-pulse">
                        Procesando...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Module detail sheet */}
      <Sheet
        open={Boolean(selectedModule)}
        onOpenChange={(v) => !v && setSelectedModule(null)}
      >
        <SheetContent className="w-full sm:max-w-md lg:max-w-xl xl:max-w-2xl overflow-y-auto">
          {selectedModule &&
            (() => {
              const color = selectedModule.color ?? "#6366f1";
              const blocked = selectedModule.compatibilityStatus === "BLOCKED";
              return (
                <div className="space-y-5">
                  {/* Hero header */}
                  <div
                    className="rounded-2xl p-5 flex items-start gap-4 -mx-1 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${color}18 0%, ${color}06 100%)`,
                    }}
                  >
                    <div
                      className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10"
                      style={{ background: color }}
                    />
                    <ModuleIcon module={selectedModule} size="lg" />
                    <div className="min-w-0 flex-1 pt-1">
                      <SheetHeader className="p-0">
                        <SheetTitle className="text-xl leading-tight text-left">
                          {selectedModule.name}
                        </SheetTitle>
                      </SheetHeader>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {getPublisher(selectedModule)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status + badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-2.5 py-1">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          selectedModule.status === "INSTALLED" &&
                            selectedModule.enabled &&
                            "shadow-[0_0_6px_rgba(34,197,94,0.65)]",
                        )}
                        style={{
                          backgroundColor:
                            STATUS_DOT[selectedModule.status] ?? "#94a3b8",
                        }}
                      />
                      <span className="text-xs font-medium">
                        {statusLabel(selectedModule)}
                      </span>
                    </div>
                    {selectedModule.core && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                        <Lock className="h-3 w-3" />
                        Protegido
                      </span>
                    )}
                    {blocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/45 dark:border-red-400/35 bg-red-500/20 dark:bg-red-400/20 px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-200">
                        <AlertCircle className="h-3 w-3" />
                        Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/45 dark:border-emerald-400/35 bg-emerald-500/20 dark:bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Compatible
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {(selectedModule.description || selectedModule.summary) && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                        Descripción
                      </p>
                      <p className="text-sm leading-relaxed text-[hsl(var(--foreground))]">
                        {selectedModule.description || selectedModule.summary}
                      </p>
                    </div>
                  )}

                  {/* Metadata grid */}
                  <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden divide-y divide-[hsl(var(--border))]">
                    {[
                      {
                        label: "Tipo",
                        value:
                          KIND_LABEL[selectedModule.kind] ??
                          selectedModule.kind,
                      },
                      {
                        label: "Categoría",
                        value: getCategoryLabel(selectedModule),
                      },
                      { label: "Versión", value: `v${selectedModule.version}` },
                      {
                        label: "Publicado por",
                        value: getPublisher(selectedModule),
                      },
                      { label: "Clave técnica", value: selectedModule.key },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between px-3 py-2.5 gap-4"
                      >
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                          {label}
                        </span>
                        <span className="text-xs font-medium text-right font-mono truncate max-w-[60%]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Dependencies */}
                  {selectedModule.compatibility?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                        Dependencias
                      </p>
                      <div className="space-y-1.5">
                        {selectedModule.compatibility.map((dep) => (
                          <div
                            key={dep.key}
                            className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-3 py-2.5 gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">
                                {dep.name || dep.key}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                {dep.required ? "Requerida" : "Opcional"}
                                {dep.versionRange
                                  ? ` · ${dep.versionRange}`
                                  : ""}
                              </p>
                            </div>
                            <Badge
                              variant={
                                dep.active
                                  ? "success"
                                  : dep.required
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="shrink-0 text-xs"
                            >
                              {dep.active
                                ? "Activa"
                                : dep.required
                                  ? "Falta"
                                  : "Inactiva"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="border-t border-[hsl(var(--border))] pt-4">
                    <SheetActions module={selectedModule} />
                  </div>
                </div>
              );
            })()}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirmUninstall)}
        onOpenChange={(v) => {
          if (!v) {
            setConfirmUninstall(null);
            setPurgeOnUninstall(false);
          }
        }}
        title="¿Desinstalar módulo?"
        description="El módulo será desinstalado. Esta acción no se puede deshacer."
        detail={confirmUninstall?.name}
        confirmLabel="Desinstalar"
        onConfirm={() =>
          lifecycleMutation.mutate({
            action: "uninstall",
            module: confirmUninstall,
            purge: purgeOnUninstall,
          })
        }
        loading={lifecycleMutation.isPending}
      >
        {confirmUninstall?.manifest?.lifecycle?.supportsDataPurge && (
          <label className="flex items-start gap-3 rounded-md border border-[hsl(var(--border))] p-3 cursor-pointer hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 accent-red-500"
              checked={purgeOnUninstall}
              onChange={(e) => setPurgeOnUninstall(e.target.checked)}
            />
            <span className="text-sm leading-snug">
              <span className="font-medium text-[hsl(var(--foreground))]">
                Eliminar todos los datos
              </span>
              <span className="block text-[hsl(var(--muted-foreground))]">
                Se borrarán permanentemente todos los registros de este módulo.
              </span>
            </span>
          </label>
        )}
      </ConfirmDialog>
    </div>
  );
}

