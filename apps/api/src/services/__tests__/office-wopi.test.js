import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createOfficeRouter } from '../../routes/office.js';
import { createOfficeService } from '../office/service.js';
import { createCollaboraProvider, readBoundedBody } from '../office/discovery.js';
import { readOfficeConfig } from '../office/config.js';
import { validateOfficeDocument } from '../office/validate-document.js';
import { OFFICE_FORMATS, getOfficeFormat } from '@atlas/core';
import { ids, officeBytes, officeEnv, officeFixture } from './office-fixture.js';

const status = expected => error => error.status === expected;

test('Office can be disabled or misconfigured without failing API startup', async () => {
  const disabled = createOfficeService({ prisma: {}, env: {} });
  assert.equal((await disabled.status()).enabled, false);
  await assert.rejects(disabled.createSession({}), status(503));
  const bad = createOfficeService({ prisma: {}, env: { ATLAS_OFFICE_ENABLED: 'true' } });
  assert.equal((await bad.status()).code, 'office_configuration');
  assert.throws(() => readOfficeConfig({ ...officeEnv, COLLABORA_PUBLIC_URL: 'http://office.example.com' }), status(503));
  const f = await officeFixture();
  const withoutEditor = createOfficeService({ prisma: f.prisma, supabaseAdmin: f.supabaseAdmin, env: {} });
  assert.ok((await withoutEditor.download({ authUserId: ids.auth, fileId: ids.file })).bytes.length > 0);
});

test('session uses stable WOPISrc, signed temporary token and company-local permission checks', async () => {
  const f = await officeFixture();
  const edit = await f.session();
  const view = await f.session('view');
  assert.equal(new URL(edit.editorUrl).searchParams.get('WOPISrc'), new URL(view.editorUrl).searchParams.get('WOPISrc'));
  assert.equal(new URL(view.editorUrl).searchParams.get('permission'), 'readonly');
  assert.ok(!edit.editorUrl.includes(edit.accessToken));
  f.state.company = ids.other;
  await assert.rejects(f.session(), status(403));
  await assert.rejects(f.service.checkFileInfo({ fileId: ids.file, token: edit.accessToken }), status(403));
});

test('missing, disabled, malformed and unsupported files fail closed', async () => {
  const f = await officeFixture();
  await assert.rejects(f.service.createSession({ authUserId: ids.auth, fileId: '../x' }), status(400));
  await assert.rejects(f.service.createSession({ authUserId: ids.auth, fileId: ids.other }), status(404));
  f.state.file.enabled = false;
  await assert.rejects(f.session(), status(404));
  f.state.file.enabled = true;
  f.state.file.originalName = 'file.pdf';
  await assert.rejects(f.session(), status(415));
});

test('view mode cannot lock or save; auto downgrades to read-only; revocation applies immediately', async () => {
  const f = await officeFixture();
  const req = await f.request('view');
  const info = await f.service.checkFileInfo(req);
  assert.equal(info.UserCanWrite, false);
  assert.equal(info.BaseFileName, 'Prueba.docx');
  assert.equal(info.Version, '1');
  await assert.rejects(f.service.lock({ ...req, operation: 'LOCK', lock: 'x' }), status(403));
  await assert.rejects(f.service.putFile({ ...req, lock: 'x', bytes: await officeBytes() }), status(403));
  f.state.role.permissions.pop();
  assert.equal((await f.session('auto')).mode, 'view');
  await assert.rejects(f.session(), status(403));
  f.state.role.permissions = [];
  await assert.rejects(f.service.checkFileInfo(req), status(403));
});

test('tokens reject tampering, expiration and use against another file', async () => {
  const f = await officeFixture();
  const req = await f.request();
  await assert.rejects(f.service.checkFileInfo({ ...req, token: req.token.slice(0, -8) + 'tampered' }), status(401));
  await assert.rejects(f.service.checkFileInfo({ ...req, fileId: ids.other }), status(401));
  f.advance(28801 * 1000);
  await assert.rejects(f.service.checkFileInfo(req), status(401));
});

