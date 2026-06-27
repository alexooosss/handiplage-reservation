// tests/test-timer.js
'use strict';
const assert = require('assert');
const { DURATION_MS, getTimeRemaining, formatCountdown, getUrgencyLevel } = require('../js/timer.js');

// DURATION_MS = 1h45 = 6300 secondes
assert.strictEqual(DURATION_MS, 105 * 60 * 1000);

// getTimeRemaining — arrivée à l'instant
{
  const now = Date.now();
  const remaining = getTimeRemaining(now);
  assert.ok(remaining >= DURATION_MS - 10 && remaining <= DURATION_MS, 'should be ~DURATION_MS');
}

// getTimeRemaining — arrivée il y a 30 minutes
{
  const checkin = Date.now() - 30 * 60 * 1000;
  const remaining = getTimeRemaining(checkin);
  const expected = 75 * 60 * 1000;
  assert.ok(Math.abs(remaining - expected) < 100, 'should be ~75 minutes remaining');
}

// getTimeRemaining — temps écoulé → retourne 0 (pas négatif)
{
  const checkin = Date.now() - 200 * 60 * 1000;
  assert.strictEqual(getTimeRemaining(checkin), 0);
}

// formatCountdown
assert.strictEqual(formatCountdown(105 * 60 * 1000), '105:00');
assert.strictEqual(formatCountdown(75 * 60 * 1000), '75:00');
assert.strictEqual(formatCountdown(90 * 1000),       '01:30');
assert.strictEqual(formatCountdown(5 * 1000),        '00:05');
assert.strictEqual(formatCountdown(0),               '00:00');
assert.strictEqual(formatCountdown(61 * 1000),       '01:01');

// getUrgencyLevel
assert.strictEqual(getUrgencyLevel(0),                  'expired');
assert.strictEqual(getUrgencyLevel(5 * 60 * 1000),      'critical'); // <15min
assert.strictEqual(getUrgencyLevel(14 * 60 * 1000 + 59000), 'critical');
assert.strictEqual(getUrgencyLevel(15 * 60 * 1000),     'warning');  // 15-30min
assert.strictEqual(getUrgencyLevel(29 * 60 * 1000),     'warning');
assert.strictEqual(getUrgencyLevel(30 * 60 * 1000),     'ok');       // ≥30min

console.log('✓ timer.js — tous les tests passent');
