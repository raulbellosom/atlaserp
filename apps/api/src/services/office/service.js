import { createHash, randomBytes } from 'node:crypto';
import { readOfficeConfig } from './config.js';
import { createCollaboraProvider } from './discovery.js';
import { createWopiTokens } from './tokens.js';
import { createOfficeAccess } from './access.js';
import { validateOfficeDocument } from './validate-document.js';
import { OfficeError, lockConflict } from './errors.js';

export function createOfficeService({ prisma, supabaseAdmin, env = process.env, fetchImpl, now = Date.now }) {
  let config;
  let configurationError;
  try { config = readOfficeConfig(env); } catch (error) { config = { enabled: true }; configurationError = error; }
  const access = createOfficeAccess({ prisma });
  const provider = config.enabled && !configurationError ? createCollaboraProvider({ config, fetchImpl, now }) : null;
  const tokens = provider ? createWopiTokens({ ...config, now }) : null;
  const version = file => String(file.contentRevision);
  const activeLock = file => file.officeLock && new Date(file.officeLockExpiresAt).getTime() > now() ? file.officeLock : '';
  function ensureEnabled() {
    if (!config.enabled) throw new OfficeError('La edición Office está desactivada.', 503, 'office_disabled');
    if (configurationError) throw configurationError;
  }
  async function audit(db, context, action, metadata = {}) {
    await db.auditLog.create({ data: { actorId: context.profile.id, moduleKey: 'atlas.files', entityType: 'FileAsset', entityId: context.file.id, action, metadata: { companyId: context.companyId, ...metadata } } });
  }
  async function status() {
    return { enabled: config.enabled, available: Boolean(provider && await provider.isAvailable()), provider: 'collabora', ...(configurationError ? { code: 'office_configuration' } : {}) };
  }
  async function createSession({ authUserId, fileId, mode = 'auto', origin }) {
    ensureEnabled();
    const hostOrigin = origin ?? config.hostOrigin;
    if (!config.hostOrigins.includes(hostOrigin)) throw new OfficeError('Este origen no está autorizado para abrir Office.', 403, 'forbidden_origin');
    if (!['view', 'edit', 'auto'].includes(mode)) throw new OfficeError('Modo Office inválido.', 400, 'invalid_mode');
    let context = await access.authorize({ authUserId, fileId, mode: mode === 'auto' ? 'view' : mode });
    if (mode === 'auto') {
      mode = 'view';
      try { context = await access.authorize({ authUserId, fileId, mode: 'edit' }); mode = 'edit'; }
      catch (error) { if (!(error instanceof OfficeError) || error.status !== 403) throw error; }
    }
    const [editor, token] = await Promise.all([
      provider.createSession({ file: context.file, mode, wopiSrc: `${config.wopiUrl}/wopi/files/${fileId}` }),
      tokens.issue({ authUserId, fileId, companyId: context.companyId, profileId: context.profile.id, mode, hostOrigin }),
    ]);
    await audit(prisma, context, 'office.document.opened', { mode });
    return { ...editor, ...token, fileId, fileName: context.file.originalName, mode };
  }
  async function authenticate({ fileId, token, write = false }, db = prisma) {
    ensureEnabled();
    const claims = await tokens.validate(token, fileId);
    if (!config.hostOrigins.includes(claims.hostOrigin)) throw new OfficeError('El origen de la sesión ya no está autorizado.', 401, 'session_expired');
    if (write && claims.mode !== 'edit') throw new OfficeError('Esta sesión es de solo lectura.', 403, 'read_only');
    const context = await access.authorize({ authUserId: claims.authUserId, fileId, mode: claims.mode, claims }, db);
    return { ...context, claims };
  }
  async function checkFileInfo(request) {
    const { file, profile, companyId, claims } = await authenticate(request);
    return {
      BaseFileName: file.originalName, Size: file.sizeBytes, Version: version(file),
      OwnerId: companyId.replaceAll('-', ''), UserId: profile.id.replaceAll('-', ''), UserFriendlyName: profile.displayName,
      UserCanWrite: claims.mode === 'edit', ReadOnly: claims.mode !== 'edit', SupportsLocks: true, SupportsGetLock: true,
      SupportsExtendedLockLength: true, SupportsUpdate: true, SupportsRename: false, UserCanRename: false,
      UserCanNotWriteRelative: true, PostMessageOrigin: claims.hostOrigin,
      LastModifiedTime: new Date(file.updatedAt).toISOString(),
      EnableOwnerTermination: false,
    };
  }
  async function getFile(request) {
    return readFile(await authenticate(request));
  }
  async function download({ authUserId, fileId }) {
    // Recovery/download remains available when the editor service is disabled.
    return readFile(await access.authorize({ authUserId, fileId, mode: 'view' }), false);
  }
  async function readFile({ file, format }, validate = true) {
    const { data, error } = await supabaseAdmin.storage.from(file.bucket).download(file.objectKey);
    if (error || !data) throw new OfficeError('No se pudo leer el archivo.', 503, 'storage_error');
    if (data.size > (config.maxBytes ?? 10 * 1024 * 1024)) throw new OfficeError('El archivo supera 10 MB.', 413, 'file_too_large');
    const bytes = Buffer.from(await data.arrayBuffer());
    if (validate) await validateOfficeDocument(bytes, format);
    return { bytes, version: version(file), mimeType: file.mimeType, fileName: file.originalName };
  }
  async function withFileLock(fileId, fn) {
    return prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM file_asset WHERE id = ${fileId}::uuid FOR UPDATE`;
      return fn(db);
    }, { timeout: 10000 });
  }
  async function lock(request) {
    await authenticate({ ...request, write: true });
    const { operation, lock: requested, oldLock } = request;
    if (!['LOCK', 'GET_LOCK', 'REFRESH_LOCK', 'UNLOCK'].includes(operation)) throw new OfficeError('Operación WOPI no implementada.', 501, 'unsupported_operation');
    if (operation !== 'GET_LOCK' && (typeof requested !== 'string' || !/^[\x20-\x7e]{1,1024}$/.test(requested))) throw new OfficeError('Bloqueo WOPI inválido.', 400, 'invalid_lock');
    if (oldLock !== undefined && (operation !== 'LOCK' || !/^[\x20-\x7e]{1,1024}$/.test(oldLock))) throw new OfficeError('Bloqueo anterior inválido.', 400, 'invalid_lock');
    return withFileLock(request.fileId, async db => {
      const { file } = await authenticate({ ...request, write: true }, db);
      const current = activeLock(file);
      if (operation === 'GET_LOCK') return { lock: current };
      if (oldLock !== undefined ? !current || current !== oldLock : (operation === 'LOCK' ? current && current !== requested : !current || current !== requested)) throw lockConflict(current);
      await db.fileAsset.update({ where: { id: file.id }, data: {
        officeLock: operation === 'UNLOCK' ? null : requested,
        officeLockExpiresAt: operation === 'UNLOCK' ? null : new Date(now() + 30 * 60000),
        // Lease refreshes do not alter document timestamps or WOPI version.
        updatedAt: file.updatedAt,
      } });
      return {};
    });
  }
  function requireSaveLock(file, requested) {
    const current = activeLock(file);
    if (!current || current !== requested) throw lockConflict(current);
  }
  async function putFile(request) {
    const context = await authenticate({ ...request, write: true });
    let objectKey;
    try {
      requireSaveLock(context.file, request.lock);
      if (!request.bytes.length || request.bytes.length > config.maxBytes) throw new OfficeError('Tamaño de archivo inválido.', 413, 'file_too_large');
      await validateOfficeDocument(request.bytes, context.format);
      const checksum = createHash('sha256').update(request.bytes).digest('hex');
      if (request.timestamp && request.timestamp !== new Date(context.file.updatedAt).toISOString()) throw lockConflict(activeLock(context.file));
      if (context.file.checksum === checksum) return { version: version(context.file), lastModifiedTime: new Date(context.file.updatedAt).toISOString() };
      objectKey = `office/${context.companyId}/${context.file.id}/${randomBytes(24).toString('hex')}.${context.format.extension}`;
      const { error } = await supabaseAdmin.storage.from(context.file.bucket).upload(objectKey, request.bytes, { contentType: context.file.mimeType, upsert: false });
      if (error) throw new OfficeError('No se pudo guardar en almacenamiento.', 503, 'storage_error');
      const saved = await withFileLock(context.file.id, async db => {
        const current = await authenticate({ ...request, write: true }, db);
        requireSaveLock(current.file, request.lock);
        if (current.file.contentRevision !== context.file.contentRevision || current.file.objectKey !== context.file.objectKey) throw lockConflict(activeLock(current.file));
        const { id: fileId, contentRevision: revision, bucket, objectKey: previousKey, originalName, mimeType, sizeBytes, checksum: previousChecksum } = current.file;
        await db.fileAssetVersion.create({ data: { fileId, revision, bucket, objectKey: previousKey, originalName, mimeType, sizeBytes, checksum: previousChecksum } });
        await db.$executeRaw`SELECT set_config('atlas.office_write', 'true', true)`;
        const updated = await db.fileAsset.update({ where: { id: fileId }, data: { objectKey, checksum, sizeBytes: request.bytes.length, contentRevision: { increment: 1 } } });
        await audit(db, current, 'office.document.saved', { revision: updated.contentRevision, sizeBytes: updated.sizeBytes });
        return updated;
      });
      return { version: version(saved), lastModifiedTime: new Date(saved.updatedAt).toISOString() };
    } catch (error) {
      // Never delete a candidate after an ambiguous commit error: it may already
      // be the live pointer. Unreferenced candidates can be reconciled offline.
      await audit(prisma, context, 'office.document.save_failed', { code: error instanceof OfficeError ? error.code : 'save_error' }).catch(() => {});
      throw error;
    }
  }
  return { status, createSession, authenticate, checkFileInfo, getFile, download, lock, putFile, maxBytes: config.maxBytes ?? 10 * 1024 * 1024 };
}
