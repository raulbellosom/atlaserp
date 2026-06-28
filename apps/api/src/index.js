import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import ExcelJS from "exceljs";
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const { PrismaClient } = pkg;
import { createClient } from "@supabase/supabase-js";
import {
  createUserSchema,
  fileBulkDownloadSchema,
  fileRenameSchema,
  hrCatalogCreateSchema,
  hrCatalogEnabledSchema,
  hrCatalogUpdateSchema,
  hrEmployeeCreateSchema,
  hrEmployeeEnabledSchema,
  hrEmployeeUpdateSchema,
  moduleInstallSchema,
  setupInitializeSchema,
} from "@atlas/validators";
import { formatLogTimestamp, getConfiguredTimeZone } from "@atlas/core";
import {
  getPermissionPresentation,
  groupPermissionsForUi,
} from "./permission-catalog.js";
import {
  createContactsService,
  ContactsServiceError,
} from "./services/contacts-service.js";
import {
  createFilesService,
  FilesServiceError,
} from "./services/files-service.js";
import {
  createCompanyService,
  CompanyServiceError,
} from "./services/company-service.js";
import { createHrService, HrServiceError } from "./services/hr-service.js";
import { createInventoryService, InventoryServiceError } from "./services/inventory-service.js";
import { createInventoryNotificationService } from "./services/inventory-notification-service.js";
import { createCommentsService, CommentsServiceError } from "./services/comments-service.js";
import { buildEmployeesExcelBuffer } from "./services/hr-export-service.js";
import { createModulesRouter } from "./routes/modules.js";
import {
  createPublicWebsiteRouter,
  createPublicCatalogRouter,
} from "./routes/public-website.js";
import { createPublicFormsRouter } from "./routes/website/forms-public-routes.js";
import { createPublicBookingsRouter } from "./routes/website/bookings-routes.js";
import { createPublicCheckoutRouter } from "./routes/website/checkout-routes.js";
import { createStorefrontRouter } from "./routes/storefront/storefront-router.js";
import { createWebsiteRouter } from "./routes/website/index.js";
import { createLedgerRouter } from "./routes/ledger/index.js";
import { createUsersRouter } from './routes/users-routes.js'
import { createFleetRouter } from "./routes/fleet/index.js";
import { createCatalogRouter } from "./routes/catalog/index.js";
import { createPosRouter } from "./routes/pos/index.js";
import { createCalendarRouter } from "./routes/calendar/index.js";
import { createProjectsRouter } from "./routes/projects/index.js";
import { createSettingsRouter } from "./routes/settings-routes.js";
import { createActivityRouter } from "./routes/activity.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createGrowthRouter } from "./routes/growth/growth-router.js";
import { createDocumentsRouter } from "./routes/documents/documents-router.js";
import { createSyncRouter } from "./routes/sync.js";
import { createPwaRouter } from "./routes/pwa.js";
import { createChatRouter } from "./routes/chat/index.js";
import { createNotesRouter } from "./routes/notes/index.js";
import { createSharesService as createNotesSharesService } from "./routes/notes/shares-service.js";
import {
  publishActivityFromContext,
  getActivityContext,
} from "./services/activity-publisher.js";
import { createModuleBundlerService } from "./services/module-bundler-service.js";
import { createRouteLoaderService } from "./services/route-loader-service.js";
import { createDistServeService } from "./services/dist-serve-service.js";
import { createNotificationDeliveryWorker } from "./services/notification-delivery-worker.js";
import { createNotificationService } from "./services/notification-service.js";
import { createRealtimeBroadcaster } from "./services/realtime-broadcaster.js";
import {
  get as cacheGet,
  set as cacheSet,
  del as cacheDel,
  delByPrefix as cacheDelByPrefix,
  TTL,
} from "./lib/cache.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({
  path: [
    path.resolve(currentDir, "../.env"),
    path.resolve(currentDir, "../../../.env"),
  ],
});

const prismaConnectionString =
  process.env.DATABASE_URL ?? process.env.DIRECT_URL;
// Use an explicit pg Pool with keepAlive so firewalls/VPS idle timeouts don't
// silently drop connections and cause "Connection terminated unexpectedly" crashes.
const pgPool = new pg.Pool({
  connectionString: prismaConnectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});
const prismaAdapter = new PrismaPg(pgPool);
const prisma = new PrismaClient({ adapter: prismaAdapter });
const app = new Hono();
const port = Number(process.env.ATLAS_API_PORT ?? 4010);
const contactsService = createContactsService({ prisma });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);
const broadcaster = createRealtimeBroadcaster({
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
const CORE_MODULE_KEYS = new Set([
  "atlas.core",
  "atlas.identity",
  "atlas.files",
  "atlas.company",
  "atlas.contacts",
  "atlas.hr",
  "atlas.fleet",
  "atlas.ledger",
  "atlas.calendar",
  "atlas.catalog",
  "atlas.notifications",
  "atlas.growth",
  "atlas.documents",
  "atlas.inventory",
]);
const STORAGE_BUCKET_NAME = "atlas-files";
const STOREFRONT_BUCKET_NAME = "atlas-storefront";
const WEBSITE_BUCKET_NAME = "atlas-website";
const filesService = createFilesService({ prisma, supabaseAdmin });
const companyService = createCompanyService({ prisma, supabaseAdmin });
const bundlerService = createModuleBundlerService({ prisma, supabaseAdmin });
const hrService = createHrService({ prisma });
const notificationDeliveryWorker = createNotificationDeliveryWorker({ prisma });
const notificationService = createNotificationService({ prisma, broadcaster });
const distServeService = createDistServeService({ prisma, supabaseAdmin });
const inventoryService = createInventoryService({ prisma });
const inventoryNotifSvc = createInventoryNotificationService({ prisma, notificationService });
const commentsService = createCommentsService({ prisma });

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function translateSupabaseCreateUserError(error) {
  const msg = error?.message?.toLowerCase?.() ?? "";
  if (
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("duplicate")
  ) {
    return "Ya existe un usuario con ese correo electrónico.";
  }
  if (msg.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }
  return (
    error?.message ||
    "No se pudo crear el usuario administrador en Supabase Auth."
  );
}

function mapSetupError(err) {
  if (err?.message === "Logo upload failed") {
    return {
      status: 500,
      error: "No se pudo subir el logotipo.",
    };
  }
  if (err?.code === "P2022") {
    return {
      status: 500,
      error:
        "La base de datos está desactualizada. Ejecuta: pnpm db:migrate && pnpm db:seed",
    };
  }
  if (err?.code === "P2002") {
    return {
      status: 409,
      error:
        "Ya existe un registro con datos únicos duplicados (correo, slug o RFC).",
    };
  }
  if (err?.code === "P1001" || err?.code === "P1002") {
    return {
      status: 503,
      error:
        "No se pudo conectar a PostgreSQL. Verifica la conexión de base de datos y vuelve a intentar.",
    };
  }
  return { status: 500, error: "Error interno al inicializar la instancia." };
}

// Verify a Supabase HS256 JWT locally without a network call.
// Returns the payload if valid, null otherwise.
function verifySupabaseJwt(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    const expectedBuf = Buffer.from(expectedSig);
    const receivedBuf = Buffer.from(signatureB64);
    // timingSafeEqual requires identical lengths; mismatch means invalid signature
    if (expectedBuf.length !== receivedBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

async function authMiddleware(c, next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token)
    return c.json({ error: "No autorizado. Debes iniciar sesion." }, 401);

  const cacheKey = `auth:token:${token.slice(-32)}`;
  let userId = cacheGet(cacheKey);
  if (!userId) {
    // Prefer local JWT verification — no network call, resilient to VPS connectivity issues.
    // SUPABASE_JWT_SECRET is the secret Supabase uses to sign its access tokens.
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    const payload = jwtSecret ? verifySupabaseJwt(token, jwtSecret) : null;

    if (payload?.sub) {
      userId = payload.sub;
      // Cache until token expiry minus 30s buffer (cap at 5 min for safety)
      const ttlSecs = payload.exp
        ? Math.min(payload.exp - Math.floor(Date.now() / 1000) - 30, 300)
        : TTL.USER_CONTEXT;
      if (ttlSecs > 0) cacheSet(cacheKey, userId, ttlSecs);
    } else {
      // Fallback: verify via Supabase network call (handles unknown alg, rotated secrets)
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        return c.json({ error: "No autorizado. Token invalido o expirado." }, 401);
      }
      userId = data.user.id;
      cacheSet(cacheKey, userId, TTL.USER_CONTEXT);
    }
  }

  c.set("authUserId", userId);
  await next();
}

const ADMIN_ROLE_KEYS = new Set(["atlas.admin", "system.admin"]);
const BASE_PERMISSION_KEYS = new Set(["profile.self.read"]);

async function getUserContextByAuthId(authUserId) {
  const cacheKey = `user_ctx:${authUserId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const profile = await prisma.userProfile.findUnique({
    where: { authUserId },
  });
  if (!profile) return null;
  const memberships = await prisma.membership.findMany({
    where: { userId: profile.id, enabled: true },
    include: {
      company: { select: { id: true, name: true, slug: true } },
      role: {
        include: {
          permissions: {
            where: { permission: { active: true } },
            include: {
              permission: {
                select: { key: true },
              },
            },
          },
        },
      },
    },
  });

  const activeMemberships = memberships.filter((membership) =>
    Boolean(membership?.role?.enabled),
  );
  const adminMembership = activeMemberships.find((membership) =>
    ADMIN_ROLE_KEYS.has(membership?.role?.key),
  );
  const roleKey =
    adminMembership?.role?.key ?? activeMemberships[0]?.role?.key ?? null;
  const isAdmin = ADMIN_ROLE_KEYS.has(roleKey);
  const permissionSet = new Set(BASE_PERMISSION_KEYS);
  for (const membership of activeMemberships) {
    for (const rolePermission of membership.role?.permissions ?? []) {
      const key = rolePermission?.permission?.key;
      if (key) permissionSet.add(key);
    }
  }
  if (isAdmin) {
    const allPermissions = await prisma.permission.findMany({
      where: { active: true },
      select: { key: true },
      take: 1000,
    });
    for (const permission of allPermissions) {
      permissionSet.add(permission.key);
    }
  }

  const context = {
    profile,
    memberships: activeMemberships,
    roleKey,
    isAdmin,
    permissions: [...permissionSet].sort(),
    permissionSet,
  };
  cacheSet(cacheKey, context, TTL.USER_CONTEXT);
  return context;
}

async function getOrLoadUserContext(c) {
  const current = c.get("userContext");
  if (current) return current;
  const authUserId = c.get("authUserId");
  if (!authUserId) return null;
  try {
    const context = await getUserContextByAuthId(authUserId);
    if (!context) return null;
    c.set("userContext", context);
    return context;
  } catch (err) {
    console.error("[getOrLoadUserContext] DB error:", err?.message ?? err);
    if (err?.stack) console.error(err.stack);
    return null;
  }
}

function forbiddenMessage(permissionKey) {
  if (!permissionKey) return "No tienes permisos para realizar esta accion.";
  const label = getPermissionPresentation(permissionKey).name.toLowerCase();
  return `No tienes permisos para ${label}.`;
}

function requirePermission(permissionKey) {
  return async (c, next) => {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) {
      return c.json(
        { error: "No autorizado. Perfil de usuario no encontrado." },
        401,
      );
    }
    c.set("companyId", context.memberships?.[0]?.companyId ?? null);
    c.set("userId", context.profile.id);
    if (context.isAdmin || context.permissionSet.has(permissionKey)) {
      await next();
      return;
    }
    return c.json({ error: forbiddenMessage(permissionKey) }, 403);
  };
}

function requireAnyPermission(permissionKeys = []) {
  return async (c, next) => {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) {
      return c.json(
        { error: "No autorizado. Perfil de usuario no encontrado." },
        401,
      );
    }
    c.set("companyId", context.memberships?.[0]?.companyId ?? null);
    c.set("userId", context.profile.id);
    if (context.isAdmin) {
      await next();
      return;
    }
    const keys = Array.isArray(permissionKeys) ? permissionKeys : [];
    const allowed = keys.some((key) => context.permissionSet.has(key));
    if (!allowed) {
      return c.json({ error: forbiddenMessage(keys.join(" o ")) }, 403);
    }
    await next();
  };
}

function getModuleRequiredPermission(moduleRow) {
  const manifest = moduleRow?.manifest ?? {};
  const aclModule = manifest?.acl?.module;
  if (typeof aclModule === "string" && aclModule.trim().length > 0) {
    return aclModule.trim();
  }
  return null;
}

function filterModuleNavigation(moduleRow, permissionSet, isAdmin) {
  const manifest = moduleRow?.manifest ?? {};
  const navigation = Array.isArray(manifest.navigation)
    ? manifest.navigation
    : [];
  const filteredNavigation = navigation.filter((item) => {
    const navPermission = item?.permissionKey;
    if (isAdmin) return true;
    if (!navPermission) return false;
    return permissionSet.has(navPermission);
  });
  return {
    ...manifest,
    navigation: filteredNavigation,
  };
}

function userCanAccessModule(context, moduleRow) {
  if (!context) return false;
  if (context.isAdmin) return true;
  const modulePermission = getModuleRequiredPermission(moduleRow);
  if (!modulePermission) return false;
  return context.permissionSet.has(modulePermission);
}

function requireModuleAccess(moduleKey) {
  return async (c, next) => {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) {
      return c.json(
        { error: "No autorizado. Perfil de usuario no encontrado." },
        401,
      );
    }
    const moduleRow = await prisma.atlasModule.findUnique({
      where: { key: moduleKey },
      select: {
        key: true,
        status: true,
        enabled: true,
        manifest: true,
      },
    });
    if (!moduleRow) {
      return c.json({ error: "Modulo no encontrado." }, 404);
    }
    if (!userCanAccessModule(context, moduleRow)) {
      return c.json(
        { error: `No tienes permisos para acceder al modulo ${moduleKey}.` },
        403,
      );
    }
    await next();
  };
}

async function syncAdminRolesPermissions(db) {
  const adminRoles = await db.role.findMany({
    where: { key: { in: ["atlas.admin", "system.admin"] } },
    select: { id: true },
  });
  if (adminRoles.length === 0) return;

  const permissions = await db.permission.findMany({
    select: { id: true },
  });

  for (const adminRole of adminRoles) {
    await db.rolePermission.deleteMany({
      where: { roleId: adminRole.id },
    });
    if (!permissions.length) continue;
    await db.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: adminRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
}

async function ensureSetupAdminRole(db) {
  return db.role.upsert({
    where: { key: "atlas.admin" },
    update: {
      enabled: true,
      system: true,
      name: "Atlas Admin",
      description: "Acceso total del sistema",
    },
    create: {
      key: "atlas.admin",
      name: "Atlas Admin",
      description: "Acceso total del sistema",
      system: true,
      enabled: true,
    },
  });
}

async function getSignedUrlByFileId(fileId) {
  if (!fileId) return null;
  const fileAsset = await prisma.fileAsset.findUnique({
    where: { id: fileId },
  });
  if (!fileAsset) return null;
  const { data } = await supabaseAdmin.storage
    .from(fileAsset.bucket)
    .createSignedUrl(fileAsset.objectKey, 3600);
  return data?.signedUrl ?? null;
}

function toPositiveInt(value, fallback, { min = 1, max = 500 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const int = Math.floor(num);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

function normalizeIdentityUsersQuery(query = {}) {
  const page = toPositiveInt(query.page, 1, { min: 1, max: 100000 });
  const pageSize = toPositiveInt(query.pageSize, 20, { min: 1, max: 200 });
  const search = String(query.search ?? "").trim();
  const enabledRaw = String(query.enabled ?? "")
    .trim()
    .toLowerCase();
  const enabled =
    enabledRaw === "true" ? true : enabledRaw === "false" ? false : null;
  const sortByRaw = String(query.sortBy ?? "").trim();
  const sortDirRaw = String(query.sortDir ?? "")
    .trim()
    .toLowerCase();
  const sortDir = sortDirRaw === "asc" ? "asc" : "desc";

  return { page, pageSize, search, enabled, sortBy: sortByRaw, sortDir };
}

function toIdentitySortOrder(sortBy, sortDir) {
  const dir = sortDir === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "firstName":
      return [{ firstName: dir }, { createdAt: "desc" }];
    case "lastName":
      return [{ lastName: dir }, { createdAt: "desc" }];
    case "displayName":
      return [{ displayName: dir }, { createdAt: "desc" }];
    case "email":
      return [{ email: dir }, { createdAt: "desc" }];
    case "enabled":
      return [{ enabled: dir }, { createdAt: "desc" }];
    case "createdAt":
      return [{ createdAt: dir }];
    default:
      return [{ createdAt: "desc" }];
  }
}

function parseIdentityUserIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      ),
    );
}

const PROTECTED_IDENTITY_ROLE_KEYS = new Set(["atlas.admin", "system.admin"]);

function hasProtectedIdentityAdminRole(user) {
  const memberships = Array.isArray(user?.memberships) ? user.memberships : [];
  return memberships.some((membership) => {
    if (!membership?.enabled) return false;
    const roleKey = String(membership?.role?.key ?? "")
      .trim()
      .toLowerCase();
    return PROTECTED_IDENTITY_ROLE_KEYS.has(roleKey);
  });
}

function buildIdentityUsersWhere({ search, enabled }) {
  const where = {};
  if (typeof enabled === "boolean") {
    where.enabled = enabled;
  }
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      {
        memberships: {
          some: {
            enabled: true,
            role: { name: { contains: search, mode: "insensitive" } },
          },
        },
      },
    ];
  }
  return where;
}

async function buildAvatarUrlMapByFileIds(fileIds) {
  const avatarUrlMap = new Map();
  if (!fileIds.length) return avatarUrlMap;

  const fileAssets = await prisma.fileAsset.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, bucket: true, objectKey: true },
  });
  const byBucket = new Map();
  for (const asset of fileAssets) {
    if (!byBucket.has(asset.bucket)) byBucket.set(asset.bucket, []);
    byBucket.get(asset.bucket).push(asset);
  }
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, assets]) => {
      const paths = assets.map((asset) => asset.objectKey);
      const { data: signedList } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrls(paths, 3600);
      if (!Array.isArray(signedList)) return;
      for (let index = 0; index < assets.length; index += 1) {
        avatarUrlMap.set(
          assets[index].id,
          signedList[index]?.signedUrl ?? null,
        );
      }
    }),
  );

  return avatarUrlMap;
}

function serializeIdentityUser(user, avatarUrlMap) {
  return {
    ...user,
    avatarUrl: user.avatarFileId
      ? (avatarUrlMap.get(user.avatarFileId) ?? null)
      : null,
    memberships: (user.memberships ?? []).map((membership) => ({
      id: membership.id,
      companyId: membership.companyId,
      companyName: membership.company?.name ?? null,
      roleId: membership.roleId,
      roleKey: membership.role?.key ?? null,
      roleName: membership.role?.name ?? null,
      enabled: membership.enabled,
    })),
  };
}

async function uploadIdentityAvatar({ profileId, file }) {
  const ext = file.name.split(".").pop() || "png";
  const objectKey = `modules/atlas-identity/userprofile/${profileId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET_NAME)
    .upload(objectKey, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });
  if (uploadError) {
    throw new Error("UPLOAD_FAILED");
  }

  const asset = await prisma.fileAsset.create({
    data: {
      bucket: STORAGE_BUCKET_NAME,
      objectKey,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      moduleKey: "atlas.identity",
      entityType: "UserProfile",
      entityId: profileId,
    },
  });

  await prisma.userProfile.update({
    where: { id: profileId },
    data: { avatarFileId: asset.id },
  });

  return asset;
}

async function ensureBuckets() {
  await supabaseAdmin.storage
    .createBucket(STORAGE_BUCKET_NAME, { public: false })
    .catch(() => {});
  await supabaseAdmin.storage
    .createBucket(STOREFRONT_BUCKET_NAME, { public: true, fileSizeLimit: 104857600, allowedMimeTypes: ['image/*', 'audio/*', 'video/*', 'application/pdf'] })
    .catch(() => {});
  await supabaseAdmin.storage.createBucket(WEBSITE_BUCKET_NAME, { public: true, fileSizeLimit: 104857600, allowedMimeTypes: [] }).catch(() => {});
  // updateBucket with allowedMimeTypes:null is rejected by self-hosted Supabase Storage — use SQL directly
  await prisma.$executeRaw`
    UPDATE storage.buckets
    SET public = TRUE, allowed_mime_types = NULL, file_size_limit = 104857600
    WHERE id = ${WEBSITE_BUCKET_NAME}
  `.catch((e) => console.error('[ensureBuckets] SQL update failed:', e.message));
  await supabaseAdmin.storage
    .createBucket("atlas-chat", { public: false, fileSizeLimit: 52428800 }) // 50 MB
    .catch(() => {});
}

function serializeModulesForResponse(modules, context, options = {}) {
  const { filterByPermission = false, filterNavigation = false } = options;

  return modules
    .filter((moduleRow) => {
      if (!filterByPermission) return true;
      return userCanAccessModule(context, moduleRow);
    })
    .map((mod) => {
      const compatibility = mod.dependencies.map((dep) => {
        const active =
          dep.dependency?.status === "INSTALLED" && dep.dependency?.enabled;
        return {
          key: dep.dependency?.key,
          name: dep.dependency?.name,
          required: !dep.optional,
          versionRange: dep.versionRange ?? null,
          active: Boolean(active),
        };
      });
      const blocking = compatibility.filter(
        (dep) => dep.required && !dep.active,
      );
      const manifest =
        filterNavigation && context
          ? filterModuleNavigation(mod, context.permissionSet, context.isAdmin)
          : mod.manifest;
      return {
        ...mod,
        manifest,
        compatibility,
        compatibilityStatus: blocking.length === 0 ? "OK" : "BLOCKED",
        compatibilityBlocking: blocking,
      };
    });
}

const routeLoader = createRouteLoaderService({
  prisma,
  authMiddleware,
  requirePermission,
  cache: {
    get: cacheGet,
    set: cacheSet,
    del: cacheDel,
    delByPrefix: cacheDelByPrefix,
    TTL,
  },
});

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Atlas-Company"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Atlas-Company"],
  }),
);

