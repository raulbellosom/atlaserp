import { getLegacyModuleKey } from '@runly/core';

export function hasBuiltInModule(screenMap, key) {
  const moduleKey = getLegacyModuleKey(key);
  return Object.keys(screenMap).some(entry => entry.startsWith(`${key}:`) || entry.startsWith(`${moduleKey}:`));
}

export function isPathAllowedByNavigation(module, subPath) {
  const navigation = module?.navigation ?? [];
  if (!navigation.length) return subPath === '/';
  if (subPath === '/') return true;

  const modulePrefix = `/app/m/${module.key}`;

  function pathMatches(navPath) {
    if (!navPath) return false;
    // Normalize full paths to relative
    const pathname = navPath.split(/[?#]/)[0];
    const rel = pathname === modulePrefix || pathname.startsWith(`${modulePrefix}/`)
      ? (pathname.slice(modulePrefix.length) || '/')
      : pathname;
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
    return (item?.children ?? []).some(itemAllows);
  }

  return navigation.some(itemAllows);
}

export function resolveScreen(screenMap, requestedModuleKey, subPath, blueprintScreen) {
  const requested = screenMap[`${requestedModuleKey}:${subPath}`];
  if (requested) return requested;
  const moduleKey = getLegacyModuleKey(requestedModuleKey);
  const exact = screenMap[`${moduleKey}:${subPath}`];
  if (exact) return exact;
  if (
    moduleKey === "atlas.identity" &&
    subPath.startsWith("/identity/roles/")
  ) {
    return screenMap["atlas.identity:/identity/roles/:id"] ?? null;
  }
  if (
    moduleKey === "atlas.identity" &&
    subPath.startsWith("/identity/users/")
  ) {
    if (subPath === "/identity/users/new") {
      return screenMap["atlas.identity:/identity/users/new"] ?? null;
    }
    if (subPath.endsWith("/edit")) {
      return screenMap["atlas.identity:/identity/users/:id/edit"] ?? null;
    }
    return screenMap["atlas.identity:/identity/users/:id"] ?? null;
  }
  if (moduleKey === "atlas.files" && subPath.startsWith("/files/")) {
    if (/^\/files\/[^/]+\/edit\/?$/.test(subPath)) return screenMap["atlas.files:/files/:id/edit"];
    return screenMap["atlas.files:/files/:id"] ?? null;
  }
  if (moduleKey === "atlas.hr" && subPath.startsWith("/hr/employees/")) {
    return screenMap["atlas.hr:/hr/employees/:id"] ?? null;
  }
  if (moduleKey === "atlas.contacts" && subPath.startsWith("/contacts/")) {
    return screenMap["atlas.contacts:/contacts/:id"] ?? null;
  }
  if (moduleKey === "atlas.fleet") {
    if (subPath === "/vehicles" || subPath === "/vehicles/new") return screenMap["atlas.fleet:/vehicles"] ?? null;
    if (subPath.startsWith("/vehicles/")) return screenMap["atlas.fleet:/vehicles/:id"] ?? null;
    if (subPath === "/drivers" || subPath === "/drivers/new") return screenMap["atlas.fleet:/drivers"] ?? null;
    if (subPath.startsWith("/drivers/")) return screenMap["atlas.fleet:/drivers/:id"] ?? null;
    if (subPath === "/insurance" || subPath === "/insurance/new") return screenMap["atlas.fleet:/insurance"] ?? null;
    if (subPath.startsWith("/insurance/")) return screenMap["atlas.fleet:/insurance/:id"] ?? null;
    if (/^\/reports\/(maintenance|service|repair|other)\/new$/.test(subPath)) return screenMap["atlas.fleet:/reports/:type/new"] ?? null;
    if (/^\/reports\/(maintenance|service|repair|other)\/[^/]+\/edit$/.test(subPath)) return screenMap["atlas.fleet:/reports/:type/new"] ?? null;
    if (/^\/reports\/(maintenance|service|repair|other)$/.test(subPath)) return screenMap["atlas.fleet:/reports/:type"] ?? null;
    if (/^\/reports\/[^/]+$/.test(subPath)) return screenMap["atlas.fleet:/reports/:id"] ?? null;
    if (/^\/catalogs\/(vehicle-types|vehicle-brands|vehicle-models)$/.test(subPath)) return screenMap["atlas.fleet:/catalogs/:section"] ?? null;
    if (subPath === "/catalogs") return screenMap["atlas.fleet:/catalogs/:section"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.ledger") {
    if (subPath === "/accounts" || subPath === "/accounts/new") return screenMap["atlas.ledger:/accounts"] ?? null;
    if (subPath.endsWith("/import")) return screenMap["atlas.ledger:/accounts/:id/import"] ?? null;
    if (subPath.startsWith("/accounts/") && !subPath.endsWith("/new")) return screenMap["atlas.ledger:/accounts/:id"] ?? null;
    if (/^\/groups\/[^/]+$/.test(subPath)) return screenMap["atlas.ledger:/groups/:id"] ?? null;
    if (subPath === "/groups") return screenMap["atlas.ledger:/groups"] ?? null;
    if (subPath === "/memberships") return screenMap["atlas.ledger:/memberships"] ?? null;
    if (subPath === "/categories" || subPath === "/categories/new") return screenMap["atlas.ledger:/categories"] ?? null;
    if (subPath.startsWith("/categories/")) return screenMap["atlas.ledger:/categories/:id"] ?? null;
    if (subPath === "/types" || subPath === "/types/new") return screenMap["atlas.ledger:/types"] ?? null;
    if (subPath.startsWith("/types/")) return screenMap["atlas.ledger:/types/:id"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.pfm") {
    if (subPath === "/" || subPath === "/overview") return screenMap["atlas.pfm:/overview"] ?? null;
    if (subPath === "/wallets" || subPath === "/wallets/new") return screenMap["atlas.pfm:/wallets"] ?? null;
    if (subPath.startsWith("/wallets/")) return screenMap["atlas.pfm:/wallets/:id"] ?? null;
    if (subPath === "/recurring") return screenMap["atlas.pfm:/recurring"] ?? null;
    if (subPath === "/receipts") return screenMap["atlas.pfm:/receipts"] ?? null;
    if (subPath === "/categories") return screenMap["atlas.pfm:/categories"] ?? null;
    if (subPath === "/budgets") return screenMap["atlas.pfm:/budgets"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.website") {
    if (/^\/pages\/[^/]+\/editor$/.test(subPath)) {
      return screenMap["atlas.website:/pages/:id/editor"] ?? null;
    }
    if (/^\/blog\/[^/]+\/editor$/.test(subPath)) {
      return screenMap["atlas.website:/blog/:id/editor"] ?? null;
    }
    if (/^\/templates\/[^/]+\/detail$/.test(subPath)) {
      return screenMap["atlas.website:/templates/:id/detail"] ?? null;
    }
    if (/^\/templates\/[^/]+\/preview$/.test(subPath)) {
      return screenMap["atlas.website:/templates/:id/preview"] ?? null;
    }
    return screenMap[`atlas.website:${subPath}`] ?? null;
  }
  if (moduleKey === "atlas.documents") {
    if (subPath === "/templates") return screenMap["atlas.documents:/templates"] ?? null;
    if (subPath === "/generated") return screenMap["atlas.documents:/generated"] ?? null;
    if (/^\/templates\/[^/]+\/editor$/.test(subPath)) return screenMap["atlas.documents:/templates/:id/editor"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.growth") {
    if (subPath === "/") {
      return screenMap["atlas.growth:/"] ?? null;
    }
    if (subPath === "/leads") {
      return screenMap["atlas.growth:/leads"] ?? null;
    }
    if (/^\/leads\/[^/]+$/.test(subPath)) {
      return screenMap["atlas.growth:/leads/:id"] ?? null;
    }
    return null;
  }
  if (moduleKey === "atlas.catalog") {
    if (subPath === "/") return screenMap["atlas.catalog:/"] ?? null;
    if (subPath.startsWith("/categories"))
      return screenMap["atlas.catalog:/categories"] ?? null;
    if (subPath === "/inventory")
      return screenMap["atlas.catalog:/inventory"] ?? null;
    // Any remaining subpath like /:id is the product detail screen
    return screenMap["atlas.catalog:/:id"] ?? null;
  }
  if (moduleKey === "atlas.pos") {
    if (subPath === "/" || subPath === "/pos/terminal") return screenMap["atlas.pos:/pos/terminal"] ?? null;
    if (subPath === "/pos/tables") return screenMap["atlas.pos:/pos/tables"] ?? null;
    if (subPath === "/pos/floor-planner") return screenMap["atlas.pos:/pos/floor-planner"] ?? null;
    if (subPath === "/pos/stations") return screenMap["atlas.pos:/pos/stations"] ?? null;
    if (subPath === "/pos/orders") return screenMap["atlas.pos:/pos/orders"] ?? null;
    if (subPath === "/pos/sessions") return screenMap["atlas.pos:/pos/sessions"] ?? null;
    if (subPath === "/pos/settings") return screenMap["atlas.pos:/pos/settings"] ?? null;
    if (/^\/pos\/comandero\/mesa\/[^/]+$/.test(subPath)) return screenMap["atlas.pos:/pos/comandero/mesa/:tableId"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.inventory") {
    if (subPath === "/" || subPath === "/inventory") return screenMap["atlas.inventory:/inventory"] ?? null;
    if (subPath === "/inventory/new") return screenMap["atlas.inventory:/inventory/new"] ?? null;
    if (subPath === "/inventory/assignments") return screenMap["atlas.inventory:/inventory/assignments"] ?? null;
    if (subPath === "/inventory/catalogs") return screenMap["atlas.inventory:/inventory/catalogs"] ?? null;
    // Parameterized routes — must come after all static path checks
    if (/^\/inventory\/[^/]+\/edit$/.test(subPath)) return screenMap["atlas.inventory:/inventory/new"] ?? null;
    if (/^\/inventory\/[^/]+$/.test(subPath)) return screenMap["atlas.inventory:/inventory/:id"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.chat") {
    if (subPath === "/" || subPath === "/chat/inbox") return screenMap["atlas.chat:/chat/inbox"] ?? null;
    if (/^\/chat\/attachment\/[^/]+\/edit\/?$/.test(subPath)) return screenMap["atlas.chat:/chat/attachment/:id/edit"] ?? null;
    if (subPath.startsWith("/chat/inbox/")) return screenMap["atlas.chat:/chat/inbox"] ?? null;
    if (subPath === "/chat/external") return screenMap["atlas.chat:/chat/external"] ?? null;
    if (subPath === "/chat/templates") return screenMap["atlas.chat:/chat/templates"] ?? null;
    return null;
  }
  if (moduleKey === "atlas.notes") {
    if (subPath === "/" || subPath === "/notes") return screenMap["atlas.notes:/notes"] ?? null;
    if (subPath === "/notes/recent") return screenMap["atlas.notes:/notes/recent"] ?? null;
    if (subPath === "/notes/shared") return screenMap["atlas.notes:/notes/shared"] ?? null;
    if (subPath === "/notes/trash")  return screenMap["atlas.notes:/notes/trash"]  ?? null;
    return null;
  }
  if (subPath === "/") return screenMap[`${moduleKey}:/`] ?? null;
  if (!hasBuiltInModule(screenMap, moduleKey)) return blueprintScreen;
  return null;
}

