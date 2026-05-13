import { lazy, Suspense, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge, Skeleton } from "@atlas/ui";
import { Layers } from "lucide-react";
import { BlueprintCrudScreen } from "../shell/BlueprintCrudScreen.jsx";
import { useRuntimeModules } from "./useRuntimeModules";
import { isModuleAvailable } from "../lib/runtimeModules";

const SCREEN_MAP = {
  "atlas.core:/": lazy(
    () => import("../modules/atlas.core/screens/Overview.jsx"),
  ),
  "atlas.core:/modules": lazy(
    () => import("../modules/atlas.core/screens/ModuleCatalog.jsx"),
  ),
  "atlas.core:/settings": lazy(
    () => import("../modules/atlas.core/screens/InstanceSettings.jsx"),
  ),
  "atlas.company:/": lazy(
    () => import("../modules/atlas.company/screens/CompanyOverview.jsx"),
  ),
  "atlas.company:/company": lazy(
    () => import("../modules/atlas.company/screens/CompanyProfile.jsx"),
  ),
  "atlas.company:/company/address": lazy(
    () => import("../modules/atlas.company/screens/CompanyAddress.jsx"),
  ),
  "atlas.company:/company/branding": lazy(
    () => import("../modules/atlas.company/screens/CompanyBranding.jsx"),
  ),
  "atlas.identity:/identity/users": lazy(
    () => import("../modules/atlas.identity/screens/UsersScreen.jsx"),
  ),
  "atlas.identity:/identity/users/new": lazy(
    () => import("../modules/atlas.identity/screens/UserCreateScreen.jsx"),
  ),
  "atlas.identity:/identity/users/:id": lazy(
    () => import("../modules/atlas.identity/screens/UserEditorScreen.jsx"),
  ),
  "atlas.identity:/identity/roles": lazy(
    () => import("../modules/atlas.identity/screens/RolesScreen.jsx"),
  ),
  "atlas.identity:/identity/roles/:id": lazy(
    () => import("../modules/atlas.identity/screens/RoleEditorScreen.jsx"),
  ),
  "atlas.contacts:/": lazy(
    () => import("../modules/atlas.contacts/screens/ContactsScreen.jsx"),
  ),
  "atlas.contacts:/contacts": lazy(
    () => import("../modules/atlas.contacts/screens/ContactsScreen.jsx"),
  ),
  "atlas.files:/": lazy(
    () => import("../modules/atlas.files/screens/FilesScreen.jsx"),
  ),
  "atlas.files:/files": lazy(
    () => import("../modules/atlas.files/screens/FilesScreen.jsx"),
  ),
  "atlas.files:/files/:id": lazy(
    () => import("../modules/atlas.files/screens/FilesScreen.jsx"),
  ),
  "atlas.finance:/": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance/accounts": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance/ar": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance/ap": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance/aging": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance/applications": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance/entries": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance/taxes": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.finance:/finance/fx-rates": lazy(
    () => import("../modules/atlas.finance/screens/FinanceScreen.jsx"),
  ),
  "atlas.hr:/": lazy(() => import("../modules/atlas.hr/screens/HrScreen.jsx")),
  "atlas.hr:/hr": lazy(
    () => import("../modules/atlas.hr/screens/HrScreen.jsx"),
  ),
  "atlas.hr:/hr/employees": lazy(
    () => import("../modules/atlas.hr/screens/HrScreen.jsx"),
  ),
  "atlas.hr:/hr/employees/:id": lazy(
    () => import("../modules/atlas.hr/screens/HrScreen.jsx"),
  ),
  "atlas.hr:/hr/org-chart": lazy(
    () => import("../modules/atlas.hr/screens/HrScreen.jsx"),
  ),
  "atlas.hr:/hr/catalogs": lazy(
    () => import("../modules/atlas.hr/screens/HrScreen.jsx"),
  ),
  "atlas.ledger:/": lazy(
    () => import("../modules/atlas.ledger/screens/LedgerScreen.jsx"),
  ),
  "atlas.ledger:/ledger": lazy(
    () => import("../modules/atlas.ledger/screens/LedgerScreen.jsx"),
  ),
  "atlas.ledger:/ledger/accounts": lazy(
    () => import("../modules/atlas.ledger/screens/LedgerScreen.jsx"),
  ),
  "atlas.ledger:/ledger/accounts/:id": lazy(
    () => import("../modules/atlas.ledger/screens/LedgerScreen.jsx"),
  ),
  "atlas.ledger:/ledger/movements": lazy(
    () => import("../modules/atlas.ledger/screens/LedgerScreen.jsx"),
  ),
  "atlas.ledger:/ledger/reports": lazy(
    () => import("../modules/atlas.ledger/screens/LedgerScreen.jsx"),
  ),
  "atlas.identity:/": lazy(
    () => import("../modules/atlas.identity/screens/IdentityOverview.jsx"),
  ),
};
const SCREEN_MODULE_KEYS = new Set(
  Object.keys(SCREEN_MAP).map((entry) => entry.split(":")[0]),
);

