// tests/test-usagers-map.js
'use strict';
const assert = require('assert');
const { splitLocalisables, getFilterOptions, filterInscriptions, computeGeoStats } = require('../js/usagers-map.js');

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

// ── computeGeoStats ──
{
  const localized = [
    { id: '1', pays: 'France',     continent: 'Europe',   countryCode: 'FR' },
    { id: '2', pays: 'France',     continent: 'Europe',   countryCode: 'FR' },
    { id: '3', pays: 'France',     continent: 'Europe',   countryCode: 'FR' },
    { id: '4', pays: 'Italie',     continent: 'Europe',   countryCode: 'IT' },
    { id: '5', pays: 'États-Unis', continent: 'Amérique', countryCode: 'US' },
  ];
  const stats = computeGeoStats(localized, 8); // 8 usagers validés dont 5 localisés

  assert.strictEqual(stats.localizedCount, 5);
  assert.strictEqual(stats.localizedPercent, 63, 'round(5/8*100) = 63');
  assert.strictEqual(stats.paysCount, 3, 'France, Italie, États-Unis');
  assert.strictEqual(stats.continentCount, 2, 'Europe, Amérique');
  assert.strictEqual(stats.foreignPercent, 40, 'round(2/5*100) = 40 (Italie + États-Unis)');
  assert.strictEqual(stats.topPays, 'France', 'pays le plus représenté');
  assert.strictEqual(stats.topPaysCount, 3);
}

// computeGeoStats : aucun usager localisé → tout à zéro, pas de division par zéro
{
  const stats = computeGeoStats([], 0);
  assert.strictEqual(stats.localizedCount, 0);
  assert.strictEqual(stats.localizedPercent, 0);
  assert.strictEqual(stats.paysCount, 0);
  assert.strictEqual(stats.continentCount, 0);
  assert.strictEqual(stats.foreignPercent, 0);
  assert.strictEqual(stats.topPays, null);
  assert.strictEqual(stats.topPaysCount, 0);
}

// computeGeoStats : égalité entre deux pays → tie-break alphabétique (ordre fr)
{
  const localized = [
    { id: '1', pays: 'Italie', continent: 'Europe', countryCode: 'IT' },
    { id: '2', pays: 'France', continent: 'Europe', countryCode: 'FR' },
  ];
  const stats = computeGeoStats(localized, 2);
  assert.strictEqual(stats.topPays, 'France', 'à égalité (1 chacun), France < Italie alphabétiquement');
  assert.strictEqual(stats.topPaysCount, 1);
}

console.log('✓ test-usagers-map.js OK');
