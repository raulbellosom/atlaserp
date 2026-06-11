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
