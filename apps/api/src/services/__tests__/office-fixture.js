import JSZip from 'jszip';
import { OFFICE_FORMATS } from '@atlas/core';
import { createOfficeService } from '../office/service.js';

export const ids = { file: '01990000-0000-7000-8000-000000000001', profile: '01990000-0000-7000-8000-000000000002', company: '01990000-0000-7000-8000-000000000003', auth: '01990000-0000-7000-8000-000000000004', other: '01990000-0000-7000-8000-000000000005' };
export const officeEnv = { ATLAS_OFFICE_ENABLED: 'true', ATLAS_WOPI_SECRET: 'unit-test-secret-which-is-at-least-32-bytes', COLLABORA_INTERNAL_URL: 'http://collabora:9980', COLLABORA_PUBLIC_URL: 'http://localhost:19980', ATLAS_WOPI_URL: 'http://host.docker.internal:19981', ATLAS_OFFICE_HOST_ORIGIN: 'http://localhost:19981' };

export async function officeBytes(extension = 'docx', value = 'Original') {
  const format = OFFICE_FORMATS[extension];
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${format.part}" ContentType="${format.contentType}"/></Types>`);
  zip.file('_rels/.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${format.part}"/></Relationships>`);
  zip.file(format.part, extension === 'docx' ? `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${value}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>` : `<test>${value}</test>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function officeFixture() {
  let time = Date.now();
  const original = await officeBytes();
  const state = {
    file: { id: ids.file, entityId: ids.company, entityType: 'AtlasFile', moduleKey: 'atlas.files', bucket: 'atlas-files', objectKey: 'original.docx', originalName: 'Prueba.docx', mimeType: OFFICE_FORMATS.docx.mimeType, visibility: 'PRIVATE', sizeBytes: original.length, contentRevision: 1, enabled: true, updatedAt: new Date(time), officeLock: null, officeLockExpiresAt: null, invItemFiles: [], calendarFiles: [] },
    profile: { id: ids.profile, authUserId: ids.auth, displayName: 'Raúl', enabled: true },
    company: ids.company, role: { key: 'employee', enabled: true, permissions: ['files.assets.read', 'files.assets.update'].map(key => ({ permission: { key, active: true } })) },
    versions: [], audits: [], objects: new Map([['original.docx', original]]), uploadError: false, downloadError: false, uploadHook: null,
  };
  const prisma = {
    userProfile: { findUnique: async ({ where }) => where.authUserId === ids.auth ? structuredClone(state.profile) : null },
    fileAsset: {
      findUnique: async ({ where }) => where.id === state.file?.id ? structuredClone(state.file) : null,
      update: async ({ data }) => { for (const [key, value] of Object.entries(data)) state.file[key] = value?.increment ? state.file[key] + value.increment : value; if (!data.updatedAt) state.file.updatedAt = new Date(time + state.file.contentRevision); return structuredClone(state.file); },
    },
    membership: { findFirst: async ({ where }) => where.companyId === state.company ? { role: structuredClone(state.role) } : null },
    fileAssetVersion: { create: async ({ data }) => { state.versions.push(data); return data; } },
    auditLog: { create: async ({ data }) => { state.audits.push(data); return data; } },
    $queryRaw: async () => [], $executeRaw: async () => 1,
  };
  let queue = Promise.resolve();
  prisma.$transaction = callback => {
    const result = queue.then(async () => {
      const snapshot = structuredClone({ file: state.file, versions: state.versions, audits: state.audits });
      try { return await callback(prisma); } catch (error) { Object.assign(state, snapshot); throw error; }
    });
    queue = result.catch(() => {});
    return result;
  };
  const supabaseAdmin = { storage: { from: () => ({
    download: async key => state.downloadError ? { error: new Error('storage') } : { data: state.objects.has(key) ? new Blob([state.objects.get(key)]) : null },
    upload: async (key, bytes) => { if (state.uploadHook) await state.uploadHook(); if (state.uploadError) return { error: new Error('storage') }; state.objects.set(key, Buffer.from(bytes)); return {}; },
  }) } };
  const fetchImpl = async () => new Response('<wopi-discovery><net-zone><app><action ext="docx" name="edit" urlsrc="http://collabora:9980/browser/hash/cool.html?"/></app></net-zone></wopi-discovery>');
  const service = createOfficeService({ prisma, supabaseAdmin, env: officeEnv, fetchImpl, now: () => time });
  const session = async (mode = 'edit') => service.createSession({ authUserId: ids.auth, fileId: ids.file, mode });
  const request = async (mode = 'edit') => ({ fileId: ids.file, token: (await session(mode)).accessToken });
  return { service, prisma, supabaseAdmin, state, session, request, advance: ms => { time += ms; } };
}
