import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../appViewPrefsDefaults.js';

test('favoritesFirst defaults to true so favorites surface without a toggle', () => {
  assert.equal(DEFAULTS.favoritesFirst, true);
});

test('other view defaults are unchanged', () => {
  assert.equal(DEFAULTS.sortMode, 'az');
  assert.equal(DEFAULTS.viewMode, 'cards');
  assert.deepEqual(DEFAULTS.favorites, []);
});
