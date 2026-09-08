import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createFilesService } from "../files-service.js";
import { createFilesWorkspace } from "../files/workspace.js";

export async function filesWorkspaceFixture(connectionString) {
  const url = new URL(connectionString);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/files_test"
  )
    throw new Error("Use an isolated localhost files_test database.");
  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const objects = new Map();
  const storage = { failUpload: false, uploads: 0, signed: 0 };
  const supabaseAdmin = {
    storage: {
      from: () => ({
        upload: async (key, bytes) => {
          storage.uploads++;
          if (storage.failUpload)
            return { error: new Error("storage unavailable") };
          objects.set(key, Buffer.from(bytes));
          return {};
        },
        remove: async (keys) => {
          keys.forEach((key) => objects.delete(key));
          return {};
        },
        download: async (key) => ({
          data: objects.has(key) ? new Blob([objects.get(key)]) : null,
        }),
        createSignedUrl: async (key) => {
          storage.signed++;
          return {
            data: {
              signedUrl: `https://files.invalid/${encodeURIComponent(key)}`,
            },
          };
        },
        createSignedUrls: async (keys) => ({
          data: keys.map((path) => ({
            path,
            signedUrl: `https://files.invalid/${encodeURIComponent(path)}`,
          })),
        }),
      }),
    },
  };
  const companies = [],
    users = [],
    roles = [];
  async function company() {
    const [c] =
      await prisma.$queryRaw`INSERT INTO company(id,name,slug,updated_at) VALUES(uuidv7(),'Files workspace test',uuidv7()::text,now()) RETURNING id`;
    companies.push(c.id);
    return c.id;
  }
  async function user(
    companyId,
    permissions = [
      "files.assets.read",
      "files.assets.create",
      "files.assets.update",
      "files.assets.delete",
    ],
  ) {
    const [u] =
      await prisma.$queryRaw`INSERT INTO user_profile(id,auth_user_id,display_name,email,updated_at) VALUES(uuidv7(),uuidv7(),'Files test user',uuidv7()::text,now()) RETURNING id,auth_user_id`;
    users.push(u.id);
    const [role] =
      await prisma.$queryRaw`INSERT INTO role(id,key,name,updated_at) VALUES(uuidv7(),uuidv7()::text,'Files test role',now()) RETURNING id`;
    roles.push(role.id);
    for (const key of permissions) {
      await prisma.$executeRaw`INSERT INTO permission(id,key,name) VALUES(uuidv7(),${key},${key}) ON CONFLICT(key) DO NOTHING`;
      await prisma.$executeRaw`INSERT INTO role_permission(id,role_id,permission_id) SELECT uuidv7(),${role.id}::uuid,id FROM permission WHERE key=${key}`;
    }
    await prisma.$executeRaw`INSERT INTO membership(id,company_id,user_id,role_id,updated_at) VALUES(uuidv7(),${companyId}::uuid,${u.id}::uuid,${role.id}::uuid,now())`;
    return { id: u.id, authUserId: u.auth_user_id, companyId };
  }
  const companyId = await company();
  const owner = await user(companyId),
    peer = await user(companyId),
    reader = await user(companyId, ["files.assets.read"]),
    outsider = await user(await company());
  const filesService = createFilesService({ prisma, supabaseAdmin });
  const workspace = createFilesWorkspace({
    prisma,
    supabaseAdmin,
    filesService,
  });
  async function cleanup() {
    await prisma.fileAsset.updateMany({
      where: { entityId: { in: companies } },
      data: { officeLock: null, officeLockExpiresAt: null },
    });
    const files = await prisma.fileAsset.findMany({
      where: { entityId: { in: companies } },
      select: { id: true },
    });
    await prisma.fileAssetVersion.deleteMany({
      where: { fileId: { in: files.map((f) => f.id) } },
    });
    await prisma.fileAsset.deleteMany({
      where: { entityId: { in: companies } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.membership.deleteMany({ where: { userId: { in: users } } });
    await prisma.rolePermission.deleteMany({
      where: { roleId: { in: roles } },
    });
    await prisma.role.deleteMany({ where: { id: { in: roles } } });
    await prisma.userProfile.deleteMany({ where: { id: { in: users } } });
    await prisma.company.deleteMany({ where: { id: { in: companies } } });
    await prisma.$disconnect();
    await pool.end();
  }
  return {
    prisma,
    supabaseAdmin,
    filesService,
    workspace,
    objects,
    storage,
    owner,
    peer,
    reader,
    outsider,
    companyId,
    cleanup,
  };
}
