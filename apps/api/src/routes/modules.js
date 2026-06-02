import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  moduleInstallSchema,
  moduleDryRunSchema,
  moduleClearErrorSchema,
  moduleCleanupDryRunSchema,
  moduleCleanupSchema,
  moduleUninstallSchema,
  moduleResetSchema,
} from "@atlas/validators";
import {
  getPermissionPresentation,
  groupPermissionsForUi,
} from "../permission-catalog.js";
import {
  createModuleLifecycleService,
  ModuleLifecycleError,
} from "../services/module-lifecycle-service.js";
import {
  publishActivityFromContext,
  getActivityContext,
} from "../services/activity-publisher.js";
import { createModuleMetadataService } from "../services/module-metadata-service.js";
import { createModuleMigrationService } from "../services/module-migration-service.js";
import {
  discoverModules,
  getDiscoveryRootInfo,
} from "../services/module-discovery-service.js";
import { listOfficialModuleManifests } from "../services/module-manifests-service.js";
import {
  detectRequiredDependencyCycle,
  formatDependencyCycle,
  normalizeManifestDependencies,
} from "../services/module-dependency-utils.js";
import { del as cacheDel } from "../lib/cache.js";

const CORE_KEYS = new Set([
  "atlas.core",
  "atlas.identity",
  "atlas.files",
  "atlas.company",
  "atlas.contacts",
  "atlas.hr",
]);
const __routesDir = path.dirname(fileURLToPath(import.meta.url));
const BUNDLES_DIR_SERVE = path.resolve(__routesDir, "..", "..", "bundles");
const SEMVER_PATCH_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCustomModuleRecord(record) {
  const source = typeof record?.source === "string" ? record.source.trim() : "";
  const key = typeof record?.key === "string" ? record.key.trim() : "";
  return source === "custom" || key.startsWith("custom.");
}

function defaultUninstallModeForKey(key) {
  return typeof key === "string" && key.trim().startsWith("custom.")
    ? "purge-owned-tables"
    : "preserve-data";
}

