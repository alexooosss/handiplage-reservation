'use strict';
const assert = require('assert');

global.window = undefined;
// SLOTS requis par _mcDefault — simuler
global.SLOTS = [
  { id: 1, label: '8h30 – 10h15' },
  { id: 2, label: '10h30 – 12h15' },
  { id: 3, label: '12h30 – 14h15' },
  { id: 4, label: '14h30 – 16h15' },
  { id: 5, label: '16h30 – 18h15' },
];

const { _mcDefault, _rowsToMcData } = require('../js/supabase-mc.js');

// _mcDefault
const def = _mcDefault();
assert.ok(def.staff, 'staff present');
assert.ok(def.slots, 'slots present');
assert.ok(Array.isArray(def.notes), 'notes array');
assert.strictEqual(Object.keys(def.slots).length, 5, '5 slots');
assert.strictEqual(def.slots[1].resa, 0);

// _rowsToMcData : assemble un objet MC depuis les lignes Supabase
const rows = [
  { creneau_id: 1, staff: { entretien_matin: 'Alice', police: true }, compteurs: { resa: 3, walkin: 1, gpe_pers: 0, gpe_acc: 0, tiralos: 0, hippocampes: 0, audioplage: 0, transferts: 0 }, notes: [{ ts: 1000, text: 'Test', reporter: '' }] },
  { creneau_id: 2, staff: { entretien_matin: 'Alice', police: true }, compteurs: { resa: 2, walkin: 0, gpe_pers: 0, gpe_acc: 0, tiralos: 0, hippocampes: 0, audioplage: 0, transferts: 0 }, notes: [] },
];
const mc = _rowsToMcData(rows);
assert.strictEqual(mc.staff.entretien_matin, 'Alice');
assert.strictEqual(mc.staff.police, true);
assert.strictEqual(mc.slots[1].resa, 3);
assert.strictEqual(mc.slots[2].walkin, 0);
assert.strictEqual(mc.notes.length, 1);
// Créneaux sans ligne → défaut zéros
assert.strictEqual(mc.slots[3].resa, 0);

console.log('✓ test-supabase-mc.js OK');