await routeLoader.initialize(app);
await bundlerService.restoreModuleBundlesOnBoot();
bundlerService.startDevWatcher();

ensureBuckets();

app.get("/health", (c) => {
  const now = new Date();
  return c.json({
    ok: true,
    name: "Atlas API",
    time: now.toISOString(),
    localTime: formatLogTimestamp(now),
    timeZone: getConfiguredTimeZone(),
  });
});

// Public notes — no auth. Registered early so it's never wrapped by auth middleware.
const _publicNotesShares = createNotesSharesService({ prisma, broadcaster });
app.get("/public/notes/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const note = await _publicNotesShares.getPublicNote(slug);
    return c.json({ note });
  } catch (e) {
    return c.json({ error: e.message }, e.status ?? 500);
  }
});

app.get("/instance/status", async (c) => {
  try {
    const record = await prisma.instanceConfig.findUnique({
      where: { key: "initialized" },
    });
    const initialized = record?.value === "true";

    if (!initialized) {
      return c.json({ initialized: false, branding: null });
    }

    const companyIdRecord = await prisma.instanceConfig.findUnique({
      where: { key: "company_id" },
    });
    const company = companyIdRecord?.value
      ? await prisma.company.findUnique({
          where: { id: companyIdRecord.value },
          select: { name: true },
        })
      : null;
    const brandingConfig = companyIdRecord?.value
      ? await prisma.brandingConfig.findFirst({
          where: { companyId: companyIdRecord.value },
        })
      : null;

    let logoUrl = null;
    if (brandingConfig?.logoFileId) {
      const fileAsset = await prisma.fileAsset.findUnique({
        where: { id: brandingConfig.logoFileId },
      });
      if (fileAsset) {
        const { data: signedData } = await supabaseAdmin.storage
          .from(fileAsset.bucket)
          .createSignedUrl(fileAsset.objectKey, 3600);
        logoUrl = signedData?.signedUrl ?? null;
      }
    }

    return c.json({
      initialized: true,
      branding: {
        companyName: company?.name ?? null,
        primaryColor: brandingConfig?.primaryColor ?? "#0A7BFF",
        logoUrl,
      },
    });
  } catch {
    return c.json({ error: "Unable to read instance state" }, 503);
  }
});

app.post("/setup/initialize", async (c) => {
  try {
    const existing = await prisma.instanceConfig.findUnique({
      where: { key: "initialized" },
    });
    if (existing?.value === "true") {
      return c.json({ error: "Already initialized" }, 409);
    }

    const body = await c.req.parseBody();
    const fields = setupInitializeSchema.parse({
      adminFirstName: body.adminFirstName || undefined,
      adminLastName: body.adminLastName || undefined,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
      companyName: body.companyName,
      primaryColor: body.primaryColor,
      legalName: body.legalName || undefined,
      rfc: body.rfc || undefined,
      companyType: body.companyType || undefined,
      companyTypeName: body.companyTypeName || undefined,
      companyIndustryKey: body.companyIndustryKey || undefined,
      companyIndustryName: body.companyIndustryName || undefined,
      companySize: body.companySize || undefined,
      contactEmail: body.contactEmail || undefined,
      phone: body.phone || undefined,
      website: body.website || undefined,
      country: body.country || undefined,
      state: body.state || undefined,
      city: body.city || undefined,
      colony: body.colony || undefined,
      street: body.street || undefined,
      extNumber: body.extNumber || undefined,
      intNumber: body.intNumber || undefined,
      postalCode: body.postalCode || undefined,
    });

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: fields.adminEmail,
        password: fields.adminPassword,
        email_confirm: true,
      });
    if (authError)
      return c.json(
        { error: translateSupabaseCreateUserError(authError) },
        400,
      );
    const authUserId = authData.user.id;

    const logoFile = body.logo;
    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      if (logoFile.size > 10 * 1024 * 1024) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        return c.json({ error: "Logo must be under 10 MB" }, 400);
      }
    }

    try {
      const slug = toSlug(fields.companyName);
      const now = new Date().toISOString();

      await prisma.$transaction(async (tx) => {
        const adminRole = await ensureSetupAdminRole(tx);
        const company = await tx.company.create({
          data: {
            name: fields.companyName,
            slug,
            legalName: fields.legalName,
            rfc: fields.rfc,
            companyType: fields.companyType,
            companyTypeName: fields.companyTypeName,
            industryKey: fields.companyIndustryKey,
            industryName: fields.companyIndustryName,
            companySize: fields.companySize,
            contactEmail: fields.contactEmail || null,
            phone: fields.phone || null,
            website: fields.website || null,
            country: fields.country,
            state: fields.state,
            city: fields.city,
            colony: fields.colony || null,
            street: fields.street,
            extNumber: fields.extNumber,
            intNumber: fields.intNumber,
            postalCode: fields.postalCode,
          },
        });
        const userProfile = await tx.userProfile.create({
          data: {
            authUserId,
            firstName: fields.adminFirstName,
            lastName: fields.adminLastName,
            displayName:
              `${fields.adminFirstName} ${fields.adminLastName}`.trim(),
            email: fields.adminEmail,
          },
        });
        await tx.membership.create({
          data: {
            companyId: company.id,
            userId: userProfile.id,
            roleId: adminRole.id,
          },
        });
        let logoFileAssetId = null;
        if (logoFile && logoFile instanceof File && logoFile.size > 0) {
          const ext = logoFile.name.split(".").pop() || "png";
          const random = Math.random().toString(36).slice(2, 10);
          const objectKey = `company/branding/${company.id}/logo-${Date.now()}-${random}.${ext}`;
          const arrayBuffer = await logoFile.arrayBuffer();
          const { error: storageError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(objectKey, arrayBuffer, {
              contentType: logoFile.type,
              upsert: false,
            });
          if (storageError) {
            throw new Error("Logo upload failed");
          }

          const fileAsset = await tx.fileAsset.create({
            data: {
              bucket: STORAGE_BUCKET_NAME,
              objectKey,
              originalName: logoFile.name,
              mimeType: logoFile.type,
              sizeBytes: logoFile.size,
              moduleKey: "atlas.company",
              entityType: "BrandingConfig",
              entityId: company.id,
            },
          });
          logoFileAssetId = fileAsset.id;
        }
        await tx.brandingConfig.create({
          data: {
            companyId: company.id,
            primaryColor: fields.primaryColor,
            logoFileId: logoFileAssetId,
          },
        });
        await tx.instanceConfig.upsert({
          where: { key: "initialized" },
          update: { value: "true" },
          create: { key: "initialized", value: "true" },
        });
        await tx.instanceConfig.upsert({
          where: { key: "company_id" },
          update: { value: company.id },
          create: { key: "company_id", value: company.id },
        });
        await tx.instanceConfig.upsert({
          where: { key: "primary_company_id" },
          update: {},
          create: { key: "primary_company_id", value: company.id },
        });
        await tx.instanceConfig.upsert({
          where: { key: "completed_at" },
          update: { value: now },
          create: { key: "completed_at", value: now },
        });
        // Seed defaults so these keys always exist after initialization.
        // Users can override them later from Settings → General.
        await tx.instanceConfig.upsert({
          where: { key: "instance_name" },
          update: {},
          create: { key: "instance_name", value: fields.companyName },
        });
        await tx.instanceConfig.upsert({
          where: { key: "instance_time_zone" },
          update: {},
          create: { key: "instance_time_zone", value: "America/Mexico_City" },
        });
        await tx.instanceConfig.upsert({
          where: { key: "instance_currency" },
          update: {},
          create: { key: "instance_currency", value: "MXN" },
        });
      });
      await syncAdminRolesPermissions(prisma);

      return c.json({ ok: true });
    } catch (txError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw txError;
    }
  } catch (err) {
    if (err?.name === "ZodError")
      return c.json(
        {
          error:
            err.errors?.[0]?.message ?? "Error de validación en el formulario.",
        },
        400,
      );
    console.error("[setup/initialize]", err);
    const mapped = mapSetupError(err);
    return c.json({ error: mapped.error }, mapped.status);
  }
});

