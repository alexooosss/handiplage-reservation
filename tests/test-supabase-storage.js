'use strict';
const assert = require('assert');

global.window = undefined;
const { _rowToSpotResa, _rowToWaitingResa, _localStatusToDb, _dbStatutToLocal } = require('../js/supabase-storage.js');

// _localStatusToDb
assert.strictEqual(_localStatusToDb('present'),  'present');
assert.strictEqual(_localStatusToDb('departed'),  'parti');
assert.strictEqual(_localStatusToDb('absent'),    'absent');
assert.strictEqual(_localStatusToDb('pas_venu'),  'absent');
assert.strictEqual(_localStatusToDb('annule'),    'annule');

// _dbStatutToLocal
assert.strictEqual(_dbStatutToLocal('present'), 'present');
assert.strictEqual(_dbStatutToLocal('parti'),   'departed');
assert.strictEqual(_dbStatutToLocal('absent'),  'absent');
assert.strictEqual(_dbStatutToLocal('annule'),  'annule');

// _rowToSpotResa
const spotRow = {
  id:            'uuid-spot-1',
  nom:           'DUPONT',
  prenom:        'Marie',
  accompagnants: 1,
  type:          'reserved',
  statut:        'present',
  spot_id:       'P12',
  checkin_time:  '2026-07-02T09:00:00Z',
  depart_time:   null,
  inscription_id: 'insc-uuid',
  resa_type:     'normal',
};
const spot = _rowToSpotResa(spotRow);
assert.strictEqual(spot.nom, 'DUPONT');
assert.strictEqual(spot.status, 'present');
assert.strictEqual(spot.type, 'reserved');
assert.strictEqual(spot.inscriptionId, 'insc-uuid');
assert.strictEqual(typeof spot.checkinTime, 'number'); // ms timestamp
assert.strictEqual(spot.departTime, null);
// durationMs non présent (local uniquement)
assert.strictEqual(spot.durationMs, undefined);

// departed
const departedRow = { ...spotRow, statut: 'parti', depart_time: '2026-07-02T10:00:00Z' };
const departed = _rowToSpotResa(departedRow);
assert.strictEqual(departed.status, 'departed');
assert.strictEqual(typeof departed.departTime, 'number');

// _rowToWaitingResa
const waitRow = {
  id:            'uuid-wait-1',
  nom:           'MARTIN',
  prenom:        'Jean',
  accompagnants: 0,
  statut:        'attente',
  inscription_id: null,
  resa_type:     'normal',
};
const wait = _rowToWaitingResa(waitRow);
assert.strictEqual(wait.id, 'uuid-wait-1');
assert.strictEqual(wait.nom, 'MARTIN');
assert.strictEqual(wait.status, 'waiting');
assert.strictEqual(wait.inscriptionId, null);
assert.strictEqual(wait.resaType, 'normal');

// statut absent en DB
const pvRow = { ...waitRow, statut: 'absent' };
const pv = _rowToWaitingResa(pvRow);
assert.strictEqual(pv.status, 'absent');

console.log('✓ test-supabase-storage.js OK');
