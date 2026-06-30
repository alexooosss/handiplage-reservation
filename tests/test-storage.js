// tests/test-storage.js
'use strict';
const assert = require('assert');

// Mock localStorage pour Node.js
global.localStorage = {
  _data: {},
  getItem(key)      { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
  setItem(key, val) { this._data[key] = String(val); },
  removeItem(key)   { delete this._data[key]; },
  clear()           { this._data = {}; },
};

const {
  getReservations, saveCheckin, updateStatus, clearSlot, getTodayISO,
  getReservationList, addReservation, removeReservation, updateReservationStatus
} = require('../js/storage.js');

const DATE = '2026-06-26';
const SLOT = 2;

// getReservations — vide au départ
{
  const resas = getReservations(DATE, SLOT);
  assert.deepStrictEqual(resas, {});
}

// saveCheckin — enregistre une réservation
{
  saveCheckin(DATE, SLOT, 'P1', {
    nom: 'Martin', prenom: 'André', accompagnants: 1,
    type: 'reserved', checkinTime: 1750000000000, status: 'present'
  });
  const resas = getReservations(DATE, SLOT);
  assert.ok(resas['P1'], 'P1 should exist');
  assert.strictEqual(resas['P1'].nom, 'Martin');
  assert.strictEqual(resas['P1'].status, 'present');
}

// saveCheckin — deuxième emplacement
{
  saveCheckin(DATE, SLOT, 'P5', {
    nom: 'Dupont', prenom: 'Claire', accompagnants: 0,
    type: 'walkin', checkinTime: 1750000100000, status: 'present'
  });
  const resas = getReservations(DATE, SLOT);
  assert.ok(resas['P5']);
  assert.strictEqual(resas['P5'].type, 'walkin');
}

// updateStatus
{
  updateStatus(DATE, SLOT, 'P1', 'absent');
  const resas = getReservations(DATE, SLOT);
  assert.strictEqual(resas['P1'].status, 'absent');
  assert.strictEqual(resas['P1'].nom, 'Martin'); // autres champs préservés
}

// updateStatus — spot inexistant → no-op sans crash
{
  assert.doesNotThrow(() => updateStatus(DATE, SLOT, 'P99', 'absent'));
}

// clearSlot — vide uniquement le slot concerné
{
  saveCheckin(DATE, 1, 'P3', {
    nom: 'Test', prenom: 'Un', accompagnants: 0,
    type: 'reserved', checkinTime: Date.now(), status: 'present'
  });
  clearSlot(DATE, SLOT);
  assert.deepStrictEqual(getReservations(DATE, SLOT), {});
  assert.ok(getReservations(DATE, 1)['P3'], 'slot 1 data should remain');
}

// getTodayISO — format YYYY-MM-DD
{
  const iso = getTodayISO();
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
}

// ── Reservation list ──

// getReservationList — vide au départ
{
  localStorage.clear();
  assert.deepStrictEqual(getReservationList(DATE, SLOT), []);
}

// addReservation — ajoute une entrée
{
  addReservation(DATE, SLOT, { nom: 'DUPONT', prenom: 'Marie', accompagnants: 1 });
  const list = getReservationList(DATE, SLOT);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].nom, 'DUPONT');
  assert.strictEqual(list[0].prenom, 'Marie');
}

// addReservation — deuxième entrée
{
  addReservation(DATE, SLOT, { nom: 'MARTIN', prenom: 'André', accompagnants: 0 });
  assert.strictEqual(getReservationList(DATE, SLOT).length, 2);
}

// removeReservation — supprime par index
{
  removeReservation(DATE, SLOT, 0);
  const list = getReservationList(DATE, SLOT);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].nom, 'MARTIN');
}

// removeReservation — index invalide → no-op sans crash
{
  assert.doesNotThrow(() => removeReservation(DATE, SLOT, 99));
}

// liste indépendante par créneau
{
  addReservation(DATE, 3, { nom: 'TEST', prenom: 'Autre', accompagnants: 0 });
  assert.strictEqual(getReservationList(DATE, SLOT).length, 1);
  assert.strictEqual(getReservationList(DATE, 3).length, 1);
}

// updateReservationStatus
{
  localStorage.clear();
  addReservation(DATE, SLOT, { nom: 'BLANC', prenom: 'Jean', accompagnants: 0 });
  updateReservationStatus(DATE, SLOT, 0, 'pas_venu');
  const list = getReservationList(DATE, SLOT);
  assert.strictEqual(list[0].status, 'pas_venu');
  assert.strictEqual(list[0].nom, 'BLANC'); // autres champs préservés
}
{
  updateReservationStatus(DATE, SLOT, 0, 'annule');
  assert.strictEqual(getReservationList(DATE, SLOT)[0].status, 'annule');
}
{
  assert.doesNotThrow(() => updateReservationStatus(DATE, SLOT, 99, 'pas_venu'));
}

// addReservation — stocke inscriptionId optionnel
{
  localStorage.clear();
  addReservation('2026-07-01', 3, { nom: 'MARTIN', prenom: 'André', accompagnants: 0, inscriptionId: 'abc123' });
  const list = getReservationList('2026-07-01', 3);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].inscriptionId, 'abc123', 'inscriptionId conservé');
}

// addReservation — sans inscriptionId (compatibilité ascendante)
{
  addReservation('2026-07-01', 3, { nom: 'DUPONT', prenom: 'Claire', accompagnants: 1 });
  const list = getReservationList('2026-07-01', 3);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[1].inscriptionId, undefined, 'pas d\'inscriptionId si non fourni');
}

console.log('✓ storage.js — tous les tests passent');
