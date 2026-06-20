import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Checkbox,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TextField,
  cn,
  LoadingState,
} from "@atlas/ui";
import {
  Home,
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
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Database,
  Sprout,
  Upload,
  Package,
} from "lucide-react";
import {
  ModuleIcon,
  resolveModuleVisuals,
  toAlphaHexColor,
} from "../../../components/ModuleCard";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { UploadModuleSheet } from "./UploadModuleSheet";
import {
  CATEGORY_LABELS,
  getModuleLaunchPath,
  isModuleAvailable,
  mergeRuntimeModules,
} from "../../../lib/runtimeModules";

// ModuleIcon, resolveModuleVisuals, toAlphaHexColor imported from @/components/ModuleCard

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

const ERROR_STAGE_LABEL = {
  validation: "Validación",
  dependency_sync: "Dependencias",
  orm_migration: "Migración ORM",
  manifest_migration: "Migración manifiesto",
  install: "Instalación",
  route_loader: "Carga de rutas",
  unknown: "Desconocido",
};

function getFirstFiniteNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function statusLabel(module) {
  if (module.core) return "Core";
  if (module.updateAvailable) return "Actualización disponible";
  if (module.status === "INSTALLED" && module.enabled) return "Instalado";
  if (module.status === "DISABLED") return "Deshabilitado";
  if (module.status === "UNINSTALLED") return "Sin instalar";
  if (module.status === "ERROR") return "Error";
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

function getModuleErrorSummary(module) {
  if (module?.status !== "ERROR") return null;
  const lastError =
    module.lastError ?? module.lifecycleConfig?.lastError ?? null;
  if (!lastError) {
    return {
      message: "No hay detalle de error disponible para este módulo.",
      stageLabel: null,
      code: null,
    };
  }
  const message = String(lastError.message ?? "").trim();
  return {
    message:
      message.length > 220
        ? `${message.slice(0, 220)}...`
        : message || "No hay detalle de error disponible para este módulo.",
    stageLabel: lastError.stage
      ? (ERROR_STAGE_LABEL[lastError.stage] ?? String(lastError.stage))
      : null,
    code: lastError.code ? String(lastError.code) : null,
  };
}

function buildModuleErrorDetail(module, lastError) {
  if (!lastError || typeof lastError !== "object") {
    return {
      title: module?.name ?? module?.key ?? "Módulo",
      summary: "No hay diagnóstico detallado de error disponible.",
      copyText: `Módulo: ${module?.name ?? "-"}\nClave: ${module?.key ?? "-"}\n\nNo hay diagnóstico detallado de error disponible.`,
      raw: null,
    };
  }

  const stage = lastError?.stage ? String(lastError.stage) : null;
  const stageLabel = stage ? (ERROR_STAGE_LABEL[stage] ?? stage) : null;
  const code = lastError?.code ? String(lastError.code) : null;
  const requestId = lastError?.requestId ? String(lastError.requestId) : null;
  const failedAt = lastError?.failedAt ? String(lastError.failedAt) : null;
  const retryable =
    typeof lastError?.retryable === "boolean"
      ? lastError.retryable
        ? "Sí"
        : "No"
      : null;
  const affectedTables = Array.isArray(lastError?.affectedTables)
    ? lastError.affectedTables.filter(Boolean).map(String)
    : [];
  const affectedMigrations = Array.isArray(lastError?.affectedMigrations)
    ? lastError.affectedMigrations.filter(Boolean).map(String)
    : [];
  const message =
    String(lastError?.message ?? "").trim() || "Sin mensaje de error.";
  const cause = String(lastError?.cause ?? "").trim() || null;

  const lines = [
    `Módulo: ${module?.name ?? "-"}`,
    `Clave: ${module?.key ?? "-"}`,
    stageLabel ? `Etapa: ${stageLabel}` : null,
    code ? `Código: ${code}` : null,
    requestId ? `RequestId: ${requestId}` : null,
    failedAt ? `Fecha: ${failedAt}` : null,
    retryable ? `Reintentable: ${retryable}` : null,
    "",
    `Mensaje: ${message}`,
    cause ? `Causa: ${cause}` : null,
    affectedTables.length > 0
      ? `Tablas afectadas: ${affectedTables.join(", ")}`
      : null,
    affectedMigrations.length > 0
      ? `Migraciones afectadas: ${affectedMigrations.join(", ")}`
      : null,
    "",
    "Payload JSON:",
    JSON.stringify(lastError, null, 2),
  ].filter(Boolean);

  return {
    title: module?.name ?? module?.key ?? "Módulo",
    summary: message,
    copyText: lines.join("\n"),
    raw: lastError,
  };
}

// ---- ModuleIcon is imported from ../../../components/ModuleCard ----

// ---- Status pill ----
function StatusPill({ module, className }) {
  const isInstalled =
    module.status === "INSTALLED" && module.enabled && !module.updateAvailable;
  const dotColor = module.updateAvailable
    ? "#0ea5e9"
    : (STATUS_DOT[module.status] ?? "#94a3b8");
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          isInstalled && "shadow-[0_0_6px_rgba(34,197,94,0.7)]",
          module.updateAvailable && "shadow-[0_0_6px_rgba(14,165,233,0.7)]",
        )}
        style={{ backgroundColor: dotColor }}
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
  onViewError,
}) {
  const canOpen = isModuleAvailable(module);
  const canSyncModule = canOpen && module.updateAvailable && canInstallModules;
  const canInstall =
    module.status === "UNINSTALLED" &&
    canInstallModules &&
    module.compatibilityStatus !== "BLOCKED";
  const canEnable =
    module.status === "DISABLED" && !isLocked(module) && canDisableModules;
  const canRetryInstall =
    module.status === "ERROR" && !isLocked(module) && canInstallModules;

  if (canSyncModule) {
    return (
      <Button
        size="sm"
        className="shrink-0 h-7 px-2.5 text-xs gap-1 bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
        onClick={(e) => {
          e.stopPropagation();
          onAction("sync-module", module);
        }}
      >
        Sincronizar
        <RefreshCw className="h-3 w-3" />
      </Button>
    );
  }
  if (canOpen) {
    return (
      <Button
        size="sm"
        className="shrink-0 h-7 px-2.5 text-xs gap-1 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
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
        className="shrink-0 h-7 px-2.5 text-xs gap-1 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
        onClick={(e) => {
          e.stopPropagation();
          onAction("install", module);
        }}
      >
        Instalar
      </Button>
    );
  }
  if (canRetryInstall) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          className="shrink-0 h-7 px-2.5 text-xs gap-1 bg-amber-400 text-amber-950 hover:bg-amber-500 dark:bg-amber-300 dark:hover:bg-amber-200"
          onClick={(e) => {
            e.stopPropagation();
            onAction("retry-install", module);
          }}
        >
          Reintentar
        </Button>
        {onViewError && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 px-2.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onViewError(module);
            }}
          >
            Ver detalles
          </Button>
        )}
      </div>
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
  const canUploadModules = hasPermission("core.modules.upload");
  const canPurgeModules = hasPermission("core.modules.purge");

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

  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [filterValues, setFilterValues] = useState({});
  const [viewMode, setViewMode] = useState("grid");
  const [selectedModule, setSelectedModule] = useState(null);
  const [confirmUninstall, setConfirmUninstall] = useState(null);
  const [purgeOnUninstall, setPurgeOnUninstall] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(null);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const [confirmDbPurge, setConfirmDbPurge] = useState(null);
  const [errorDialog, setErrorDialog] = useState({
    open: false,
    module: null,
    loading: false,
    detail: null,
  });

  const lifecycleMutation = useMutation({
    mutationFn: async ({ action, module, purge = false, mode }) => {
      const key = module.key;
      if (action === "install") {
        const manifest = module.manifest;
        if (!manifest) throw new Error("Manifiesto no disponible.");
        return atlas.modules.install(manifest, token);
      }
      if (action === "retry-install")
        return atlas.modules.retryInstall(key, token);
      if (action === "clear-error")
        return atlas.modules.clearError(key, mode ?? "preserve-data", token);
      if (action === "cleanup")
        return atlas.modules.cleanup(
          key,
          "purge-empty-tables",
          cleanupConfirmation,
          token,
        );
      if (action === "disable") return atlas.modules.disable(key, token);
      if (action === "enable") return atlas.modules.enable(key, token);
      if (action === "sync-module") {
        return atlas.modules.sync(token, { autoRepair: true, moduleKey: key });
      }
      if (action === "uninstall") {
        if (purge) {
          const policy = module?.manifest?.lifecycle?.defaultUninstallPolicy;
          const uninstallMode =
            policy === "purge-owned-tables"
              ? "purge-owned-tables"
              : "purge-data";
          return atlas.modules.uninstallExplicit(
            key,
            uninstallMode,
            "ACEPTO",
            token,
          );
        }
        return atlas.modules.uninstall(key, token);
      }
      if (action === "purge-orphaned-tables") {
        return atlas.modules.uninstallExplicit(
          key,
          "purge-owned-tables",
          "ACEPTO",
          token,
        );
      }
      if (action === "seed") return atlas.modules.seed(key, token);
    },
    onMutate: ({ action }) => {
      const loadingLabels = {
        install: "Instalando módulo...",
        "retry-install": "Reintentando instalación...",
        "clear-error": "Restaurando estado del módulo...",
        cleanup: "Limpiando intento fallido...",
        disable: "Deshabilitando módulo...",
        enable: "Habilitando módulo...",
        "sync-module": "Sincronizando módulo...",
        uninstall: "Desinstalando módulo...",
        "purge-orphaned-tables": "Purgando tablas del módulo...",
        seed: "Ejecutando seed...",
      };
      const toastId = toast.loading(
        loadingLabels[action] ?? "Procesando módulo...",
      );
      return { toastId };
    },
    onSuccess: async (_, { action }, context) => {
      await queryClient.invalidateQueries({ queryKey: ["modules"] });
      await queryClient.invalidateQueries({ queryKey: ["runtime-modules"] });
      await queryClient.invalidateQueries({ queryKey: ["blueprints"] });
      await queryClient.invalidateQueries({
        queryKey: ["module-orphan-tables"],
      });
      setConfirmUninstall(null);
      setPurgeOnUninstall(false);
      setConfirmCleanup(null);
      setCleanupConfirmation("");
      setConfirmDbPurge(null);
      const labels = {
        install: "instalado",
        "retry-install": "reinstalado",
        "clear-error": "restaurado a sin instalar",
        cleanup: "limpiado",
        disable: "deshabilitado",
        enable: "habilitado",
        "sync-module": "sincronizado",
        uninstall: "desinstalado",
        "purge-orphaned-tables": "purgado de la base de datos",
        seed: "seed ejecutado",
      };
      toast.success(`Módulo ${labels[action] ?? "actualizado"}`, {
        id: context?.toastId,
      });
    },
    onError: (err, _vars, context) => {
      const fallback = "No se pudo actualizar el módulo";
      try {
        const msg = JSON.parse(err?.message ?? "{}").error;
        toast.error(msg ?? fallback, { id: context?.toastId });
      } catch {
        toast.error(err?.message || fallback, { id: context?.toastId });
      }
    },
  });

  const syncCatalogMutation = useMutation({
    mutationFn: (vars) =>
      atlas.modules.sync(token, { autoRepair: true, ...(vars ?? {}) }),
    onMutate: (vars) => {
      const toastId = toast.loading(
        vars?.moduleKey
          ? `Sincronizando ${vars.moduleKey}...`
          : "Sincronizando módulos...",
      );
      return { toastId, moduleKey: vars?.moduleKey ?? null };
    },
    onSuccess: async (result, _vars, context) => {
      await queryClient.invalidateQueries({ queryKey: ["modules"] });
      await queryClient.invalidateQueries({ queryKey: ["runtime-modules"] });
      await queryClient.invalidateQueries({ queryKey: ["blueprints"] });
      const summary = result?.summary ?? result?.data ?? result ?? {};
      const totals = summary?.totals ?? {};
      const automation = summary?.automation ?? {};
      const discovered = getFirstFiniteNumber(
        summary?.discovered,
        totals?.discovered,
      );
      const valid = getFirstFiniteNumber(summary?.valid, totals?.valid);
      const invalid = getFirstFiniteNumber(
        summary?.invalid,
        totals?.invalid,
        summary?.errored,
        totals?.errored,
      );
      const hasCounts = [discovered, valid, invalid].every((n) => n !== null);
      const scope = summary?.scope ?? {};
      const scopedModuleKey = scope?.moduleKey ?? context?.moduleKey ?? null;
      const autoSummary =
        automation?.autoRepairEnabled === true
          ? ` Auto: ${Number(automation?.modulesScanned ?? 0)} escaneados, ${Number(automation?.checksumsFixed ?? 0)} checksums corregidos, ${Number(automation?.versionsBumped ?? 0)} versiones ajustadas, ${Number(automation?.reinstalled ?? 0)} reinstalados, ${Number(automation?.failed ?? 0)} fallidos.`
          : "";
      const failedModules = Array.isArray(automation?.failedModules)
        ? automation.failedModules
        : [];

      if (hasCounts) {
        const scopePrefix = scopedModuleKey
          ? `Módulo sincronizado (${scopedModuleKey}): `
          : "Catálogo sincronizado: ";
        const message = `${scopePrefix}${discovered} descubierto${discovered === 1 ? "" : "s"}, ${valid} válido${valid === 1 ? "" : "s"}, ${invalid} inválido${invalid === 1 ? "" : "s"}.${autoSummary}`;
        if (Number(automation?.failed ?? 0) > 0) {
          toast.warning(message, {
            id: context?.toastId,
            action: {
              label: "Ver detalle",
              onClick: () => {
                const detail = failedModules
                  .map((item) => {
                    const key = item?.key ?? "módulo";
                    const stage = item?.stage ? ` (${item.stage})` : "";
                    const msg = item?.message ?? "Error desconocido";
                    return `${key}${stage}: ${msg}`;
                  })
                  .join(" | ");
                toast.error(
                  detail || "Hay errores en la automatización de módulos.",
                );
              },
            },
          });
          return;
        }

        toast.success(message, { id: context?.toastId });
      } else {
        const scopePrefix = scopedModuleKey
          ? `Módulo sincronizado (${scopedModuleKey})`
          : "Catálogo sincronizado correctamente";
        toast.success(`${scopePrefix}.${autoSummary}`, {
          id: context?.toastId,
        });
      }
    },
    onError: (error, _vars, context) => {
      if (error?.status === 403) {
        toast.error(
          "No tienes permisos para sincronizar el catálogo de módulos.",
          { id: context?.toastId },
        );
        return;
      }
      toast.error("No se pudo sincronizar el catálogo de módulos.", {
        id: context?.toastId,
      });
    },
  });

  async function handleViewError(module) {
    setErrorDialog({
      open: true,
      module,
      loading: true,
      detail: null,
    });
    try {
      const response = await atlas.modules.getError(module.key, token);
      const err = response?.data?.lastError;
      const fallback =
        module?.lastError ?? module?.lifecycleConfig?.lastError ?? null;
      const detail = buildModuleErrorDetail(module, err ?? fallback);
      setErrorDialog({
        open: true,
        module,
        loading: false,
        detail,
      });
    } catch {
      const fallback =
        module?.lastError ?? module?.lifecycleConfig?.lastError ?? null;
      setErrorDialog({
        open: true,
        module,
        loading: false,
        detail: buildModuleErrorDetail(module, fallback),
      });
    }
  }

  async function handleCopyErrorDetails() {
    const text = String(errorDialog?.detail?.copyText ?? "").trim();
    if (!text) {
      toast.error("No hay detalle para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Detalle copiado al portapapeles.");
    } catch {
      toast.error("No se pudo copiar automáticamente.");
    }
  }

  function handleAction(action, module, options = {}) {
    lifecycleMutation.mutate({ action, module, ...options });
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
    const canSyncModule =
      canOpen && module.updateAvailable && canInstallModules;
    const canInstall = module.status === "UNINSTALLED";
    const canDisable =
      module.status === "INSTALLED" && module.enabled && !locked;
    const canEnable = module.status === "DISABLED" && !locked;
    const canRetryInstall = module.status === "ERROR" && !locked;
    const canClearError = module.status === "ERROR" && !locked;
    const canCleanupFailedInstall =
      module.status === "ERROR" &&
      !locked &&
      canUninstallModules &&
      Array.isArray(module?.lifecycleConfig?.ownedTables) &&
      module.lifecycleConfig.ownedTables.length > 0;
    const canUninstall =
      (module.status === "INSTALLED" || module.status === "DISABLED") &&
      !locked;
    const canPurge =
      canPurgeModules &&
      (module.status === "UNINSTALLED" || module.status === "DISABLED") &&
      !module.core;
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    async function handlePurge() {
      if (!token) return;
      setIsPurging(true);
      const toastId = toast.loading(`Purgando ${module.name}...`);
      try {
        const result = await atlas.modules.purgeModule(module.key, token);
        if (result?.error) {
          toast.error(result.error, { id: toastId });
          return;
        }
        toast.success(`Módulo ${module.name} eliminado del servidor`, {
          id: toastId,
        });
        setSelectedModule(null);
        queryClient.invalidateQueries({ queryKey: ["modules"] });
        queryClient.invalidateQueries({ queryKey: ["runtime-modules"] });
      } catch (err) {
        toast.error("Error al purgar el módulo", {
          id: toastId,
          description: err?.message ?? "Error desconocido",
        });
      } finally {
        setIsPurging(false);
        setPurgeDialogOpen(false);
      }
    }
    const couldHaveOrphanedTables =
      module.status === "UNINSTALLED" &&
      !locked &&
      canUninstallModules &&
      ((Array.isArray(module?.lifecycleConfig?.ownedTables) &&
        module.lifecycleConfig.ownedTables.length > 0) ||
        module?.manifest?.lifecycle?.defaultUninstallPolicy ===
          "purge-owned-tables");

    const orphanQuery = useQuery({
      queryKey: ["module-orphan-tables", module.key],
      queryFn: () =>
        atlas.modules.uninstallDryRun(module.key, token, "purge-owned-tables"),
      enabled: Boolean(couldHaveOrphanedTables && token),
      staleTime: 60000,
      retry: false,
    });

    const hasOrphanedTables = (
      orphanQuery.data?.data?.ownedTablePurge?.tableChecks ?? []
    ).some((t) => t.exists);
    const canPurgeOrphanedTables = couldHaveOrphanedTables && hasOrphanedTables;
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Acciones del módulo
        </p>
        {canOpen && (
          <Button
            className="w-full bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            disabled={inFlight}
            onClick={() => openModule(module)}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir módulo
          </Button>
        )}
        {canSyncModule && (
          <Button
            className="w-full bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
            disabled={inFlight}
            onClick={() =>
              lifecycleMutation.mutate({ action: "sync-module", module })
            }
          >
            <RefreshCw className="h-4 w-4" />
            {inFlight ? "Sincronizando..." : "Sincronizar este módulo"}
          </Button>
        )}
        {!locked && module.status === "INSTALLED" && module.enabled && (
          <Button
            className="w-full"
            variant="outline"
            disabled={inFlight}
            onClick={() => lifecycleMutation.mutate({ action: "seed", module })}
          >
            <Sprout className="h-4 w-4" />
            {inFlight ? "Ejecutando..." : "Ejecutar seed"}
          </Button>
        )}
        {canInstall && (
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            disabled={!canInstallModules || inFlight}
            onClick={() =>
              lifecycleMutation.mutate({ action: "install", module })
            }
          >
            {inFlight ? "Instalando..." : "Instalar módulo"}
          </Button>
        )}
        {canRetryInstall && (
          <Button
            className="w-full bg-amber-400 text-amber-950 hover:bg-amber-500 dark:bg-amber-300 dark:hover:bg-amber-200"
            disabled={!canInstallModules || inFlight}
            onClick={() =>
              lifecycleMutation.mutate({ action: "retry-install", module })
            }
          >
            <RefreshCw className="h-4 w-4" />
            {inFlight ? "Reintentando..." : "Reintentar instalación"}
          </Button>
        )}
        {canClearError && (
          <Button
            className="w-full"
            variant="outline"
            disabled={!canDisableModules || inFlight}
            onClick={() =>
              lifecycleMutation.mutate({
                action: "clear-error",
                module,
                mode: "preserve-data",
              })
            }
          >
            Restaurar a sin instalar
          </Button>
        )}
        {canCleanupFailedInstall && (
          <Button
            className="w-full"
            variant="outline"
            disabled={inFlight}
            onClick={() => {
              setConfirmCleanup(module);
              setSelectedModule(null);
            }}
          >
            Limpiar intento fallido
          </Button>
        )}
        {module.status === "ERROR" && (
          <Button
            className="w-full"
            variant="outline"
            disabled={inFlight}
            onClick={() => handleViewError(module)}
          >
            Ver error
          </Button>
        )}
        {canEnable && (
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
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
        {canPurgeOrphanedTables && (
          <Button
            className="w-full"
            variant="outline"
            disabled={inFlight}
            onClick={() => {
              setConfirmDbPurge(module);
              setSelectedModule(null);
            }}
          >
            <Database className="h-4 w-4 text-red-500" />
            <span className="text-red-600 dark:text-red-400">
              Purgar tablas de base de datos
            </span>
          </Button>
        )}
        {locked && !canOpen && (
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded-xl px-3 py-2.5">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Módulo core protegido — no puede modificarse.
          </div>
        )}
        {canPurge && (
          <>
            <div className="border-t border-[hsl(var(--border))] pt-3 mt-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
                Zona de peligro
              </p>
              <Button
                className="w-full border-red-500/50 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                variant="outline"
                disabled={isPurging || inFlight}
                onClick={() => setPurgeDialogOpen(true)}
              >
                Eliminar módulo del servidor
              </Button>
            </div>
            <ConfirmDialog
              open={purgeDialogOpen}
              onOpenChange={setPurgeDialogOpen}
              title="Eliminar módulo del servidor"
              description={`Esta acción elimina permanentemente todos los archivos de "${module.name}" del servidor y su registro en la base de datos. No se puede deshacer.`}
              confirmLabel="Eliminar permanentemente"
              cancelLabel="Cancelar"
              loading={isPurging}
              onConfirm={handlePurge}
            />
          </>
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
          actions={
            <div className="flex items-center gap-2">
              {canUploadModules && (
                <Button
                  variant="outline"
                  onClick={() => setUploadSheetOpen(true)}
                >
                  <Upload className="h-4 w-4" />
                  Subir módulo
                </Button>
              )}
              <Button
                variant="default"
                className="bg-(--brand-primary) text-(--brand-primary-foreground) hover:bg-(--brand-primary-hover) shadow-sm"
                disabled={
                  syncCatalogMutation.isPending || !canReadModules || !token
                }
                onClick={() => syncCatalogMutation.mutate()}
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    syncCatalogMutation.isPending && "animate-spin",
                  )}
                />
                {syncCatalogMutation.isPending
                  ? "Sincronizando..."
                  : "Sincronizar módulos"}
              </Button>
            </div>
          }
        />

        {redirectMessage && (
          <div className="rounded-xl border border-amber-400 dark:border-amber-800 bg-amber-100 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-sm px-4 py-3">
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
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredModules.map((module) => {
              const visuals = resolveModuleVisuals(module);
              const color = visuals.color;
              const accentColor = visuals.accentColor;
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
                    className="relative h-18 overflow-hidden shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${toAlphaHexColor(color, "22")} 0%, ${toAlphaHexColor(accentColor, "08")} 70%, transparent 100%)`,
                    }}
                  >
                    {/* Decorative blobs */}
                    <div
                      className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12]"
                      style={{ background: accentColor }}
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
                        {module.updateAvailable && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-full px-1.5 py-0.5 shrink-0">
                            <RefreshCw className="h-2.5 w-2.5" />
                            Actualización pendiente
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
                          onViewError={handleViewError}
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
                  {module.updateAvailable && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-full px-1.5 py-0.5 shrink-0">
                      <RefreshCw className="h-2.5 w-2.5" />
                      Pendiente
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
                        onViewError={handleViewError}
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
              const visuals = resolveModuleVisuals(selectedModule);
              const color = visuals.color;
              const accentColor = visuals.accentColor;
              const blocked = selectedModule.compatibilityStatus === "BLOCKED";
              return (
                <div className="space-y-5">
                  {/* Hero header */}
                  <div
                    className="rounded-2xl p-5 flex items-start gap-4 -mx-1 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${toAlphaHexColor(color, "18")} 0%, ${toAlphaHexColor(accentColor, "06")} 100%)`,
                    }}
                  >
                    <div
                      className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10"
                      style={{ background: accentColor }}
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
                    {selectedModule.updateAvailable && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/45 dark:border-sky-400/35 bg-sky-500/20 dark:bg-sky-400/20 px-2.5 py-1 text-xs font-medium text-sky-800 dark:text-sky-200">
                        <RefreshCw className="h-3 w-3" />
                        Actualización pendiente
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
                      ...(selectedModule.localVersion &&
                      selectedModule.localVersion !== selectedModule.version
                        ? [
                            {
                              label: "Versión local",
                              value: `v${selectedModule.localVersion}`,
                            },
                          ]
                        : []),
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

      <Dialog
        open={Boolean(errorDialog.open)}
        onOpenChange={(open) => {
          if (!open) {
            setErrorDialog({
              open: false,
              module: null,
              loading: false,
              detail: null,
            });
          }
        }}
      >
        <DialogContent className="w-full sm:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del error del módulo</DialogTitle>
            <DialogDescription>
              {errorDialog?.module?.name ?? "Módulo"} ·{" "}
              {errorDialog?.module?.key ?? "-"}
            </DialogDescription>
          </DialogHeader>
          {errorDialog.loading ? (
            <LoadingState message="Cargando diagnóstico..." />
          ) : (
            <div className="space-y-3">
              {errorDialog?.detail?.raw && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {errorDialog.detail.raw.stage && (
                    <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5">
                      Etapa:{" "}
                      {ERROR_STAGE_LABEL[errorDialog.detail.raw.stage] ??
                        String(errorDialog.detail.raw.stage)}
                    </span>
                  )}
                  {errorDialog.detail.raw.code && (
                    <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 font-mono">
                      {String(errorDialog.detail.raw.code)}
                    </span>
                  )}
                  {errorDialog.detail.raw.requestId && (
                    <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 font-mono">
                      RequestId: {String(errorDialog.detail.raw.requestId)}
                    </span>
                  )}
                </div>
              )}
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
                <pre className="max-h-80 overflow-auto p-3 text-xs leading-relaxed whitespace-pre-wrap break-words font-mono">
                  {errorDialog?.detail?.copyText ??
                    "No hay detalle de error disponible."}
                </pre>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyErrorDetails}
                >
                  Copiar detalle
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
          <div
            className="flex items-start gap-3 rounded-md border border-[hsl(var(--border))] p-3 cursor-pointer hover:bg-[hsl(var(--muted)/0.4)] transition-colors"
            onClick={() => setPurgeOnUninstall((v) => !v)}
          >
            <Checkbox
              className="mt-0.5"
              checked={purgeOnUninstall}
              onCheckedChange={(v) => setPurgeOnUninstall(Boolean(v))}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-sm leading-snug">
              <span className="font-medium text-[hsl(var(--foreground))]">
                Eliminar todos los datos
              </span>
              <span className="block text-[hsl(var(--muted-foreground))]">
                {confirmUninstall?.manifest?.lifecycle
                  ?.defaultUninstallPolicy === "purge-owned-tables"
                  ? "Se eliminarán permanentemente todos los datos y tablas propias de este módulo."
                  : "Se borrarán permanentemente todos los registros de este módulo."}
              </span>
            </span>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(confirmCleanup)}
        onOpenChange={(v) => {
          if (!v) {
            setConfirmCleanup(null);
            setCleanupConfirmation("");
          }
        }}
        title="¿Limpiar intento fallido?"
        description='Esta limpieza puede eliminar tablas vacías del módulo. Escribe "ACEPTO" para confirmar.'
        detail={confirmCleanup?.name}
        confirmLabel="Limpiar"
        onConfirm={() => {
          if (cleanupConfirmation.trim() !== "ACEPTO") {
            toast.error('Debes escribir "ACEPTO" para continuar.');
            return;
          }
          lifecycleMutation.mutate({
            action: "cleanup",
            module: confirmCleanup,
          });
        }}
        loading={lifecycleMutation.isPending}
      >
        <TextField
          label="Confirmación"
          value={cleanupConfirmation}
          onChange={(e) => setCleanupConfirmation(e.target.value)}
          placeholder='Escribe "ACEPTO"'
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(confirmDbPurge)}
        onOpenChange={(v) => {
          if (!v) setConfirmDbPurge(null);
        }}
        title="¿Purgar tablas de la base de datos?"
        description="El módulo está desinstalado pero puede tener tablas residuales en la base de datos. Esta acción las eliminará permanentemente junto con todos sus datos. No se puede deshacer."
        detail={confirmDbPurge?.name}
        confirmLabel="Purgar base de datos"
        onConfirm={() =>
          lifecycleMutation.mutate({
            action: "purge-orphaned-tables",
            module: confirmDbPurge,
          })
        }
        loading={lifecycleMutation.isPending}
      >
        <div className="flex items-start gap-2 rounded-md border border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-950/30 p-3">
          <Database className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
            Se eliminarán todas las tablas propias del módulo y sus registros
            asociados en la base de datos.
          </p>
        </div>
      </ConfirmDialog>

      <UploadModuleSheet
        open={uploadSheetOpen}
        onOpenChange={setUploadSheetOpen}
        onSuccess={() => syncCatalogMutation.mutate()}
      />
    </div>
  );
}