app.get("/user/me", authMiddleware, async (c) => {
  const authUserId = c.get("authUserId");
  try {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) return c.json({ error: "Profile not found" }, 404);
    const avatarUrl = await getSignedUrlByFileId(context.profile.avatarFileId);
    return c.json({
      id: context.profile.id,
      firstName: context.profile.firstName,
      lastName: context.profile.lastName,
      displayName: context.profile.displayName,
      email: context.profile.email,
      avatarUrl,
      role: context.roleKey,
      isAdmin: context.isAdmin,
      permissions: context.permissions,
      colony: context.profile.colony,
      companyId: context.memberships?.[0]?.companyId ?? null,
      availableForChat: context.profile.availableForChat ?? false,
    });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get(
  "/profile/me",
  authMiddleware,
  requirePermission("profile.self.read"),
  async (c) => {
    const authUserId = c.get("authUserId");
    try {
      const context = await getOrLoadUserContext(c);
      if (!context?.profile)
        return c.json({ error: "Perfil no encontrado." }, 404);
      const avatarUrl = await getSignedUrlByFileId(
        context.profile.avatarFileId,
      );
      return c.json({
        data: {
          id: context.profile.id,
          firstName: context.profile.firstName,
          lastName: context.profile.lastName,
          displayName: context.profile.displayName,
          email: context.profile.email,
          avatarUrl,
          birthDate: context.profile.birthDate,
          gender: context.profile.gender,
          phone: context.profile.phone,
          country: context.profile.country,
          state: context.profile.state,
          city: context.profile.city,
          colony: context.profile.colony,
          street: context.profile.street,
          extNumber: context.profile.extNumber,
          intNumber: context.profile.intNumber,
          postalCode: context.profile.postalCode,
          bio: context.profile.bio,
          role: context.roleKey,
        },
      });
    } catch {
      return c.json({ error: "No se pudo cargar el perfil." }, 500);
    }
  },
);

app.put(
  "/profile/me",
  authMiddleware,
  requirePermission("profile.self.update"),
  async (c) => {
    const authUserId = c.get("authUserId");
    try {
      const context = await getOrLoadUserContext(c);
      if (!context?.profile)
        return c.json({ error: "Perfil no encontrado." }, 404);
      const body = await c.req.json();
      const firstName = String(
        body.firstName ?? context.profile.firstName ?? "",
      ).trim();
      const lastName = String(
        body.lastName ?? context.profile.lastName ?? "",
      ).trim();
      if (!firstName || !lastName) {
        return c.json({ error: "Nombre y apellidos son obligatorios." }, 400);
      }
      const birthDate = body.birthDate ? new Date(body.birthDate) : null;
      if (body.birthDate && Number.isNaN(birthDate?.getTime())) {
        return c.json({ error: "Fecha de nacimiento invalida." }, 400);
      }
      const updated = await prisma.userProfile.update({
        where: { id: context.profile.id },
        data: {
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`.trim(),
          birthDate,
          gender: body.gender ? String(body.gender).trim() : null,
          phone: body.phone ? String(body.phone).trim() : null,
          country: body.country ? String(body.country).trim() : null,
          state: body.state ? String(body.state).trim() : null,
          city: body.city ? String(body.city).trim() : null,
          colony: body.colony ? String(body.colony).trim() : null,
          street: body.street ? String(body.street).trim() : null,
          extNumber: body.extNumber ? String(body.extNumber).trim() : null,
          intNumber: body.intNumber ? String(body.intNumber).trim() : null,
          postalCode: body.postalCode ? String(body.postalCode).trim() : null,
          bio: body.bio ? String(body.bio).trim() : null,
        },
      });
      const avatarUrl = await getSignedUrlByFileId(updated.avatarFileId);
      cacheDel(`user_ctx:${authUserId}`);
      return c.json({
        data: {
          id: updated.id,
          firstName: updated.firstName,
          lastName: updated.lastName,
          displayName: updated.displayName,
          email: updated.email,
          avatarUrl,
          birthDate: updated.birthDate,
          gender: updated.gender,
          phone: updated.phone,
          country: updated.country,
          state: updated.state,
          city: updated.city,
          colony: updated.colony,
          street: updated.street,
          extNumber: updated.extNumber,
          intNumber: updated.intNumber,
          postalCode: updated.postalCode,
          bio: updated.bio,
          role: context.roleKey,
        },
      });
    } catch {
      return c.json({ error: "No se pudo actualizar el perfil." }, 500);
    }
  },
);

app.post(
  "/profile/me/avatar",
  authMiddleware,
  requirePermission("profile.avatar.update"),
  async (c) => {
    const authUserId = c.get("authUserId");
    try {
      const context = await getOrLoadUserContext(c);
      if (!context?.profile) {
        return c.json({ error: "Perfil no encontrado." }, 404);
      }
      const body = await c.req.parseBody();
      const file = body.avatar;
      if (!(file instanceof File) || file.size <= 0) {
        return c.json({ error: "Selecciona una imagen valida." }, 400);
      }
      if (file.size > 10 * 1024 * 1024) {
        return c.json({ error: "La imagen no puede superar 10 MB." }, 400);
      }
      if (!file.type.startsWith("image/")) {
        return c.json({ error: "Solo se permiten imagenes." }, 400);
      }

      const asset = await uploadIdentityAvatar({
        profileId: context.profile.id,
        file,
      });
      cacheDel(`user_ctx:${authUserId}`);
      const avatarUrl = await getSignedUrlByFileId(asset.id);
      return c.json({ data: { avatarUrl } });
    } catch {
      return c.json({ error: "No se pudo actualizar el avatar." }, 500);
    }
  },
);

app.post(
  "/profile/me/password",
  authMiddleware,
  requirePermission("profile.password.update"),
  async (c) => {
    const authUserId = c.get("authUserId");
    try {
      const context = await getOrLoadUserContext(c);
      if (!context?.profile) {
        return c.json({ error: "Perfil no encontrado." }, 404);
      }

      const body = await c.req.json();
      const currentPassword = String(body.currentPassword ?? "");
      const newPassword = String(body.newPassword ?? "");
      const confirmPassword = String(body.confirmPassword ?? "");

      if (!currentPassword || !newPassword || !confirmPassword) {
        return c.json(
          { error: "Debes completar contraseña actual, nueva y confirmación." },
          400,
        );
      }
      if (newPassword.length < 8) {
        return c.json(
          { error: "La nueva contraseña debe tener al menos 8 caracteres." },
          400,
        );
      }
      if (newPassword !== confirmPassword) {
        return c.json({ error: "La confirmación no coincide." }, 400);
      }
      if (currentPassword === newPassword) {
        return c.json(
          { error: "La nueva contraseña debe ser diferente a la actual." },
          400,
        );
      }

      const { error: authCheckError } =
        await supabaseAdmin.auth.signInWithPassword({
          email: context.profile.email,
          password: currentPassword,
        });
      if (authCheckError) {
        return c.json({ error: "La contraseña actual no es correcta." }, 400);
      }

      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: newPassword,
        });
      if (updateError) {
        return c.json(
          { error: "No se pudo actualizar la contraseña. Intenta de nuevo." },
          500,
        );
      }

      return c.json({ data: { ok: true } });
    } catch {
      return c.json({ error: "No se pudo actualizar la contraseña." }, 500);
    }
  },
);

app.get("/profile/me/preferences/:key", authMiddleware, async (c) => {
  try {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile)
      return c.json({ error: "Perfil no encontrado." }, 404);
    const key = c.req.param("key");
    const pref = await prisma.userPreference.findUnique({
      where: { userId_key: { userId: context.profile.id, key } },
    });
    return c.json({ value: pref?.value ?? null });
  } catch {
    return c.json({ error: "No se pudo obtener la preferencia." }, 500);
  }
});

app.get(
  "/profile/me/table-preferences/:tableKey",
  authMiddleware,
  async (c) => {
    try {
      const context = await getOrLoadUserContext(c);
      if (!context?.profile)
        return c.json({ error: "Perfil no encontrado." }, 404);
      const tableKey = c.req.param("tableKey");
      const pref = await prisma.userTablePreference.findUnique({
        where: { userId_tableKey: { userId: context.profile.id, tableKey } },
      });
      return c.json({ data: pref?.config ?? null });
    } catch {
      return c.json({ error: "No se pudo obtener la preferencia." }, 500);
    }
  },
);

app.put("/profile/me/preferences/:key", authMiddleware, async (c) => {
  try {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile)
      return c.json({ error: "Perfil no encontrado." }, 404);
    const key = c.req.param("key");
    const body = await c.req.json();
    if (body.value === undefined) {
      return c.json({ error: "Se requiere el campo 'value'." }, 400);
    }
    const { value } = body;
    const pref = await prisma.userPreference.upsert({
      where: { userId_key: { userId: context.profile.id, key } },
      update: { value },
      create: { userId: context.profile.id, key, value },
    });
    return c.json({ value: pref.value });
  } catch {
    return c.json({ error: "No se pudo guardar la preferencia." }, 500);
  }
});

app.put(
  "/profile/me/table-preferences/:tableKey",
  authMiddleware,
  async (c) => {
    try {
      const context = await getOrLoadUserContext(c);
      if (!context?.profile)
        return c.json({ error: "Perfil no encontrado." }, 404);
      const tableKey = c.req.param("tableKey");
      const config = await c.req.json();
      const pref = await prisma.userTablePreference.upsert({
        where: { userId_tableKey: { userId: context.profile.id, tableKey } },
        update: { config },
        create: { userId: context.profile.id, tableKey, config },
      });
      return c.json({ data: pref.config });
    } catch {
      return c.json({ error: "No se pudo guardar la preferencia." }, 500);
    }
  },
);

app.delete(
  "/profile/me/table-preferences/:tableKey",
  authMiddleware,
  async (c) => {
    try {
      const context = await getOrLoadUserContext(c);
      if (!context?.profile)
        return c.json({ error: "Perfil no encontrado." }, 404);
      const tableKey = c.req.param("tableKey");
      await prisma.userTablePreference.deleteMany({
        where: { userId: context.profile.id, tableKey },
      });
      return c.json({ data: { ok: true } });
    } catch {
      return c.json({ error: "No se pudo eliminar la preferencia." }, 500);
    }
  },
);

app.get("/memberships/me", authMiddleware, async (c) => {
  const authUserId = c.get("authUserId");
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
    });
    if (!profile) return c.json({ data: [] });
    const memberships = await prisma.membership.findMany({
      where: { userId: profile.id, enabled: true },
      include: {
        role: true,
        company: {
          include: { brandingConfig: true },
        },
      },
    });

    // Batch-load all logo file assets in a single query, then batch signed URLs per bucket.
    const logoFileIds = memberships
      .map((m) => m.company?.brandingConfig?.logoFileId)
      .filter(Boolean);
    const logoUrlMap = new Map();
    if (logoFileIds.length > 0) {
      const logoAssets = await prisma.fileAsset.findMany({
        where: { id: { in: logoFileIds } },
        select: { id: true, bucket: true, objectKey: true },
      });
      const byBucket = new Map();
      for (const asset of logoAssets) {
        if (!byBucket.has(asset.bucket)) byBucket.set(asset.bucket, []);
        byBucket.get(asset.bucket).push(asset);
      }
      await Promise.all(
        [...byBucket.entries()].map(async ([bucket, assets]) => {
          const paths = assets.map((a) => a.objectKey);
          const { data: signedList } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrls(paths, 3600);
          if (Array.isArray(signedList)) {
            for (let i = 0; i < assets.length; i++) {
              logoUrlMap.set(assets[i].id, signedList[i]?.signedUrl ?? null);
            }
          }
        }),
      );
    }

    const data = memberships.map((m) => {
      const logoFileId = m.company?.brandingConfig?.logoFileId;
      return {
        ...m,
        company: m.company
          ? {
              id: m.company.id,
              name: m.company.name,
              logoUrl: logoFileId ? (logoUrlMap.get(logoFileId) ?? null) : null,
              primaryColor: m.company.brandingConfig?.primaryColor ?? null,
            }
          : null,
      };
    });

    return c.json({ data });
  } catch (e) {
    console.error("[GET /memberships/me]", e);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get(
  "/instance/config",
  authMiddleware,
  requirePermission("core.instance.read"),
  async (c) => {
    try {
      const records = await prisma.instanceConfig.findMany({
        where: {
          key: {
            in: [
              "initialized",
              "company_id",
              "completed_at",
              "instance_name",
              "instance_time_zone",
              "instance_currency",
              "instance_description",
            ],
          },
        },
      });
      const values = Object.fromEntries(records.map((r) => [r.key, r.value]));
      return c.json({
        data: {
          initialized: values.initialized === "true",
          companyId: values.company_id ?? null,
          completedAt: values.completed_at ?? null,
          instanceName: values.instance_name ?? "Atlas ERP",
          timeZone: values.instance_time_zone ?? "America/Mexico_City",
          currency: values.instance_currency ?? "MXN",
          description: values.instance_description ?? "",
        },
      });
    } catch {
      return c.json({ error: "No se pudo cargar la configuracion." }, 500);
    }
  },
);

app.put(
  "/instance/config",
  authMiddleware,
  requirePermission("core.instance.update"),
  async (c) => {
    try {
      const body = await c.req.json();
      const instanceName = String(body.instanceName ?? "").trim();
      const timeZone = String(body.timeZone ?? "").trim();
      const currency = String(body.currency ?? "")
        .trim()
        .toUpperCase();
      const description = String(body.description ?? "").trim();
      if (!instanceName || !timeZone || !currency) {
        return c.json(
          { error: "instanceName, timeZone y currency son obligatorios." },
          400,
        );
      }
      if (description.length > 500) {
        return c.json(
          { error: "La descripcion no puede exceder 500 caracteres." },
          400,
        );
      }
      const pairs = [
        ["instance_name", instanceName],
        ["instance_time_zone", timeZone],
        ["instance_currency", currency],
        ["instance_description", description],
      ];
      await prisma.$transaction(
        pairs.map(([key, value]) =>
          prisma.instanceConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          }),
        ),
      );
      return c.json({
        data: { instanceName, timeZone, currency, description },
      });
    } catch {
      return c.json({ error: "No se pudo guardar la configuracion." }, 500);
    }
  },
);

// ── Company: Profile ─────────────────────────────────────────────────────────

app.get(
  "/company/profile",
  authMiddleware,
  requirePermission("company.profile.read"),
  async (c) => {
    try {
      const data = await companyService.getProfile();
      return c.json({ data });
    } catch (err) {
      if (err instanceof CompanyServiceError)
        return c.json({ error: err.message }, err.status);
      return c.json(
        { error: "No se pudo cargar el perfil de la empresa." },
        500,
      );
    }
  },
);

app.put(
  "/company/profile",
  authMiddleware,
  requirePermission("company.profile.update"),
  async (c) => {
    try {
      const body = await c.req.json();
      const name = String(body.name ?? "").trim();
      if (!name)
        return c.json(
          { error: "El nombre de la empresa es obligatorio." },
          400,
        );
      const data = await companyService.updateProfile({
        name,
        legalName: String(body.legalName ?? "").trim(),
        rfc: String(body.rfc ?? "").trim(),
        companyType: String(body.companyType ?? "").trim(),
        companyTypeName: String(body.companyTypeName ?? "").trim(),
        industryKey: String(body.industryKey ?? "").trim(),
        industryName: String(body.industryName ?? "").trim(),
        companySize: String(body.companySize ?? "").trim(),
        contactEmail: String(body.contactEmail ?? "").trim(),
        phone: String(body.phone ?? "").trim(),
        website: String(body.website ?? "").trim(),
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "company.profile.update",
        severity: "info",
        entityType: "Company",
        summary: `${actorName} actualizó el perfil de la empresa`,
      });
      return c.json({ data });
    } catch (err) {
      if (err instanceof CompanyServiceError)
        return c.json({ error: err.message }, err.status);
      return c.json(
        { error: "No se pudo actualizar el perfil de la empresa." },
        500,
      );
    }
  },
);

// ── Company: Address ─────────────────────────────────────────────────────────

app.get(
  "/company/address",
  authMiddleware,
  requirePermission("company.address.read"),
  async (c) => {
    try {
      const data = await companyService.getAddress();
      return c.json({ data });
    } catch (err) {
      if (err instanceof CompanyServiceError)
        return c.json({ error: err.message }, err.status);
      return c.json(
        { error: "No se pudo cargar la direccion de la empresa." },
        500,
      );
    }
  },
);

app.put(
  "/company/address",
  authMiddleware,
  requirePermission("company.address.update"),
  async (c) => {
    try {
      const body = await c.req.json();
      const data = await companyService.updateAddress({
        country: String(body.country ?? "").trim(),
        state: String(body.state ?? "").trim(),
        city: String(body.city ?? "").trim(),
        colony: String(body.colony ?? "").trim(),
        street: String(body.street ?? "").trim(),
        extNumber: String(body.extNumber ?? "").trim(),
        intNumber: String(body.intNumber ?? "").trim(),
        postalCode: String(body.postalCode ?? "").trim(),
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "company.address.update",
        severity: "info",
        entityType: "Company",
        summary: `${actorName} actualizó la dirección de la empresa`,
      });
      return c.json({ data });
    } catch (err) {
      if (err instanceof CompanyServiceError)
        return c.json({ error: err.message }, err.status);
      return c.json(
        { error: "No se pudo actualizar la direccion de la empresa." },
        500,
      );
    }
  },
);

// ── Company: Branding ────────────────────────────────────────────────────────

app.get(
  "/company/branding",
  authMiddleware,
  requirePermission("company.branding.read"),
  async (c) => {
    try {
      const data = await companyService.getBranding();
      return c.json({ data });
    } catch (err) {
      if (err instanceof CompanyServiceError)
        return c.json({ error: err.message }, err.status);
      return c.json(
        { error: "No se pudo cargar la configuracion de marca." },
        500,
      );
    }
  },
);

app.put(
  "/company/branding",
  authMiddleware,
  requirePermission("company.branding.update"),
  async (c) => {
    try {
      const companyIdRecord = await prisma.instanceConfig.findUnique({
        where: { key: "company_id" },
      });
      if (!companyIdRecord?.value)
        return c.json({ error: "No hay empresa activa configurada." }, 404);
      const companyId = companyIdRecord.value;
      const body = await c.req.json();
      const primaryColor = String(body.primaryColor ?? "").trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
        return c.json({ error: "primaryColor valido es obligatorio." }, 400);
      }
      const logoFileIdRaw = body.logoFileId;
      const logoFileId =
        logoFileIdRaw === null ||
        logoFileIdRaw === undefined ||
        logoFileIdRaw === ""
          ? null
          : String(logoFileIdRaw).trim();
      const data = await companyService.updateBranding(
        { primaryColor, logoFileId },
        companyId,
      );
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "company.branding.update",
        severity: "info",
        entityType: "Company",
        entityId: companyId,
        summary: `${actorName} actualizó la marca de la empresa`,
      });
      return c.json({ data });
    } catch (err) {
      if (err instanceof CompanyServiceError)
        return c.json({ error: err.message }, err.status);
      return c.json(
        { error: "No se pudo guardar la configuracion de marca." },
        500,
      );
    }
  },
);

app.post(
  "/files/upload",
  authMiddleware,
  requirePermission("files.assets.create"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.parseBody();
      const file = body.file;
      const asset = await filesService.upload({
        authUserId,
        file,
        fields: {
          moduleKey: body.moduleKey,
          entityType: body.entityType,
          entityId: body.entityId,
          visibility: body.visibility,
          metadata: body.metadata,
        },
      });

      if (
        body.moduleKey === "atlas.hr" &&
        body.entityType === "HrEmployee" &&
        body.entityId
      ) {
        const actor = await prisma.userProfile.findUnique({
          where: { authUserId },
          select: { id: true },
        });
        if (actor?.id) {
          await prisma.auditLog.create({
            data: {
              actorId: actor.id,
              moduleKey: "atlas.hr",
              entityType: "HrEmployee",
              entityId: String(body.entityId),
              action: "hr.employee.file.attach",
              metadata: {
                fileId: asset.id,
                originalName: asset.originalName,
                mimeType: asset.mimeType,
              },
            },
          });
        }
      }

      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "files.assets.upload",
        severity: "success",
        entityType: "FileAsset",
        entityId: asset.id,
        summary:
          `${actorName} subió "${asset.originalName ?? asset.id}"`.trim(),
      });

      const responseAsset = { ...asset }
      if (asset.bucket === WEBSITE_BUCKET_NAME) {
        const { data: urlData } = supabaseAdmin.storage.from(asset.bucket).getPublicUrl(asset.objectKey)
        responseAsset.url = urlData?.publicUrl ?? null
      }
      return c.json({ data: responseAsset }, 201);
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo subir el archivo." }, 500);
    }
  },
);

app.get(
  "/files",
  authMiddleware,
  requirePermission("files.assets.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const result = await filesService.list({
        authUserId,
        query: {
          q: c.req.query("q"),
          moduleKey: c.req.query("moduleKey"),
          entityType: c.req.query("entityType"),
          entityId: c.req.query("entityId"),
          sourceEntityId: c.req.query("sourceEntityId"),
          mime: c.req.query("mime"),
          enabled: c.req.query("enabled"),
          page: c.req.query("page"),
          pageSize: c.req.query("pageSize"),
          sortBy: c.req.query("sortBy"),
          sortDir: c.req.query("sortDir"),
        },
      });
      return c.json(result);
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudieron cargar los archivos." }, 500);
    }
  },
);

app.get(
  "/files/:id",
  authMiddleware,
  requirePermission("files.assets.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const asset = await filesService.getById({ authUserId, id });
      return c.json({ data: asset });
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo cargar el archivo." }, 500);
    }
  },
);

app.patch(
  "/files/:id",
  authMiddleware,
  requirePermission("files.assets.update"),
  async (c) => {
    // Intentional policy: renaming is a lifecycle mutation restricted to admin roles.
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      let body;

      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Nombre de archivo invalido." }, 400);
      }

      const parsed = fileRenameSchema.safeParse(body);
      if (!parsed.success) {
        const schemaMessage = parsed.error.issues?.[0]?.message;
        return c.json(
          { error: schemaMessage || "Nombre de archivo invalido." },
          400,
        );
      }

      const updated = await filesService.rename({
        authUserId,
        id,
        originalName: parsed.data.originalName,
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "files.assets.rename",
        severity: "info",
        entityType: "FileAsset",
        entityId: id,
        summary:
          `${actorName} renombró un archivo a "${updated.originalName ?? ""}"`.trim(),
      });
      return c.json({ data: updated });
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo renombrar el archivo." }, 500);
    }
  },
);

app.post(
  "/files/bulk-download",
  authMiddleware,
  requirePermission("files.assets.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      let body;

      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Solicitud de descarga masiva invalida." }, 400);
      }

      const parsed = fileBulkDownloadSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Solicitud de descarga masiva invalida." }, 400);
      }

      const data = await filesService.bulkDownload({
        authUserId,
        fileIds: parsed.data.fileIds,
        mode: parsed.data.mode,
      });

      return c.json({ data });
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo procesar la descarga masiva." }, 500);
    }
  },
);

app.get(
  "/files/:id/signed-url",
  authMiddleware,
  requirePermission("files.assets.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const data = await filesService.getSignedUrl({ authUserId, id });
      return c.json({ data });
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudo generar el enlace del archivo." },
        500,
      );
    }
  },
);

app.post(
  "/files/batch-signed-urls",
  authMiddleware,
  requirePermission("files.assets.read"),
  async (c) => {
    try {
      const body = await c.req.json();
      const fileIds = Array.isArray(body?.fileIds)
        ? body.fileIds.slice(0, 50)
        : [];
      if (fileIds.length === 0) return c.json({ data: {} });

      const assets = await prisma.fileAsset.findMany({
        where: { id: { in: fileIds }, enabled: true },
        select: { id: true, bucket: true, objectKey: true },
      });

      const byBucket = new Map();
      for (const asset of assets) {
        if (!byBucket.has(asset.bucket)) byBucket.set(asset.bucket, []);
        byBucket.get(asset.bucket).push(asset);
      }

      const urlMap = {};
      await Promise.all(
        [...byBucket.entries()].map(async ([bucket, bucketAssets]) => {
          if (bucket === WEBSITE_BUCKET_NAME) {
            for (const a of bucketAssets) {
              const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(a.objectKey)
              urlMap[a.id] = data?.publicUrl ?? null
            }
            return
          }
          const { data: signedList } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrls(
              bucketAssets.map((a) => a.objectKey),
              3600,
            );
          if (Array.isArray(signedList)) {
            for (let i = 0; i < bucketAssets.length; i++) {
              urlMap[bucketAssets[i].id] = signedList[i]?.signedUrl ?? null;
            }
          }
        }),
      );

      return c.json({ data: urlMap });
    } catch (err) {
      return c.json(
        { error: "No se pudieron generar los enlaces de archivos." },
        500,
      );
    }
  },
);

app.patch(
  "/files/:id/enabled",
  authMiddleware,
  requirePermission("files.assets.update"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const body = await c.req.json();
      const updated = await filesService.setEnabled({
        authUserId,
        id,
        enabled: Boolean(body.enabled),
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: updated.enabled ? "files.assets.enable" : "files.assets.disable",
        severity: updated.enabled ? "info" : "warning",
        entityType: "FileAsset",
        entityId: id,
        summary: `${actorName} ${updated.enabled ? "habilitó" : "deshabilitó"} un archivo`,
      });
      return c.json({ data: updated });
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudo actualizar el estado del archivo." },
        500,
      );
    }
  },
);

app.delete(
  "/files/:id",
  authMiddleware,
  requirePermission("files.assets.delete"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      await filesService.delete({ authUserId, id });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "files.assets.delete",
        severity: "warning",
        entityType: "FileAsset",
        entityId: id,
        summary: `${actorName} eliminó un archivo`,
      });
      return c.json({ ok: true });
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo eliminar el archivo." }, 500);
    }
  },
);

app.get(
  "/identity/permissions",
  authMiddleware,
  requirePermission("identity.permissions.read"),
  async (c) => {
    try {
      const includeInactive = c.req.query("includeInactive") === "true";
      const permissions = await prisma.permission.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ moduleId: "asc" }, { key: "asc" }],
      });
      const grouped = groupPermissionsForUi(permissions);
      return c.json({
        data: {
          permissions: permissions.map((permission) => {
            const presentation = getPermissionPresentation(permission.key);
            return {
              ...permission,
              name: presentation.name,
              description: presentation.description,
              groupKey: presentation.groupKey,
              groupLabel: presentation.groupLabel,
              sortOrder: presentation.sortOrder,
              isSystem: true,
            };
          }),
          groups: grouped,
        },
      });
    } catch {
      return c.json({ error: "No se pudieron cargar los permisos." }, 500);
    }
  },
);

app.get(
  "/identity/roles",
  authMiddleware,
  requirePermission("identity.roles.read"),
  async (c) => {
    try {
      const roles = await prisma.role.findMany({
        include: {
          permissions: {
            select: {
              permission: {
                select: { id: true, key: true, name: true, moduleId: true },
              },
            },
          },
          _count: { select: { memberships: { where: { enabled: true } } } },
        },
        orderBy: { name: "asc" },
      });
      return c.json({
        data: roles.map((role) => ({
          ...role,
          permissionKeys: role.permissions.map((p) => p.permission.key),
          memberCount: role._count.memberships,
        })),
      });
    } catch {
      return c.json({ error: "No se pudieron cargar los roles." }, 500);
    }
  },
);

app.post(
  "/identity/roles",
  authMiddleware,
  requirePermission("identity.roles.create"),
  async (c) => {
    try {
      const body = await c.req.json();
      const key = String(body.key ?? "").trim();
      const name = String(body.name ?? "").trim();
      const description = String(body.description ?? "").trim() || null;
      if (!key || !name)
        return c.json({ error: "key y name son obligatorios." }, 400);
      const role = await prisma.role.create({
        data: { key, name, description, system: false, enabled: true },
      });
      if (["atlas.admin", "system.admin"].includes(role.key)) {
        await syncAdminRolesPermissions(prisma);
      }
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.role.create",
        severity: "success",
        entityType: "Role",
        entityId: role.id,
        summary: `${actorName} creó el rol "${role.name}"`,
      });
      return c.json({ data: role }, 201);
    } catch {
      return c.json({ error: "No se pudo crear el rol." }, 500);
    }
  },
);

app.put(
  "/identity/roles/:id",
  authMiddleware,
  requirePermission("identity.roles.update"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const name = String(body.name ?? "").trim();
      const description = String(body.description ?? "").trim() || null;
      if (!name) return c.json({ error: "name es obligatorio." }, 400);
      const role = await prisma.role.update({
        where: { id },
        data: { name, description },
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.role.update",
        severity: "info",
        entityType: "Role",
        entityId: id,
        summary: `${actorName} actualizó el rol "${role.name}"`,
      });
      return c.json({ data: role });
    } catch {
      return c.json({ error: "No se pudo actualizar el rol." }, 500);
    }
  },
);

app.patch(
  "/identity/roles/:id/enabled",
  authMiddleware,
  requirePermission("identity.roles.update"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const enabled = Boolean(body.enabled);
      const role = await prisma.role.update({
        where: { id },
        data: { enabled },
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: role.enabled ? "identity.role.enable" : "identity.role.disable",
        severity: role.enabled ? "info" : "warning",
        entityType: "Role",
        entityId: id,
        summary: `${actorName} ${role.enabled ? "habilitó" : "deshabilitó"} el rol "${role.name}"`,
      });
      return c.json({ data: role });
    } catch {
      return c.json({ error: "No se pudo actualizar el estado del rol." }, 500);
    }
  },
);

app.delete(
  "/identity/roles/:id",
  authMiddleware,
  requirePermission("identity.roles.delete"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const role = await prisma.role.findUnique({
        where: { id },
        select: { id: true, system: true, key: true },
      });
      if (!role) return c.json({ error: "Rol no encontrado." }, 404);
      if (role.system || ADMIN_ROLE_KEYS.has(role.key)) {
        return c.json(
          { error: "No se puede eliminar un rol del sistema." },
          403,
        );
      }
      await prisma.role.delete({ where: { id } });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.role.delete",
        severity: "critical",
        entityType: "Role",
        entityId: id,
        summary: `${actorName} eliminó el rol "${role.key}"`,
      });
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "No se pudo eliminar el rol." }, 500);
    }
  },
);

app.patch(
  "/identity/roles/:id/permissions",
  authMiddleware,
  requirePermission("identity.permissions.update"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const permissionKeys = Array.isArray(body.permissionKeys)
        ? body.permissionKeys
        : [];
      const permissions = await prisma.permission.findMany({
        where: { key: { in: permissionKeys }, active: true },
        select: { id: true },
      });
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        ...(permissions.length
          ? [
              prisma.rolePermission.createMany({
                data: permissions.map((permission) => ({
                  roleId: id,
                  permissionId: permission.id,
                })),
              }),
            ]
          : []),
      ]);
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.role.permissions.update",
        severity: "info",
        entityType: "Role",
        entityId: id,
        summary: `${actorName} actualizó los permisos del rol (${permissions.length})`,
      });
      return c.json({
        data: { roleId: id, permissionCount: permissions.length },
      });
    } catch {
      return c.json(
        { error: "No se pudieron actualizar los permisos del rol." },
        500,
      );
    }
  },
);

app.get(
  "/identity/users",
  authMiddleware,
  requirePermission("identity.users.read"),
  async (c) => {
    try {
      const normalizedQuery = normalizeIdentityUsersQuery(c.req.query());
      const where = buildIdentityUsersWhere(normalizedQuery);
      const orderBy = toIdentitySortOrder(
        normalizedQuery.sortBy,
        normalizedQuery.sortDir,
      );
      const skip = (normalizedQuery.page - 1) * normalizedQuery.pageSize;

      const [users, total] = await prisma.$transaction([
        prisma.userProfile.findMany({
          where,
          include: {
            memberships: {
              include: {
                role: true,
                company: true,
              },
              where: { enabled: true },
            },
          },
          orderBy,
          skip,
          take: normalizedQuery.pageSize,
        }),
        prisma.userProfile.count({ where }),
      ]);

      const avatarFileIds = users
        .map((user) => user.avatarFileId)
        .filter(Boolean);
      const avatarUrlMap = await buildAvatarUrlMapByFileIds(avatarFileIds);

      return c.json({
        data: users.map((user) => serializeIdentityUser(user, avatarUrlMap)),
        pagination: {
          page: normalizedQuery.page,
          pageSize: normalizedQuery.pageSize,
          total,
        },
      });
    } catch {
      return c.json({ error: "No se pudieron cargar los usuarios." }, 500);
    }
  },
);

app.post(
  "/identity/users",
  authMiddleware,
  requirePermission("identity.users.create"),
  async (c) => {
    try {
      const body = await c.req.json();
      const fields = createUserSchema.parse(body);

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: fields.email,
          password: fields.password,
          email_confirm: true,
        });
      if (authError) {
        return c.json(
          { error: translateSupabaseCreateUserError(authError) },
          400,
        );
      }
      const authUserId = authData.user.id;

      const context = c.get("userContext");
      const companyId = context.memberships[0]?.companyId;
      if (!companyId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        return c.json(
          { error: "No se pudo determinar la empresa activa." },
          400,
        );
      }

      try {
        const userProfile = await prisma.$transaction(async (tx) => {
          const profile = await tx.userProfile.create({
            data: {
              authUserId,
              firstName: fields.firstName,
              lastName: fields.lastName,
              displayName: `${fields.firstName} ${fields.lastName}`.trim(),
              email: fields.email,
            },
          });
          await tx.membership.create({
            data: {
              companyId,
              userId: profile.id,
              roleId: fields.roleId ?? null,
            },
          });
          return profile;
        });
        const { actorName } = getActivityContext(c);
        await publishActivityFromContext(prisma, c, {
          type: "identity.user.create",
          severity: "success",
          entityType: "UserProfile",
          entityId: userProfile.id,
          summary: `${actorName} creó al usuario ${fields.email}`,
        });
        return c.json({ data: userProfile }, 201);
      } catch (txError) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        throw txError;
      }
    } catch (err) {
      if (err?.name === "ZodError") {
        return c.json(
          { error: err.errors[0]?.message ?? "Datos inválidos." },
          400,
        );
      }
      return c.json({ error: "No se pudo crear el usuario." }, 500);
    }
  },
);

app.patch(
  "/identity/users/bulk/enabled",
  authMiddleware,
  requirePermission("identity.users.update"),
  async (c) => {
    try {
      const body = await c.req.json();
      const ids = parseIdentityUserIds(body?.ids);
      const enabled = body?.enabled;
      if (!ids.length) {
        return c.json(
          { error: "Debes enviar al menos un usuario valido." },
          400,
        );
      }
      if (typeof enabled !== "boolean") {
        return c.json({ error: "El campo enabled es obligatorio." }, 400);
      }
      const result = await prisma.userProfile.updateMany({
        where: { id: { in: ids } },
        data: { enabled },
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: enabled
          ? "identity.user.bulk_enable"
          : "identity.user.bulk_disable",
        severity: enabled ? "info" : "warning",
        entityType: "UserProfile",
        summary: `${actorName} ${enabled ? "habilitó" : "deshabilitó"} ${result.count} usuario(s)`,
      });
      return c.json({ data: { count: result.count, enabled } });
    } catch {
      return c.json(
        { error: "No se pudo actualizar el estado de los usuarios." },
        500,
      );
    }
  },
);

app.delete(
  "/identity/users/bulk",
  authMiddleware,
  requirePermission("identity.users.delete"),
  async (c) => {
    try {
      const body = await c.req.json();
      const ids = parseIdentityUserIds(body?.ids);
      if (!ids.length) {
        return c.json(
          { error: "Debes enviar al menos un usuario valido." },
          400,
        );
      }

      const context = c.get("userContext");
      if (ids.includes(context?.profile?.id)) {
        return c.json({ error: "No puedes eliminar tu propia cuenta." }, 400);
      }

      const users = await prisma.userProfile.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          authUserId: true,
          memberships: {
            where: { enabled: true },
            select: {
              enabled: true,
              role: { select: { key: true } },
            },
          },
        },
      });
      if (!users.length) {
        return c.json({ data: { count: 0 } });
      }
      if (users.some(hasProtectedIdentityAdminRole)) {
        return c.json(
          {
            error:
              "No se pueden eliminar usuarios con rol Atlas Admin o System Admin.",
          },
          400,
        );
      }

      for (const user of users) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(
          user.authUserId,
        );
        if (error) {
          return c.json(
            { error: "No se pudo eliminar uno o mas usuarios en Auth." },
            500,
          );
        }
      }

      const deleted = await prisma.userProfile.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
      for (const user of users) {
        cacheDel(`user_ctx:${user.authUserId}`);
      }

      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.user.bulk_delete",
        severity: "critical",
        entityType: "UserProfile",
        summary: `${actorName} eliminó ${deleted.count} usuario(s)`,
      });

      return c.json({ data: { count: deleted.count } });
    } catch {
      return c.json({ error: "No se pudieron eliminar los usuarios." }, 500);
    }
  },
);

app.post(
  "/identity/users/export/excel",
  authMiddleware,
  requirePermission("identity.users.read"),
  async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const ids = parseIdentityUserIds(body?.ids);
      const normalizedQuery = normalizeIdentityUsersQuery(c.req.query());
      const where = buildIdentityUsersWhere(normalizedQuery);
      if (ids.length) where.id = { in: ids };

      const users = await prisma.userProfile.findMany({
        where,
        include: {
          memberships: {
            include: { role: true, company: true },
            where: { enabled: true },
          },
        },
        orderBy: toIdentitySortOrder(
          normalizedQuery.sortBy,
          normalizedQuery.sortDir,
        ),
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Usuarios");
      sheet.columns = [
        { header: "ID", key: "id", width: 40 },
        { header: "Nombre", key: "firstName", width: 20 },
        { header: "Apellidos", key: "lastName", width: 24 },
        { header: "Nombre completo", key: "displayName", width: 30 },
        { header: "Correo", key: "email", width: 32 },
        { header: "Rol", key: "roleName", width: 24 },
        { header: "Empresa", key: "companyName", width: 28 },
        { header: "Estado", key: "enabled", width: 12 },
        { header: "Telefono", key: "phone", width: 18 },
        { header: "Fecha nacimiento", key: "birthDate", width: 18 },
        { header: "Sexo", key: "gender", width: 18 },
        { header: "Pais", key: "country", width: 18 },
        { header: "Estado/Provincia", key: "state", width: 20 },
        { header: "Ciudad", key: "city", width: 20 },
        { header: "Colonia", key: "colony", width: 20 },
        { header: "Calle", key: "street", width: 20 },
        { header: "Numero exterior", key: "extNumber", width: 16 },
        { header: "Numero interior", key: "intNumber", width: 16 },
        { header: "Codigo postal", key: "postalCode", width: 16 },
        { header: "Biografia", key: "bio", width: 40 },
        { header: "Creado", key: "createdAt", width: 20 },
      ];
      sheet.getRow(1).font = { bold: true };

      for (const user of users) {
        const membership = user.memberships?.[0] ?? null;
        sheet.addRow({
          id: user.id,
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          displayName: user.displayName ?? "",
          email: user.email ?? "",
          roleName: membership?.role?.name ?? "",
          companyName: membership?.company?.name ?? "",
          enabled: user.enabled ? "Activo" : "Inactivo",
          phone: user.phone ?? "",
          birthDate: user.birthDate
            ? new Date(user.birthDate).toISOString().slice(0, 10)
            : "",
          gender: user.gender ?? "",
          country: user.country ?? "",
          state: user.state ?? "",
          city: user.city ?? "",
          colony: user.colony ?? "",
          street: user.street ?? "",
          extNumber: user.extNumber ?? "",
          intNumber: user.intNumber ?? "",
          postalCode: user.postalCode ?? "",
          bio: user.bio ?? "",
          createdAt: user.createdAt
            ? new Date(user.createdAt)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
            : "",
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `usuarios-${new Date().toISOString().slice(0, 10)}.xlsx`;
      c.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(users.length));
      return c.body(buffer);
    } catch {
      return c.json({ error: "No se pudo generar el archivo Excel." }, 500);
    }
  },
);

app.post(
  "/identity/users/export/pdf",
  authMiddleware,
  requirePermission("identity.users.read"),
  async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const ids = parseIdentityUserIds(body?.ids);
      const normalizedQuery = normalizeIdentityUsersQuery(c.req.query());
      const where = buildIdentityUsersWhere(normalizedQuery);
      if (ids.length) where.id = { in: ids };

      const users = await prisma.userProfile.findMany({
        where,
        include: {
          memberships: {
            include: { role: true, company: true },
            where: { enabled: true },
          },
        },
        orderBy: toIdentitySortOrder(normalizedQuery.sortBy, normalizedQuery.sortDir),
      });

      const authUserId = c.get("userId");
      const membership = await prisma.membership.findFirst({ where: { userId: authUserId, enabled: true } });
      const companyId = membership?.companyId ?? null;

      const { resolvePdfDocumentCtor, resolveCompanyBranding, drawPdfHeader, drawPdfFooter, formatDateEs, toSafeText } =
        await import("./services/pdf-branding-service.js");
      const PDFDocument = await resolvePdfDocumentCtor();
      const branding = await resolveCompanyBranding({ prisma, companyId });

      const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));

      const HEADER_H = 90;
      const FOOTER_H = 36;
      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const bodyTop = 40 + HEADER_H + 10;
      const bodyBottom = pageH - 40 - FOOTER_H - 10;

      function drawTableHeader(y) {
        doc.rect(40, y, pageW - 80, 20).fill(branding.primaryColor || "#2563eb");
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
        doc.text("Nombre completo", 48, y + 6, { width: 130 });
        doc.text("Correo", 184, y + 6, { width: 130 });
        doc.text("Rol", 320, y + 6, { width: 90 });
        doc.text("Estado", 416, y + 6, { width: 55 });
        doc.text("Ingreso", 476, y + 6, { width: 80 });
        doc.fillColor("#000000").font("Helvetica");
        return y + 20;
      }

      let page = 0;
      let y = bodyTop;

      drawPdfHeader(doc, branding, { title: "Directorio de usuarios", subtitle: `${users.length} registro${users.length !== 1 ? "s" : ""}`, folio: `RPT-USR-${new Date().getFullYear()}` });
      y = drawTableHeader(y);

      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const m = u.memberships?.[0] ?? null;
        const rowH = 18;

        if (y + rowH > bodyBottom) {
          drawPdfFooter(doc, branding, { pageNum: ++page });
          doc.addPage();
          drawPdfHeader(doc, branding, { title: "Directorio de usuarios", subtitle: `${users.length} registro${users.length !== 1 ? "s" : ""}`, folio: `RPT-USR-${new Date().getFullYear()}` });
          y = bodyTop;
          y = drawTableHeader(y);
        }

        const bg = i % 2 === 0 ? "#ffffff" : "#f8f9fb";
        doc.rect(40, y, pageW - 80, rowH).fill(bg);
        doc.fillColor("#1a1a1a").fontSize(8).font("Helvetica");
        doc.text(toSafeText(u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()), 48, y + 5, { width: 130, ellipsis: true });
        doc.text(toSafeText(u.email ?? ""), 184, y + 5, { width: 130, ellipsis: true });
        doc.text(toSafeText(m?.role?.name ?? "—"), 320, y + 5, { width: 90, ellipsis: true });
        doc.text(u.enabled ? "Activo" : "Inactivo", 416, y + 5, { width: 55 });
        doc.text(u.createdAt ? formatDateEs(u.createdAt) : "—", 476, y + 5, { width: 80 });
        y += rowH;
      }

      drawPdfFooter(doc, branding, { pageNum: ++page });
      doc.end();

      const buffer = await new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      const filename = `usuarios-${new Date().toISOString().slice(0, 10)}.pdf`;
      c.header("Content-Type", "application/pdf");
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(users.length));
      return c.body(buffer);
    } catch (err) {
      console.error("[identity/export/pdf]", err);
      return c.json({ error: "No se pudo generar el PDF." }, 500);
    }
  },
);

app.post(
  "/identity/users/:id/avatar",
  authMiddleware,
  requirePermission("identity.users.update"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const target = await prisma.userProfile.findUnique({
        where: { id },
        select: { id: true, authUserId: true },
      });
      if (!target) return c.json({ error: "Usuario no encontrado." }, 404);

      const body = await c.req.parseBody();
      const file = body.avatar;
      if (!(file instanceof File) || file.size <= 0) {
        return c.json({ error: "Selecciona una imagen valida." }, 400);
      }
      if (file.size > 10 * 1024 * 1024) {
        return c.json({ error: "La imagen no puede superar 10 MB." }, 400);
      }
      if (!file.type.startsWith("image/")) {
        return c.json({ error: "Solo se permiten imagenes." }, 400);
      }

      const asset = await uploadIdentityAvatar({ profileId: target.id, file });
      cacheDel(`user_ctx:${target.authUserId}`);
      const avatarUrl = await getSignedUrlByFileId(asset.id);
      return c.json({ data: { avatarUrl } });
    } catch {
      return c.json(
        { error: "No se pudo actualizar el avatar del usuario." },
        500,
      );
    }
  },
);

app.delete(
  "/identity/users/:id",
  authMiddleware,
  requirePermission("identity.users.delete"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const context = c.get("userContext");

      if (id === context.profile.id) {
        return c.json({ error: "No puedes eliminar tu propia cuenta." }, 400);
      }

      const targetUser = await prisma.userProfile.findUnique({
        where: { id },
        include: {
          memberships: {
            where: { enabled: true },
            include: { role: { select: { key: true } } },
          },
        },
      });
      if (!targetUser) {
        return c.json({ error: "Usuario no encontrado." }, 404);
      }
      if (hasProtectedIdentityAdminRole(targetUser)) {
        return c.json(
          {
            error:
              "No se puede eliminar un usuario con rol Atlas Admin o System Admin.",
          },
          400,
        );
      }

      await supabaseAdmin.auth.admin.deleteUser(targetUser.authUserId);
      await prisma.userProfile.delete({ where: { id } });

      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.user.delete",
        severity: "critical",
        entityType: "UserProfile",
        entityId: id,
        summary: `${actorName} eliminó al usuario ${targetUser.email ?? id}`,
      });

      return c.json({ ok: true });
    } catch {
      return c.json({ error: "No se pudo eliminar el usuario." }, 500);
    }
  },
);

app.patch(
  "/identity/users/:id",
  authMiddleware,
  requirePermission("identity.users.update"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const patch = {};

      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (typeof body.firstName === "string")
        patch.firstName = body.firstName.trim();
      if (typeof body.lastName === "string")
        patch.lastName = body.lastName.trim();
      // Extended personal fields
      if (typeof body.phone === "string")
        patch.phone = body.phone.trim() || null;
      if (body.phone === null) patch.phone = null;
      if (typeof body.bio === "string") patch.bio = body.bio.trim() || null;
      if (body.bio === null) patch.bio = null;
      if (typeof body.gender === "string")
        patch.gender = body.gender.trim() || null;
      if (body.gender === null) patch.gender = null;
      if (typeof body.birthDate === "string") {
        const d = body.birthDate ? new Date(body.birthDate) : null;
        patch.birthDate = d && !Number.isNaN(d.getTime()) ? d : null;
      }
      if (body.birthDate === null) patch.birthDate = null;

      // Address fields
      if (typeof body.country === "string")
        patch.country = body.country.trim() || null;
      if (body.country === null) patch.country = null;
      if (typeof body.state === "string")
        patch.state = body.state.trim() || null;
      if (body.state === null) patch.state = null;
      if (typeof body.city === "string") patch.city = body.city.trim() || null;
      if (body.city === null) patch.city = null;
      if (typeof body.colony === "string")
        patch.colony = body.colony.trim() || null;
      if (body.colony === null) patch.colony = null;
      if (typeof body.street === "string")
        patch.street = body.street.trim() || null;
      if (body.street === null) patch.street = null;
      if (typeof body.extNumber === "string")
        patch.extNumber = body.extNumber.trim() || null;
      if (body.extNumber === null) patch.extNumber = null;
      if (typeof body.intNumber === "string")
        patch.intNumber = body.intNumber.trim() || null;
      if (body.intNumber === null) patch.intNumber = null;
      if (typeof body.postalCode === "string")
        patch.postalCode = body.postalCode.trim() || null;
      if (body.postalCode === null) patch.postalCode = null;

      const user = await prisma.userProfile.update({
        where: { id },
        data: patch,
      });

      if (patch.firstName !== undefined || patch.lastName !== undefined) {
        const newDisplay =
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
        if (newDisplay !== user.displayName) {
          await prisma.userProfile.update({
            where: { id },
            data: { displayName: newDisplay },
          });
          user.displayName = newDisplay;
        }
      }

      // Email update — requires both DB and Supabase auth update
      if (typeof body.email === "string" && body.email.trim()) {
        const newEmail = body.email.trim().toLowerCase();
        const { error: authEmailError } =
          await supabaseAdmin.auth.admin.updateUserById(user.authUserId, {
            email: newEmail,
          });
        if (authEmailError) {
          return c.json(
            { error: "No se pudo actualizar el correo del usuario." },
            500,
          );
        }
        try {
          await prisma.userProfile.update({
            where: { id },
            data: { email: newEmail },
          });
          user.email = newEmail;
        } catch {
          await supabaseAdmin.auth.admin.updateUserById(user.authUserId, {
            email: user.email,
          });
          return c.json(
            { error: "No se pudo sincronizar el correo. Intenta de nuevo." },
            500,
          );
        }
      }

      // Membership / role update
      if (body.membershipId && body.roleId) {
        await prisma.membership.update({
          where: { id: body.membershipId },
          data: { roleId: body.roleId },
        });
      }

      // Bust user context cache so the next GET /user/me reflects changes
      cacheDel(`user_ctx:${user.authUserId}`);

      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.user.update",
        severity: "info",
        entityType: "UserProfile",
        entityId: id,
        summary: `${actorName} actualizó al usuario ${user.email ?? id}`,
      });

      return c.json({ data: user });
    } catch {
      return c.json({ error: "No se pudo actualizar el usuario." }, 500);
    }
  },
);

app.get("/runtime/modules", authMiddleware, async (c) => {
  const context = await getOrLoadUserContext(c);
  if (!context?.profile) {
    return c.json(
      { error: "No autorizado. Perfil de usuario no encontrado." },
      401,
    );
  }

  // Cache raw DB data — the per-user access filter is applied below on each request.
  // Invalidated by module lifecycle events (same points as blueprints:raw).
  let modulesRaw = cacheGet("runtime:modules:raw");
  if (!modulesRaw) {
    modulesRaw = await prisma.atlasModule.findMany({
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
    cacheSet("runtime:modules:raw", modulesRaw, TTL.BLUEPRINTS);
  }

  return c.json({
    data: serializeModulesForResponse(modulesRaw, context, {
      filterByPermission: true,
      filterNavigation: true,
    }),
  });
});

app.get("/blueprints", authMiddleware, async (c) => {
  const context = await getOrLoadUserContext(c);
  if (!context?.profile) {
    return c.json(
      { error: "No autorizado. Perfil de usuario no encontrado." },
      401,
    );
  }

  // Cache raw DB data — the per-user access filter is applied below on each request.
  // Invalidated by module lifecycle events (install/enable/disable/uninstall/sync/reset).
  let blueprintRaw = cacheGet("blueprints:raw");
  if (!blueprintRaw) {
    const [blueprints, installedModuleRows] = await Promise.all([
      prisma.blueprint.findMany({
        where: { enabled: true },
        include: { module: true },
      }),
      prisma.atlasModule.findMany({
        where: { status: "INSTALLED", enabled: true },
        select: {
          key: true,
          name: true,
          status: true,
          enabled: true,
          version: true,
          manifest: true,
          hasBundle: true,
        },
      }),
    ]);
    const atlasViews = await prisma.atlasView.findMany({
      where: {
        enabled: true,
        moduleKey: { in: installedModuleRows.map((row) => row.key) },
      },
    });
    blueprintRaw = { blueprints, installedModuleRows, atlasViews };
    cacheSet("blueprints:raw", blueprintRaw, TTL.BLUEPRINTS);
  }

  const { blueprints, installedModuleRows, atlasViews } = blueprintRaw;
  const moduleRowsByKey = new Map(
    installedModuleRows.map((row) => [row.key, row]),
  );
  const mergedByKey = new Map();

  for (const blueprint of blueprints) {
    if (!userCanAccessModule(context, blueprint.module)) continue;
    mergedByKey.set(blueprint.key, {
      ...blueprint,
      source: "blueprint",
      module: blueprint.module
        ? {
            ...blueprint.module,
            has_bundle: blueprint.module.hasBundle ?? false,
          }
        : blueprint.module,
    });
  }

  for (const view of atlasViews) {
    const moduleRow = moduleRowsByKey.get(view.moduleKey);
    if (!moduleRow) continue;
    if (!userCanAccessModule(context, moduleRow)) continue;

    mergedByKey.set(view.key, {
      id: view.id,
      key: view.key,
      moduleKey: view.moduleKey,
      kind: view.type,
      version: moduleRow.version ?? "0.1.0",
      schema: view.schema,
      enabled: view.enabled,
      source: "atlas-view",
      module: {
        key: moduleRow.key,
        name: moduleRow.name,
        status: moduleRow.status,
        enabled: moduleRow.enabled,
        has_bundle: moduleRow.hasBundle ?? false,
      },
    });
  }

  return c.json({ data: [...mergedByKey.values()] });
});

const publicWebsiteRouter = createPublicWebsiteRouter({
  prisma,
  supabaseAdmin,
});
app.route("/public/website", publicWebsiteRouter);

const publicCatalogRouter = createPublicCatalogRouter({ prisma });
app.route("/public/catalog", publicCatalogRouter);

const publicFormsRouter = createPublicFormsRouter({ prisma });
app.route("/public/website", publicFormsRouter);

const publicBookingsRouter = createPublicBookingsRouter({ prisma });
app.route("/public/website", publicBookingsRouter);

const publicCheckoutRouter = createPublicCheckoutRouter({ prisma });
app.route("/public/website", publicCheckoutRouter);

const storefrontRouter = createStorefrontRouter({ prisma, supabaseAdmin, supabaseAnon });
app.route("/public/storefront", storefrontRouter);

const pwaRouter = createPwaRouter({ prisma });
app.route("/pwa", pwaRouter);

app.get("/public", (c) => {
  return c.json({
    api: "Atlas ERP Public API",
    version: "1.0",
    docs: "https://github.com/raulbellosom/atlaserp",
    endpoints: [
      // Discovery
      { method: "GET",  path: "/public",                                auth: "none",       description: "This index — lists all public endpoints" },
      { method: "GET",  path: "/public/modules",                        auth: "none",       description: "Installed and enabled modules (key, name, version, navigation)" },
      { method: "GET",  path: "/public/blueprints",                     auth: "none",       description: "Public custom views declared by modules (schema, component path)" },
      // Storefront auth
      { method: "POST", path: "/public/storefront/auth/register",       auth: "none",       description: "Register a storefront user account" },
      { method: "POST", path: "/public/storefront/auth/login",          auth: "none",       description: "Login and obtain access + refresh tokens" },
      { method: "POST", path: "/public/storefront/auth/refresh",        auth: "none",       description: "Refresh an expired access token" },
      { method: "GET",  path: "/public/storefront/auth/me",             auth: "storefront", description: "Get the authenticated storefront user profile" },
      { method: "POST", path: "/public/storefront/auth/logout",         auth: "storefront", description: "Invalidate the current session" },
      // Storefront config & realtime
      { method: "GET",  path: "/public/storefront/config",              auth: "none",       description: "Public instance configuration (company name, branding, features)" },
      { method: "GET",  path: "/public/storefront/realtime-config",     auth: "none",       description: "Supabase realtime connection credentials for live updates" },
      { method: "GET",  path: "/public/storefront/v1/config",           auth: "none",       description: "Storefront capture policy and capabilities" },
      { method: "POST", path: "/public/storefront/v1/events/batch",     auth: "optional",   description: "Submit a bounded analytics event batch" },
      { method: "GET",  path: "/public/storefront/v1/forms/:formId",    auth: "none",       description: "Get an enabled public form definition" },
      { method: "POST", path: "/public/storefront/v1/forms/:formId/submissions", auth: "optional", description: "Submit a public form with idempotency" },
      // Storefront files
      { method: "POST", path: "/public/storefront/files/upload",        auth: "storefront", description: "Upload a file as an authenticated storefront user" },
      { method: "GET",  path: "/public/storefront/files/:id/url",       auth: "none",       description: "Get a signed download URL for a public file" },
      { method: "DELETE", path: "/public/storefront/files/:id",         auth: "storefront", description: "Delete an owned file" },
      // Catalog
      { method: "GET",  path: "/public/catalog/categories",             auth: "none",       description: "Published product categories" },
      { method: "GET",  path: "/public/catalog/products",               auth: "none",       description: "Published products list (supports ?q, ?category, ?limit)" },
      { method: "GET",  path: "/public/catalog/products/:slug",         auth: "none",       description: "Single product detail by slug" },
      // Website / CMS
      { method: "GET",  path: "/public/website/resolve",                auth: "none",       description: "Resolve a website by domain or slug" },
      { method: "GET",  path: "/public/website/blog",                   auth: "none",       description: "Published blog posts" },
      { method: "POST", path: "/public/website/forms/:formId/submit",   auth: "none",       description: "Submit a website form" },
      { method: "POST", path: "/public/website/bookings",               auth: "none",       description: "Create a booking" },
      { method: "POST", path: "/public/website/checkout",               auth: "none",       description: "Initiate a checkout (Stripe)" },
      // Static site
      { method: "GET",  path: "/public/site/erp-badge-check",           auth: "optional",   description: "Check if the current session has ERP access (used by the injected beacon)" },
      { method: "GET",  path: "/public/site/*",                         auth: "none",       description: "Serve the compiled static website" },
    ],
    auth: {
      storefront: "Bearer <token> obtained from /public/storefront/auth/login, plus header X-Atlas-Company: <company-slug>",
    },
  });
});

// Atlas client SDK — served at /atlas-sdk.js via nginx rewrite (/ → /public/site$uri)
app.get("/public/site/atlas-sdk.js", async (c) => {
  const { readFile } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const __dir   = dirname(fileURLToPath(import.meta.url))
  const sdkPath = join(__dir, 'public', 'atlas-sdk.js')
  try {
    const code = await readFile(sdkPath, 'utf8')
    c.header('Content-Type', 'application/javascript; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    return c.text(code)
  } catch {
    return c.text('/* atlas-sdk not found */', 404)
  }
})

// ERP beacon check — called client-side by the injected badge script.
// Returns { show: true } only when the request carries a valid Atlas session
// with platform.erp.access. No auth middleware: missing/invalid tokens return false.
app.get("/public/site/erp-badge-check", async (c) => {
  c.header("Cache-Control", "no-store")
  const authHeader = c.req.header("Authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) return c.json({ show: false })
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return c.json({ show: false })
  try {
    const context = await getUserContextByAuthId(data.user.id)
    return c.json({ show: Boolean(context?.permissionSet.has("platform.erp.access")) })
  } catch {
    return c.json({ show: false })
  }
})

// Public site catch-all — must be registered last among public routes
app.get("/public/site/*", async (c) => {
  const fullPath = c.req.path.replace(/^\/public\/site/, '') || '/'
  const result = await distServeService.serve(c, fullPath)
  if (result === null) {
    // Builder mode: return 404 so nginx falls back to the React SPA,
    // which loads PublicWebsiteEntry and renders the builder client-side.
    return c.notFound()
  }
  return result
})

app.get("/public/blueprints", async (c) => {
  try {
    const cacheKey = "public:blueprints:raw";
    let publicViews = cacheGet(cacheKey);
    if (!publicViews) {
      publicViews = await prisma.atlasView.findMany({
        where: {
          type: "CUSTOM",
          enabled: true,
          schema: { path: ["public"], equals: true },
        },
      });
      cacheSet(cacheKey, publicViews, TTL.BLUEPRINTS);
    }
    return c.json({
      data: publicViews.map((v) => ({
        key: v.key,
        kind: v.type,
        moduleKey: v.moduleKey,
        schema: {
          component: v.schema?.component,
          path: v.schema?.path,
          title: v.schema?.title,
          public: v.schema?.public,
        },
        source: "atlas-view",
      })),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[public/blueprints]", err?.message);
    }
    return c.json({ error: "No se pudieron cargar las vistas públicas." }, 500);
  }
});

app.get("/public/modules", async (c) => {
  try {
    const cacheKey = "public:modules:raw";
    let modulesRaw = cacheGet(cacheKey);
    if (!modulesRaw) {
      modulesRaw = await prisma.atlasModule.findMany({
        where: { status: "INSTALLED", enabled: true },
        orderBy: [{ core: "desc" }, { name: "asc" }],
        select: {
          key: true,
          name: true,
          version: true,
          kind: true,
          enabled: true,
          manifest: true,
        },
      });
      cacheSet(cacheKey, modulesRaw, TTL.BLUEPRINTS);
    }
    return c.json({
      data: modulesRaw.map((m) => ({
        key: m.key,
        name: m.name,
        version: m.version,
        kind: m.kind,
        enabled: m.enabled,
        navigation: m.manifest?.navigation ?? [],
        exposes: m.manifest?.exposes ?? [],
      })),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[public/modules]", err?.message);
    }
    return c.json({ error: "No se pudieron cargar los modulos." }, 500);
  }
});

app.get(
  "/contacts",
  authMiddleware,
  requirePermission("contacts.contacts.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const search = c.req.query("search") ?? c.req.query("q") ?? "";
      const page = c.req.query("page") ?? "1";
      const pageSize = c.req.query("pageSize") ?? c.req.query("limit") ?? "20";
      const sortBy = c.req.query("sortBy") ?? "";
      const sortDir = c.req.query("sortDir") ?? "asc";
      const enabledRaw = c.req.query("enabled");
      const enabled = enabledRaw === "false" ? false : true;
      const result = await contactsService.list({
        authUserId,
        search,
        page,
        pageSize,
        sortBy,
        sortDir,
        enabled,
      });
      return c.json({
        data: result.rows,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        },
      });
    } catch (err) {
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudieron cargar los contactos." }, 500);
    }
  },
);

app.get(
  "/contacts/picker",
  authMiddleware,
  requirePermission("contacts.contacts.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const query = c.req.query("q") ?? "";
      const limit = c.req.query("limit");
      const options = await contactsService.picker({
        authUserId,
        query,
        limit,
      });
      return c.json({ data: options });
    } catch (err) {
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudieron cargar opciones de contacto." },
        500,
      );
    }
  },
);

app.post(
  "/contacts",
  authMiddleware,
  requirePermission("contacts.contacts.create"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const payload = await c.req.json();
      const contact = await contactsService.create({ authUserId, payload });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "contacts.contact.create",
        severity: "success",
        entityType: "Contact",
        entityId: contact.id,
        summary: `${actorName} creó el contacto "${contact.name ?? ""}"`.trim(),
      });
      return c.json({ data: contact }, 201);
    } catch (err) {
      if (err?.name === "ZodError") {
        return c.json(
          { error: err.errors?.[0]?.message ?? "Datos de contacto invalidos." },
          400,
        );
      }
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo crear el contacto." }, 500);
    }
  },
);

app.patch(
  "/contacts/bulk/enabled",
  authMiddleware,
  requirePermission("contacts.contacts.update"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const { ids, enabled } = await c.req.json();
      await contactsService.bulkSetEnabled({ authUserId, ids, enabled });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: enabled
          ? "contacts.contact.bulk_enable"
          : "contacts.contact.bulk_disable",
        severity: enabled ? "info" : "warning",
        entityType: "Contact",
        summary: `${actorName} ${enabled ? "habilitó" : "deshabilitó"} ${Array.isArray(ids) ? ids.length : 0} contacto(s)`,
      });
      return c.json({ ok: true });
    } catch (err) {
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudo actualizar el estado de los contactos." },
        500,
      );
    }
  },
);

app.delete(
  "/contacts/bulk",
  authMiddleware,
  requirePermission("contacts.contacts.delete"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const { ids } = await c.req.json();
      await contactsService.bulkDelete({ authUserId, ids });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "contacts.contact.bulk_delete",
        severity: "warning",
        entityType: "Contact",
        summary: `${actorName} eliminó ${Array.isArray(ids) ? ids.length : 0} contacto(s)`,
      });
      return c.json({ ok: true });
    } catch (err) {
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudieron eliminar los contactos." }, 500);
    }
  },
);

app.post(
  "/contacts/export/excel",
  authMiddleware,
  requirePermission("contacts.contacts.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json().catch(() => ({}));
      const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
      const contacts = await contactsService.getContactsForExport({
        authUserId,
        ids,
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Contactos");
      sheet.columns = [
        { header: "ID", key: "id", width: 40 },
        { header: "Nombre", key: "name", width: 30 },
        { header: "Razon social", key: "legalName", width: 36 },
        { header: "Tipo", key: "type", width: 16 },
        { header: "Correo", key: "email", width: 32 },
        { header: "Telefono", key: "phone", width: 18 },
        { header: "RFC / ID fiscal", key: "taxId", width: 20 },
        { header: "Estado", key: "enabled", width: 12 },
        { header: "Creado", key: "createdAt", width: 22 },
      ];
      sheet.getRow(1).font = { bold: true };

      for (const contact of contacts) {
        sheet.addRow({
          id: contact.id,
          name: contact.name ?? "",
          legalName: contact.legalName ?? "",
          type: contact.type ?? "",
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          taxId: contact.taxId ?? "",
          enabled: contact.enabled ? "Activo" : "Inactivo",
          createdAt: contact.createdAt
            ? new Date(contact.createdAt)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
            : "",
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `contactos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      c.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(contacts.length));
      return c.body(buffer);
    } catch {
      return c.json({ error: "No se pudo generar el archivo Excel." }, 500);
    }
  },
);

app.post(
  "/contacts/export/pdf",
  authMiddleware,
  requirePermission("contacts.contacts.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json().catch(() => ({}));
      const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
      const contacts = await contactsService.getContactsForExport({ authUserId, ids });
      const { resolveCompanyBranding, resolvePdfDocumentCtor, toSafeText, compact, normalizeHexColor, lightenHex, drawPdfHeader, drawPdfFooter } =
        await import("./services/pdf-branding-service.js");
      const companyId = (await prisma.membership.findFirst({ where: { userId: authUserId } }))?.companyId;
      const branding = await resolveCompanyBranding({ prisma, companyId: companyId ?? "" });
      const PDFDocument = await resolvePdfDocumentCtor();
      if (typeof PDFDocument !== "function") {
        return c.json({ error: "PDF no disponible." }, 503);
      }

      const brandColor = normalizeHexColor(branding.primaryColor, "#0F766E");
      const brandColorLight = lightenHex(brandColor, 0.9);
      const C_DARK = "#0F172A";
      const C_MID = "#334155";
      const C_MUTED = "#64748B";
      const C_BORDER = "#E2E8F0";
      const MARGIN = 44;
      const TYPE_LABELS = { customer: "Cliente", supplier: "Proveedor", person: "Persona", company: "Empresa" };

      const doc = new PDFDocument({ margin: 0, size: "LETTER", layout: "portrait", bufferPages: true });
      const chunks = [];
      const done = new Promise((resolve, reject) => {
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      const pageWidth = doc.page.width;
      const right = pageWidth - MARGIN;
      const contentWidth = right - MARGIN;
      const date = new Date().toLocaleDateString("es-MX");

      let y = drawPdfHeader(doc, {
        branding,
        title: "Directorio de Contactos",
        subtitle: `${contacts.length} contacto${contacts.length !== 1 ? "s" : ""}`,
        folio: date,
      });

      const COL_WIDTHS = { name: 160, type: 70, email: 140, phone: 90, taxId: 90 };
      const headers = [
        { key: "name", label: "Nombre", w: COL_WIDTHS.name },
        { key: "type", label: "Tipo", w: COL_WIDTHS.type },
        { key: "email", label: "Correo", w: COL_WIDTHS.email },
        { key: "phone", label: "Telefono", w: COL_WIDTHS.phone },
        { key: "taxId", label: "RFC / ID fiscal", w: COL_WIDTHS.taxId },
      ];

      // Table header row
      const ROW_H = 18;
      const HEADER_ROW_H = 20;
      doc.rect(MARGIN, y, contentWidth, HEADER_ROW_H).fill(brandColor);
      let cx = MARGIN + 6;
      for (const h of headers) {
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF")
          .text(h.label, cx, y + 6, { width: h.w - 8, lineBreak: false });
        cx += h.w;
      }
      y += HEADER_ROW_H;

      // Table rows
      for (let i = 0; i < contacts.length; i++) {
        const ct = contacts[i];
        const rowBg = i % 2 === 0 ? "#FFFFFF" : brandColorLight;

        if (y + ROW_H > doc.page.height - 44) {
          drawPdfFooter(doc, { branding, pageNumber: doc.bufferedPageRange().count, totalPages: 0 });
          doc.addPage();
          y = drawPdfHeader(doc, { branding, title: "Directorio de Contactos", subtitle: `Continuacion`, folio: date });
          doc.rect(MARGIN, y, contentWidth, HEADER_ROW_H).fill(brandColor);
          let cx2 = MARGIN + 6;
          for (const h of headers) {
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF")
              .text(h.label, cx2, y + 6, { width: h.w - 8, lineBreak: false });
            cx2 += h.w;
          }
          y += HEADER_ROW_H;
        }

        doc.rect(MARGIN, y, contentWidth, ROW_H).fill(rowBg);
        doc.lineWidth(0.3).rect(MARGIN, y, contentWidth, ROW_H).stroke(C_BORDER);

        const values = [
          toSafeText(ct.name),
          TYPE_LABELS[ct.type] ?? toSafeText(ct.type),
          toSafeText(ct.email),
          toSafeText(ct.phone),
          toSafeText(ct.taxId),
        ];

        cx = MARGIN + 6;
        for (let j = 0; j < headers.length; j++) {
          const color = j === 0 ? C_DARK : C_MID;
          const weight = j === 0 ? "Helvetica-Bold" : "Helvetica";
          doc.font(weight).fontSize(7.5).fillColor(color)
            .text(values[j], cx, y + 5, { width: headers[j].w - 10, lineBreak: false, ellipsis: true });
          cx += headers[j].w;
        }
        y += ROW_H;
      }

      if (contacts.length === 0) {
        doc.font("Helvetica").fontSize(9).fillColor(C_MUTED)
          .text("No hay contactos para mostrar.", MARGIN, y + 12, { width: contentWidth, align: "center" });
      }

      const totalPages = doc.bufferedPageRange().count;
      const range = doc.bufferedPageRange();
      for (let p = range.start; p < range.start + range.count; p++) {
        doc.switchToPage(p);
        drawPdfFooter(doc, { branding, pageNumber: p - range.start + 1, totalPages });
      }

      doc.end();
      const buffer = await done;
      const filename = `contactos-${new Date().toISOString().slice(0, 10)}.pdf`;
      c.header("Content-Type", "application/pdf");
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(contacts.length));
      return c.body(buffer);
    } catch (err) {
      console.error("[contacts/export/pdf]", err);
      return c.json({ error: "No se pudo generar el PDF." }, 500);
    }
  },
);

app.put(
  "/contacts/:id",
  authMiddleware,
  requirePermission("contacts.contacts.update"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const payload = await c.req.json();
      const contact = await contactsService.update({ authUserId, id, payload });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "contacts.contact.update",
        severity: "info",
        entityType: "Contact",
        entityId: id,
        summary:
          `${actorName} actualizó el contacto "${contact.name ?? ""}"`.trim(),
      });
      return c.json({ data: contact });
    } catch (err) {
      if (err?.name === "ZodError") {
        return c.json(
          { error: err.errors?.[0]?.message ?? "Datos de contacto invalidos." },
          400,
        );
      }
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo actualizar el contacto." }, 500);
    }
  },
);

app.patch(
  "/contacts/:id/enabled",
  authMiddleware,
  requirePermission("contacts.contacts.update"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const { enabled } = await c.req.json();
      const contact = await contactsService.setEnabled({
        authUserId,
        id,
        enabled,
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: contact.enabled
          ? "contacts.contact.enable"
          : "contacts.contact.disable",
        severity: contact.enabled ? "info" : "warning",
        entityType: "Contact",
        entityId: id,
        summary:
          `${actorName} ${contact.enabled ? "habilitó" : "deshabilitó"} el contacto "${contact.name ?? ""}"`.trim(),
      });
      return c.json({ data: contact });
    } catch (err) {
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudo actualizar el estado del contacto." },
        500,
      );
    }
  },
);

