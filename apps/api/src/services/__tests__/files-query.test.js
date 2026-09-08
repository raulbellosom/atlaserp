import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileKindWhere } from '../files/query.js';

test('fileKindWhere gains a csv clause and drops csv from sheet', () => {
  assert.ok(JSON.stringify(fileKindWhere('csv')).includes('text/csv'));
  assert.ok(!JSON.stringify(fileKindWhere('sheet')).includes('text/csv'));
  assert.deepEqual(fileKindWhere('nonsense'), {});
  // generic is still "none of the known kinds"
  assert.ok(JSON.stringify(fileKindWhere('generic')).includes('NOT'));
});
