import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSortedDisplay } from '../sortModules.js';

const modules = [
  { key: 'c', name: 'Contactos', category: 'operaciones' },
  { key: 'f', name: 'Finanzas', category: 'contabilidad' },
  { key: 'a', name: 'Archivos', category: 'sistema' },
  { key: 'e', name: 'Empresa', category: 'sistema' },
  { key: 'fl', name: 'Flota', category: 'general' },
];

test('A-Z mode returns one section sorted alphabetically', () => {
  const result = getSortedDisplay(modules, { sortMode: 'az', favorites: [], favoritesFirst: false });
  assert.equal(result.length, 1);
  assert.equal(result[0].label, null);
  assert.deepEqual(
    result[0].modules.map((m) => m.name),
    ['Archivos', 'Contactos', 'Empresa', 'Finanzas', 'Flota'],
  );
});

test('Groups mode returns one section per category', () => {
  const result = getSortedDisplay(modules, { sortMode: 'groups', favorites: [], favoritesFirst: false });
  assert.ok(result.length >= 4);
  const labels = result.map((s) => s.label);
  assert.ok(labels.includes('Sistema'));
  assert.ok(labels.includes('Contabilidad'));
});

test('favoritesFirst=true puts Favoritos section first', () => {
  const result = getSortedDisplay(modules, { sortMode: 'az', favorites: ['f'], favoritesFirst: true });
  assert.equal(result[0].label, 'Favoritos');
  assert.equal(result[0].modules.length, 1);
  assert.equal(result[0].modules[0].key, 'f');
});

test('favorites not duplicated in other sections', () => {
  const result = getSortedDisplay(modules, { sortMode: 'az', favorites: ['f'], favoritesFirst: true });
  const nonFavKeys = result
    .filter((s) => s.label !== 'Favoritos')
    .flatMap((s) => s.modules.map((m) => m.key));
  assert.ok(!nonFavKeys.includes('f'));
});

test('empty favorites with favoritesFirst=true does not add Favoritos section', () => {
  const result = getSortedDisplay(modules, { sortMode: 'az', favorites: [], favoritesFirst: true });
  assert.ok(!result.some((s) => s.label === 'Favoritos'));
});

test('Groups + favoritesFirst puts favorites first then remaining in groups', () => {
  const result = getSortedDisplay(modules, { sortMode: 'groups', favorites: ['f'], favoritesFirst: true });
  assert.equal(result[0].label, 'Favoritos');
  const groupLabels = result.slice(1).map((s) => s.label);
  assert.ok(groupLabels.includes('Sistema'));
  const allGroupKeys = result.slice(1).flatMap((s) => s.modules.map((m) => m.key));
  assert.ok(!allGroupKeys.includes('f'));
});

test('modules within a group are sorted alphabetically', () => {
  const result = getSortedDisplay(modules, { sortMode: 'groups', favorites: [], favoritesFirst: false });
  const sistemaSection = result.find((s) => s.label === 'Sistema');
  assert.ok(sistemaSection);
  assert.deepEqual(
    sistemaSection.modules.map((m) => m.name),
    ['Archivos', 'Empresa'],
  );
});
