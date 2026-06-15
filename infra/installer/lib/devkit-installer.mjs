import fs from 'node:fs/promises'
import path from 'node:path'

export const DEVKIT_EXPORT_REPO_PATH = 'infra/installer/devkit-export'

export function getDevKitManifestRepoPath() {
  return `${DEVKIT_EXPORT_REPO_PATH}/manifest.json`
}

async function downloadTextFile(url, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'atlaserp-installer' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`)
  }
  return response.text()
}

export async function downloadDevKitSnapshot({ devKitDir, docsRawBase, fetchImpl = fetch }) {
  const manifestUrl = `${docsRawBase}/${getDevKitManifestRepoPath()}`
  const manifestSource = await downloadTextFile(manifestUrl, { fetchImpl })
  const manifest = JSON.parse(manifestSource)
  const files = Array.isArray(manifest?.files) ? manifest.files : []

  if (!files.length) {
    throw new Error('Dev Kit manifest does not contain any files.')
  }

  await fs.mkdir(devKitDir, { recursive: true })
  const downloadedFiles = []
  const failedFiles = []

  for (const relativePath of files) {
    const url = `${docsRawBase}/${DEVKIT_EXPORT_REPO_PATH}/${relativePath}`
    const destination = path.resolve(devKitDir, relativePath)
    try {
      const content = await downloadTextFile(url, { fetchImpl })
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, content, 'utf8')
      downloadedFiles.push(relativePath)
    } catch (error) {
      failedFiles.push({ relativePath, error })
    }
  }

  return {
    manifest,
    downloadedFiles,
    failedFiles,
  }
}
