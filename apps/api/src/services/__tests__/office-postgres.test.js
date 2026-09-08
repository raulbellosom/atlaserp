import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { createOfficeService } from '../office/service.js';
import { officeFixture, officeBytes, officeEnv } from './office-fixture.js';
import { OFFICE_FORMATS } from '@atlas/core';

// Explicit opt-in: never use DATABASE_URL or the developer's configured Supabase.
const connectionString = process.env.OFFICE_TEST_DATABASE_URL;
test('Office migration and two independent services serialize correctly in PostgreSQL', { skip: !connectionString }, async t => {
  const url = new URL(connectionString);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/office_test', 'Use only an isolated localhost office_test database.');
  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const [{ id: companyId }] = await prisma.$queryRaw`INSERT INTO company (id, name, slug, updated_at) VALUES (uuidv7(), 'Office test', uuidv7()::text, now()) RETURNING id`;
  const [{ id: profileId, auth_user_id: authUserId }] = await prisma.$queryRaw`INSERT INTO user_profile (id, auth_user_id, display_name, email, updated_at) VALUES (uuidv7(), uuidv7(), 'Office test', uuidv7()::text, now()) RETURNING id, auth_user_id`;
  const [{ id: roleId }] = await prisma.$queryRaw`INSERT INTO role (id, key, name, updated_at) VALUES (uuidv7(), uuidv7()::text, 'Office test', now()) RETURNING id`;
  await prisma.$executeRaw`INSERT INTO membership (id, company_id, user_id, role_id, updated_at) VALUES (uuidv7(), ${companyId}::uuid, ${profileId}::uuid, ${roleId}::uuid, now())`;
  for (const key of ['files.assets.read', 'files.assets.update']) {
    await prisma.$executeRaw`INSERT INTO permission (id, key, name) VALUES (uuidv7(), ${key}, ${key}) ON CONFLICT (key) DO NOTHING`;
    await prisma.$executeRaw`INSERT INTO role_permission (id, role_id, permission_id) SELECT uuidv7(), ${roleId}::uuid, id FROM permission WHERE key = ${key}`;
  }
  const original = await officeBytes();
  const [{ id: fileId }] = await prisma.$queryRaw`INSERT INTO file_asset (id, bucket, object_key, original_name, mime_type, size_bytes, module_key, entity_type, entity_id, updated_at) VALUES (uuidv7(), 'atlas-files', 'original.docx', 'Prueba.docx', ${OFFICE_FORMATS.docx.mimeType}, ${original.length}, 'atlas.files', 'AtlasFile', ${companyId}::uuid, now()) RETURNING id`;
  const f = await officeFixture();
  const options = { prisma, supabaseAdmin: f.supabaseAdmin, env: officeEnv, fetchImpl: async () => new Response('<wopi-discovery><net-zone><app><action ext="docx" name="edit" urlsrc="http://collabora:9980/browser/hash/cool.html?"/></app></net-zone></wopi-discovery>') };
  const first = createOfficeService(options);
  const second = createOfficeService(options);
  const { accessToken: token } = await first.createSession({ authUserId, fileId, mode: 'edit' });
  const req = { fileId, token };
  try {
    await t.test('one instance acquires a lease and another sees it', async () => {
      await first.lock({ ...req, operation: 'LOCK', lock: 'same-document' });
      assert.deepEqual(await second.lock({ ...req, operation: 'GET_LOCK' }), { lock: 'same-document' });
      await assert.rejects(second.lock({ ...req, operation: 'LOCK', lock: 'other' }), e => e.status === 409);
    });
    await t.test('database trigger blocks non-WOPI lifecycle and association changes', async () => {
      await assert.rejects(prisma.fileAsset.update({ where: { id: fileId }, data: { originalName: 'renamed.docx' } }));
      await assert.rejects(prisma.fileAsset.update({ where: { id: fileId }, data: { entityId: profileId } }));
      await assert.rejects(prisma.fileAsset.delete({ where: { id: fileId } }));
    });
    await t.test('concurrent uploads commit exactly one pointer and preserve original', async () => {
      let release;
      let uploads = 0;
      const barrier = new Promise(resolve => { release = resolve; });
      f.state.uploadHook = async () => { if (++uploads === 2) release(); await barrier; };
      const bytes = await officeBytes('docx', 'PostgreSQL checked');
      const results = await Promise.allSettled([first, second].map(service => service.putFile({ ...req, lock: 'same-document', bytes })));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, JSON.stringify(results));
      assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
      const file = await prisma.fileAsset.findUnique({ where: { id: fileId } });
      assert.equal(file.contentRevision, 2);
      const revisions = await prisma.fileAssetVersion.findMany({ where: { fileId } });
      assert.equal(revisions.length, 1);
      assert.equal(revisions[0].objectKey, 'original.docx');
      assert.deepEqual((await second.getFile(req)).bytes, bytes);
    });
    await t.test('a recreated service retains locks; expired leases permit takeover', async () => {
      const restarted = createOfficeService(options);
      assert.deepEqual(await restarted.lock({ ...req, operation: 'GET_LOCK' }), { lock: 'same-document' });
      await prisma.fileAsset.update({ where: { id: fileId }, data: { officeLockExpiresAt: new Date(0) } });
      await restarted.lock({ ...req, operation: 'LOCK', lock: 'new-lock' });
      await restarted.lock({ ...req, operation: 'UNLOCK', lock: 'new-lock' });
    });
  } finally {
    await prisma.fileAsset.update({ where: { id: fileId }, data: { officeLock: null, officeLockExpiresAt: null } });
    await prisma.fileAssetVersion.deleteMany({ where: { fileId } });
    await prisma.fileAsset.delete({ where: { id: fileId } });
    await prisma.auditLog.deleteMany({ where: { entityId: fileId } });
    await prisma.membership.deleteMany({ where: { userId: profileId } });
    await prisma.role.delete({ where: { id: roleId } });
    await prisma.userProfile.delete({ where: { id: profileId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
    await pool.end();
  }
});
