// tests/test-usager-storage.js
'use strict';
const assert = require('assert');

// ── Fonctions pures testables ─────────────────────────────────────

function _rowToUsagerInscription(row) {
  var obj = {
    id:              row.id,
    nom:             row.nom,
    prenom:          row.prenom,
    mail:            row.mail,
    telephone:       row.telephone,
    statut:          row.statut,
    passActif:       !!row.pass_actif,
    passActivatedAt: row.pass_activated_at || null,
  };
  if (row.metadata && typeof row.metadata === 'object') {
    Object.assign(obj, row.metadata);
  }
  return obj;
}

function _rowToUsagerReservation(row) {
  return {
    id:           row.id,
    date:         row.date,
    creneauId:    row.creneau_id,
    statut:       row.statut,
    accompagnants: row.accompagnants,
    spotId:       row.spot_id || null,
    createdAt:    row.created_at,
  };
}

function computePassBalance(reservations, quota) {
  var today = new Date();
  var monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var used = reservations.filter(function(r) {
    return r.statut !== 'annule' && r.date && r.date.startsWith(monthKey);
  }).length;
  return { used: used, remaining: Math.max(0, quota - used), quota: quota, monthKey: monthKey };
}

function canCancelReservation(dateISO) {
  var resaDate = new Date(dateISO + 'T00:00:00');
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return resaDate >= tomorrow;
}

// ── Tests ────────────────────────────────────────────────────────

// Test 1 : _rowToUsagerInscription aplatit les metadata
var row1 = {
  id: 'insc-1', nom: 'DUPONT', prenom: 'Marie', mail: 'marie@test.fr',
  telephone: '0600000000', statut: 'valide', pass_actif: true,
  pass_activated_at: '2026-06-01', created_at: '2026-05-01T00:00:00Z',
  metadata: { adresse: '12 rue de la Mer', ville: 'Antibes', accompagnement: ['aucun'] },
};
var insc1 = _rowToUsagerInscription(row1);
assert.strictEqual(insc1.nom, 'DUPONT', 'nom mappé');
assert.strictEqual(insc1.passActif, true, 'passActif mappé');
assert.strictEqual(insc1.adresse, '12 rue de la Mer', 'metadata aplatie');
assert.strictEqual(insc1.ville, 'Antibes', 'ville depuis metadata');
console.log('✓ _rowToUsagerInscription OK');

// Test 2 : _rowToUsagerReservation
var row2 = { id: 'resa-1', date: '2026-07-09', creneau_id: 1, statut: 'attente', accompagnants: 0, spot_id: null, created_at: '2026-07-01T10:00:00Z' };
var resa1 = _rowToUsagerReservation(row2);
assert.strictEqual(resa1.creneauId, 1, 'creneauId mappé');
assert.strictEqual(resa1.spotId, null, 'spotId null');
console.log('✓ _rowToUsagerReservation OK');

// Test 3 : computePassBalance avec 3 réservations ce mois
var today = new Date();
var thisMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
var resas = [
  { statut: 'attente', date: thisMonth + '-05' },
  { statut: 'present', date: thisMonth + '-08' },
  { statut: 'annule',  date: thisMonth + '-10' },  // ne compte pas
  { statut: 'attente', date: '2025-06-01' },         // mois passé, ne compte pas
];
var balance = computePassBalance(resas, 40);
assert.strictEqual(balance.used, 2, 'seules les non-annulées du mois comptent');
assert.strictEqual(balance.remaining, 38, 'remaining = 40 - 2');
assert.strictEqual(balance.quota, 40, 'quota = 40');
console.log('✓ computePassBalance OK');

// Test 4 : computePassBalance quota épuisé
var resas2 = Array.from({ length: 40 }, function(_, i) {
  return { statut: 'present', date: thisMonth + '-' + String(i % 28 + 1).padStart(2, '0') };
});
var balance2 = computePassBalance(resas2, 40);
assert.strictEqual(balance2.remaining, 0, 'remaining = 0 quand quota épuisé');
console.log('✓ computePassBalance épuisé OK');

// Test 5 : canCancelReservation
var tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
var tomorrowISO = tomorrow.toISOString().slice(0, 10);
var yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
var yesterdayISO = yesterday.toISOString().slice(0, 10);
assert.strictEqual(canCancelReservation(tomorrowISO), true,  'peut annuler pour demain');
assert.strictEqual(canCancelReservation(yesterdayISO), false, 'ne peut pas annuler pour hier');
console.log('✓ canCancelReservation OK');

console.log('✓ test-usager-storage.js OK');
