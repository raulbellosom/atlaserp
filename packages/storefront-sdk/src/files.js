export function createFilesNamespace({ request }) {
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

  async function getUrl(id) {
    const res = await request('GET', `/public/storefront/files/${encodeURIComponent(id)}/url`)
    return res.data
  }

  async function getSignedUrl(id) {
    const res = await request('GET', `/public/storefront/files/${encodeURIComponent(id)}/url`)
    return res.data
  }

  async function deleteFile(id) {
    const res = await request('DELETE', `/public/storefront/files/${encodeURIComponent(id)}`)
    return res.data
  }

  return { upload, getUrl, getSignedUrl, delete: deleteFile }
}
