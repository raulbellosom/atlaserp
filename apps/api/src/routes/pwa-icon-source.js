import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ALLOWED_LOGO_EXTENSIONS = new Set(['.png', '.svg', '.webp'])

export const DEFAULT_MODULE_LOGO_DIR = fileURLToPath(
  new URL('../../../desktop/public/module-logos/', import.meta.url),
)

export async function loadModuleLogo(
  logoUrl,
  {
    logoDirectory = DEFAULT_MODULE_LOGO_DIR,
    readAsset = readFile,
  } = {},
) {
  if (!logoUrl) return null
  if (
    typeof logoUrl !== 'string' ||
    !logoUrl.startsWith('/module-logos/')
  ) {
    return { invalid: true }
  }

  const relativePath = logoUrl.slice('/module-logos/'.length)
  if (
    !relativePath ||
    relativePath !== path.basename(relativePath) ||
    !ALLOWED_LOGO_EXTENSIONS.has(path.extname(relativePath).toLowerCase())
  ) {
    return { invalid: true }
  }

  try {
    const buffer = await readAsset(path.join(logoDirectory, relativePath))
    return {
      buffer,
      hash: createHash('sha256').update(buffer).digest('hex'),
    }
  } catch {
    return { invalid: true }
  }
}
