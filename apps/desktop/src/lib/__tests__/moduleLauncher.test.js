import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isModuleOfflineBlocked,
  resolveMenuAnchor,
  clampMenuToViewport,
  favoriteToggleLabel,
  shouldOpenInNewTab,
  isCoarsePointer,
} from '../moduleLauncher.js';

test('isModuleOfflineBlocked: blocked only when offline and not an offline module', () => {
  const offline = ['atlas.ledger'];
  assert.equal(isModuleOfflineBlocked(false, { key: 'atlas.hr' }, offline), true);
  assert.equal(isModuleOfflineBlocked(false, { key: 'atlas.ledger' }, offline), false);
  assert.equal(isModuleOfflineBlocked(true, { key: 'atlas.hr' }, offline), false);
});

test('resolveMenuAnchor: reads a mouse event and calls preventDefault', () => {
  let prevented = 0;
  const anchor = resolveMenuAnchor({ clientX: 40, clientY: 90, preventDefault: () => { prevented++; } });
  assert.deepEqual(anchor, { x: 40, y: 90 });
  assert.equal(prevented, 1);
});

test('resolveMenuAnchor: reads a plain coords object', () => {
  assert.deepEqual(resolveMenuAnchor({ x: 5, y: 6 }), { x: 5, y: 6 });
});

test('resolveMenuAnchor: returns null for missing/invalid input', () => {
  assert.equal(resolveMenuAnchor(null), null);
  assert.equal(resolveMenuAnchor({}), null);
  assert.equal(resolveMenuAnchor({ x: 'a', y: 2 }), null);
});

test('clampMenuToViewport: keeps the menu fully on screen', () => {
  const r = clampMenuToViewport({ x: 990, y: 780 }, { width: 200, height: 120 }, { width: 1000, height: 800 });
  assert.deepEqual(r, { left: 792, top: 672 });
});

test('clampMenuToViewport: does not push past the top-left margin', () => {
  const r = clampMenuToViewport({ x: 0, y: 0 }, { width: 200, height: 120 }, { width: 1000, height: 800 });
  assert.deepEqual(r, { left: 8, top: 8 });
});

test('favoriteToggleLabel', () => {
  assert.equal(favoriteToggleLabel(true), 'Quitar de favoritos');
  assert.equal(favoriteToggleLabel(false), 'Agregar a favoritos');
});

test('shouldOpenInNewTab: modifier keys / middle click', () => {
  assert.equal(shouldOpenInNewTab({ ctrlKey: true }), true);
  assert.equal(shouldOpenInNewTab({ metaKey: true }), true);
  assert.equal(shouldOpenInNewTab({ button: 1 }), true);
  assert.equal(shouldOpenInNewTab({ button: 0 }), false);
  assert.equal(shouldOpenInNewTab(null), false);
});

test('isCoarsePointer: false when matchMedia is unavailable', () => {
  const had = 'window' in globalThis;
  const prev = globalThis.window;
  globalThis.window = {};
  assert.equal(isCoarsePointer(), false);
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  assert.equal(isCoarsePointer(), true);
  if (had) globalThis.window = prev; else delete globalThis.window;
});
