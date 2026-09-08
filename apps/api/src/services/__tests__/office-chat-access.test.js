import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_FORMATS } from '@atlas/core';
import { createOfficeAccess } from '../office/access.js';

const ids = {
  att: '01990000-0000-7000-8000-0000000000a1',
  conv: '01990000-0000-7000-8000-0000000000c1',
  profile: '01990000-0000-7000-8000-0000000000b1',
  auth: '01990000-0000-7000-8000-0000000000d1',
  company: '01990000-0000-7000-8000-0000000000e1',
};
const status = (n) => (e) => e.status === n;

// Bespoke prisma mock. `attRow` / `memberRow` / `profile` are overridable per case;
// $queryRaw dispatches on the SQL text of the tagged template.
function makeAccess({ attRow = {}, memberRow = { role: 'member' }, profile = { id: ids.profile, enabled: true } } = {}) {
  const baseAtt = {
    id: ids.att, conversation_id: ids.conv, bucket: 'atlas-chat', object_key: 'conversations/x/y.xlsx',
    file_name: 'plan.xlsx', mime_type: OFFICE_FORMATS.xlsx.mimeType, size_bytes: 2048n,
    uploaded_by_guest_id: null, content_revision: 1, checksum: null, office_lock: null,
    office_lock_expires_at: null, updated_at: new Date(), company_id: ids.company,
  };
  const prisma = {
    userProfile: { findUnique: async ({ where }) => (where.authUserId === ids.auth ? profile : null) },
    $queryRaw: async (strings) => {
      const sql = strings.join(' ');
      if (sql.includes('FROM chat_attachments')) return attRow === null ? [] : [{ ...baseAtt, ...attRow }];
      if (sql.includes('chat_conversation_members')) return memberRow === null ? [] : [memberRow];
      return [];
    },
  };
  return createOfficeAccess({ prisma });
}

test('active member can view and edit an Office attachment', async () => {
  const access = makeAccess();
  for (const mode of ['view', 'edit']) {
    const ctx = await access.authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode });
    assert.equal(ctx.source, 'chat_attachment');
    assert.equal(ctx.format.kind, 'ooxml');
    assert.equal(ctx.file.originalName, 'plan.xlsx');
    assert.equal(ctx.companyId, ids.company);
  }
});

test('non-member is rejected', async () => {
  const access = makeAccess({ memberRow: null });
  await assert.rejects(access.authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'view' }), status(403));
});

test('guest role: view ok, edit rejected', async () => {
  const access = makeAccess({ memberRow: { role: 'guest' } });
  await access.authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'view' });
  await assert.rejects(access.authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'edit' }), status(403));
});

test('guest-uploaded original: view ok, edit rejected', async () => {
  const access = makeAccess({ attRow: { uploaded_by_guest_id: '01990000-0000-7000-8000-0000000000f1' } });
  await access.authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'view' });
  await assert.rejects(access.authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'edit' }), status(403));
});

test('non-Office mime → 415, oversize → 413, missing row → 404, bad id → 400', async () => {
  await assert.rejects(makeAccess({ attRow: { mime_type: 'image/png', file_name: 'x.png' } }).authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'view' }), status(415));
  await assert.rejects(makeAccess({ attRow: { size_bytes: 11n * 1024n * 1024n } }).authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'view' }), status(413));
  await assert.rejects(makeAccess({ attRow: null }).authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'view' }), status(404));
  await assert.rejects(makeAccess().authorizeChatAttachment({ authUserId: ids.auth, attachmentId: 'not-a-uuid', mode: 'view' }), status(400));
});

test('disabled/unknown profile → 403', async () => {
  await assert.rejects(makeAccess({ profile: { id: ids.profile, enabled: false } }).authorizeChatAttachment({ authUserId: ids.auth, attachmentId: ids.att, mode: 'view' }), status(403));
});
