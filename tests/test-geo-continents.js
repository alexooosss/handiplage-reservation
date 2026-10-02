// tests/test-geo-continents.js
'use strict';
const assert = require('assert');
const { countryCodeToContinent } = require('../js/geo-continents.js');

assert.strictEqual(countryCodeToContinent('FR'), 'Europe', 'France → Europe');
assert.strictEqual(countryCodeToContinent('fr'), 'Europe', 'insensible à la casse');
assert.strictEqual(countryCodeToContinent('US'), 'Amérique', 'États-Unis → Amérique');
assert.strictEqual(countryCodeToContinent('MA'), 'Afrique', 'Maroc → Afrique');
assert.strictEqual(countryCodeToContinent('JP'), 'Asie', 'Japon → Asie');
assert.strictEqual(countryCodeToContinent('AU'), 'Océanie', 'Australie → Océanie');
assert.strictEqual(countryCodeToContinent('ZZ'), null, 'code inconnu → null');
assert.strictEqual(countryCodeToContinent(null), null, 'null → null');
assert.strictEqual(countryCodeToContinent(''), null, 'vide → null');
assert.strictEqual(countryCodeToContinent('  it  '), 'Europe', 'espaces ignorés');

console.log('✓ test-geo-continents.js OK');
