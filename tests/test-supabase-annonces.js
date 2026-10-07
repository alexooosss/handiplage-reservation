// tests/test-supabase-annonces.js
'use strict';
const assert = require('assert');

// Tester la transformation pure d'une ligne annonces → objet local
function _rowToAnnonce(row) {
  return {
    id:        row.id,
    contenu:   row.contenu,
    actif:     !!row.actif,
    createdAt: row.created_at,
  };
}

// Test 1 : transformation basique, annonce active
var row1 = { id: 'an-1', contenu: 'Fermeture exceptionnelle demain', actif: true, created_at: '2026-10-07T10:00:00Z' };
var a1 = _rowToAnnonce(row1);
assert.strictEqual(a1.id, 'an-1', 'id mappé');
assert.strictEqual(a1.contenu, 'Fermeture exceptionnelle demain', 'contenu mappé');
assert.strictEqual(a1.actif, true, 'actif=true');
assert.strictEqual(a1.createdAt, '2026-10-07T10:00:00Z', 'createdAt mappé');
console.log('✓ _rowToAnnonce basique (active) OK');

// Test 2 : annonce désactivée — actif=false
var row2 = { ...row1, actif: false };
var a2 = _rowToAnnonce(row2);
assert.strictEqual(a2.actif, false, 'actif=false');
console.log('✓ _rowToAnnonce désactivée OK');

// Test 3 : actif stocké en valeur "truthy" non-booléenne (ex: 1 depuis Postgres) — doit être coercé en booléen strict
var row3 = { ...row1, actif: 1 };
var a3 = _rowToAnnonce(row3);
assert.strictEqual(a3.actif, true, 'actif coercé en booléen strict');
console.log('✓ _rowToAnnonce coercion actif OK');

console.log('✓ test-supabase-annonces.js OK');