function computeMigrationSignature(manifest) {
  const migrations = Array.isArray(manifest?.migrations)
    ? manifest.migrations
    : [];
  const normalized = migrations.map((entry) => ({
    path: typeof entry?.path === "string" ? entry.path.trim() : "",
    checksum:
      typeof entry?.checksum === "string"
        ? entry.checksum.trim().toLowerCase()
        : "",
    unsafe: entry?.unsafe === true,
  }));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function bumpPatchVersion(version) {
  const normalized = typeof version === "string" ? version.trim() : "";
  const match = normalized.match(SEMVER_PATCH_RE);
  if (!match) return null;
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function toManifestMigrationFilename(declaredPath) {
  const safePath = typeof declaredPath === "string" ? declaredPath.trim() : "";
  return `manifest__${safePath.replaceAll("\\", "/").replaceAll("/", "__")}`;
}

async function applyManifestChecksumUpdates({ manifestPath, updates }) {
  if (!updates.length) return { applied: false, updatedPaths: [] };

  let source = await fs.readFile(manifestPath, "utf8");
  const updatedPaths = [];
  for (const update of updates) {
    const rx = new RegExp(
      `(path:\\s*["']${escapeRegExp(update.path)}["'][\\s\\S]{0,2000}?checksum:\\s*["'])([a-fA-F0-9]{64})(["'])`,
      "m",
    );
    if (!rx.test(source)) {
      throw new Error(
        `No se pudo ubicar checksum en manifest para ${update.path}`,
      );
    }
    source = source.replace(rx, `$1${update.checksum}$3`);
    updatedPaths.push(update.path);
  }

  await fs.writeFile(manifestPath, source, "utf8");
  return { applied: true, updatedPaths };
}

async function bumpManifestVersion({ manifestPath, fromVersion, toVersion }) {
  let source = await fs.readFile(manifestPath, "utf8");
  const rx = /(\bversion\s*:\s*["'])([^"']+)(["'])/;
  if (!rx.test(source)) {
    throw new Error(`No se pudo ubicar "version" en ${manifestPath}`);
  }
  source = source.replace(rx, `$1${toVersion}$3`);
  await fs.writeFile(manifestPath, source, "utf8");
  return { fromVersion, toVersion };
}

function validateManifestAcl(manifest = {}) {
  const declaredKeys = new Set((manifest.permissions ?? []).map((p) => p.key));
  const acl = manifest.acl ?? {};

  if (manifest.navigation?.length) {
    for (const nav of manifest.navigation) {
      if (!nav?.permissionKey || !declaredKeys.has(nav.permissionKey)) {
        throw Object.assign(new Error("INVALID_MANIFEST_ACL"), {
          code: "INVALID_MANIFEST_ACL",
          detail: `El item de navegacion "${nav?.path ?? "/"}" debe declarar permissionKey valido.`,
        });
      }
    }
  }
  if (typeof acl.module === "string" && acl.module.trim()) {
    if (!declaredKeys.has(acl.module.trim())) {
      throw Object.assign(new Error("INVALID_MANIFEST_ACL"), {
        code: "INVALID_MANIFEST_ACL",
        detail: `acl.module "${acl.module}" no esta declarado en permissions.`,
      });
    }
  }
}

function serializeModule(moduleRow) {
  return {
    id: moduleRow.id,
    key: moduleRow.key,
    name: moduleRow.name,
    description: moduleRow.description,
    version: moduleRow.version,
    kind: moduleRow.kind,
    status: moduleRow.status,
    core: moduleRow.core,
    uninstallable: moduleRow.uninstallable,
    enabled: moduleRow.enabled,
    installedAt: moduleRow.installedAt,
    lifecycleConfig: moduleRow.lifecycleConfig ?? null,
    dependencies: (moduleRow.dependencies ?? []).map((dep) => ({
      key: dep.dependency?.key,
      name: dep.dependency?.name,
      status: dep.dependency?.status,
      enabled: dep.dependency?.enabled,
      optional: dep.optional,
    })),
    manifest: moduleRow.manifest,
  };
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function classifyInstallStage(err) {
  if (err?.stage) return err.stage;
  if (err?.code === "MANIFEST_MIGRATION_CHECKSUM_MISMATCH")
    return "manifest_migration";
  if (err?.code === "AME_METADATA_SYNC_FAILED") return "metadata_sync";
  if (
    err?.name === "ModuleOrmMigrationError" ||
    err?.code === "AME_ORM_MIGRATION_FAILED" ||
    err?.code === "AME_SQL_MIGRATION_EXECUTION_FAILED"
  )
    return "orm_migration";
  if (err?.name === "ZodError") return "validation";
  if (err?.code === "INVALID_MANIFEST_ACL") return "validation";
  if (err?.code === "DEPENDENCY_NOT_FOUND") return "dependency_sync";
  if (err instanceof ModuleLifecycleError) return "install";
  return "unknown";
}

function handleLifecycleError(c, err, fallback) {
  if (err instanceof ModuleLifecycleError) {
    return c.json({ error: err.message }, err.status);
  }
  if (err?.code === "DEPENDENCY_NOT_FOUND") {
    return c.json(
      { error: `Dependencias no encontradas: ${err.keys.join(", ")}.` },
      409,
    );
  }
  if (err?.code === "INVALID_MANIFEST_ACL") {
    return c.json(
      { error: err.detail ?? "El manifiesto ACL es invalido." },
      400,
    );
  }
  if (err?.name === "ZodError") {
    return c.json(
      { error: err.errors?.[0]?.message ?? "Datos invalidos." },
      400,
    );
  }
  console.error("[modules]", err);
  return c.json({ error: fallback }, 500);
}

function toErrorMessage(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error.message === "string") return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function resolveSyncActorId(prisma, userContext) {
  const rawId = userContext?.profile?.id;
  if (typeof rawId !== "string" || !rawId.trim()) {
    return null;
  }

  const actorId = rawId.trim();
  const profile = await prisma.userProfile.findUnique({
    where: { id: actorId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

function serializeDiscoveredModule(record) {
  return {
    key: record?.key ?? null,
    source: record?.source ?? null,
    localPath: record?.localPath ?? null,
    moduleDir: record?.moduleDir ?? null,
    status: record?.status ?? "ERROR",
    error: record?.error ?? null,
    modelsCount: Array.isArray(record?.models) ? record.models.length : 0,
    viewsCount: Array.isArray(record?.views) ? record.views.length : 0,
    migrationsCount: Array.isArray(record?.migrations)
      ? record.migrations.length
      : 0,
  };
}

function mergeDiscoveryIntoManifest(record, options = {}) {
  const manifest =
    record?.manifest && typeof record.manifest === "object"
      ? record.manifest
      : null;
  if (!manifest) return null;
  const extraLifecycle = isPlainObject(options?.extraLifecycle)
    ? options.extraLifecycle
    : {};
  const existingLifecycle =
    manifest.lifecycle &&
    typeof manifest.lifecycle === "object" &&
    !Array.isArray(manifest.lifecycle)
      ? manifest.lifecycle
      : {};
  const existingDiscovery = isPlainObject(existingLifecycle.discovery)
    ? existingLifecycle.discovery
    : {};
  const existingDev = isPlainObject(existingLifecycle.dev)
    ? existingLifecycle.dev
    : {};
  const extraDev = isPlainObject(extraLifecycle.dev) ? extraLifecycle.dev : {};
  const mergedDev =
    Object.keys(existingDev).length > 0 || Object.keys(extraDev).length > 0
      ? { ...existingDev, ...extraDev }
      : undefined;
  const discovery = {
    ...existingDiscovery,
    source: record?.source ?? null,
    localPath: record?.localPath ?? null,
  };

  return {
    ...manifest,
    lifecycle: {
      ...existingLifecycle,
      ...extraLifecycle,
      ...(mergedDev ? { dev: mergedDev } : {}),
      discovery,
    },
  };
}

function buildOfficialFallbackManifests({ discoveredKeys }) {
  const fallback = [];
  const officialManifests = listOfficialModuleManifests();

  for (const manifest of officialManifests) {
    const key = typeof manifest?.key === "string" ? manifest.key.trim() : "";
    if (!key || discoveredKeys.has(key)) continue;
    fallback.push({
      ...manifest,
      lifecycle: {
        ...(manifest?.lifecycle && typeof manifest.lifecycle === "object"
          ? manifest.lifecycle
          : {}),
        discovery: {
          source: "official_manifest_fallback",
          localPath: "apps/api/src/manifests/official",
        },
      },
    });
  }

  return fallback;
}

async function upsertDiscoveredModuleError({ prisma, record }) {
  const key =
    typeof record?.key === "string" && record.key.trim()
      ? record.key.trim()
      : null;
  if (!key) return null;

  const manifest =
    record?.manifest && typeof record.manifest === "object"
      ? record.manifest
      : {};
  const isCore = CORE_KEYS.has(key);
  const name =
    typeof manifest.name === "string" && manifest.name.trim()
      ? manifest.name.trim()
      : key;
  const version =
    typeof manifest.version === "string" && manifest.version.trim()
      ? manifest.version.trim()
      : "0.0.0";

  const discoveryError = {
    discovery: {
      status: "ERROR",
      source: record.source ?? null,
      localPath: record.localPath ?? null,
      message: toErrorMessage(record.error),
      updatedAt: new Date().toISOString(),
    },
  };

  return prisma.atlasModule.upsert({
    where: { key },
    update: {
      name,
      description:
        typeof manifest.description === "string" ? manifest.description : null,
      version,
      kind: manifest.kind ?? (isCore ? "CORE" : "FEATURE"),
      core: isCore,
      uninstallable: isCore ? false : (manifest.uninstallable ?? true),
      manifest: Object.keys(manifest).length
        ? manifest
        : { key, name, version },
      lifecycleConfig: discoveryError,
    },
    create: {
      key,
      name,
      description:
        typeof manifest.description === "string" ? manifest.description : null,
      version,
      kind: manifest.kind ?? (isCore ? "CORE" : "FEATURE"),
      core: isCore,
      uninstallable: isCore ? false : (manifest.uninstallable ?? true),
      status: isCore ? "INSTALLED" : "UNINSTALLED",
      enabled: isCore,
      manifest: Object.keys(manifest).length
        ? manifest
        : { key, name, version },
      lifecycleConfig: discoveryError,
    },
  });
}

async function syncDiscoveredModuleDependencies({
  prisma,
  moduleKey,
  dependencies = [],
}) {
  const moduleRow = await prisma.atlasModule.findUnique({
    where: { key: moduleKey },
    select: { id: true, key: true },
  });

  if (!moduleRow) {
    return {
      key: moduleKey,
      declared: 0,
      synced: 0,
      removed: 0,
      missingRequired: [],
      missingOptional: [],
      error: {
        code: "MODULE_NOT_FOUND_AFTER_SYNC",
        message: `No se encontro el modulo ${moduleKey} despues del sync lifecycle.`,
      },
    };
  }

  const normalizedDependencies = normalizeManifestDependencies(dependencies);
  const keys = normalizedDependencies.map((dep) => dep.key);
  const dependencyRows =
    keys.length > 0
      ? await prisma.atlasModule.findMany({
          where: { key: { in: keys } },
          select: { id: true, key: true },
        })
      : [];

  const dependencyByKey = new Map(
    dependencyRows.map((row) => [row.key, row.id]),
  );
  const missingRequired = normalizedDependencies
    .filter((dep) => !dep.optional && !dependencyByKey.has(dep.key))
    .map((dep) => dep.key);
  const missingOptional = normalizedDependencies
    .filter((dep) => dep.optional && !dependencyByKey.has(dep.key))
    .map((dep) => dep.key);
  const resolvable = normalizedDependencies.filter((dep) =>
    dependencyByKey.has(dep.key),
  );
  const requiredDependencyIds = resolvable
    .filter((dep) => !dep.optional)
    .map((dep) => dependencyByKey.get(dep.key))
    .filter(Boolean);

  if (requiredDependencyIds.length > 0) {
    const existingRequiredEdges = await prisma.moduleDependency.findMany({
      where: { optional: false },
      select: { moduleId: true, dependencyId: true },
    });
    const cycleIds = detectRequiredDependencyCycle({
      moduleId: moduleRow.id,
      requiredDependencyIds,
      existingRequiredEdges,
    });
    if (cycleIds) {
      const involvedIds = [...new Set(cycleIds)];
      const moduleRows = await prisma.atlasModule.findMany({
        where: { id: { in: involvedIds } },
        select: { id: true, key: true },
      });
      const idToKey = new Map(moduleRows.map((row) => [row.id, row.key]));
      const cyclePath = formatDependencyCycle({ cycle: cycleIds, idToKey });
      return {
        key: moduleRow.key,
        declared: normalizedDependencies.length,
        synced: 0,
        removed: 0,
        missingRequired,
        missingOptional,
        error: {
          code: "DEPENDENCY_CYCLE_DETECTED",
          message: `Dependencia circular detectada: ${cyclePath}.`,
          cyclePath,
        },
      };
    }
  }

  const desiredDependencyIds = new Set(
    resolvable.map((dep) => dependencyByKey.get(dep.key)),
  );

  const txResult = await prisma.$transaction(async (tx) => {
    for (const dep of resolvable) {
      await tx.moduleDependency.upsert({
        where: {
          moduleId_dependencyId: {
            moduleId: moduleRow.id,
            dependencyId: dependencyByKey.get(dep.key),
          },
        },
        create: {
          moduleId: moduleRow.id,
          dependencyId: dependencyByKey.get(dep.key),
          optional: dep.optional,
          versionRange: dep.versionRange,
        },
        update: {
          optional: dep.optional,
          versionRange: dep.versionRange,
        },
      });
    }

    const currentRows = await tx.moduleDependency.findMany({
      where: { moduleId: moduleRow.id },
      select: { id: true, dependencyId: true },
    });
    const staleRowIds = currentRows
      .filter((row) => !desiredDependencyIds.has(row.dependencyId))
      .map((row) => row.id);

    if (staleRowIds.length > 0) {
      await tx.moduleDependency.deleteMany({
        where: {
          moduleId: moduleRow.id,
          id: { in: staleRowIds },
        },
      });
    }

    return {
      removed: staleRowIds.length,
      synced: resolvable.length,
    };
  });

  return {
    key: moduleRow.key,
    declared: normalizedDependencies.length,
    synced: txResult.synced,
    removed: txResult.removed,
    missingRequired,
    missingOptional,
    error: null,
  };
}

export function createModulesRouter({
  prisma,
  authMiddleware,
  requirePermission,
  routeLoader = null,
  bundlerSvc = null,
}) {
  const app = new Hono();
  const svc = createModuleLifecycleService({ prisma });

  async function safeRouteReload(moduleKey) {
    if (!routeLoader) return null;
    try {
      return await routeLoader.reloadModule(moduleKey);
    } catch (err) {
      console.error(
        `[modules] routeLoader.reloadModule(${moduleKey}) failed:`,
        err.message,
      );
      return { loaded: false, reason: "error", error: err.message };
    }
  }

  function safeRouteUnload(moduleKey) {
    if (!routeLoader) return null;
    return routeLoader.unloadModule(moduleKey);
  }

  async function safeBuildBundle(key, opts = {}) {
    if (!bundlerSvc) return null;
    try {
      return await bundlerSvc.buildModuleBundle(key, opts);
    } catch (err) {
      console.warn(`[modules] bundle build failed for ${key}:`, err.message);
      return null;
    }
  }

  async function safeDeleteBundle(key) {
    if (!bundlerSvc) return null;
    try {
      return await bundlerSvc.deleteModuleBundle(key);
    } catch (err) {
      console.warn(`[modules] bundle delete failed for ${key}:`, err.message);
      return null;
    }
  }

  const metadataSvc = createModuleMetadataService({ prisma });
  const migrationSvc = createModuleMigrationService({ prisma });

  async function applyManifestMigrationsForRecord({ record }) {
    const moduleKey = record?.manifest?.key ?? null;
    if (!moduleKey) {
      return {
        moduleKey: null,
        status: "skipped",
        reason: "missing_module_key",
        entries: [],
      };
    }

    const moduleRow = await prisma.atlasModule.findUnique({
      where: { key: moduleKey },
      select: { key: true, status: true, enabled: true },
    });
    if (!moduleRow || moduleRow.status !== "INSTALLED" || !moduleRow.enabled) {
      return {
        moduleKey,
        status: "skipped",
        reason: "module_not_active",
        entries: [],
      };
    }

    const migrations = Array.isArray(record?.migrations)
      ? record.migrations
      : [];
    if (!migrations.length) {
      return {
        moduleKey,
        status: "skipped",
        reason: "no_manifest_migrations",
        entries: [],
      };
    }

    const entries = [];
    for (const migration of migrations) {
      const sql = typeof migration?.sql === "string" ? migration.sql : "";
      const checksum =
        typeof migration?.checksum === "string"
          ? migration.checksum.trim().toLowerCase()
          : "";
      const allowUnsafeSql = migration?.unsafe === true;
      const computed = createHash("sha256").update(sql).digest("hex");
      const localPath =
        typeof migration?.path === "string"
          ? migration.path
          : (migration?.filename ?? "unknown.sql");
      const filename = `manifest__${localPath.replaceAll("\\", "/").replaceAll("/", "__")}`;
      if (checksum && checksum !== computed) {
        entries.push({
          filename,
          path: localPath,
          status: "error",
          code: "CHECKSUM_MISMATCH",
          expected: checksum,
          computed,
        });
        continue;
      }

      try {
        const result = await migrationSvc.applySqlMigration({
          moduleKey,
          filename,
          sql,
          allowUnsafeSql,
        });
        entries.push({
          filename,
          path: localPath,
          status: result.applied ? "applied" : "already_applied",
        });
      } catch (error) {
        entries.push({
          filename,
          path: localPath,
          status: "error",
          code: error?.code ?? "MIGRATION_EXECUTION_FAILED",
          message: toErrorMessage(error),
        });
      }
    }

    const hasErrors = entries.some((entry) => entry.status === "error");
    return {
      moduleKey,
      status: hasErrors ? "partial_error" : "ok",
      entries,
    };
  }

  // ── GET /modules ──────────────────────────────────────────────────────────

  app.get(
    "/",
    authMiddleware,
    requirePermission("core.modules.read"),
    async (c) => {
      try {
        const modules = await prisma.atlasModule.findMany({
          orderBy: [{ core: "desc" }, { name: "asc" }],
          include: {
            dependencies: {
              include: {
                dependency: {
                  select: {
                    id: true,
                    key: true,
                    name: true,
                    status: true,
                    enabled: true,
                    version: true,
                  },
                },
              },
            },
          },
        });
        return c.json({ data: modules.map(serializeModule) });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudieron cargar los modulos.",
        );
      }
    },
  );

  // ── GET /modules/available ────────────────────────────────────────────────

  app.get(
    "/available",
    authMiddleware,
    requirePermission("core.modules.read"),
    async (c) => {
      try {
        const modules = await prisma.atlasModule.findMany({
          orderBy: [{ core: "desc" }, { name: "asc" }],
          include: {
            dependencies: {
              include: {
                dependency: {
                  select: {
                    id: true,
                    key: true,
                    name: true,
                    status: true,
                    enabled: true,
                    version: true,
                  },
                },
              },
            },
          },
        });
        return c.json({ data: modules.map(serializeModule) });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudieron cargar los modulos disponibles.",
        );
      }
    },
  );

  // ── POST /modules/install ─────────────────────────────────────────────────

  app.post(
    "/install",
    authMiddleware,
    requirePermission("core.modules.create"),
    async (c) => {
      const requestId = generateRequestId();
      const isDev = process.env.NODE_ENV !== "production";
      let moduleKey = null;

      try {
        const body = await c.req.json();
        const parsed = moduleInstallSchema.parse(body);
        moduleKey = parsed.manifest?.key ?? null;
        validateManifestAcl(parsed.manifest);
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const result = await svc.installModule({
          manifest: parsed.manifest,
          actorId,
          requestId,
        });
        const rlStatus = await safeRouteReload(moduleKey);
        await safeBuildBundle(moduleKey);
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        const { actorName } = getActivityContext(c);
        await publishActivityFromContext(prisma, c, {
          type: "core.module.install",
          severity: "success",
          entityType: "AtlasModule",
          entityId: moduleKey,
          summary: `${actorName} instaló el módulo ${moduleKey}`,
        });
        return c.json({ data: result, routeLoader: rlStatus }, 201);
      } catch (err) {
        const stage = classifyInstallStage(err);
        const code =
          err?.code ??
          (err instanceof ModuleLifecycleError
            ? "LIFECYCLE_ERROR"
            : "INTERNAL_ERROR");

        console.error("[modules] POST /install failed", {
          requestId,
          moduleKey,
          stage,
          errorName: err?.name ?? null,
          errorMessage: err?.message ?? null,
          errorCode: err?.code ?? null,
          causeMessage: err?.cause?.message ?? null,
          causeCode: err?.cause?.code ?? null,
          filename: err?.filename ?? null,
          tableName: err?.tableName ?? null,
          sqlPreview: err?.sqlPreview ?? err?.cause?.sqlPreview ?? null,
          statementPreview:
            err?.statementPreview ?? err?.cause?.statementPreview ?? null,
          stack: err?.stack ?? null,
        });

        if (err instanceof ModuleLifecycleError) {
          return c.json(
            { error: err.message, code, moduleKey, stage, requestId },
            err.status,
          );
        }
        if (err?.name === "ZodError") {
          return c.json(
            {
              error: err.errors?.[0]?.message ?? "El manifiesto es invalido.",
              code: "VALIDATION_ERROR",
              moduleKey,
              stage: "validation",
              requestId,
            },
            400,
          );
        }
        if (err?.code === "INVALID_MANIFEST_ACL") {
          return c.json(
            {
              error: err.detail ?? "El manifiesto ACL es invalido.",
              code,
              moduleKey,
              stage: "validation",
              requestId,
            },
            400,
          );
        }
        if (err?.code === "DEPENDENCY_NOT_FOUND") {
          return c.json(
            {
              error: `Dependencias no encontradas: ${err.keys?.join(", ")}.`,
              code,
              moduleKey,
              stage: "dependency_sync",
              requestId,
            },
            409,
          );
        }

        return c.json(
          {
            error: "No se pudo instalar el modulo.",
            code,
            moduleKey,
            stage,
            requestId,
            ...(isDev
              ? {
                  details: err?.message ?? null,
                  cause: err?.cause?.message ?? null,
                }
              : {}),
          },
          500,
        );
      }
    },
  );

  // ── POST /modules/sync ────────────────────────────────────────────────────

  app.post(
    "/sync",
    authMiddleware,
    requirePermission("core.modules.create"),
    async (c) => {
      try {
        const isDev = process.env.NODE_ENV !== "production";
        const requestBody = await c.req.json().catch(() => ({}));
        const requestedAutoRepair =
          typeof requestBody?.autoRepair === "boolean"
            ? requestBody.autoRepair
            : null;
        const requestedModuleKey =
          typeof requestBody?.moduleKey === "string" &&
          requestBody.moduleKey.trim()
            ? requestBody.moduleKey.trim()
            : null;
        const autoRepairEnabled = isDev && (requestedAutoRepair ?? true);

        const actorId = await resolveSyncActorId(prisma, c.get("userContext"));
        const discoveryRootInfo = await getDiscoveryRootInfo();
        const discoveredAll = await discoverModules({
          rootDir: discoveryRootInfo.projectRoot,
        });
        const discovered = requestedModuleKey
          ? discoveredAll.filter((record) => record?.key === requestedModuleKey)
          : discoveredAll;

        const automation = {
          autoRepairEnabled,
          modulesScanned: discovered.filter((record) =>
            isCustomModuleRecord(record),
          ).length,
          checksumsFixed: 0,
          versionsBumped: 0,
          reinstalled: 0,
          failed: 0,
          checksumFixes: [],
          versionBumps: [],
          reinstalledModules: [],
          failedModules: [],
        };

        if (autoRepairEnabled) {
          const checksumMismatchRecords = discovered.filter((record) => {
            return (
              isCustomModuleRecord(record) &&
              record?.status !== "VALID" &&
              record?.error?.code === "MANIFEST_MIGRATION_CHECKSUM_MISMATCH" &&
              typeof record?.moduleDir === "string" &&
              isPlainObject(record?.manifest)
            );
          });

          for (const record of checksumMismatchRecords) {
            const moduleKey =
              typeof record?.key === "string" ? record.key.trim() : "";
            const migrations = Array.isArray(record?.manifest?.migrations)
              ? record.manifest.migrations
              : [];
            const manifestPath = path.join(
              record.moduleDir,
              "module.manifest.js",
            );

            try {
              const updates = [];
              for (const migration of migrations) {
                const declaredPath =
                  typeof migration?.path === "string"
                    ? migration.path.trim()
                    : "";
                if (!declaredPath) continue;

                const sqlPath = path.resolve(record.moduleDir, declaredPath);
                const sql = await fs.readFile(sqlPath, "utf8");
                const computedChecksum = createHash("sha256")
                  .update(sql)
                  .digest("hex");
                const declaredChecksum =
                  typeof migration?.checksum === "string"
                    ? migration.checksum.trim().toLowerCase()
                    : "";
                if (computedChecksum !== declaredChecksum) {
                  updates.push({
                    path: declaredPath,
                    checksum: computedChecksum,
                  });
                }
              }

              if (updates.length > 0) {
                const result = await applyManifestChecksumUpdates({
                  manifestPath,
                  updates,
                });
                automation.checksumsFixed += result.updatedPaths.length;
                automation.checksumFixes.push({
                  key: moduleKey || null,
                  manifestPath,
                  updatedPaths: result.updatedPaths,
                });
              }
            } catch (error) {
              automation.failed += 1;
              automation.failedModules.push({
                key: moduleKey || null,
                stage: "checksum_autofix",
                message: toErrorMessage(error),
              });
            }
          }

          if (automation.checksumFixes.length > 0) {
            const rediscoveredAll = await discoverModules({
              rootDir: discoveryRootInfo.projectRoot,
            });
            discovered.length = 0;
            discovered.push(
              ...(requestedModuleKey
                ? rediscoveredAll.filter(
                    (record) => record?.key === requestedModuleKey,
                  )
                : rediscoveredAll),
            );
          }

          const customValidRecordsForBump = discovered.filter(
            (record) =>
              isCustomModuleRecord(record) &&
              record?.status === "VALID" &&
              isPlainObject(record?.manifest) &&
              typeof record?.moduleDir === "string",
          );

          const customKeysForBump = customValidRecordsForBump
            .map((record) => record?.manifest?.key)
            .filter((value) => typeof value === "string" && value.trim())
            .map((value) => value.trim());

          const existingRowsForBump =
            customKeysForBump.length > 0
              ? await prisma.atlasModule.findMany({
                  where: { key: { in: customKeysForBump } },
                  select: { key: true, version: true, lifecycleConfig: true },
                })
              : [];
          const existingRowsByKey = new Map(
            existingRowsForBump.map((row) => [row.key, row]),
          );

          for (const record of customValidRecordsForBump) {
            const key = record?.manifest?.key;
            const manifestVersion =
              typeof record?.manifest?.version === "string"
                ? record.manifest.version.trim()
                : "";
            const existing = existingRowsByKey.get(key);
            if (!existing || !manifestVersion) continue;

            const prevSignature =
              existing?.lifecycleConfig?.dev &&
              typeof existing.lifecycleConfig.dev === "object" &&
              !Array.isArray(existing.lifecycleConfig.dev)
                ? (existing.lifecycleConfig.dev.migrationSignature ?? null)
                : null;
            const nextSignature = computeMigrationSignature(record.manifest);
            const signatureChanged = prevSignature !== nextSignature;
            const versionUnchangedVsDb = existing.version === manifestVersion;

            if (!signatureChanged || !versionUnchangedVsDb) continue;

            const nextVersion = bumpPatchVersion(manifestVersion);
            if (!nextVersion || nextVersion === manifestVersion) continue;

            try {
              const manifestPath = path.join(
                record.moduleDir,
                "module.manifest.js",
              );
              const bumpResult = await bumpManifestVersion({
                manifestPath,
                fromVersion: manifestVersion,
                toVersion: nextVersion,
              });
              automation.versionsBumped += 1;
              automation.versionBumps.push({
                key,
                manifestPath,
                fromVersion: bumpResult.fromVersion,
                toVersion: bumpResult.toVersion,
              });
            } catch (error) {
              automation.failed += 1;
              automation.failedModules.push({
                key,
                stage: "version_autobump",
                message: toErrorMessage(error),
              });
            }
          }

          if (automation.versionBumps.length > 0) {
            const rediscoveredAll = await discoverModules({
              rootDir: discoveryRootInfo.projectRoot,
            });
            discovered.length = 0;
            discovered.push(
              ...(requestedModuleKey
                ? rediscoveredAll.filter(
                    (record) => record?.key === requestedModuleKey,
                  )
                : rediscoveredAll),
            );
          }
        }

        const validModules = discovered.filter(
          (record) => record.status === "VALID" && record.manifest,
        );
        const invalidModules = discovered.filter(
          (record) => record.status !== "VALID",
        );
        automation.modulesScanned = discovered.filter((record) =>
          isCustomModuleRecord(record),
        ).length;
        const customValidModules = validModules.filter((record) =>
          isCustomModuleRecord(record),
        );

        const customModuleKeys = customValidModules
          .map((record) => record?.manifest?.key)
          .filter((value) => typeof value === "string" && value.trim())
          .map((value) => value.trim());

        const customModuleRows =
          customModuleKeys.length > 0
            ? await prisma.atlasModule.findMany({
                where: { key: { in: customModuleKeys } },
                select: {
                  key: true,
                  version: true,
                  status: true,
                  enabled: true,
                  lifecycleConfig: true,
                },
              })
            : [];
        const customModuleRowsByKey = new Map(
          customModuleRows.map((row) => [row.key, row]),
        );

        const signatureByModuleKey = new Map(
          customValidModules.map((record) => [
            record.manifest.key,
            computeMigrationSignature(record.manifest),
          ]),
        );
        const customMigrationRows =
          customModuleKeys.length > 0
            ? await prisma.moduleMigration.findMany({
                where: { moduleKey: { in: customModuleKeys } },
                select: { moduleKey: true, filename: true },
              })
            : [];
        const appliedManifestFilenamesByModule = new Map();
        for (const row of customMigrationRows) {
          const moduleKey =
            typeof row?.moduleKey === "string" ? row.moduleKey.trim() : "";
          const filename =
            typeof row?.filename === "string" ? row.filename.trim() : "";
          if (!moduleKey || !filename) continue;
          if (!appliedManifestFilenamesByModule.has(moduleKey)) {
            appliedManifestFilenamesByModule.set(moduleKey, new Set());
          }
          appliedManifestFilenamesByModule.get(moduleKey).add(filename);
        }

        let lifecycleSync = { synced: 0, added: 0, updated: 0 };
        const discoveredKeys = new Set(
          validModules.map((record) => record.manifest.key),
        );
        const officialFallbackManifests = buildOfficialFallbackManifests({
          discoveredKeys,
        });
        const dependencySourceRecords = [...validModules];
        if (validModules.length > 0) {
          const syncManifests = validModules
            .map((record) => {
              if (autoRepairEnabled && isCustomModuleRecord(record)) {
                const migrationSignature = signatureByModuleKey.get(
                  record.manifest.key,
                );
                return mergeDiscoveryIntoManifest(record, {
                  extraLifecycle: {
                    dev: {
                      migrationSignature: migrationSignature ?? null,
                      migrationSignatureUpdatedAt: new Date().toISOString(),
                    },
                  },
                });
              }
              return mergeDiscoveryIntoManifest(record);
            })
            .filter(Boolean);
          syncManifests.push(...officialFallbackManifests);
          dependencySourceRecords.push(
            ...officialFallbackManifests.map((manifest) => ({ manifest })),
          );
          lifecycleSync = await svc.syncModules({
            manifests: syncManifests,
            actorId,
          });
        } else if (officialFallbackManifests.length > 0) {
          dependencySourceRecords.push(
            ...officialFallbackManifests.map((manifest) => ({ manifest })),
          );
          lifecycleSync = await svc.syncModules({
            manifests: officialFallbackManifests,
            actorId,
          });
        }

        const dependencySync = {
          synced: 0,
          removed: 0,
          errors: [],
          warnings: [],
          modules: [],
        };
        for (const record of dependencySourceRecords) {
          try {
            const moduleResult = await syncDiscoveredModuleDependencies({
              prisma,
              moduleKey: record.manifest.key,
              dependencies: record.manifest.dependencies ?? [],
            });
            dependencySync.synced += moduleResult.synced;
            dependencySync.removed += moduleResult.removed;
            dependencySync.modules.push(moduleResult);

            if (moduleResult.error) {
              dependencySync.errors.push({
                key: moduleResult.key,
                code: moduleResult.error.code,
                message: moduleResult.error.message,
              });
            }

            if (moduleResult.missingRequired.length > 0) {
              dependencySync.errors.push({
                key: moduleResult.key,
                code: "MISSING_REQUIRED_DEPENDENCY",
                message: `Dependencias requeridas faltantes: ${moduleResult.missingRequired.join(", ")}`,
                missing: moduleResult.missingRequired,
              });
            }

            if (moduleResult.missingOptional.length > 0) {
              dependencySync.warnings.push({
                key: moduleResult.key,
                code: "MISSING_OPTIONAL_DEPENDENCY",
                message: `Dependencias opcionales no encontradas: ${moduleResult.missingOptional.join(", ")}`,
                missing: moduleResult.missingOptional,
              });
            }
          } catch (error) {
            dependencySync.errors.push({
              key: record.key ?? record.manifest?.key ?? null,
              code: "DEPENDENCY_SYNC_FAILED",
              message: toErrorMessage(error),
            });
          }
        }

        const metadataSync = {
          synced: 0,
          errors: [],
        };

        for (const record of validModules) {
          try {
            await metadataSvc.syncModuleMetadata({
              manifest: record.manifest,
              models: record.models ?? [],
              views: record.views ?? [],
            });
            metadataSync.synced += 1;
          } catch (error) {
            metadataSync.errors.push({
              key: record.key ?? null,
              source: record.source ?? null,
              localPath: record.localPath ?? null,
              code: "METADATA_SYNC_FAILED",
              message: toErrorMessage(error),
            });
          }
        }

        const autoReconcileCandidates = [];
        if (autoRepairEnabled) {
          for (const record of customValidModules) {
            const key = record.manifest.key;
            const moduleRow = customModuleRowsByKey.get(key);
            if (
              !moduleRow ||
              moduleRow.status !== "INSTALLED" ||
              !moduleRow.enabled
            ) {
              continue;
            }

            const prevSignature =
              moduleRow?.lifecycleConfig?.dev &&
              typeof moduleRow.lifecycleConfig.dev === "object" &&
              !Array.isArray(moduleRow.lifecycleConfig.dev)
                ? (moduleRow.lifecycleConfig.dev.migrationSignature ?? null)
                : null;
            const nextSignature = signatureByModuleKey.get(key) ?? null;
            const signatureChanged = prevSignature !== nextSignature;
            const versionChanged =
              moduleRow.version !== record.manifest.version;
            const expectedManifestFilenames = (
              Array.isArray(record?.migrations) ? record.migrations : []
            )
              .map((migration) => toManifestMigrationFilename(migration?.path))
              .filter((value) => typeof value === "string" && value.trim());
            const appliedFilenames =
              appliedManifestFilenamesByModule.get(key) ?? new Set();
            const hasPendingManifestMigrations = expectedManifestFilenames.some(
              (filename) => !appliedFilenames.has(filename),
            );

            if (
              !signatureChanged &&
              !versionChanged &&
              !hasPendingManifestMigrations
            )
              continue;

            autoReconcileCandidates.push({
              key,
              previousVersion: moduleRow.version,
              nextVersion: record.manifest.version,
              signatureChanged,
              versionChanged,
              pendingManifestMigrations: hasPendingManifestMigrations,
            });
          }
        }

        const autoReconciledModuleKeys = new Set();
        for (const candidate of autoReconcileCandidates) {
          autoReconciledModuleKeys.add(candidate.key);
          try {
            const result = await svc.retryInstallModule({
              key: candidate.key,
              actorId,
              requestId: generateRequestId(),
            });
            const routeLoaderStatus = await safeRouteReload(candidate.key);
            automation.reinstalled += 1;
            automation.reinstalledModules.push({
              key: candidate.key,
              status: result?.status ?? "INSTALLED",
              previousVersion: candidate.previousVersion,
              nextVersion: candidate.nextVersion,
              signatureChanged: candidate.signatureChanged,
              versionChanged: candidate.versionChanged,
              pendingManifestMigrations: candidate.pendingManifestMigrations,
              routeLoader: routeLoaderStatus,
            });
          } catch (error) {
            automation.failed += 1;
            automation.failedModules.push({
              key: candidate.key,
              stage: classifyInstallStage(error),
              message: toErrorMessage(error),
              previousVersion: candidate.previousVersion,
              nextVersion: candidate.nextVersion,
              pendingManifestMigrations: candidate.pendingManifestMigrations,
            });
          }
        }

        const manifestMigrationsSync = {
          modules: [],
          applied: 0,
          alreadyApplied: 0,
          errors: [],
          skipped: [],
        };
        for (const record of validModules) {
          const moduleKey = record?.manifest?.key ?? null;
          if (autoReconciledModuleKeys.has(moduleKey)) {
            const skipped = {
              moduleKey,
              status: "skipped",
              reason: "handled_by_auto_reconcile",
              entries: [],
            };
            manifestMigrationsSync.modules.push(skipped);
            manifestMigrationsSync.skipped.push({
              moduleKey,
              reason: skipped.reason,
            });
            continue;
          }

          const result = await applyManifestMigrationsForRecord({ record });
          manifestMigrationsSync.modules.push(result);
          if (result.status === "skipped") {
            manifestMigrationsSync.skipped.push({
              moduleKey: result.moduleKey,
              reason: result.reason,
            });
            continue;
          }
          for (const entry of result.entries) {
            if (entry.status === "applied") manifestMigrationsSync.applied += 1;
            if (entry.status === "already_applied")
              manifestMigrationsSync.alreadyApplied += 1;
            if (entry.status === "error") {
              manifestMigrationsSync.errors.push({
                moduleKey: result.moduleKey,
                filename: entry.filename,
                path: entry.path,
                code: entry.code,
                message: entry.message ?? "Migration failed",
              });
            }
          }
        }

        const invalidUpserts = [];
        for (const record of invalidModules) {
          if (!record.key) continue;
          const upserted = await upsertDiscoveredModuleError({
            prisma,
            record,
          });
          if (!upserted) continue;
          invalidUpserts.push({
            key: upserted.key,
            status: upserted.status,
            enabled: upserted.enabled,
          });
        }

        const payload = {
          status:
            dependencySync.errors.length > 0 ||
            metadataSync.errors.length > 0 ||
            manifestMigrationsSync.errors.length > 0 ||
            automation.failed > 0 ||
            invalidModules.length > 0
              ? "partial"
              : "ok",
          scope: {
            moduleKey: requestedModuleKey,
            scoped: Boolean(requestedModuleKey),
            discoveredAll: discoveredAll.length,
            discoveredScoped: discovered.length,
          },
          discovered: discovered.length,
          valid: validModules.length,
          invalid: invalidModules.length,
          lifecycleSync,
          officialFallbackSync: {
            used: officialFallbackManifests.length > 0,
            modulesCount: officialFallbackManifests.length,
            moduleKeys: officialFallbackManifests.map(
              (manifest) => manifest.key,
            ),
          },
          dependencySync,
          metadataSync,
          manifestMigrationsSync,
          invalidUpserts,
          automation,
          modules: discovered.map(serializeDiscoveredModule),
        };

        if (routeLoader) {
          const touchedModuleKeys = validModules
            .map((record) => record?.manifest?.key)
            .filter((value) => typeof value === "string" && value.trim())
            .map((value) => value.trim());
          payload.routeLoaderSync = await routeLoader.syncInstalledModules({
            limitToModuleKeys: touchedModuleKeys,
          });
        }

        if (bundlerSvc) {
          const keysToBundle = validModules
            .map((record) => record?.manifest?.key)
            .filter((value) => typeof value === "string" && value.trim());
          for (const key of keysToBundle) {
            await safeBuildBundle(key);
          }
        }

        if (process.env.NODE_ENV !== "production") {
          payload.debug = {
            cwd: discoveryRootInfo.cwd,
            projectRoot: discoveryRootInfo.projectRoot,
            modulesDirExists: discoveryRootInfo.modulesDirExists,
            customModulesDirExists: discoveryRootInfo.customModulesDirExists,
            officialModulesDirExists:
              discoveryRootInfo.officialModulesDirExists,
          };
        }

        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        return c.json({ data: payload });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo sincronizar los modulos.",
        );
      }
    },
  );

  // ── GET /modules/:key/lifecycle ───────────────────────────────────────────

  app.get(
    "/:key/lifecycle",
    authMiddleware,
    requirePermission("core.modules.read"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const mod = await prisma.atlasModule.findUnique({
          where: { key },
          include: {
            dependencies: {
              include: {
                dependency: {
                  select: {
                    key: true,
                    name: true,
                    status: true,
                    enabled: true,
                  },
                },
              },
            },
          },
        });
        if (!mod) return c.json({ error: "Modulo no encontrado." }, 404);

        const lc = mod.lifecycleConfig ?? {};
        const permissionsTotal = await prisma.permission.count({
          where: { moduleId: mod.id },
        });
        const permissionsActive = await prisma.permission.count({
          where: { moduleId: mod.id, active: true },
        });
        const dependents = await prisma.moduleDependency.findMany({
          where: {
            dependencyId: mod.id,
            module: { status: "INSTALLED", enabled: true },
          },
          include: { module: { select: { key: true, name: true } } },
        });

        return c.json({
          data: {
            key: mod.key,
            status: mod.status,
            enabled: mod.enabled,
            core: mod.core,
            installable: lc.installable ?? true,
            uninstallable: mod.uninstallable,
            resettable: lc.resettable ?? false,
            supportsDataPurge: lc.supportsDataPurge ?? false,
            ownedEntities: lc.ownedEntities ?? [],
            permissionsTotal,
            permissionsActive,
            dependents: dependents.map((d) => ({
              key: d.module.key,
              name: d.module.name,
            })),
            dependencies: mod.dependencies.map((d) => ({
              key: d.dependency.key,
              name: d.dependency.name,
              status: d.dependency.status,
              enabled: d.dependency.enabled,
              optional: d.optional,
            })),
          },
        });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo cargar el ciclo de vida del modulo.",
        );
      }
    },
  );

  // ── GET /modules/:key/migrations ─────────────────────────────────────────

  app.get(
    "/:key/migrations",
    authMiddleware,
    requirePermission("core.modules.read"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const mod = await prisma.atlasModule.findUnique({
          where: { key },
          select: { key: true },
        });
        if (!mod) return c.json({ error: "Modulo no encontrado." }, 404);

        const migrations = await migrationSvc.listAppliedMigrations(key);
        return c.json({ data: migrations });
      } catch (err) {
        console.error("[modules] GET /:key/migrations error:", err);
        return c.json(
          { error: "No se pudieron cargar las migraciones del modulo." },
          500,
        );
      }
    },
  );

  // ── POST /modules/:key/disable ────────────────────────────────────────────

  app.get(
    "/:key/error",
    authMiddleware,
    requirePermission("core.modules.read"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const data = await svc.getModuleInstallError({ key });
        return c.json({ data });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo obtener el error del modulo.",
        );
      }
    },
  );

  app.post(
    "/:key/retry-install",
    authMiddleware,
    requirePermission("core.modules.create"),
    async (c) => {
      const requestId = generateRequestId();
      const isDev = process.env.NODE_ENV !== "production";
      const key = c.req.param("key");
      try {
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const result = await svc.retryInstallModule({
          key,
          actorId,
          requestId,
        });
        const rlStatus = await safeRouteReload(key);
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        return c.json({ data: result, routeLoader: rlStatus });
      } catch (err) {
        const stage = classifyInstallStage(err);
        const code =
          err?.code ??
          (err instanceof ModuleLifecycleError
            ? "LIFECYCLE_ERROR"
            : "INTERNAL_ERROR");

        console.error("[modules] POST /:key/retry-install failed", {
          requestId,
          moduleKey: key,
          stage,
          errorName: err?.name ?? null,
          errorMessage: err?.message ?? null,
          errorCode: err?.code ?? null,
          causeMessage: err?.cause?.message ?? null,
          causeCode: err?.cause?.code ?? null,
          filename: err?.filename ?? null,
          tableName: err?.tableName ?? null,
          sqlPreview: err?.sqlPreview ?? err?.cause?.sqlPreview ?? null,
          statementPreview:
            err?.statementPreview ?? err?.cause?.statementPreview ?? null,
          stack: err?.stack ?? null,
        });

        if (err instanceof ModuleLifecycleError) {
          return c.json(
            { error: err.message, code, moduleKey: key, stage, requestId },
            err.status,
          );
        }
        return c.json(
          {
            error: "No se pudo reintentar la instalacion del modulo.",
            code,
            moduleKey: key,
            stage,
            requestId,
            ...(isDev
              ? {
                  details: err?.message ?? null,
                  cause: err?.cause?.message ?? null,
                }
              : {}),
          },
          500,
        );
      }
    },
  );

  app.post(
    "/:key/clear-error",
    authMiddleware,
    requirePermission("core.modules.update"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const body = await c.req.json().catch(() => ({}));
        const parsed = moduleClearErrorSchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            { error: parsed.error.errors[0]?.message ?? "Datos invalidos." },
            400,
          );
        }
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const result = await svc.clearFailedInstall({
          key,
          actorId,
          mode: parsed.data.mode,
        });
        safeRouteUnload(key);
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        return c.json({ data: result });
      } catch (err) {
        return handleLifecycleError(c, err, "No se pudo restaurar el modulo.");
      }
    },
  );

  app.post(
    "/:key/cleanup-dry-run",
    authMiddleware,
    requirePermission("core.modules.delete"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const body = await c.req.json().catch(() => ({}));
        const parsed = moduleCleanupDryRunSchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            { error: parsed.error.errors[0]?.message ?? "Datos invalidos." },
            400,
          );
        }
        const result = await svc.dryRunFailedInstallCleanup({
          key,
          mode: parsed.data.mode,
        });
        return c.json({ data: result });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo ejecutar la simulacion de limpieza.",
        );
      }
    },
  );

  app.post(
    "/:key/cleanup",
    authMiddleware,
    requirePermission("core.modules.delete"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const body = await c.req.json().catch(() => ({}));
        const parsed = moduleCleanupSchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            { error: parsed.error.errors[0]?.message ?? "Datos invalidos." },
            400,
          );
        }
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const result = await svc.clearFailedInstall({
          key,
          actorId,
          mode: parsed.data.mode,
          confirmation: parsed.data.confirmation,
        });
        safeRouteUnload(key);
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        return c.json({ data: result });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo limpiar el intento fallido del modulo.",
        );
      }
    },
  );

  app.post(
    "/:key/disable",
    authMiddleware,
    requirePermission("core.modules.update"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const result = await svc.disableModule({ key, actorId });
        const rlUnloaded = safeRouteUnload(key);
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        const { actorName } = getActivityContext(c);
        await publishActivityFromContext(prisma, c, {
          type: "core.module.disable",
          severity: "warning",
          entityType: "AtlasModule",
          entityId: key,
          summary: `${actorName} deshabilitó el módulo ${key}`,
        });
        return c.json({
          data: result,
          routeLoader: { unloaded: rlUnloaded ?? false },
        });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo deshabilitar el modulo.",
        );
      }
    },
  );

  // ── POST /modules/:key/enable ─────────────────────────────────────────────

  app.post(
    "/:key/enable",
    authMiddleware,
    requirePermission("core.modules.update"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const result = await svc.enableModule({ key, actorId });
        const rlStatus = await safeRouteReload(key);
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        const { actorName } = getActivityContext(c);
        await publishActivityFromContext(prisma, c, {
          type: "core.module.enable",
          severity: "info",
          entityType: "AtlasModule",
          entityId: key,
          summary: `${actorName} habilitó el módulo ${key}`,
        });
        return c.json({ data: result, routeLoader: rlStatus });
      } catch (err) {
        return handleLifecycleError(c, err, "No se pudo habilitar el modulo.");
      }
    },
  );

  // ── DELETE /modules/:key (preserve-data uninstall shorthand) ─────────────

  app.delete(
    "/:key",
    authMiddleware,
    requirePermission("core.modules.delete"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const context = c.get("userContext");
        const companyId = context?.memberships?.[0]?.companyId ?? null;
        const result = await svc.uninstallModule({
          key,
          mode: "preserve-data",
          companyId,
          actorId,
        });
        const rlUnloaded = safeRouteUnload(key);
        await safeDeleteBundle(key);
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        const { actorName } = getActivityContext(c);
        await publishActivityFromContext(prisma, c, {
          type: "core.module.uninstall",
          severity: "critical",
          entityType: "AtlasModule",
          entityId: key,
          summary: `${actorName} desinstaló el módulo ${key} (preservando datos)`,
        });
        return c.json({
          data: result,
          routeLoader: { unloaded: rlUnloaded ?? false },
        });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo desinstalar el modulo.",
        );
      }
    },
  );

  // ── POST /modules/:key/uninstall/dry-run ──────────────────────────────────

  app.post(
    "/:key/uninstall/dry-run",
    authMiddleware,
    requirePermission("core.modules.delete"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const body = await c.req.json().catch(() => ({}));
        const parsed = moduleDryRunSchema.safeParse(body);
        const mode = parsed.success
          ? (parsed.data.mode ?? defaultUninstallModeForKey(key))
          : defaultUninstallModeForKey(key);
        const context = c.get("userContext");
        const companyId = context?.memberships?.[0]?.companyId ?? null;
        const result = await svc.dryRunUninstall({ key, mode, companyId });
        return c.json({ data: result });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo ejecutar la simulacion de desinstalacion.",
        );
      }
    },
  );

  // ── POST /modules/:key/uninstall ──────────────────────────────────────────

  app.post(
    "/:key/uninstall",
    authMiddleware,
    requirePermission("core.modules.delete"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const body = await c.req.json();
        const parsed = moduleUninstallSchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            { error: parsed.error.errors[0]?.message ?? "Datos invalidos." },
            400,
          );
        }
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const context = c.get("userContext");
        const companyId = context?.memberships?.[0]?.companyId ?? null;
        const mode = parsed.data.mode ?? defaultUninstallModeForKey(key);
        const result = await svc.uninstallModule({
          key,
          mode,
          companyId,
          actorId,
          confirmation: parsed.data.confirmation ?? null,
        });
        const rlUnloaded = safeRouteUnload(key);
        await safeDeleteBundle(key);
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        const { actorName } = getActivityContext(c);
        await publishActivityFromContext(prisma, c, {
          type: "core.module.uninstall",
          severity: "critical",
          entityType: "AtlasModule",
          entityId: key,
          summary: `${actorName} desinstaló el módulo ${key} (${mode})`,
        });
        return c.json({
          data: result,
          routeLoader: { unloaded: rlUnloaded ?? false },
        });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo desinstalar el modulo.",
        );
      }
    },
  );

  // ── POST /modules/:key/reset/dry-run ─────────────────────────────────────

  app.post(
    "/:key/reset/dry-run",
    authMiddleware,
    requirePermission("core.modules.delete"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const context = c.get("userContext");
        const companyId = context?.memberships?.[0]?.companyId ?? null;
        const result = await svc.dryRunReset({ key, companyId });
        return c.json({ data: result });
      } catch (err) {
        return handleLifecycleError(
          c,
          err,
          "No se pudo ejecutar la simulacion de reinicio.",
        );
      }
    },
  );

  // ── POST /modules/:key/reset ──────────────────────────────────────────────

  app.post(
    "/:key/reset",
    authMiddleware,
    requirePermission("core.modules.delete"),
    async (c) => {
      try {
        const key = c.req.param("key");
        const body = await c.req.json();
        const parsed = moduleResetSchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            { error: parsed.error.errors[0]?.message ?? "Datos invalidos." },
            400,
          );
        }
        const actorId = c.get("userContext")?.profile?.id ?? null;
        const context = c.get("userContext");
        const companyId = context?.memberships?.[0]?.companyId ?? null;
        const result = await svc.resetModule({ key, companyId, actorId });
        await safeBuildBundle(key, { force: true });
        cacheDel("blueprints:raw");
        cacheDel("runtime:modules:raw");
        const { actorName } = getActivityContext(c);
        await publishActivityFromContext(prisma, c, {
          type: "core.module.reset",
          severity: "warning",
          entityType: "AtlasModule",
          entityId: key,
          summary: `${actorName} reinició el módulo ${key}`,
        });
        return c.json({ data: result });
      } catch (err) {
        return handleLifecycleError(c, err, "No se pudo reiniciar el modulo.");
      }
    },
  );

  // ── GET /modules/:key/bundle.js ───────────────────────────────────────────
  // The bundle is served with its original bare-specifier imports intact.
  // The frontend HTML injects an importmap (via Vite plugin) that resolves
  // those specifiers both in dev (/@id/ virtual modules) and in production
  // (/app/shims/ext-*.js shim chunks).  No server-side rewriting is needed.
  app.get("/:key/bundle.js", async (c) => {
    const key = c.req.param("key");

    if (!/^[\w.-]+$/.test(key)) {
      return c.json({ error: "Clave de modulo invalida." }, 400);
    }

    const moduleRow = await prisma.atlasModule.findUnique({
      where: { key },
      select: {
        status: true,
        enabled: true,
        hasBundle: true,
        bundleHash: true,
      },
    });

    if (
      !moduleRow ||
      moduleRow.status !== "INSTALLED" ||
      !moduleRow.enabled ||
      !moduleRow.hasBundle
    ) {
      return c.json({ error: "Bundle no disponible." }, 404);
    }

    const bundlePath = path.join(BUNDLES_DIR_SERVE, `${key}.js`);

    let content;
    try {
      content = await fs.readFile(bundlePath, "utf8");
    } catch {
      return c.json(
        { error: "Bundle no encontrado. Ejecuta sync para reconstruirlo." },
        404,
      );
    }

    c.header("Content-Type", "application/javascript");
    c.header("ETag", `"${moduleRow.bundleHash ?? key}"`);
    c.header(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, max-age=3600"
        : "no-store",
    );
    return c.body(content);
  });

  return app;
}
