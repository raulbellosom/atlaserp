import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// Inline isSafePath to avoid importing the full service (which imports jszip).
function isSafePath(targetBase, relativeEntryPath) {
  const normalized = relativeEntryPath.split('/').join(path.sep);
  const resolved = path.resolve(targetBase, normalized);
  return resolved === targetBase || resolved.startsWith(targetBase + path.sep);
}

const base = path.resolve('/data/modules/custom.fleet');

describe('isSafePath', () => {
  it('allows files within the target directory', () => {
    assert.ok(isSafePath(base, 'api/index.js'));
    assert.ok(isSafePath(base, 'module.manifest.js'));
    assert.ok(isSafePath(base, 'models/vehicle.model.js'));
    assert.ok(isSafePath(base, 'views/nested/deep/file.js'));
  });

  it('blocks single-level path traversal', () => {
    assert.ok(!isSafePath(base, '../custom.other/api/index.js'));
  });

  it('blocks multi-level path traversal', () => {
    assert.ok(!isSafePath(base, '../../apps/api/src/index.js'));
    assert.ok(!isSafePath(base, '../../../etc/passwd'));
  });

  it('blocks traversal hidden inside subdirectory', () => {
    assert.ok(!isSafePath(base, 'api/../../apps/api/src/evil.js'));
  });
});
