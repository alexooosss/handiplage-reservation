// tests/test-supabase-messages.js
'use strict';
const assert = require('assert');

// Tester la transformation pure d'une ligne messages → objet local
function _rowToMessage(row) {
  return {
    id:              row.id,
    inscriptionId:   row.inscription_id,
    motifRefus:      row.motif_refus,
    token:           row.token,
    tokenExpiresAt:  row.token_expires_at,
    contenu:         row.contenu || null,
    lu:              !!row.lu,
    createdAt:       row.created_at,
    // champs dénormalisés depuis la jointure inscriptions
    nom:             row.inscriptions ? row.inscriptions.nom   : null,
    prenom:          row.inscriptions ? row.inscriptions.prenom : null,
    mail:            row.inscriptions ? row.inscriptions.mail   : null,
    statut:          row.inscriptions ? row.inscriptions.statut : null,
  };
}

// Test 1 : transformation basique
var row1 = {
  id: 'msg-1', inscription_id: 'insc-1', motif_refus: 'CMI illisible',
  token: 'tok-abc', token_expires_at: '2026-08-01T00:00:00Z',
  contenu: null, lu: false, created_at: '2026-07-01T10:00:00Z',
  inscriptions: { nom: 'DUPONT', prenom: 'Marie', mail: 'marie@test.fr', statut: 'refuse' },
};
var m1 = _rowToMessage(row1);
assert.strictEqual(m1.nom, 'DUPONT', 'nom dénormalisé');
assert.strictEqual(m1.motifRefus, 'CMI illisible', 'motifRefus mappé');
assert.strictEqual(m1.contenu, null, 'contenu null si pas de réponse');
assert.strictEqual(m1.lu, false, 'lu=false');
console.log('✓ _rowToMessage basique OK');

// Test 2 : message avec réponse + déjà lu
var row2 = { ...row1, contenu: 'Voici ma CMI en pièce jointe', lu: true };
var m2 = _rowToMessage(row2);
assert.strictEqual(m2.contenu, 'Voici ma CMI en pièce jointe', 'contenu présent');
assert.strictEqual(m2.lu, true, 'lu=true');
console.log('✓ _rowToMessage avec réponse OK');

// Test 3 : pas de jointure inscriptions (row sans inscriptions)
var row3 = { ...row1, inscriptions: null };
var m3 = _rowToMessage(row3);
assert.strictEqual(m3.nom, null, 'nom null sans jointure');
console.log('✓ _rowToMessage sans jointure OK');

console.log('✓ test-supabase-messages.js OK');
