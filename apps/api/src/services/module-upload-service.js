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
