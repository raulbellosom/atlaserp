import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'
import { resolveModuleRoots } from './module-root-resolver.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUNDLES_DIR = path.resolve(__dirname, '..', '..', 'bundles')
const STORAGE_BUCKET = 'module-bundles'

export const BUNDLE_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@tanstack/react-query',
  'zustand',
  '@atlas/ui',
  '@atlas/sdk',
  '@atlas/validators',
  'react-router-dom',
  'sonner',
  'lucide-react',
  'recharts',
]

export async function computeSourceHash(dir) {
  const entries = await collectFiles(dir)
  const hash = createHash('sha256')
  for (const filePath of entries.sort()) {
    const content = await fs.readFile(filePath)
    hash.update(filePath.replace(dir, '').split(path.sep).join('/'))
    hash.update(content)
  }
  return hash.digest('hex')
}

async function collectFiles(dir) {
  const result = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(full)))
    } else {
      result.push(full)
    }
  }
  return result
}

async function resolveModuleBaseDir(key) {
  const roots = await resolveModuleRoots({ sourceDir: __dirname })
  const candidate = path.join(roots.customModulesDir, key)
  try {
    await fs.access(candidate)
    return candidate
  } catch {
    return null
  }
}

export function createModuleBundlerService({ prisma, supabaseAdmin }) {
  async function ensureBundlesDir() {
    await fs.mkdir(BUNDLES_DIR, { recursive: true })
  }

  async function ensureStorageBucket() {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    if (!buckets?.find((b) => b.name === STORAGE_BUCKET)) {
      await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, { public: false })
    }
  }

  async function buildModuleBundle(key, { force = false } = {}) {
    const moduleBaseDir = await resolveModuleBaseDir(key)
    if (!moduleBaseDir) {
      return { built: false, reason: 'module-not-found' }
    }
    const componentsDir = path.join(moduleBaseDir, 'components')
    const entryPoint = path.join(componentsDir, 'index.js')

    try {
      await fs.access(entryPoint)
    } catch {
      return { built: false, reason: 'no-components' }
    }

    const newHash = await computeSourceHash(componentsDir)

    if (!force) {
      const row = await prisma.atlasModule.findUnique({
        where: { key },
        select: { bundleHash: true },
      })
      if (row?.bundleHash === newHash) {
        return { built: false, reason: 'unchanged', hash: newHash }
      }
    }

    await ensureBundlesDir()
    const outfile = path.join(BUNDLES_DIR, `${key}.js`)

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      format: 'esm',
      jsx: 'automatic',
      loader: { '.js': 'jsx', '.jsx': 'jsx' },
      external: BUNDLE_EXTERNALS,
      outfile,
      sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
    })

    try {
      await ensureStorageBucket()
      const bundleContent = await fs.readFile(outfile)
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(`${key}.js`, bundleContent, {
          contentType: 'application/javascript',
          upsert: true,
        })
    } catch (storageErr) {
      console.warn(`[bundler] Storage upload failed for ${key}:`, storageErr.message)
    }

    await prisma.atlasModule.update({
      where: { key },
      data: { hasBundle: true, bundleHash: newHash },
    })

    console.log(`[bundler] built ${key} (hash: ${newHash.slice(0, 8)})`)
    return { built: true, hash: newHash }
  }

  async function deleteModuleBundle(key) {
    const bundlePath = path.join(BUNDLES_DIR, `${key}.js`)

    try {
      await fs.unlink(bundlePath)
    } catch {
      // File may not exist
    }

    try {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([`${key}.js`])
    } catch (err) {
      console.warn(`[bundler] Storage delete failed for ${key}:`, err.message)
    }

    try {
      await prisma.atlasModule.update({
        where: { key },
        data: { hasBundle: false, bundleHash: null },
      })
    } catch (err) {
      console.warn(`[bundler] DB update failed for ${key}:`, err.message)
    }
  }

  let _devWatcher = null

  async function restoreModuleBundlesOnBoot() {
    await ensureBundlesDir()

    let modules
    try {
      modules = await prisma.atlasModule.findMany({
        where: { status: 'INSTALLED', enabled: true, hasBundle: true },
        select: { key: true },
      })
    } catch (err) {
      console.warn('[bundler] restoreModuleBundlesOnBoot: DB query failed:', err.message)
      return
    }

    for (const { key } of modules) {
      const bundlePath = path.join(BUNDLES_DIR, `${key}.js`)
      try {
        await fs.access(bundlePath)
      } catch {
        try {
          const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .download(`${key}.js`)

          if (error || !data) {
            console.warn(`[bundler] Could not restore bundle for ${key}: ${error?.message ?? 'no data'}`)
            await prisma.atlasModule.update({
              where: { key },
              data: { hasBundle: false, bundleHash: null },
            })
            continue
          }

          const buffer = Buffer.from(await data.arrayBuffer())
          await fs.writeFile(bundlePath, buffer)
          console.log(`[bundler] restored ${key} from Storage`)
        } catch (restoreErr) {
          console.warn(`[bundler] restore failed for ${key}:`, restoreErr.message)
          try {
            await prisma.atlasModule.update({ where: { key }, data: { hasBundle: false, bundleHash: null } })
          } catch {
            // ignore secondary DB failure
          }
        }
      }
    }

    // Auto-build bundles for installed modules that have components/ but has_bundle=false
    let modulesWithoutBundle
    try {
      modulesWithoutBundle = await prisma.atlasModule.findMany({
        where: { status: 'INSTALLED', enabled: true, hasBundle: false },
        select: { key: true },
      })
    } catch (err) {
      console.warn('[bundler] restoreModuleBundlesOnBoot: auto-build query failed:', err.message)
      return
    }

    for (const { key } of modulesWithoutBundle) {
      try {
        const result = await buildModuleBundle(key)
        if (result.built) {
          console.log(`[bundler] auto-built bundle for ${key} on boot`)
        }
      } catch (err) {
        console.warn(`[bundler] auto-build failed for ${key}:`, err.message)
      }
    }
  }

  function startDevWatcher() {
    if (process.env.NODE_ENV === 'production') return
    if (_devWatcher) return
    _devWatcher = true
    const debouncers = new Map()

    import('node:fs').then(({ watch }) => {
      resolveModuleRoots({ sourceDir: __dirname })
        .then(({ customModulesDir }) => {
          fs.access(customModulesDir)
            .then(() => {
              watch(customModulesDir, { recursive: true }, (_event, filename) => {
                const normalized = filename?.replaceAll(path.sep, '/')
                if (!normalized?.includes('/components/')) return
                const parts = normalized.split('/')
                const key = parts[0]
                if (!key) return

                clearTimeout(debouncers.get(key))
                debouncers.set(
                  key,
                  setTimeout(async () => {
                    try {
                      const result = await buildModuleBundle(key, { force: true })
                      if (result.built) console.log(`[bundler:watch] rebuilt ${key}`)
                    } catch (err) {
                      console.error(`[bundler:watch] rebuild failed for ${key}:`, err.message)
                    } finally {
                      debouncers.delete(key)
                    }
                  }, 200),
                )
              })
              console.log(`[bundler] watching ${customModulesDir} for component changes`)
            })
            .catch(() => {})
        })
        .catch(() => {})
    })
  }

  return {
    buildModuleBundle,
    deleteModuleBundle,
    restoreModuleBundlesOnBoot,
    startDevWatcher,
  }
}
