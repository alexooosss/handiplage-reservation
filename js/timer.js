'use strict';

const DURATION_MS        = 105 * 60 * 1000; // 1h45 — créneau simple
const DURATION_MS_DOUBLE = 210 * 60 * 1000; // 3h30 — double créneau consécutif

// durationMs optionnel — utiliser resa.durationMs si disponible
function getTimeRemaining(checkinTimestamp, durationMs) {
  const d = (durationMs !== undefined) ? durationMs : DURATION_MS;
  return Math.max(0, d - (Date.now() - checkinTimestamp));
}

function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getUrgencyLevel(ms) {
  if (ms === 0)              return 'expired';
  if (ms < 15 * 60 * 1000)  return 'critical';
  if (ms < 30 * 60 * 1000)  return 'warning';
  return 'ok';
}

// Millisecondes restantes jusqu'à la fin officielle d'un créneau
function slotEndMs(slotId) {
  var slot = (typeof getSlotById === 'function') ? getSlotById(slotId) : null;
  if (!slot) return 0;
  var parts = slot.end.split(':').map(Number);
  var t = new Date();
  t.setHours(parts[0], parts[1], 0, 0);
  return Math.max(0, t.getTime() - Date.now());
}

if (typeof module !== 'undefined') {
  module.exports = { DURATION_MS, DURATION_MS_DOUBLE, getTimeRemaining, formatCountdown, getUrgencyLevel, slotEndMs };
}