test('native origins are explicitly allowed and bound in the signed session', async () => {
  const f = await officeFixture();
  const session = await f.service.createSession({ authUserId: ids.auth, fileId: ids.file, mode: 'view', origin: 'http://tauri.localhost' });
  assert.equal((await f.service.checkFileInfo({ fileId: ids.file, token: session.accessToken })).PostMessageOrigin, 'http://tauri.localhost');
  await assert.rejects(f.service.createSession({ authUserId: ids.auth, fileId: ids.file, origin: 'https://evil.example.com' }), status(403));
});

test('persistent leases refresh, conflict, unlock/relock atomically, and expire after 30 minutes', async () => {
  const f = await officeFixture();
  const req = await f.request();
  const lock = (operation, value, oldLock) => f.service.lock({ ...req, operation, lock: value, oldLock });
  await lock('LOCK', 'a');
  assert.deepEqual(await lock('GET_LOCK'), { lock: 'a' });
  await assert.rejects(lock('LOCK', 'b'), error => error.status === 409 && error.headers['X-WOPI-Lock'] === 'a');
  await lock('LOCK', 'b', 'a');
  await assert.rejects(lock('UNLOCK', 'a'), status(409));
  f.advance(29 * 60000);
  await lock('REFRESH_LOCK', 'b');
  f.advance(2 * 60000);
  assert.deepEqual(await lock('GET_LOCK'), { lock: 'b' });
  f.advance(30 * 60000 + 1);
  assert.deepEqual(await lock('GET_LOCK'), { lock: '' });
  await assert.rejects(lock('REFRESH_LOCK', 'b'), error => error.headers['X-WOPI-Lock'] === '');
  await assert.rejects(lock('LOCK', 'c', 'b'), status(409));
  await lock('LOCK', 'c');
  await lock('UNLOCK', 'c');
  assert.equal(f.state.file.officeLock, null);
});

test('save preserves previous bytes, swaps one FileAsset pointer and identical saves create no revision', async () => {
  const f = await officeFixture();
  const req = await f.request();
  await f.service.lock({ ...req, operation: 'LOCK', lock: 'a' });
  const bytes = await officeBytes('docx', 'Edited');
  await f.service.putFile({ ...req, lock: 'a', bytes });
  assert.equal(f.state.file.contentRevision, 2);
  assert.equal(f.state.versions[0].objectKey, 'original.docx');
  assert.ok(f.state.objects.has('original.docx'));
  assert.deepEqual((await f.service.getFile(req)).bytes, bytes);
  await f.service.putFile({ ...req, lock: 'a', bytes });
  assert.equal(f.state.versions.length, 1);
  assert.ok(f.state.audits.some(a => a.action === 'office.document.saved'));
  assert.ok(!JSON.stringify(f.state.audits).includes(req.token));
});

test('storage errors, incorrect locks, invalid packages and stale timestamps retain original', async () => {
  const f = await officeFixture();
  const req = await f.request();
  const bytes = await officeBytes('docx', 'Edited');
  await assert.rejects(f.service.putFile({ ...req, lock: 'a', bytes }), status(409));
  await f.service.lock({ ...req, operation: 'LOCK', lock: 'a' });
  await assert.rejects(f.service.putFile({ ...req, lock: 'a', bytes: Buffer.from('not office') }), status(415));
  await assert.rejects(f.service.putFile({ ...req, lock: 'a', bytes, timestamp: 'stale' }), status(409));
  f.state.uploadError = true;
  await assert.rejects(f.service.putFile({ ...req, lock: 'a', bytes }), status(503));
  assert.equal(f.state.file.objectKey, 'original.docx');
  assert.equal(f.state.versions.length, 0);
  f.state.downloadError = true;
  await assert.rejects(f.service.getFile(req), status(503));
});

