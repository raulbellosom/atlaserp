import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function importResolverModule() {
  try {
    return await import('../module-root-resolver.js')
  } catch (error) {
    return { __importError: error }
  }
}

async function createProjectRoot() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-module-roots-'))
  await fs.writeFile(path.join(projectRoot, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n', 'utf8')
  await fs.writeFile(path.join(projectRoot, 'package.json'), '{"name":"tmp","type":"module"}', 'utf8')
  await fs.mkdir(path.join(projectRoot, 'modules', 'official'), { recursive: true })
  await fs.mkdir(path.join(projectRoot, 'modules', 'custom'), { recursive: true })
  return projectRoot
}

test('resolveModuleRoots uses ATLAS_MODULES_DIR when provided', async () => {
  const resolver = await importResolverModule()
  assert.ok(!resolver.__importError, resolver.__importError?.message ?? 'module-root-resolver.js must exist')
  assert.equal(typeof resolver.resolveModuleRoots, 'function', 'resolveModuleRoots must be exported')

  const projectRoot = await createProjectRoot()
  const customModulesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-external-custom-modules-'))

  const roots = await resolver.resolveModuleRoots({
    cwd: projectRoot,
    sourceDir: projectRoot,
    env: {
      ATLAS_MODULES_DIR: customModulesDir,
    },
  })

  assert.equal(roots.projectRoot, projectRoot)
  assert.equal(roots.customModulesDir, path.resolve(customModulesDir))
  assert.equal(roots.customModulesSource, 'env')
  assert.equal(roots.officialModulesDir, path.join(projectRoot, 'modules', 'official'))

  await fs.rm(projectRoot, { recursive: true, force: true })
  await fs.rm(customModulesDir, { recursive: true, force: true })
})

test('resolveModuleRoots falls back to <projectRoot>/modules/custom and exposes installer mapping guidance', async () => {
  const resolver = await importResolverModule()
  assert.ok(!resolver.__importError, resolver.__importError?.message ?? 'module-root-resolver.js must exist')
  assert.equal(typeof resolver.resolveModuleRoots, 'function', 'resolveModuleRoots must be exported')
  assert.equal(
    typeof resolver.describeCustomModulesMapping,
    'function',
    'describeCustomModulesMapping must be exported'
  )

  const projectRoot = await createProjectRoot()

  const roots = await resolver.resolveModuleRoots({
    cwd: projectRoot,
    sourceDir: projectRoot,
    env: {},
  })

  assert.equal(roots.customModulesDir, path.join(projectRoot, 'modules', 'custom'))
  assert.equal(roots.customModulesSource, 'project')

  const mapping = resolver.describeCustomModulesMapping(roots)
  assert.match(mapping, /ATLAS_MODULES_DIR/)
  assert.match(mapping, /custom-modules\//)
  assert.match(mapping, /modules\/custom/)

  await fs.rm(projectRoot, { recursive: true, force: true })
})
