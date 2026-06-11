import JSZip from 'jszip';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const MAX_COMPRESSED_BYTES = 50 * 1024 * 1024;    // 50 MB
const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;  // 150 MB

// Returns the resolved absolute path from ATLAS_MODULES_DIR, or null if not set.
export function resolveModulesDir() {
  const raw = process.env.ATLAS_MODULES_DIR;
  if (!raw || !raw.trim()) return null;
  return path.resolve(raw.trim());
}

// Returns true if the resolved path stays within targetBase (prevents path traversal).
// Handles forward-slash ZIP entry names on Windows by normalizing to path.sep.
function isSafePath(targetBase, relativeEntryPath) {
  const normalized = relativeEntryPath.split('/').join(path.sep);
  const resolved = path.resolve(targetBase, normalized);
  return resolved === targetBase || resolved.startsWith(targetBase + path.sep);
}

// Returns '' if module.manifest.js is at the ZIP root.
// Returns 'folderName/' if the ZIP has a single root folder containing the manifest.
// Returns null if the structure is ambiguous (reject).
function detectRootPrefix(filenames) {
  if (filenames.some(f => f === 'module.manifest.js')) return '';
  const rootEntries = [...new Set(filenames.map(f => f.split('/')[0]))].filter(Boolean);
  if (
    rootEntries.length === 1 &&
    filenames.some(f => f === rootEntries[0] + '/module.manifest.js')
  ) {
    return rootEntries[0] + '/';
  }
  return null;
}

// Extracts the `key:` literal string from a manifest file using a regex.
// Does NOT execute the file. Returns null if the pattern is not found (dynamic key).
function extractManifestKey(content) {
  const match = content.match(/key\s*:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/**
 * Validates a ZIP buffer and extracts it to {modulesDir}/{key}/.
 * Throws an Error with statusCode and optional details on validation failure.
 * Returns { fileCount } on success.
 */
export async function validateAndExtractZip(key, fileBuffer, modulesDir) {
  if (fileBuffer.length > MAX_COMPRESSED_BYTES) {
    throw Object.assign(new Error('ZIP_TOO_LARGE'), { statusCode: 413 });
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(fileBuffer);
  } catch {
    throw Object.assign(new Error('INVALID_ZIP'), { statusCode: 422 });
  }

  const filenames = Object.keys(zip.files).filter(n => !zip.files[n].dir);
  const prefix = detectRootPrefix(filenames);

  if (prefix === null) {
    throw Object.assign(new Error('AMBIGUOUS_ZIP_STRUCTURE'), { statusCode: 422 });
  }

  const manifestEntry = zip.files[prefix + 'module.manifest.js'];
  if (!manifestEntry) {
    throw Object.assign(new Error('MISSING_MANIFEST'), { statusCode: 422 });
  }

  const manifestContent = await manifestEntry.async('text');
  const manifestKey = extractManifestKey(manifestContent);
  if (!manifestKey) {
    throw Object.assign(new Error('MANIFEST_KEY_UNREADABLE'), { statusCode: 422 });
  }
  if (manifestKey !== key) {
    throw Object.assign(new Error('MANIFEST_KEY_MISMATCH'), {
      statusCode: 422,
      details: { expected: key, found: manifestKey },
    });
  }

  const targetBase = path.resolve(modulesDir, key);
  let totalUncompressed = 0;

  // Validate all paths and accumulate uncompressed size before writing anything
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const relative = prefix ? name.slice(prefix.length) : name;
    if (!isSafePath(targetBase, relative)) {
      throw Object.assign(new Error('PATH_TRAVERSAL_DETECTED'), {
        statusCode: 422,
        details: { entry: name },
      });
    }
    totalUncompressed += entry._data?.uncompressedSize ?? 0;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw Object.assign(new Error('UNCOMPRESSED_SIZE_EXCEEDED'), { statusCode: 413 });
    }
  }

  // Atomically replace the existing directory (if any)
  if (existsSync(targetBase)) {
    await fs.rm(targetBase, { recursive: true, force: true });
  }
  await fs.mkdir(targetBase, { recursive: true });

  let fileCount = 0;
  try {
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const relative = prefix ? name.slice(prefix.length) : name;
      // Convert forward slashes to OS separator (Windows compatibility)
      const dest = path.resolve(targetBase, relative.split('/').join(path.sep));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const content = await entry.async('nodebuffer');
      await fs.writeFile(dest, content);
      fileCount++;
    }
  } catch (writeErr) {
    // Cleanup partial write — do not leave a broken module directory
    await fs.rm(targetBase, { recursive: true, force: true }).catch(() => {});
    throw Object.assign(new Error('WRITE_FAILED'), { statusCode: 500, cause: writeErr });
  }

  return { fileCount };
}

/**
 * Deletes the module directory from the filesystem.
 * Returns true if deleted, false if the directory did not exist (not an error).
 */
export async function purgeModuleFiles(key, modulesDir) {
  const targetBase = path.resolve(modulesDir, key);
  if (!existsSync(targetBase)) return false;
  await fs.rm(targetBase, { recursive: true, force: true });
  return true;
}

/**
 * Hard-deletes all DB records for a module inside a Prisma transaction.
 * Requires module.status !== 'INSTALLED' || module.enabled === false.
 * Deletion order: AtlasField → AtlasModel → Blueprint → AtlasModule.
 */
export async function purgeModuleFromDb(key, prisma) {
  return prisma.$transaction(async (tx) => {
    const module = await tx.atlasModule.findUnique({ where: { key } });
    if (!module) {
      throw Object.assign(new Error('MODULE_NOT_FOUND'), { statusCode: 404 });
    }
    if (module.status === 'INSTALLED' && module.enabled) {
      throw Object.assign(new Error('MODULE_MUST_BE_UNINSTALLED'), { statusCode: 409 });
    }

    const models = await tx.atlasModel.findMany({
      where: { moduleKey: key },
      select: { id: true },
    });
    const modelIds = models.map(m => m.id);
    if (modelIds.length > 0) {
      await tx.atlasField.deleteMany({ where: { modelId: { in: modelIds } } });
    }
    await tx.atlasModel.deleteMany({ where: { moduleKey: key } });
    await tx.blueprint.deleteMany({ where: { moduleKey: key } });
    await tx.atlasModule.delete({ where: { key } });

    return { moduleKey: key };
  });
}
