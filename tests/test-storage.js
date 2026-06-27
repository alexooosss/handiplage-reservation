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
  getReservations, saveCheckin, updateStatus, clearSlot, getTodayISO
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

console.log('✓ storage.js — tous les tests passent');
