import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { OFFICE_FORMATS } from '@atlas/core';
import { createOfficeService } from '../office/service.js';
import { createOfficeRouter } from '../../routes/office.js';
import { officeEnv, officeBytes } from './office-fixture.js';

const ids = {
  att: '01990000-0000-7000-8000-0000000000a1',
  conv: '01990000-0000-7000-8000-0000000000c1',
  profile: '01990000-0000-7000-8000-0000000000b1',
  auth: '01990000-0000-7000-8000-0000000000d1',
  company: '01990000-0000-7000-8000-0000000000e1',
};
const status = (n) => (e) => e.status === n;

function chatFixture({ locked = false } = {}) {
  // Real wall clock: hono/jwt verify rejects tokens whose iat is in the future.
  const time = Date.now();
  const state = {
    lock: locked ? 'LK1' : null,
    lockExp: locked ? new Date(time + 20 * 60000) : null,
    revision: 1,
    objectKey: 'conversations/x/orig.xlsx',
    checksum: null,
    updatedAt: new Date(time),
    versions: [],
    audits: [],
    objects: new Map(),
    broadcasts: [],
  };
  const attRow = () => ({
    id: ids.att, conversation_id: ids.conv, bucket: 'atlas-chat', object_key: state.objectKey,
    file_name: 'plan.xlsx', mime_type: OFFICE_FORMATS.xlsx.mimeType, size_bytes: 2048n,
    uploaded_by_guest_id: null, content_revision: state.revision, checksum: state.checksum,
    office_lock: state.lock, office_lock_expires_at: state.lockExp, updated_at: state.updatedAt,
    company_id: ids.company,
  });
  const prisma = {
    userProfile: { findUnique: async () => ({ id: ids.profile, authUserId: ids.auth, displayName: 'Raúl', enabled: true }) },
    auditLog: { create: async ({ data }) => { state.audits.push(data); return data; } },
    $queryRaw: async (strings) => {
      const sql = strings.join(' ');
      if (sql.includes('FROM chat_attachments a')) return [attRow()];
      if (sql.includes('chat_conversation_members')) return [{ role: 'member' }];
      if (sql.includes('FOR UPDATE')) return [{ id: ids.att }];
      if (sql.includes('UPDATE chat_attachments') && sql.includes('RETURNING')) {
        state.revision += 1;
        state.updatedAt = new Date(time + 60000);
        return [{ content_revision: state.revision, updated_at: state.updatedAt }];
      }
      return [];
    },
    $executeRaw: async (strings, ...vals) => {
      const sql = strings.join(' ');
      if (sql.includes('INSERT INTO chat_attachment_versions')) state.versions.push(vals);
      if (sql.includes('UPDATE chat_attachments') && sql.includes('office_lock')) { state.lock = vals[0]; state.lockExp = vals[1]; }
      return 1;
    },
    $transaction: async (cb) => cb(prisma),
  };
  const supabaseAdmin = { storage: { from: () => ({
    download: async () => ({ data: state.objects.has(state.objectKey) ? new Blob([state.objects.get(state.objectKey)]) : new Blob([Buffer.alloc(2048)]) }),
    upload: async (key, bytes) => { state.objects.set(key, Buffer.from(bytes)); return {}; },
  }) } };
  const fetchImpl = async () => new Response('<wopi-discovery><net-zone><app><action ext="xlsx" name="edit" urlsrc="http://collabora:9980/browser/hash/cool.html?"/></app></net-zone></wopi-discovery>');
  const broadcaster = { broadcastToChannel: (ch, ev, payload) => state.broadcasts.push({ ch, ev, payload }) };
  const service = createOfficeService({ prisma, supabaseAdmin, env: officeEnv, fetchImpl, now: () => time, broadcaster });
  return { service, state };
}

test('chat attachment: createSession builds a chat:<id> WOPISrc and never leaks the token', async () => {
  const { service } = chatFixture();
  const s = await service.createSession({ authUserId: ids.auth, fileId: ids.att, mode: 'edit', source: 'chat_attachment' });
  const wopiSrc = new URL(s.editorUrl).searchParams.get('WOPISrc');
  assert.ok(wopiSrc.includes(`chat:${ids.att}`), wopiSrc);
  assert.ok(!s.editorUrl.includes(s.accessToken));
  assert.equal(s.fileName, 'plan.xlsx');
});

test('chat attachment: checkFileInfo reports the file name and size', async () => {
  const { service } = chatFixture();
  const s = await service.createSession({ authUserId: ids.auth, fileId: ids.att, mode: 'edit', source: 'chat_attachment' });
  const info = await service.checkFileInfo({ fileId: ids.att, token: s.accessToken, source: 'chat_attachment' });
  assert.equal(info.BaseFileName, 'plan.xlsx');
  assert.equal(info.Size, 2048);
  assert.equal(info.UserCanWrite, true);
});

test('chat attachment: a token minted for file_asset is refused on a chat resource', async () => {
  const { service } = chatFixture();
  const s = await service.createSession({ authUserId: ids.auth, fileId: ids.att, mode: 'edit', source: 'chat_attachment' });
  await assert.rejects(service.checkFileInfo({ fileId: ids.att, token: s.accessToken /* no source => file_asset */ }), status(401));
});

test('chat attachment: putFile requires the WOPI lock', async () => {
  const { service } = chatFixture({ locked: false });
  const s = await service.createSession({ authUserId: ids.auth, fileId: ids.att, mode: 'edit', source: 'chat_attachment' });
  await assert.rejects(
    service.putFile({ fileId: ids.att, token: s.accessToken, source: 'chat_attachment', bytes: await officeBytes('xlsx', 'x'), lock: 'LK1' }),
    status(409),
  );
});

test('WOPI route resolves /wopi/files/chat:<uuid> to the chat backend', async () => {
  const { service } = chatFixture();
  const s = await service.createSession({ authUserId: ids.auth, fileId: ids.att, mode: 'edit', source: 'chat_attachment' });
  const app = new Hono();
  app.route('/', createOfficeRouter({ officeService: service, authMiddleware: async (_, next) => next(), requirePermission: () => async (_, next) => next() }));
  const ok = await app.request(`/wopi/files/chat:${ids.att}?access_token=${encodeURIComponent(s.accessToken)}`);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).BaseFileName, 'plan.xlsx');
  // Same token, no chat: prefix → treated as file_asset → source mismatch → 401.
  const mismatch = await app.request(`/wopi/files/${ids.att}?access_token=${encodeURIComponent(s.accessToken)}`);
  assert.equal(mismatch.status, 401);
});

test('chat attachment: putFile writes a version row, bumps the revision and broadcasts', async () => {
  const { service, state } = chatFixture({ locked: true });
  const s = await service.createSession({ authUserId: ids.auth, fileId: ids.att, mode: 'edit', source: 'chat_attachment' });
  const out = await service.putFile({
    fileId: ids.att, token: s.accessToken, source: 'chat_attachment',
    bytes: await officeBytes('xlsx', 'edited'), lock: 'LK1',
  });
  assert.equal(out.version, '2');
  assert.equal(state.versions.length, 1);
  assert.equal(state.broadcasts.length, 1);
  assert.equal(state.broadcasts[0].ev, 'attachment_updated');
  assert.equal(state.broadcasts[0].payload.attachmentId, ids.att);
});
