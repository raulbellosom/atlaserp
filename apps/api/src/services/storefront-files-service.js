const STOREFRONT_BUCKET = 'atlas-storefront'
const FILES_BUCKET = 'atlas-files'

export function resolveFileLimits(roleKey) {
  if (roleKey === 'storefront_vendor') {
    return {
      maxBytes: 100 * 1024 * 1024,
      allowedMime: ['image/', 'audio/', 'video/', 'application/pdf'],
    }
  }
  return {
    maxBytes: 5 * 1024 * 1024,
    allowedMime: ['image/'],
  }
}

export function resolveBucket(visibility) {
  return visibility === 'PRIVATE' ? FILES_BUCKET : STOREFRONT_BUCKET
}

export function createStorefrontFilesService({ prisma, supabaseAdmin }) {
  async function upload({ file, fileName, mimeType, sizeBytes, visibility, entityType, entityId, uploadedById, roleKey }) {
    const limits = resolveFileLimits(roleKey)

    if (sizeBytes > limits.maxBytes) {
      throw Object.assign(
        new Error(`Archivo demasiado grande. Maximo: ${limits.maxBytes / 1024 / 1024}MB`),
        { code: 'VALIDATION_ERROR', status: 422 }
      )
    }

    const mimeAllowed = limits.allowedMime.some(prefix => mimeType.startsWith(prefix))
    if (!mimeAllowed) {
      throw Object.assign(
        new Error(`Tipo de archivo no permitido: ${mimeType}`),
        { code: 'VALIDATION_ERROR', status: 422 }
      )
    }

    const bucket = resolveBucket(visibility)
    const objectKey = `storefront/${uploadedById}/${Date.now()}-${fileName}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(objectKey, file, { contentType: mimeType, upsert: false })

    if (uploadError) {
      throw Object.assign(
        new Error(`Error al subir archivo: ${uploadError.message}`),
        { code: 'UNKNOWN', status: 500 }
      )
    }

    let url = null
    if (bucket === STOREFRONT_BUCKET) {
      const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectKey)
      url = data.publicUrl
    }

    const asset = await prisma.fileAsset.create({
      data: {
        bucket,
        objectKey,
        originalName: fileName,
        mimeType,
        sizeBytes,
        visibility: visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
        moduleKey: 'atlas.storefront',
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        uploadedById: uploadedById ?? null,
      },
    })

    return { id: asset.id, url, originalName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes }
  }

  async function getUrl(id) {
    const asset = await prisma.fileAsset.findUnique({ where: { id } })
    if (!asset || !asset.enabled) {
      throw Object.assign(new Error('Archivo no encontrado'), { code: 'NOT_FOUND', status: 404 })
    }

    if (asset.bucket === STOREFRONT_BUCKET) {
      const { data } = supabaseAdmin.storage.from(asset.bucket).getPublicUrl(asset.objectKey)
      return { url: data.publicUrl, type: 'public' }
    }

    const { data, error } = await supabaseAdmin.storage
      .from(asset.bucket)
      .createSignedUrl(asset.objectKey, 3600)
    if (error) throw Object.assign(new Error('Error al generar URL'), { code: 'UNKNOWN', status: 500 })

    return { signedUrl: data.signedUrl, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), type: 'signed' }
  }

  async function deleteFile(id, uploadedById) {
    const asset = await prisma.fileAsset.findUnique({ where: { id } })
    if (!asset || !asset.enabled) {
      throw Object.assign(new Error('Archivo no encontrado'), { code: 'NOT_FOUND', status: 404 })
    }
    if (asset.uploadedById !== uploadedById) {
      throw Object.assign(new Error('Sin permiso para eliminar este archivo'), { code: 'FORBIDDEN', status: 403 })
    }

    await supabaseAdmin.storage.from(asset.bucket).remove([asset.objectKey])
    await prisma.fileAsset.update({ where: { id }, data: { enabled: false } })
    return { success: true }
  }

  return { upload, getUrl, deleteFile }
}