app.delete(
  "/contacts/:id",
  authMiddleware,
  requirePermission("contacts.contacts.delete"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      await contactsService.delete({ authUserId, id });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "contacts.contact.delete",
        severity: "warning",
        entityType: "Contact",
        entityId: id,
        summary: `${actorName} eliminó un contacto`,
      });
      return c.json({ ok: true });
    } catch (err) {
      if (err instanceof ContactsServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo eliminar el contacto." }, 500);
    }
  },
);

app.get(
  "/hr/employees/export",
  authMiddleware,
  requirePermission("hr.employee.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const idsParam = c.req.query("ids");
      const ids = idsParam
        ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
        : null;
      const rows = await hrService.listEmployeesForExport({ authUserId, ids });
      const buffer = await buildEmployeesExcelBuffer({ rows });
      c.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      c.header(
        "Content-Disposition",
        `attachment; filename="colaboradores-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      );
      return new Response(buffer, { status: 200, headers: c.res.headers });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo exportar los colaboradores." }, 500);
    }
  },
);

app.get(
  "/hr/employees/export/pdf",
  authMiddleware,
  requirePermission("hr.employee.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const idsParam = c.req.query("ids");
      const ids = idsParam
        ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
        : null;
      const rows = await hrService.listEmployeesForExport({ authUserId, ids });
      const {
        resolveCompanyBranding, resolvePdfDocumentCtor,
        toSafeText, compact, normalizeHexColor, lightenHex,
        drawPdfHeader, drawPdfFooter,
      } = await import("./services/pdf-branding-service.js");
      const membership = await prisma.membership.findFirst({ where: { userId: authUserId } });
      const branding = await resolveCompanyBranding({ prisma, companyId: membership?.companyId ?? "" });
      const PDFDocument = await resolvePdfDocumentCtor();
      if (typeof PDFDocument !== "function") {
        return c.json({ error: "PDF no disponible." }, 503);
      }

      const brandColor = normalizeHexColor(branding.primaryColor, "#0F766E");
      const brandLight = lightenHex(brandColor, 0.9);
      const C_DARK = "#0F172A";
      const C_MID = "#334155";
      const C_MUTED = "#64748B";
      const C_BORDER = "#E2E8F0";
      const MARGIN = 44;

      const STATUS_LABELS = { active: "Activo", vacation: "Vacaciones", inactive: "Inactivo", terminated: "Baja" };
      const TYPE_LABELS = { full_time: "T. completo", part_time: "Medio tiempo", contractor: "Contratista", intern: "Practicante" };

      const doc = new PDFDocument({ margin: 0, size: "LETTER", layout: "portrait", bufferPages: true });
      const chunks = [];
      const done = new Promise((resolve, reject) => {
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      const pageWidth = doc.page.width;
      const right = pageWidth - MARGIN;
      const contentWidth = right - MARGIN;
      const date = new Date().toLocaleDateString("es-MX");

      let y = drawPdfHeader(doc, {
        branding,
        title: "Directorio de Colaboradores",
        subtitle: `${rows.length} colaborador${rows.length !== 1 ? "es" : ""}`,
        folio: date,
      });

      const COL = { name: 150, code: 65, title: 110, dept: 100, status: 60, type: 75 };
      const headers = [
        { key: "full_name", label: "Nombre", w: COL.name },
        { key: "employee_code", label: "Codigo", w: COL.code },
        { key: "job_title", label: "Puesto", w: COL.title },
        { key: "department", label: "Depto.", w: COL.dept },
        { key: "status", label: "Estado", w: COL.status },
        { key: "employment_type", label: "Tipo", w: COL.type },
      ];

      const HEADER_ROW_H = 20;
      const ROW_H = 18;

      function drawTableHeader(doc, y) {
        doc.rect(MARGIN, y, contentWidth, HEADER_ROW_H).fill(brandColor);
        let cx = MARGIN + 6;
        for (const h of headers) {
          doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF")
            .text(h.label, cx, y + 6, { width: h.w - 8, lineBreak: false });
          cx += h.w;
        }
        return y + HEADER_ROW_H;
      }

      y = drawTableHeader(doc, y);

      for (let i = 0; i < rows.length; i++) {
        const emp = rows[i];
        if (y + ROW_H > doc.page.height - 44) {
          drawPdfFooter(doc, { branding, pageNumber: doc.bufferedPageRange().count, totalPages: 0 });
          doc.addPage();
          y = drawPdfHeader(doc, { branding, title: "Directorio de Colaboradores", subtitle: "Continuacion", folio: date });
          y = drawTableHeader(doc, y);
        }
        const rowBg = i % 2 === 0 ? "#FFFFFF" : brandLight;
        doc.rect(MARGIN, y, contentWidth, ROW_H).fill(rowBg);
        doc.lineWidth(0.3).rect(MARGIN, y, contentWidth, ROW_H).stroke(C_BORDER);

        const values = [
          toSafeText(emp.full_name ?? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim()),
          toSafeText(emp.employee_code),
          toSafeText(emp.job_title),
          toSafeText(emp.department),
          STATUS_LABELS[emp.status] ?? toSafeText(emp.status),
          TYPE_LABELS[emp.employment_type] ?? toSafeText(emp.employment_type),
        ];

        let cx = MARGIN + 6;
        for (let j = 0; j < headers.length; j++) {
          const color = j === 0 ? C_DARK : j === 4 ? brandColor : C_MID;
          const weight = j === 0 ? "Helvetica-Bold" : "Helvetica";
          doc.font(weight).fontSize(7.5).fillColor(color)
            .text(values[j], cx, y + 5, { width: headers[j].w - 10, lineBreak: false, ellipsis: true });
          cx += headers[j].w;
        }
        y += ROW_H;
      }

      if (rows.length === 0) {
        doc.font("Helvetica").fontSize(9).fillColor(C_MUTED)
          .text("No hay colaboradores para mostrar.", MARGIN, y + 12, { width: contentWidth, align: "center" });
      }

      const range = doc.bufferedPageRange();
      for (let p = range.start; p < range.start + range.count; p++) {
        doc.switchToPage(p);
        drawPdfFooter(doc, { branding, pageNumber: p - range.start + 1, totalPages: range.count });
      }

      doc.end();
      const buffer = await done;
      const filename = `colaboradores-${new Date().toISOString().slice(0, 10)}.pdf`;
      c.header("Content-Type", "application/pdf");
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(rows.length));
      return new Response(buffer, { status: 200, headers: c.res.headers });
    } catch (err) {
      console.error("[hr/employees/export/pdf]", err);
      if (err instanceof HrServiceError) return c.json({ error: err.message }, err.status);
      return c.json({ error: "No se pudo generar el PDF." }, 500);
    }
  },
);

app.get(
  "/hr/employees",
  authMiddleware,
  requirePermission("hr.employee.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const search = c.req.query("search") ?? c.req.query("q") ?? "";
      const status = c.req.query("status");
      const enabledRaw = c.req.query("enabled");
      const enabled =
        enabledRaw === undefined ? undefined : enabledRaw === "true";
      const limit = c.req.query("limit");
      const page = c.req.query("page");
      const pageSize = c.req.query("pageSize");
      const sortBy = c.req.query("sortBy");
      const sortDir = c.req.query("sortDir") === "desc" ? "desc" : "asc";

      const result = await hrService.listEmployees({
        authUserId,
        search,
        status,
        enabled,
        limit,
        page,
        pageSize,
        sortBy,
        sortDir,
      });

      if (page !== undefined || pageSize !== undefined) {
        const take = Math.min(Math.max(1, Number(pageSize) || 20), 200);
        const currentPage = Math.max(1, Number(page) || 1);
        return c.json({
          data: result.rows,
          pagination: {
            page: currentPage,
            pageSize: take,
            total: result.total,
          },
        });
      }
      return c.json({ data: result });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudieron cargar colaboradores." }, 500);
    }
  },
);

app.get(
  "/hr/employees/:id",
  authMiddleware,
  requirePermission("hr.employee.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const row = await hrService.getEmployee({ authUserId, id });
      return c.json({ data: row });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo cargar el colaborador." }, 500);
    }
  },
);

app.post(
  "/hr/employees",
  authMiddleware,
  requirePermission("hr.employee.create"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const parsed = hrEmployeeCreateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          { error: parsed.error.errors?.[0]?.message ?? "Datos invalidos." },
          400,
        );
      }
      const row = await hrService.createEmployee({
        authUserId,
        payload: parsed.data,
      });
      return c.json({ data: row }, 201);
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo crear el colaborador." }, 500);
    }
  },
);

app.put(
  "/hr/employees/:id",
  authMiddleware,
  requirePermission("hr.employee.update"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const parsed = hrEmployeeUpdateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          { error: parsed.error.errors?.[0]?.message ?? "Datos invalidos." },
          400,
        );
      }
      const row = await hrService.updateEmployee({
        authUserId,
        id,
        payload: parsed.data,
      });
      return c.json({ data: row });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo actualizar el colaborador." }, 500);
    }
  },
);

app.patch(
  "/hr/employees/:id/enabled",
  authMiddleware,
  requirePermission("hr.employee.delete"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const parsed = hrEmployeeEnabledSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json({ error: "Estado invalido." }, 400);
      }
      const row = await hrService.setEmployeeEnabled({
        authUserId,
        id,
        enabled: parsed.data.enabled,
      });
      return c.json({ data: row });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo actualizar el estado." }, 500);
    }
  },
);

app.get(
  "/hr/employees/:id/audit",
  authMiddleware,
  requirePermission("hr.employee.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const limit = c.req.query("limit");
      const rows = await hrService.getEmployeeAudit({ authUserId, id, limit });
      return c.json({ data: rows });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo cargar el historial." }, 500);
    }
  },
);

app.get(
  "/hr/departments",
  authMiddleware,
  requirePermission("hr.department.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const q = c.req.query("q") ?? "";
      const enabledRaw = c.req.query("enabled");
      const enabled =
        enabledRaw === undefined ? undefined : enabledRaw === "true";
      const limit = c.req.query("limit");
      const rows = await hrService.listDepartments({
        authUserId,
        search: q,
        enabled,
        limit,
      });
      return c.json({ data: rows });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudieron cargar los departamentos." }, 500);
    }
  },
);

app.post(
  "/hr/departments",
  authMiddleware,
  requirePermission("hr.department.create"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const parsed = hrCatalogCreateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          { error: parsed.error.errors?.[0]?.message ?? "Datos inválidos." },
          400,
        );
      }
      const row = await hrService.createDepartment({
        authUserId,
        payload: parsed.data,
      });
      return c.json({ data: row }, 201);
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo crear el departamento." }, 500);
    }
  },
);

app.put(
  "/hr/departments/:id",
  authMiddleware,
  requirePermission("hr.department.update"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const parsed = hrCatalogUpdateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          { error: parsed.error.errors?.[0]?.message ?? "Datos inválidos." },
          400,
        );
      }
      const row = await hrService.updateDepartment({
        authUserId,
        id,
        payload: parsed.data,
      });
      return c.json({ data: row });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo actualizar el departamento." }, 500);
    }
  },
);

app.patch(
  "/hr/departments/:id/enabled",
  authMiddleware,
  requirePermission("hr.department.delete"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const parsed = hrCatalogEnabledSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json({ error: "Estado inválido." }, 400);
      }
      const row = await hrService.setDepartmentEnabled({
        authUserId,
        id,
        enabled: parsed.data.enabled,
      });
      return c.json({ data: row });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudo actualizar el estado del departamento." },
        500,
      );
    }
  },
);

app.get(
  "/hr/job-titles",
  authMiddleware,
  requirePermission("hr.job_title.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const q = c.req.query("q") ?? "";
      const enabledRaw = c.req.query("enabled");
      const enabled =
        enabledRaw === undefined ? undefined : enabledRaw === "true";
      const limit = c.req.query("limit");
      const rows = await hrService.listJobTitles({
        authUserId,
        search: q,
        enabled,
        limit,
      });
      return c.json({ data: rows });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudieron cargar los puestos." }, 500);
    }
  },
);

app.post(
  "/hr/job-titles",
  authMiddleware,
  requirePermission("hr.job_title.create"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const parsed = hrCatalogCreateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          { error: parsed.error.errors?.[0]?.message ?? "Datos inválidos." },
          400,
        );
      }
      const row = await hrService.createJobTitle({
        authUserId,
        payload: parsed.data,
      });
      return c.json({ data: row }, 201);
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo crear el puesto." }, 500);
    }
  },
);

app.put(
  "/hr/job-titles/:id",
  authMiddleware,
  requirePermission("hr.job_title.update"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const parsed = hrCatalogUpdateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          { error: parsed.error.errors?.[0]?.message ?? "Datos inválidos." },
          400,
        );
      }
      const row = await hrService.updateJobTitle({
        authUserId,
        id,
        payload: parsed.data,
      });
      return c.json({ data: row });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo actualizar el puesto." }, 500);
    }
  },
);

app.patch(
  "/hr/job-titles/:id/enabled",
  authMiddleware,
  requirePermission("hr.job_title.delete"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const parsed = hrCatalogEnabledSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json({ error: "Estado inválido." }, 400);
      }
      const row = await hrService.setJobTitleEnabled({
        authUserId,
        id,
        enabled: parsed.data.enabled,
      });
      return c.json({ data: row });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudo actualizar el estado del puesto." },
        500,
      );
    }
  },
);

app.get(
  "/hr/org-chart",
  authMiddleware,
  requirePermission("hr.org_chart.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const rootEmployeeId = c.req.query("rootEmployeeId") ?? null;
      const enabledRaw = c.req.query("enabled");
      const enabled = enabledRaw === undefined ? true : enabledRaw === "true";
      const chart = await hrService.getOrgChart({
        authUserId,
        rootEmployeeId,
        enabled,
      });

      // Batch-collect all avatarFileIds from the tree, load in one query, then assign.
      function collectNodes(node, out = []) {
        out.push(node);
        if (Array.isArray(node.children))
          node.children.forEach((c) => collectNodes(c, out));
        return out;
      }
      const allNodes = (chart.roots ?? []).flatMap((r) => collectNodes(r));
      const orgAvatarFileIds = allNodes
        .map((n) => n.linkedUser?.avatarFileId)
        .filter(Boolean);
      const orgAvatarUrlMap = new Map();
      if (orgAvatarFileIds.length > 0) {
        const orgAssets = await prisma.fileAsset.findMany({
          where: { id: { in: orgAvatarFileIds } },
          select: { id: true, bucket: true, objectKey: true },
        });
        const byBucket = new Map();
        for (const asset of orgAssets) {
          if (!byBucket.has(asset.bucket)) byBucket.set(asset.bucket, []);
          byBucket.get(asset.bucket).push(asset);
        }
        await Promise.all(
          [...byBucket.entries()].map(async ([bucket, assets]) => {
            const { data: signedList } = await supabaseAdmin.storage
              .from(bucket)
              .createSignedUrls(
                assets.map((a) => a.objectKey),
                3600,
              );
            if (Array.isArray(signedList)) {
              for (let i = 0; i < assets.length; i++) {
                orgAvatarUrlMap.set(
                  assets[i].id,
                  signedList[i]?.signedUrl ?? null,
                );
              }
            }
          }),
        );
      }
      for (const node of allNodes) {
        if (node.linkedUser?.avatarFileId) {
          node.linkedUser.avatarUrl =
            orgAvatarUrlMap.get(node.linkedUser.avatarFileId) ?? null;
        }
      }

      // Batch-load profileImageFileId signed URLs — avoids N per-node frontend requests.
      const orgProfileFileIds = allNodes
        .map((n) => n.profileImageFileId)
        .filter(Boolean);
      const orgProfileUrlMap = new Map();
      if (orgProfileFileIds.length > 0) {
        const profileAssets = await prisma.fileAsset.findMany({
          where: { id: { in: orgProfileFileIds } },
          select: { id: true, bucket: true, objectKey: true },
        });
        const profileByBucket = new Map();
        for (const asset of profileAssets) {
          if (!profileByBucket.has(asset.bucket))
            profileByBucket.set(asset.bucket, []);
          profileByBucket.get(asset.bucket).push(asset);
        }
        await Promise.all(
          [...profileByBucket.entries()].map(async ([bucket, assets]) => {
            const { data: signedList } = await supabaseAdmin.storage
              .from(bucket)
              .createSignedUrls(
                assets.map((a) => a.objectKey),
                3600,
              );
            if (Array.isArray(signedList)) {
              for (let i = 0; i < assets.length; i++) {
                orgProfileUrlMap.set(
                  assets[i].id,
                  signedList[i]?.signedUrl ?? null,
                );
              }
            }
          }),
        );
      }
      for (const node of allNodes) {
        if (node.profileImageFileId) {
          node.profileImageUrl =
            orgProfileUrlMap.get(node.profileImageFileId) ?? null;
        }
      }

      return c.json({ data: chart });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "No se pudo cargar el organigrama." }, 500);
    }
  },
);

app.get(
  "/hr/user-options",
  authMiddleware,
  requirePermission("hr.employee.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const q = c.req.query("q") ?? "";
      const limit = c.req.query("limit");
      const rows = await hrService.listUserOptions({
        authUserId,
        search: q,
        limit,
      });
      return c.json({ data: rows });
    } catch (err) {
      if (err instanceof HrServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudieron cargar las cuentas disponibles." },
        500,
      );
    }
  },
);

const modulesRouter = createModulesRouter({
  prisma,
  authMiddleware,
  requirePermission,
  routeLoader,
  bundlerSvc: bundlerService,
});
app.route("/modules", modulesRouter);

// Dist-serve middleware — must be registered BEFORE mountWithAuth() calls.
// In Hono v4, secured.use("*", authMiddleware) inside a sub-app mounted at "/"
// intercepts every unmatched path before the wildcard route at the bottom can fire.
// Moving this up as a use() middleware means it runs first for browser GETs to
// non-API paths and calls next() for everything else (API AJAX calls, etc.).
const API_PREFIX_RE = /^\/(modules|blueprints|files|contacts|company|identity|finance|hr|website|ledger|calendar|projects|catalog|pos|storefront|activity|notifications|inventory|chat|public|auth|health|p|app|user|users|memberships|profile|settings|sync)\b/i
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET') return next()
  const path = c.req.path
  if (API_PREFIX_RE.test(path)) return next()
  const accept = c.req.header('Accept') ?? ''
  if (!accept.includes('text/html')) return next()
  const result = await distServeService.serve(c, path)
  if (result === null) return next()
  return result
})

function mountWithAuth(baseApp, router) {
  const secured = new Hono();
  secured.use("*", authMiddleware);
  secured.route("/", router);
  baseApp.route("/", secured);
}

mountWithAuth(app, createSettingsRouter({ prisma, requirePermission }));
mountWithAuth(app, createWebsiteRouter({ prisma, requirePermission, supabaseAdmin }));
mountWithAuth(app, createLedgerRouter({ prisma, requirePermission }));
mountWithAuth(app, createUsersRouter({ prisma, requirePermission }));
mountWithAuth(app, createFleetRouter({ prisma, requirePermission, enrichFilesWithSignedUrls: filesService.enrichFilesWithSignedUrls.bind(filesService) }));
mountWithAuth(app, createCatalogRouter({ prisma, requirePermission, supabaseAdmin }));
mountWithAuth(app, createPosRouter({ prisma, requirePermission, broadcaster }));
mountWithAuth(app, createCalendarRouter({ prisma, requirePermission, broadcaster }));
mountWithAuth(app, createProjectsRouter({ prisma, requirePermission, notificationService, enrichFileAssets: filesService.enrichFileAssets.bind(filesService), broadcaster }));
mountWithAuth(app, createActivityRouter({ prisma, requirePermission }));
mountWithAuth(app, createNotificationsRouter({ prisma, requirePermission }));
mountWithAuth(app, createGrowthRouter({ prisma, requirePermission, notificationService, enrichFileAssets: filesService.enrichFileAssets.bind(filesService) }));
mountWithAuth(
  app,
  createDocumentsRouter({ prisma, supabaseAdmin, requirePermission }),
);
mountWithAuth(app, createSyncRouter({ prisma }));

// Chat router handles its own auth (internal + public guest routes)
app.route("/", createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService, broadcaster }));

app.route("/", createNotesRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, broadcaster }));

app.post("/internal/notifications/process-deliveries", async (c) => {
  const secret = c.req.header("x-internal-secret");
  if (
    process.env.NODE_ENV === "production" &&
    secret !== process.env.ATLAS_INTERNAL_SECRET
  ) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const body = await c.req.json().catch(() => ({}));
    const limit = Number(body?.limit ?? c.req.query("limit") ?? 50);
    const channel = String(body?.channel ?? c.req.query("channel") ?? "email");
    if (channel === "all") {
      const [email, webPush] = await Promise.all([
        notificationDeliveryWorker.processPendingNotificationDeliveries({
          channel: "email",
          limit,
        }),
        notificationDeliveryWorker.processPendingNotificationDeliveries({
          channel: "web_push",
          limit,
        }),
      ]);
      return c.json({ data: { email, webPush } });
    }
    const result =
      await notificationDeliveryWorker.processPendingNotificationDeliveries({
        channel,
        limit,
      });
    return c.json({ data: result });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Error interno." },
      500,
    );
  }
});

// ─── atlas.inventory ───────────────────────────────────────────────────────

// Items
app.get('/inventory/items', authMiddleware, requirePermission('inventory.item.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { search, categoryId, brandId, locationId, status, assignedToId, page, limit } = c.req.query();
    const result = await inventoryService.listItems({ companyId, search, categoryId, brandId, locationId, status, assignedToId, page: Number(page) || 1, limit: Number(limit) || 50 });
    return c.json(result);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar los items.' }, 500);
  }
});

app.post('/inventory/items', authMiddleware, requirePermission('inventory.item.create'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const data = await c.req.json();
    const item = await inventoryService.createItem(data, companyId, authUserId);
    return c.json({ data: item }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear el item.' }, 500);
  }
});

app.get('/inventory/items/by-employee/:empId', authMiddleware, requirePermission('inventory.assignment.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { empId } = c.req.param();
    const items = await inventoryService.getItemsByEmployee(empId, companyId);
    return c.json({ data: items });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar los items del colaborador.' }, 500);
  }
});

app.get('/inventory/items/:id', authMiddleware, requirePermission('inventory.item.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const item = await inventoryService.getItem(id, companyId);
    return c.json({ data: item });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo cargar el item.' }, 500);
  }
});

app.put('/inventory/items/:id', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const data = await c.req.json();
    const item = await inventoryService.updateItem(id, data, companyId);
    return c.json({ data: item });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo actualizar el item.' }, 500);
  }
});

app.delete('/inventory/items/:id', authMiddleware, requirePermission('inventory.item.delete'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    await inventoryService.deleteItem(id, companyId);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo eliminar el item.' }, 500);
  }
});

app.post('/inventory/items/:id/assign', authMiddleware, requirePermission('inventory.assignment.manage'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const { id } = c.req.param();
    const { employeeId, notes } = await c.req.json();
    const result = await inventoryService.assignItem(id, employeeId, authUserId, notes, companyId);
    return c.json({ data: result }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo asignar el item.' }, 500);
  }
});

app.post('/inventory/items/:id/return', authMiddleware, requirePermission('inventory.assignment.manage'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const result = await inventoryService.returnItem(id, authUserId, body.notes, companyId);
    return c.json({ data: result });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo registrar la devolucion del item.' }, 500);
  }
});

app.get('/inventory/items/:id/assignments', authMiddleware, requirePermission('inventory.assignment.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const history = await inventoryService.getAssignmentHistory(id, companyId);
    return c.json({ data: history });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo cargar el historial de asignaciones.' }, 500);
  }
});

// Item files
app.get('/inventory/items/:id/files', authMiddleware, requirePermission('inventory.item.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const files = await inventoryService.listItemFiles(id, companyId);
    const enriched = await filesService.enrichFilesWithSignedUrls(files);
    return c.json({ data: enriched });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar los archivos.' }, 500);
  }
});

app.post('/inventory/items/:id/files', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const body = await c.req.json();
    const fileAssetId = body.file_asset_id ?? body.fileAssetId;
    if (!fileAssetId) return c.json({ error: 'file_asset_id is required' }, 400);
    const record = await inventoryService.addItemFile(id, fileAssetId, companyId, body.label ?? null);
    return c.json({ data: record }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo asociar el archivo.' }, 500);
  }
});

app.delete('/inventory/items/:id/files/:docId', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id, docId } = c.req.param();
    await inventoryService.removeItemFile(id, docId, companyId);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo eliminar el archivo.' }, 500);
  }
});

// Comments
app.get('/inventory/items/:id/comments', authMiddleware, requirePermission('inventory.item.read'), async (c) => {
  try {
    const { id } = c.req.param();
    const comments = await commentsService.listComments('InvItem', id);
    return c.json({ data: comments });
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar los comentarios.' }, 500);
  }
});

app.post('/inventory/items/:id/comments', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const actorId    = c.get('userId');
    const { id } = c.req.param();
    const { body } = await c.req.json();
    const comment = await commentsService.createComment('InvItem', id, authUserId, body, companyId);
    const mentionIds = comment.mentions?.map((m) => m.userId) ?? [];
    if (mentionIds.length > 0) {
      const members = await prisma.membership.findMany({
        where: { companyId, userId: { in: mentionIds }, enabled: true },
        select: { userId: true },
      });
      const validatedMentionIds = members.map((m) => m.userId);
      if (validatedMentionIds.length > 0) {
        inventoryNotifSvc.notifyInvComment({ companyId, actorId, itemId: id, mentionedUserIds: validatedMentionIds });
      }
    }
    return c.json({ data: comment }, 201);
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear el comentario.' }, 500);
  }
});

app.patch('/inventory/items/:id/comments/:cid', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const authUserId = c.get('authUserId');
    const { cid } = c.req.param();
    const { body } = await c.req.json();
    const comment = await commentsService.updateComment(cid, authUserId, body);
    return c.json({ data: comment });
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo actualizar el comentario.' }, 500);
  }
});

app.delete('/inventory/items/:id/comments/:cid', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const { cid } = c.req.param();
    await commentsService.deleteComment(cid, authUserId, companyId);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo eliminar el comentario.' }, 500);
  }
});

app.post('/inventory/items/:id/comments/:cid/reactions', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const actorId    = c.get('userId');
    const { cid } = c.req.param();
    const { emoji } = await c.req.json();
    const result = await commentsService.toggleReaction(cid, authUserId, emoji);
    if (!result.removed) {
      inventoryNotifSvc.notifyInvReaction({ companyId, actorId, commentId: cid });
    }
    return c.json({ data: result });
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo registrar la reaccion.' }, 500);
  }
});

// Assignments list
app.get('/inventory/assignments', authMiddleware, requirePermission('inventory.assignment.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { employeeId, itemId, active, page, limit } = c.req.query();
    const result = await inventoryService.listAllAssignments({ companyId, employeeId, itemId, active: active === 'true', page: Number(page) || 1, limit: Number(limit) || 50 });
    return c.json(result);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar las asignaciones.' }, 500);
  }
});

// Categories
app.get('/inventory/categories', authMiddleware, requirePermission('inventory.catalog.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const categories = await inventoryService.listCategories(companyId);
    return c.json({ data: categories });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar las categorias.' }, 500);
  }
});

app.post('/inventory/categories', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const data = await c.req.json();
    const category = await inventoryService.createCategory(data, companyId);
    return c.json({ data: category }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear la categoria.' }, 500);
  }
});

app.put('/inventory/categories/:id', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const data = await c.req.json();
    const category = await inventoryService.updateCategory(id, data, companyId);
    return c.json({ data: category });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo actualizar la categoria.' }, 500);
  }
});

app.delete('/inventory/categories/:id', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    await inventoryService.deleteCategory(id, companyId);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo eliminar la categoria.' }, 500);
  }
});

app.patch('/inventory/categories/reorder', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { items } = await c.req.json();
    await inventoryService.reorderCategories(companyId, items);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo reordenar.' }, 500);
  }
});

// Brands
app.get('/inventory/brands', authMiddleware, requirePermission('inventory.catalog.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const brands = await inventoryService.listBrands(companyId);
    return c.json({ data: brands });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar las marcas.' }, 500);
  }
});

app.post('/inventory/brands', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const data = await c.req.json();
    const brand = await inventoryService.createBrand(data, companyId);
    return c.json({ data: brand }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear la marca.' }, 500);
  }
});

app.put('/inventory/brands/:id', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const data = await c.req.json();
    const brand = await inventoryService.updateBrand(id, data, companyId);
    return c.json({ data: brand });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo actualizar la marca.' }, 500);
  }
});

app.delete('/inventory/brands/:id', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    await inventoryService.deleteBrand(id, companyId);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo eliminar la marca.' }, 500);
  }
});

app.patch('/inventory/brands/reorder', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { items } = await c.req.json();
    await inventoryService.reorderBrands(companyId, items);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo reordenar.' }, 500);
  }
});

// Locations
app.get('/inventory/locations', authMiddleware, requirePermission('inventory.catalog.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const locations = await inventoryService.listLocations(companyId);
    return c.json({ data: locations });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar las ubicaciones.' }, 500);
  }
});

app.post('/inventory/locations', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const data = await c.req.json();
    const location = await inventoryService.createLocation(data, companyId);
    return c.json({ data: location }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear la ubicacion.' }, 500);
  }
});

app.put('/inventory/locations/:id', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const data = await c.req.json();
    const location = await inventoryService.updateLocation(id, data, companyId);
    return c.json({ data: location });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo actualizar la ubicacion.' }, 500);
  }
});

app.delete('/inventory/locations/:id', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    await inventoryService.deleteLocation(id, companyId);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo eliminar la ubicacion.' }, 500);
  }
});

app.patch('/inventory/locations/reorder', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { items } = await c.req.json();
    await inventoryService.reorderLocations(companyId, items);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo reordenar.' }, 500);
  }
});

// Custom Fields
app.get('/inventory/custom-fields', authMiddleware, requirePermission('inventory.catalog.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { categoryId } = c.req.query();
    const fields = await inventoryService.listCustomFields(companyId, categoryId);
    return c.json({ data: fields });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar los campos personalizados.' }, 500);
  }
});

app.post('/inventory/custom-fields', authMiddleware, requirePermission('inventory.customfield.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const data = await c.req.json();
    const field = await inventoryService.createCustomField(data, companyId);
    return c.json({ data: field }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear el campo personalizado.' }, 500);
  }
});

app.put('/inventory/custom-fields/:id', authMiddleware, requirePermission('inventory.customfield.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const data = await c.req.json();
    const field = await inventoryService.updateCustomField(id, data, companyId);
    return c.json({ data: field });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo actualizar el campo personalizado.' }, 500);
  }
});

app.delete('/inventory/custom-fields/:id', authMiddleware, requirePermission('inventory.customfield.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    await inventoryService.deleteCustomField(id, companyId);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo eliminar el campo personalizado.' }, 500);
  }
});

app.patch('/inventory/custom-fields/reorder', authMiddleware, requirePermission('inventory.customfield.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { items } = await c.req.json();
    await inventoryService.reorderCustomFields(companyId, items);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo reordenar.' }, 500);
  }
});

const server = serve({ fetch: app.fetch, port });
console.log(`Atlas API running on http://localhost:${port}`);

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));

// Prevent stale-connection errors from the Prisma pg pool from crashing the
// API process. These are transient and Prisma will reconnect on the next query.
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason ?? "");
  console.error("[api] unhandledRejection (non-fatal):", msg);
});
process.on("uncaughtException", (err) => {
  const msg = err?.message ?? String(err);
  // Re-throw anything that isn't a transient DB connection error — those should
  // still crash the process so we don't silently swallow real bugs.
  const isConnectionError =
    msg.includes("Connection terminated") ||
    msg.includes("Connection reset") ||
    msg.includes("Server has closed the connection") ||
    msg.includes("EPIPE") ||
    err?.code === "P1001" ||
    err?.code === "P1017";
  if (isConnectionError) {
    console.error("[api] uncaughtException (transient DB error, continuing):", msg);
    return;
  }
  console.error("[api] uncaughtException (fatal):", err);
  process.exit(1);
});
