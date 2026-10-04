// tests/test-slots.js
'use strict';
const assert = require('assert');
const { SLOTS, isWithinSeason, clampToSeasonEnd, timeToMinutes, getSlotStatus, getActiveSlot, getSlotById } = require('../js/slots.js');

// timeToMinutes
assert.strictEqual(timeToMinutes('08:30'), 510);
assert.strictEqual(timeToMinutes('10:15'), 615);
assert.strictEqual(timeToMinutes('00:00'), 0);
assert.strictEqual(timeToMinutes('23:59'), 1439);

// getSlotStatus — avant tous les créneaux
{
  const d = new Date('2026-06-26T07:00:00');
  assert.strictEqual(getSlotStatus(SLOTS[0], d), 'upcoming');
}

// getSlotStatus — pendant le créneau 1
{
  const d = new Date('2026-06-26T09:00:00');
  assert.strictEqual(getSlotStatus(SLOTS[0], d), 'active');
}

// getSlotStatus — après le créneau 1, avant créneau 2
{
  const d = new Date('2026-06-26T10:20:00');
  assert.strictEqual(getSlotStatus(SLOTS[0], d), 'past');
  assert.strictEqual(getSlotStatus(SLOTS[1], d), 'upcoming');
}

// getSlotStatus — pendant créneau 3
{
  const d = new Date('2026-06-26T13:00:00');
  assert.strictEqual(getSlotStatus(SLOTS[2], d), 'active');
  assert.strictEqual(getSlotStatus(SLOTS[1], d), 'past');
  assert.strictEqual(getSlotStatus(SLOTS[3], d), 'upcoming');
}

// getSlotStatus — après tous
{
  const d = new Date('2026-06-26T20:00:00');
  SLOTS.forEach(s => assert.strictEqual(getSlotStatus(s, d), 'past'));
}

// getActiveSlot
{
  const d = new Date('2026-06-26T11:00:00');
  const slot = getActiveSlot(d);
  assert.ok(slot, 'should find active slot at 11h');
  assert.strictEqual(slot.id, 2);
}

{
  const d = new Date('2026-06-26T07:00:00');
  assert.strictEqual(getActiveSlot(d), null);
}

// getSlotById
assert.strictEqual(getSlotById(1).label, '8h30 – 10h15');
assert.strictEqual(getSlotById(5).label, '16h30 – 18h15');
assert.strictEqual(getSlotById(99), null);

// ── Période de saison (bornes passées en paramètres — plus de constante figée
// dans slots.js, elles vivent dans app_config.saison_debut/saison_fin).
// Bornes volontairement différentes de l'ancienne constante figée de slots.js
// (2026-06-12/2026-09-15) : si l'implémentation ignorait les paramètres et
// retombait sur un reliquat interne au module, ces assertions échoueraient —
// preuve que la fonction utilise bien ce qu'on lui passe.
const SEASON_START = '2027-05-01';
const SEASON_END   = '2027-08-31';

// isWithinSeason
assert.strictEqual(isWithinSeason('2027-05-01', SEASON_START, SEASON_END), true,  'borne de début incluse');
assert.strictEqual(isWithinSeason('2027-08-31', SEASON_START, SEASON_END), true,  'borne de fin incluse');
assert.strictEqual(isWithinSeason('2027-07-01', SEASON_START, SEASON_END), true);
assert.strictEqual(isWithinSeason('2027-09-01', SEASON_START, SEASON_END), false, 'lendemain de fermeture exclu');
assert.strictEqual(isWithinSeason('2027-04-30', SEASON_START, SEASON_END), false);
assert.strictEqual(isWithinSeason('', SEASON_START, SEASON_END), false);
assert.strictEqual(isWithinSeason(null, SEASON_START, SEASON_END), false);

// clampToSeasonEnd
assert.strictEqual(clampToSeasonEnd('2027-09-10', SEASON_END), '2027-08-31', 'date au-delà ramenée à la fin de saison');
assert.strictEqual(clampToSeasonEnd('2027-08-31', SEASON_END), '2027-08-31', 'fin de saison inchangée');
assert.strictEqual(clampToSeasonEnd('2027-07-15', SEASON_END), '2027-07-15', 'date en saison inchangée');

console.log('✓ slots.js — tous les tests passent');
