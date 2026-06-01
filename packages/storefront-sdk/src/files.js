/**
 * Factory for the sdk.files namespace.
 * @param {{ request: Function }} deps
 * @returns {{ upload, getUrl, getSignedUrl, delete }}
 */
export function createFilesNamespace({ request }) {
  /**
   * Upload a file to Supabase Storage.
   * @param {File|Blob} file - The file to upload
   * @param {{ visibility?: 'PUBLIC'|'PRIVATE', entityType?: string, entityId?: string }} [options]
   * @returns {Promise<{ id, url, originalName, mimeType, sizeBytes }>}
   */
  async function upload(file, options = {}) {
    const { visibility = 'PUBLIC', entityType = null, entityId = null } = options
    const formData = new FormData()
    formData.append('file', file)
    formData.append('visibility', visibility)
    if (entityType) formData.append('entityType', entityType)
    if (entityId) formData.append('entityId', entityId)
    const res = await request('POST', '/public/storefront/files/upload', formData)
    return res.data
  }

  /**
   * Get the URL for a file asset. Returns permanent URL for PUBLIC files, signed URL for PRIVATE.
   * @param {string} id - FileAsset ID
   * @returns {Promise<{ url?: string, signedUrl?: string, type: 'public'|'signed' }>}
   */
  async function getUrl(id) {
    const res = await request('GET', `/public/storefront/files/${encodeURIComponent(id)}/url`)
    return res.data
  }

  async function getSignedUrl(id) {
    const res = await request('GET', `/public/storefront/files/${encodeURIComponent(id)}/url`)
    return res.data
  }

  /**
   * Delete a file (caller must be the uploader).
   * @param {string} id - FileAsset ID
   * @returns {Promise<{ success: true }>}
   */
  async function deleteFile(id) {
    const res = await request('DELETE', `/public/storefront/files/${encodeURIComponent(id)}`)
    return res.data
  }

  return { upload, getUrl, getSignedUrl, delete: deleteFile }
}