function LoadingFallback() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-3 gap-4 mt-8">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ModulePlaceholder({ module }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-6 px-6 text-center">
      <div
        className="h-20 w-20 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: `${module.color}20` }}
      >
        <Layers size={36} style={{ color: module.color }} />
      </div>
      <div className="space-y-2 max-w-sm">
        <h1 className="text-3xl font-semibold text-[hsl(var(--foreground))]">
          {module.name}
        </h1>
        {module.summary && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {module.summary}
          </p>
        )}
        <div className="pt-1">
          <Badge variant="secondary">Módulo en desarrollo</Badge>
        </div>
      </div>
      {module.navigation && module.navigation.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {module.navigation.map((nav) => (
            <span
              key={nav.path}
              className="px-3 py-1 rounded-full text-xs border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
            >
              {nav.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function unavailableMessage(module) {
  if (!module) return "El módulo no está disponible.";
  if (module.status === "DISABLED") {
    return `El módulo ${module.name} está deshabilitado.`;
  }
  if (module.status === "UNINSTALLED") {
    return `El módulo ${module.name} está desinstalado.`;
  }
  return `El módulo ${module.name} no está disponible.`;
}

function isPathAllowedByNavigation(module, subPath) {
  const navigation = module?.navigation ?? [];
  if (!navigation.length) return subPath === "/";
  if (subPath === "/") return true;
  return navigation.some((item) => {
    const navPath = item?.path;
    if (!navPath) return false;
    if (navPath === "/") return subPath === "/";
    return subPath === navPath || subPath.startsWith(`${navPath}/`);
  });
}

function resolveScreen(moduleKey, subPath) {
  const exact = SCREEN_MAP[`${moduleKey}:${subPath}`];
  if (exact) return exact;
  if (
    moduleKey === "atlas.identity" &&
    subPath.startsWith("/identity/roles/")
  ) {
    return SCREEN_MAP["atlas.identity:/identity/roles/:id"] ?? null;
  }
  if (
    moduleKey === "atlas.identity" &&
    subPath.startsWith("/identity/users/")
  ) {
    if (subPath === "/identity/users/new") {
      return SCREEN_MAP["atlas.identity:/identity/users/new"] ?? null;
    }
    return SCREEN_MAP["atlas.identity:/identity/users/:id"] ?? null;
  }
  if (moduleKey === "atlas.files" && subPath.startsWith("/files/")) {
    return SCREEN_MAP["atlas.files:/files/:id"] ?? null;
  }
  if (moduleKey === "atlas.hr" && subPath.startsWith("/hr/employees/")) {
    return SCREEN_MAP["atlas.hr:/hr/employees/:id"] ?? null;
  }
  if (moduleKey === "atlas.ledger" && subPath.startsWith("/ledger/accounts/")) {
    return SCREEN_MAP["atlas.ledger:/ledger/accounts/:id"] ?? null;
  }
  if (subPath === "/") return SCREEN_MAP[`${moduleKey}:/`] ?? null;
  if (!SCREEN_MODULE_KEYS.has(moduleKey)) return BlueprintCrudScreen;
  return null;
}

export function ModuleOutlet() {
  const { moduleKey, "*": wildcard } = useParams();
  const navigate = useNavigate();
  const { moduleMap, isLoading } = useRuntimeModules();

  const module = moduleMap.get(moduleKey) ?? null;
  const subPath = useMemo(() => {
    if (!wildcard) return "/";
    return `/${wildcard}`;
  }, [wildcard]);

  useEffect(() => {
    if (isLoading || !module) return;

    const color = module?.color ?? "var(--brand-primary)";
    document.documentElement.style.setProperty("--module-accent", color);
    return () => {
      document.documentElement.style.removeProperty("--module-accent");
    };
  }, [isLoading, module]);

  useEffect(() => {
    if (isLoading || !module) return;
    if (isModuleAvailable(module)) return;

    navigate("/app/m/atlas.core/modules", {
      replace: true,
      state: { moduleWarning: unavailableMessage(module) },
    });
  }, [isLoading, module, navigate]);

  useEffect(() => {
    if (isLoading || !module) return;
    if (subPath !== "/") return;

    const navigation = module.navigation ?? [];
    if (!navigation.length) return;
    const hasRootNavigation = navigation.some((item) => item?.path === "/");
    if (hasRootNavigation) return;

    const fallbackPath = navigation[0]?.path;
    if (!fallbackPath || fallbackPath === "/") return;

    navigate(`/app/m/${module.key}${fallbackPath}`, { replace: true });
  }, [isLoading, module, subPath, navigate]);

  if (isLoading) return <LoadingFallback />;

  if (!module) {
    if (SCREEN_MODULE_KEYS.has(moduleKey)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-4 text-center px-6">
          <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
            Acceso restringido
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No tienes permisos para acceder a este módulo.
          </p>
          <button
            onClick={() => navigate("/app/home")}
            className="text-sm hover:underline cursor-pointer"
            style={{ color: "var(--brand-primary)" }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-4 text-center px-6">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
          Módulo no encontrado
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          El módulo{" "}
          <code className="font-mono text-xs bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">
            {moduleKey}
          </code>{" "}
          no existe o no está registrado.
        </p>
        <button
          onClick={() => navigate("/app/home")}
          className="text-sm hover:underline cursor-pointer"
          style={{ color: "var(--brand-primary)" }}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  if (!isModuleAvailable(module)) {
    return null;
  }
  if (!isPathAllowedByNavigation(module, subPath)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-4 text-center px-6">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
          Acceso restringido
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No tienes permisos para abrir esta sección.
        </p>
        <button
          onClick={() => navigate("/app/home")}
          className="text-sm hover:underline cursor-pointer"
          style={{ color: "var(--brand-primary)" }}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const Screen = resolveScreen(moduleKey, subPath);

  return (
    <Suspense fallback={<LoadingFallback />}>
      {Screen ? <Screen /> : <ModulePlaceholder module={module} />}
    </Suspense>
  );
}