test('two simultaneous saves using the same lock cannot overwrite the committed winner', async () => {
  const f = await officeFixture();
  const req = await f.request();
  await f.service.lock({ ...req, operation: 'LOCK', lock: 'shared' });
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  let uploads = 0;
  f.state.uploadHook = async () => { if (++uploads === 2) release(); await barrier; };
  const bodies = await Promise.all(['A', 'B'].map(value => officeBytes('docx', value)));
  const results = await Promise.allSettled(bodies.map(bytes => f.service.putFile({ ...req, lock: 'shared', bytes })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal(f.state.file.contentRevision, 2);
  assert.equal(f.state.versions.length, 1);
});

test('unsupported attachment origins and authoritative foreign-company associations are denied', async () => {
  const f = await officeFixture();
  f.state.file.moduleKey = 'atlas.chat';
  await assert.rejects(f.session(), status(403));
  f.state.file.moduleKey = 'atlas.files';
  f.state.file.invItemFiles = [{ item: { companyId: ids.other, enabled: true } }];
  await assert.rejects(f.session(), status(403));
});

test('HTTP routes enforce auth, token checks, WOPI headers and request size bounds', async () => {
  const f = await officeFixture();
  const app = new Hono();
  app.route('/', createOfficeRouter({ officeService: f.service, authMiddleware: async (c, next) => { if (c.req.header('Authorization') !== 'Bearer atlas-test') return c.json({}, 401); c.set('authUserId', ids.auth); await next(); }, requirePermission: () => async (_, next) => next() }));
  assert.equal((await app.request('/files/office/status')).status, 401);
  assert.equal((await app.request(`/wopi/files/${ids.file}`)).status, 401);
  const req = await f.request();
  const url = `/wopi/files/${ids.file}?access_token=${encodeURIComponent(req.token)}`;
  const info = await app.request(url);
  assert.equal(info.status, 200);
  assert.equal(info.headers.get('cache-control'), 'no-store');
  const conflict = await app.request(url, { method: 'POST', headers: { 'X-WOPI-Override': 'UNLOCK', 'X-WOPI-Lock': 'x' } });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.headers.get('X-WOPI-Lock'), '');
  const large = await app.request(`/wopi/files/${ids.file}/contents?access_token=${req.token}`, { method: 'POST', headers: { 'X-WOPI-Override': 'PUT', 'Content-Length': '99999999' }, body: 'x' });
  assert.equal(large.status, 413);
  await assert.rejects(readBoundedBody(new Response('12345').body, 4), status(413));
});

test('discovery is cached and errors bounded; never trusts arbitrary editor origins', async () => {
  let calls = 0;
  const provider = createCollaboraProvider({ config: readOfficeConfig(officeEnv), fetchImpl: async () => { calls++; return new Response('<wopi-discovery><net-zone><app><action ext="docx" name="edit" urlsrc="https://untrusted.example/browser/hash/cool.html?"/></app></net-zone></wopi-discovery>'); } });
  await Promise.all([provider.isAvailable(), provider.isAvailable()]);
  const session = await provider.createSession({ file: { originalName: 'a.docx', mimeType: OFFICE_FORMATS.docx.mimeType }, mode: 'edit', wopiSrc: 'http://api:4010/wopi/files/file' });
  assert.equal(calls, 1);
  assert.equal(new URL(session.editorUrl).origin, 'http://localhost:19980');
  const broken = createCollaboraProvider({ config: readOfficeConfig(officeEnv), fetchImpl: async () => new Response('<!DOCTYPE x>') });
  assert.equal(await broken.isAvailable(), false);
});

test('catalog enforces extension/MIME and archive content types for all MVP formats', async () => {
  for (const [extension, format] of Object.entries(OFFICE_FORMATS)) {
    assert.ok(getOfficeFormat({ originalName: `a.${extension}`, mimeType: format.mimeType }));
    await validateOfficeDocument(await officeBytes(extension), format);
  }
  assert.equal(getOfficeFormat({ originalName: '../a.docx', mimeType: OFFICE_FORMATS.docx.mimeType }), null);
  await assert.rejects(validateOfficeDocument(await officeBytes('xlsx'), OFFICE_FORMATS.docx), status(415));
});
