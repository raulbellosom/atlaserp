import { lazy, Suspense, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge, Skeleton } from "@atlas/ui";
import { Layers } from "lucide-react";
import { BlueprintCrudScreen } from "../shell/BlueprintCrudScreen.jsx";
import { useRuntimeModules } from "./useRuntimeModules";
import { isModuleAvailable } from "../lib/runtimeModules";
import { applyBrandTheme } from "../lib/brandTheme.js";
import { useBrandingStore } from "../stores/branding.js";

const SCREEN_MAP = {
  "atlas.core:/modules": lazy(
    () => import("../modules/atlas.core/screens/ModuleCatalog.jsx"),
  ),
  "atlas.core:/settings": lazy(
    () => import("../modules/atlas.core/screens/InstanceSettings.jsx"),
  ),
  "atlas.core:/settings/smtp": lazy(
    () => import("../modules/atlas.core/screens/SmtpSettingsScreen.jsx"),
  ),
  "atlas.core:/settings/webpush": lazy(
    () => import("../modules/atlas.core/screens/WebPushSettingsScreen.jsx"),
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
  "atlas.identity:/identity/users/:id/edit": lazy(
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
  "atlas.identity:/": lazy(
    () => import("../modules/atlas.identity/screens/IdentityOverview.jsx"),
  ),
  "atlas.ledger:/accounts": lazy(
    () => import("../modules/atlas.ledger/screens/AccountsScreen.jsx"),
  ),
  "atlas.ledger:/accounts/:id": lazy(
    () => import("../modules/atlas.ledger/screens/AccountScreen.jsx"),
  ),
  "atlas.ledger:/accounts/:id/import": lazy(
    () => import("../modules/atlas.ledger/screens/ImportWizard.jsx"),
  ),
  "atlas.ledger:/groups": lazy(
    () => import("../modules/atlas.ledger/screens/GroupsScreen.jsx"),
  ),
  "atlas.ledger:/groups/:id": lazy(
    () => import("../modules/atlas.ledger/screens/GroupScreen.jsx"),
  ),
  "atlas.ledger:/memberships": lazy(
    () => import("../modules/atlas.ledger/screens/MembershipsScreen.jsx"),
  ),
  "atlas.ledger:/categories": lazy(
    () => import("../modules/atlas.ledger/screens/CategoriesScreen.jsx"),
  ),
  "atlas.ledger:/categories/:id": lazy(
    () => import("../modules/atlas.ledger/screens/CategoriesScreen.jsx"),
  ),
  "atlas.ledger:/types": lazy(
    () => import("../modules/atlas.ledger/screens/TypesScreen.jsx"),
  ),
  "atlas.ledger:/types/:id": lazy(
    () => import("../modules/atlas.ledger/screens/TypesScreen.jsx"),
  ),
  // atlas.fleet custom screens
  "atlas.fleet:/vehicles": lazy(
    () => import("../modules/atlas.fleet/screens/VehiclesScreen.jsx"),
  ),
  "atlas.fleet:/vehicles/:id": lazy(
    () => import("../modules/atlas.fleet/screens/VehiclesScreen.jsx"),
  ),
  "atlas.fleet:/drivers": lazy(
    () => import("../modules/atlas.fleet/screens/DriversScreen.jsx"),
  ),
  "atlas.fleet:/drivers/:id": lazy(
    () => import("../modules/atlas.fleet/screens/DriversScreen.jsx"),
  ),
  "atlas.fleet:/insurance": lazy(
    () => import("../modules/atlas.fleet/screens/InsuranceScreen.jsx"),
  ),
  "atlas.fleet:/insurance/:id": lazy(
    () => import("../modules/atlas.fleet/screens/InsuranceScreen.jsx"),
  ),
  "atlas.fleet:/reports/:type": lazy(
    () => import("../modules/atlas.fleet/screens/ReportsScreen.jsx"),
  ),
  "atlas.fleet:/reports/:type/new": lazy(
    () => import("../modules/atlas.fleet/screens/ReportFormPage.jsx"),
  ),
  "atlas.fleet:/reports/:id": lazy(
    () => import("../modules/atlas.fleet/screens/ReportDetailScreen.jsx"),
  ),
  "atlas.fleet:/catalogs/:section": lazy(
    () => import("../modules/atlas.fleet/screens/CatalogsScreen.jsx"),
  ),
  "atlas.website:/": lazy(
    () => import("../modules/atlas.website/screens/WebsiteOverviewScreen.jsx"),
  ),
  "atlas.website:/pages": lazy(
    () => import("../modules/atlas.website/screens/WebsitePagesScreen.jsx"),
  ),
  "atlas.website:/templates": lazy(
    () => import("../modules/atlas.website/screens/WebsiteTemplatesScreen.jsx"),
  ),
  "atlas.website:/templates/:id/detail": lazy(
    () => import("../modules/atlas.website/screens/WebsiteTemplateDetailScreen.jsx"),
  ),
  "atlas.website:/templates/:id/preview": lazy(
    () => import("../modules/atlas.website/screens/TemplatePreviewScreen.jsx"),
  ),
  "atlas.website:/pages/:id/editor": lazy(
    () =>
      import("../modules/atlas.website/screens/WebsitePageEditorScreen.jsx"),
  ),
  "atlas.website:/theme": lazy(
    () => import("../modules/atlas.website/screens/WebsiteThemeScreen.jsx"),
  ),
  "atlas.website:/menus": lazy(
    () => import("../modules/atlas.website/screens/WebsiteMenusScreen.jsx"),
  ),
  "atlas.website:/blog": lazy(
    () => import("../modules/atlas.website/screens/WebsiteBlogScreen.jsx"),
  ),
  "atlas.website:/blog/:id/editor": lazy(
    () =>
      import("../modules/atlas.website/screens/WebsiteBlogPostEditorScreen.jsx"),
  ),
  "atlas.website:/forms": lazy(
    () => import("../modules/atlas.website/screens/WebsiteFormsScreen.jsx"),
  ),
  "atlas.website:/settings": lazy(
    () => import("../modules/atlas.website/screens/WebsiteSettingsScreen.jsx"),
  ),
  "atlas.website:/payments": lazy(
    () => import("../modules/atlas.website/screens/WebsitePaymentsScreen.jsx"),
  ),
  "atlas.growth:/": lazy(
    () => import("../modules/atlas.growth/screens/GrowthAnalyticsScreen.jsx"),
  ),
  "atlas.growth:/leads": lazy(
    () => import("../modules/atlas.growth/screens/GrowthLeadsScreen.jsx"),
  ),
  "atlas.growth:/leads/:id": lazy(
    () => import("../modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx"),
  ),
  "atlas.documents:/templates": lazy(
    () => import("../modules/atlas.documents/screens/DocumentTemplatesScreen.jsx"),
  ),
  "atlas.documents:/templates/:id/editor": lazy(
    () => import("../modules/atlas.documents/screens/DocumentTemplateEditorScreen.jsx"),
  ),
  "atlas.documents:/generated": lazy(
    () => import("../modules/atlas.documents/screens/GeneratedDocumentsScreen.jsx"),
  ),
  "atlas.calendar:/calendar": lazy(
    () => import("../modules/atlas.calendar/screens/CalendarScreen.jsx"),
  ),
  "atlas.calendar:/": lazy(
    () => import("../modules/atlas.calendar/screens/CalendarScreen.jsx"),
  ),
  // atlas.projects
  "atlas.projects:/": lazy(
    () => import("../modules/atlas.projects/screens/ProjectsScreen.jsx"),
  ),
  // atlas.chat
  "atlas.chat:/": lazy(
    () => import("../modules/atlas.chat/screens/ChatScreen.jsx").then((m) => ({ default: m.ChatScreen })),
  ),
  "atlas.chat:/chat/inbox": lazy(
    () => import("../modules/atlas.chat/screens/ChatScreen.jsx").then((m) => ({ default: m.ChatScreen })),
  ),
  "atlas.chat:/chat/external": lazy(
    () => import("../modules/atlas.chat/screens/ExternalInboxScreen.jsx").then((m) => ({ default: m.ExternalInboxScreen })),
  ),
  "atlas.catalog:/": lazy(
    () => import("../modules/atlas.catalog/screens/CatalogProductsScreen.jsx"),
  ),
  "atlas.catalog:/categories": lazy(
    () =>
      import("../modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx"),
  ),
  "atlas.catalog:/inventory": lazy(
    () => import("../modules/atlas.catalog/screens/CatalogInventoryScreen.jsx"),
  ),
  "atlas.catalog:/:id": lazy(
    () =>
      import("../modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx"),
  ),
  "atlas.pos:/": lazy(
    () => import("../modules/atlas.pos/screens/PosTerminalScreen.jsx"),
  ),
  "atlas.pos:/pos/terminal": lazy(
    () => import("../modules/atlas.pos/screens/PosTerminalScreen.jsx"),
  ),
  "atlas.pos:/pos/tables": lazy(
    () => import("../modules/atlas.pos/screens/PosTablesScreen.jsx"),
  ),
  "atlas.pos:/pos/floor-planner": lazy(
    () => import("../modules/atlas.pos/screens/PosFloorPlannerScreen.jsx"),
  ),
  "atlas.pos:/pos/stations": lazy(
    () => import("../modules/atlas.pos/screens/PosStationsScreen.jsx"),
  ),
  "atlas.pos:/pos/orders": lazy(
    () => import("../modules/atlas.pos/screens/PosOrdersScreen.jsx"),
  ),
  "atlas.pos:/pos/sessions": lazy(
    () => import("../modules/atlas.pos/screens/PosSessionsScreen.jsx"),
  ),
  "atlas.pos:/pos/settings": lazy(
    () => import("../modules/atlas.pos/screens/PosSettingsScreen.jsx"),
  ),
  "atlas.activity:/": lazy(
    () => import("../modules/atlas.activity/ActivityFeedScreen.jsx"),
  ),
  "atlas.notifications:/": lazy(
    () =>
      import(
        "../modules/atlas.notifications/NotificationsInboxScreen.jsx"
      ),
  ),
  "atlas.notifications:/settings": lazy(
    () =>
      import(
        "../modules/atlas.notifications/NotificationSettingsScreen.jsx"
      ),
  ),
  // atlas.notes
  "atlas.notes:/": lazy(() => import("../modules/atlas.notes/NotesScreen.jsx")),
  "atlas.notes:/notes": lazy(() => import("../modules/atlas.notes/NotesScreen.jsx")),
  "atlas.notes:/notes/recent": lazy(() => import("../modules/atlas.notes/NotesScreen.jsx")),
  "atlas.notes:/notes/shared": lazy(() => import("../modules/atlas.notes/NotesScreen.jsx")),
  "atlas.notes:/notes/trash": lazy(() => import("../modules/atlas.notes/NotesScreen.jsx")),
  // atlas.inventory
  "atlas.inventory:/": lazy(
    () => import("../modules/atlas.inventory/screens/InventoryScreen.jsx"),
  ),
  "atlas.inventory:/inventory": lazy(
    () => import("../modules/atlas.inventory/screens/InventoryScreen.jsx"),
  ),
  "atlas.inventory:/inventory/new": lazy(
    () => import("../modules/atlas.inventory/screens/InventoryItemForm.jsx"),
  ),
  "atlas.inventory:/inventory/:id": lazy(
    () => import("../modules/atlas.inventory/screens/InventoryItemDetail.jsx"),
  ),
  "atlas.inventory:/inventory/catalogs": lazy(
    () => import("../modules/atlas.inventory/screens/InventoryCatalogsScreen.jsx"),
  ),
  "atlas.inventory:/inventory/assignments": lazy(
    () => import("../modules/atlas.inventory/screens/InventoryAssignmentsScreen.jsx"),
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
  if (!navigation.length) return subPath === '/';
  if (subPath === '/') return true;

  const modulePrefix = `/app/m/${module.key}`;

  function pathMatches(navPath) {
    if (!navPath) return false;
    // Normalize full paths to relative
    const rel = navPath.startsWith(modulePrefix)
      ? (navPath.slice(modulePrefix.length) || '/')
      : navPath;
    // Root nav items authorize direct single-segment children (e.g. /:id detail pages).
    // Deeper paths (e.g. /categories/sub) are covered by their own nav entries.
    if (rel === '/') {
      const extra = subPath.slice(1); // strip leading /
      return extra.length > 0 && !extra.includes('/');
    }
    return subPath === rel || subPath.startsWith(`${rel}/`);
  }

  function itemAllows(item) {
    if (pathMatches(item?.path)) return true;
    return (item?.children ?? []).some((child) => pathMatches(child?.path));
  }

  return navigation.some(itemAllows);
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
    if (subPath.endsWith("/edit")) {
      return SCREEN_MAP["atlas.identity:/identity/users/:id/edit"] ?? null;
    }
    return SCREEN_MAP["atlas.identity:/identity/users/:id"] ?? null;
  }
  if (moduleKey === "atlas.files" && subPath.startsWith("/files/")) {
    return SCREEN_MAP["atlas.files:/files/:id"] ?? null;
  }
  if (moduleKey === "atlas.hr" && subPath.startsWith("/hr/employees/")) {
    return SCREEN_MAP["atlas.hr:/hr/employees/:id"] ?? null;
  }
  if (moduleKey === "atlas.fleet") {
    if (subPath === "/vehicles" || subPath === "/vehicles/new") return SCREEN_MAP["atlas.fleet:/vehicles"] ?? null;
    if (subPath.startsWith("/vehicles/")) return SCREEN_MAP["atlas.fleet:/vehicles/:id"] ?? null;
    if (subPath === "/drivers" || subPath === "/drivers/new") return SCREEN_MAP["atlas.fleet:/drivers"] ?? null;
    if (subPath.startsWith("/drivers/")) return SCREEN_MAP["atlas.fleet:/drivers/:id"] ?? null;
    if (subPath === "/insurance" || subPath === "/insurance/new") return SCREEN_MAP["atlas.fleet:/insurance"] ?? null;
    if (subPath.startsWith("/insurance/")) return SCREEN_MAP["atlas.fleet:/insurance/:id"] ?? null;
    if (/^\/reports\/(maintenance|service|repair|other)\/new$/.test(subPath)) return SCREEN_MAP["atlas.fleet:/reports/:type/new"] ?? null;
    if (/^\/reports\/(maintenance|service|repair|other)$/.test(subPath)) return SCREEN_MAP["atlas.fleet:/reports/:type"] ?? null;
    if (/^\/reports\/[^/]+$/.test(subPath)) return SCREEN_MAP["atlas.fleet:/reports/:id"] ?? null;
    if (/^\/catalogs\/(vehicle-types|vehicle-brands|vehicle-models)$/.test(subPath)) return SCREEN_MAP["atlas.fleet:/catalogs/:section"] ?? null;
    if (subPath === "/catalogs") return SCREEN_MAP["atlas.fleet:/catalogs/:section"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.ledger") {
    if (subPath === "/accounts" || subPath === "/accounts/new") return SCREEN_MAP["atlas.ledger:/accounts"] ?? null;
    if (subPath.endsWith("/import")) return SCREEN_MAP["atlas.ledger:/accounts/:id/import"] ?? null;
    if (subPath.startsWith("/accounts/") && !subPath.endsWith("/new")) return SCREEN_MAP["atlas.ledger:/accounts/:id"] ?? null;
    if (/^\/groups\/[^/]+$/.test(subPath)) return SCREEN_MAP["atlas.ledger:/groups/:id"] ?? null;
    if (subPath === "/groups") return SCREEN_MAP["atlas.ledger:/groups"] ?? null;
    if (subPath === "/memberships") return SCREEN_MAP["atlas.ledger:/memberships"] ?? null;
    if (subPath === "/categories" || subPath === "/categories/new") return SCREEN_MAP["atlas.ledger:/categories"] ?? null;
    if (subPath.startsWith("/categories/")) return SCREEN_MAP["atlas.ledger:/categories/:id"] ?? null;
    if (subPath === "/types" || subPath === "/types/new") return SCREEN_MAP["atlas.ledger:/types"] ?? null;
    if (subPath.startsWith("/types/")) return SCREEN_MAP["atlas.ledger:/types/:id"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.website") {
    if (/^\/pages\/[^/]+\/editor$/.test(subPath)) {
      return SCREEN_MAP["atlas.website:/pages/:id/editor"] ?? null;
    }
    if (/^\/blog\/[^/]+\/editor$/.test(subPath)) {
      return SCREEN_MAP["atlas.website:/blog/:id/editor"] ?? null;
    }
    if (/^\/templates\/[^/]+\/detail$/.test(subPath)) {
      return SCREEN_MAP["atlas.website:/templates/:id/detail"] ?? null;
    }
    if (/^\/templates\/[^/]+\/preview$/.test(subPath)) {
      return SCREEN_MAP["atlas.website:/templates/:id/preview"] ?? null;
    }
    return SCREEN_MAP[`atlas.website:${subPath}`] ?? null;
  }
  if (moduleKey === "atlas.documents") {
    if (subPath === "/templates") return SCREEN_MAP["atlas.documents:/templates"] ?? null;
    if (subPath === "/generated") return SCREEN_MAP["atlas.documents:/generated"] ?? null;
    if (/^\/templates\/[^/]+\/editor$/.test(subPath)) return SCREEN_MAP["atlas.documents:/templates/:id/editor"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.growth") {
    if (subPath === "/") {
      return SCREEN_MAP["atlas.growth:/"] ?? null;
    }
    if (subPath === "/leads") {
      return SCREEN_MAP["atlas.growth:/leads"] ?? null;
    }
    if (/^\/leads\/[^/]+$/.test(subPath)) {
      return SCREEN_MAP["atlas.growth:/leads/:id"] ?? null;
    }
    return null;
  }
  if (moduleKey === "atlas.catalog") {
    if (subPath === "/") return SCREEN_MAP["atlas.catalog:/"] ?? null;
    if (subPath.startsWith("/categories"))
      return SCREEN_MAP["atlas.catalog:/categories"] ?? null;
    if (subPath === "/inventory")
      return SCREEN_MAP["atlas.catalog:/inventory"] ?? null;
    // Any remaining subpath like /:id is the product detail screen
    return SCREEN_MAP["atlas.catalog:/:id"] ?? null;
  }
  if (moduleKey === "atlas.pos") {
    if (subPath === "/" || subPath === "/pos/terminal") return SCREEN_MAP["atlas.pos:/pos/terminal"] ?? null;
    if (subPath === "/pos/tables") return SCREEN_MAP["atlas.pos:/pos/tables"] ?? null;
    if (subPath === "/pos/floor-planner") return SCREEN_MAP["atlas.pos:/pos/floor-planner"] ?? null;
    if (subPath === "/pos/stations") return SCREEN_MAP["atlas.pos:/pos/stations"] ?? null;
    if (subPath === "/pos/orders") return SCREEN_MAP["atlas.pos:/pos/orders"] ?? null;
    if (subPath === "/pos/sessions") return SCREEN_MAP["atlas.pos:/pos/sessions"] ?? null;
    if (subPath === "/pos/settings") return SCREEN_MAP["atlas.pos:/pos/settings"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.inventory") {
    if (subPath === "/" || subPath === "/inventory") return SCREEN_MAP["atlas.inventory:/inventory"] ?? null;
    if (subPath === "/inventory/new") return SCREEN_MAP["atlas.inventory:/inventory/new"] ?? null;
    if (subPath === "/inventory/assignments") return SCREEN_MAP["atlas.inventory:/inventory/assignments"] ?? null;
    if (subPath === "/inventory/catalogs") return SCREEN_MAP["atlas.inventory:/inventory/catalogs"] ?? null;
    // Parameterized routes — must come after all static path checks
    if (/^\/inventory\/[^/]+\/edit$/.test(subPath)) return SCREEN_MAP["atlas.inventory:/inventory/new"] ?? null;
    if (/^\/inventory\/[^/]+$/.test(subPath)) return SCREEN_MAP["atlas.inventory:/inventory/:id"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.chat") {
    if (subPath === "/" || subPath === "/chat/inbox") return SCREEN_MAP["atlas.chat:/chat/inbox"] ?? null;
    if (subPath.startsWith("/chat/inbox/")) return SCREEN_MAP["atlas.chat:/chat/inbox"] ?? null;
    if (subPath === "/chat/external") return SCREEN_MAP["atlas.chat:/chat/external"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.notes") {
    if (subPath === "/" || subPath === "/notes") return SCREEN_MAP["atlas.notes:/notes"] ?? null;
    if (subPath === "/notes/recent") return SCREEN_MAP["atlas.notes:/notes/recent"] ?? null;
    if (subPath === "/notes/shared") return SCREEN_MAP["atlas.notes:/notes/shared"] ?? null;
    if (subPath === "/notes/trash")  return SCREEN_MAP["atlas.notes:/notes/trash"]  ?? null;
    return null;
  }
  if (subPath === "/") return SCREEN_MAP[`${moduleKey}:/`] ?? null;
  if (!SCREEN_MODULE_KEYS.has(moduleKey)) return BlueprintCrudScreen;
  return null;
}

export function ModuleOutlet() {
  const { moduleKey, "*": wildcard } = useParams();
  const navigate = useNavigate();
  const { moduleMap, isLoading, isPending, isError, error } =
    useRuntimeModules();

  const module = moduleMap.get(moduleKey) ?? null;
  const companyPrimaryColor = useBrandingStore((s) => s.branding?.primaryColor);
  const subPath = useMemo(() => {
    if (!wildcard) return "/";
    return `/${wildcard}`;
  }, [wildcard]);

  useEffect(() => {
    if (isLoading || !module) return;

    const color = module?.color ?? "var(--brand-primary)";
    document.documentElement.style.setProperty("--module-accent", color);

    if (module?.color?.startsWith("#")) {
      applyBrandTheme(module.color);
    }

    return () => {
      document.documentElement.style.removeProperty("--module-accent");
      applyBrandTheme(companyPrimaryColor);
    };
  }, [isLoading, module, companyPrimaryColor]);

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

    const targetPath = fallbackPath.startsWith("/app/m/")
      ? fallbackPath
      : `/app/m/${module.key}${fallbackPath}`;
    navigate(targetPath, { replace: true });
  }, [isLoading, module, subPath, navigate]);

  if (isLoading || isPending) return <LoadingFallback />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-4 text-center px-6">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
          No se pudo cargar el módulo
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {error instanceof Error && error.message
            ? error.message
            : "Hubo un problema consultando los módulos en runtime."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm hover:underline cursor-pointer"
          style={{ color: "var(--brand-primary)" }}
        >
          Reintentar
        </button>
      </div>
    );
  }

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
            type="button"
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
          type="button"
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
          type="button"
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
