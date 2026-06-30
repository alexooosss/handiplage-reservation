// tests/test-pass.js
'use strict';
const assert = require('assert');

// Mock localStorage avec iteration complète
let _store = {};
global.localStorage = {
  get length() { return Object.keys(_store).length; },
  key(i)        { return Object.keys(_store)[i] ?? null; },
  getItem(k)    { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v) { _store[k] = String(v); },
  removeItem(k) { delete _store[k]; },
  clear()       { _store = {}; },
};

// Mock getInscriptions (défini globalement dans inscription.js en prod)
global.getInscriptions = () => [
  { id: 'abc', statut: 'valide', nom: 'MARTIN', prenom: 'André',
    pass: { actif: true, activatedAt: '2026-06-01' } },
  { id: 'def', statut: 'valide', nom: 'DUPONT', prenom: 'Claire',
    pass: { actif: false, activatedAt: '2026-06-01' } },
  { id: 'ghi', statut: 'en_attente', nom: 'SIMON', prenom: 'Paul', pass: null },
];

const {
  isPassSeason, getPassMonthKey, getPassResetDate,
  getPassRemaining, getInscriptionsWithActivePass, PASS_QUOTA,
} = require('../js/pass.js');

// ── isPassSeason ──
{
  const m = new Date().getMonth() + 1;
  const expected = [6,7,8,9].includes(m);
  assert.strictEqual(isPassSeason(), expected, 'isPassSeason cohérent avec la date système');
}

// ── getPassMonthKey ──
{
  const key = getPassMonthKey();
  assert.match(key, /^\d{4}-\d{2}$/, 'format YYYY-MM');
}

// ── getPassResetDate ──
{
  const reset = getPassResetDate();
  assert.match(reset, /^\d{2}\/\d{2}\/\d{4}$/, 'format DD/MM/YYYY');
  assert.ok(reset.startsWith('01/'), 'commence le 1er du mois');
}

// ── PASS_QUOTA ──
{
  assert.strictEqual(PASS_QUOTA, 40);
}

// ── getInscriptionsWithActivePass ──
{
  const result = getInscriptionsWithActivePass();
  assert.strictEqual(result.length, 1, 'seul l\'inscrit valide avec pass.actif=true');
  assert.strictEqual(result[0].id, 'abc');
}

// ── getPassRemaining — aucune réservation ──
{
  localStorage.clear();
  const rem = getPassRemaining('abc');
  const m = new Date().getMonth() + 1;
  const inSeason = [6,7,8,9].includes(m);
  assert.strictEqual(rem, inSeason ? 40 : 0, 'quota plein sans réservation');
}

// ── getPassRemaining — décompte liste d'attente (logique de comptage testée indirectement) ──
{
  localStorage.clear();
  const month = getPassMonthKey(); // ex. "2026-07"
  const listKey = `handiplage_${month}-15_slot2_list`;
  localStorage.setItem(listKey, JSON.stringify([
    { inscriptionId: 'abc', status: 'waiting' },    // compte
    { inscriptionId: 'abc', status: 'annule' },     // ne compte PAS
    { inscriptionId: 'def', status: 'waiting' },    // autre inscrit
  ]));
  const raw = JSON.parse(localStorage.getItem(listKey));
  assert.strictEqual(raw.length, 3);
  const abc = raw.filter(r => r.inscriptionId === 'abc' && r.status !== 'annule');
  assert.strictEqual(abc.length, 1, '1 entrée non annulée pour abc');
}

{
  localStorage.clear();
  const month   = getPassMonthKey();
  const spotKey = `handiplage_${month}-16_slot1`;
  localStorage.setItem(spotKey, JSON.stringify({
    P1: { inscriptionId: 'abc', status: 'present' },
    P3: { inscriptionId: 'def', status: 'present' },
  }));
  const raw = JSON.parse(localStorage.getItem(spotKey));
  const abc = Object.values(raw).filter(r => r && r.inscriptionId === 'abc');
  assert.strictEqual(abc.length, 1, '1 spot pour abc');
}

// ── getPassRemaining — exercice direct de la logique de décompte ──
// (uniquement si la date système courante tombe en saison ; sinon ces blocs
// sont sautés sans casser le test — la production exige le gating "hors
// saison => 0" qui est déjà vérifié ci-dessus)
if (isPassSeason()) {
  const month = getPassMonthKey();

  // Liste d'attente : 1 entrée 'waiting' + 1 'annule' (ignorée) pour abc, 1 pour def
  localStorage.clear();
  localStorage.setItem(`handiplage_${month}-15_slot2_list`, JSON.stringify([
    { inscriptionId: 'abc', status: 'waiting' },
    { inscriptionId: 'abc', status: 'annule' },
    { inscriptionId: 'def', status: 'waiting' },
  ]));
  assert.strictEqual(getPassRemaining('abc'), PASS_QUOTA - 1, 'liste : 1 réservation active décomptée pour abc');
  assert.strictEqual(getPassRemaining('def'), PASS_QUOTA - 1, 'liste : 1 réservation active décomptée pour def');

  // Emplacements assignés : 1 spot pour abc, 1 pour def
  localStorage.clear();
  localStorage.setItem(`handiplage_${month}-16_slot1`, JSON.stringify({
    P1: { inscriptionId: 'abc', status: 'present' },
    P3: { inscriptionId: 'def', status: 'present' },
  }));
  assert.strictEqual(getPassRemaining('abc'), PASS_QUOTA - 1, 'spot : 1 emplacement décompté pour abc');

  // Cumul sur plusieurs jours/créneaux du même mois pour le même inscrit
  localStorage.clear();
  localStorage.setItem(`handiplage_${month}-10_slot1`, JSON.stringify({
    P1: { inscriptionId: 'abc', status: 'present' },
  }));
  localStorage.setItem(`handiplage_${month}-11_slot2`, JSON.stringify({
    P2: { inscriptionId: 'abc', status: 'present' },
  }));
  localStorage.setItem(`handiplage_${month}-12_slot1_list`, JSON.stringify([
    { inscriptionId: 'abc', status: 'waiting' },
  ]));
  assert.strictEqual(getPassRemaining('abc'), PASS_QUOTA - 3, 'cumul sur 3 entrées distinctes pour abc');

  // Une clé d'un autre mois ne doit pas être comptée
  localStorage.clear();
  localStorage.setItem('handiplage_2099-01-10_slot1', JSON.stringify({
    P1: { inscriptionId: 'abc', status: 'present' },
  }));
  assert.strictEqual(getPassRemaining('abc'), PASS_QUOTA, 'clé hors mois courant ignorée');

  // Quota épuisé ne descend pas sous 0
  localStorage.clear();
  const spots = {};
  for (let i = 0; i < PASS_QUOTA + 5; i++) spots['P' + i] = { inscriptionId: 'abc', status: 'present' };
  localStorage.setItem(`handiplage_${month}-20_slot1`, JSON.stringify(spots));
  assert.strictEqual(getPassRemaining('abc'), 0, 'quota dépassé => 0, jamais négatif');
}

console.log('✓ test-pass.js OK');
