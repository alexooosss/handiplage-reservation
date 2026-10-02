// tests/test-usagers-map.js
'use strict';
const assert = require('assert');
const { splitLocalisables, getFilterOptions, filterInscriptions } = require('../js/usagers-map.js');

// ── splitLocalisables ──
{
  const valid = [
    { id: '1', geoLat: 43.5, geoLng: 7.1, continent: 'Europe' },
    { id: '2', ville: 'Antibes' },           // jamais géocodé
    { id: '3', geoLat: 10, geoLng: 10 },      // géocodé mais continent manquant
  ];
  const { localized, unlocalized } = splitLocalisables(valid);
  assert.strictEqual(localized.length, 1);
  assert.strictEqual(localized[0].id, '1');
  assert.strictEqual(unlocalized.length, 2);
  assert.deepStrictEqual(unlocalized.map(i => i.id), ['2', '3']);
}

// ── getFilterOptions ──
{
  const localized = [
    { id: '1', continent: 'Europe',   pays: 'France',       region: 'PACA',          ville: 'Antibes' },
    { id: '2', continent: 'Europe',   pays: 'France',       region: 'Île-de-France', ville: 'Paris' },
    { id: '3', continent: 'Europe',   pays: 'Italie',       region: null,            ville: 'Milan' },
    { id: '4', continent: 'Amérique', pays: 'États-Unis',   region: null,            ville: 'New York' },
  ];

  let opts = getFilterOptions(localized, {});
  assert.deepStrictEqual(opts.continents, ['Amérique', 'Europe']);
  assert.deepStrictEqual(opts.pays, ['France', 'Italie', 'États-Unis'].sort((a, b) => a.localeCompare(b, 'fr')));

  opts = getFilterOptions(localized, { continent: 'Europe' });
  assert.deepStrictEqual(opts.pays, ['France', 'Italie']);
  assert.deepStrictEqual(opts.regions, ['PACA', 'Île-de-France'].sort((a, b) => a.localeCompare(b, 'fr')));

  opts = getFilterOptions(localized, { continent: 'Europe', pays: 'France' });
  assert.deepStrictEqual(opts.villes, ['Antibes', 'Paris'].sort((a, b) => a.localeCompare(b, 'fr')));
}

// ── filterInscriptions ──
{
  const localized = [
    { id: '1', continent: 'Europe',   pays: 'France',     region: 'PACA',          ville: 'Antibes' },
    { id: '2', continent: 'Europe',   pays: 'France',     region: 'Île-de-France', ville: 'Paris' },
    { id: '3', continent: 'Amérique', pays: 'États-Unis', region: null,            ville: 'New York' },
  ];

  assert.strictEqual(filterInscriptions(localized, {}).length, 3, 'aucun filtre = tout');
  assert.deepStrictEqual(filterInscriptions(localized, { continent: 'Europe' }).map(i => i.id), ['1', '2']);
  assert.deepStrictEqual(
    filterInscriptions(localized, { continent: 'Europe', pays: 'France', ville: 'Paris' }).map(i => i.id),
    ['2']
  );
  assert.strictEqual(
    filterInscriptions(localized, { pays: 'Allemagne' }).length,
    0,
    'filtre sur une valeur absente des données → liste vide'
  );
}

console.log('✓ test-usagers-map.js OK');
