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

// Dernier créneau de la présence d'une personne :
// - _finSlotId : repéré par app.js (la même personne est inscrite sur le même emplacement au créneau suivant) ;
// - nbCreneaux > 1 : arrivée sans réservation enregistrée pour 2 créneaux.
function resaFinSlotId(resa) {
  if (!resa || !resa.slotId) return null;
  if (resa._finSlotId) return resa._finSlotId;
  if (resa.nbCreneaux > 1) {
    var suivant = (typeof getSlotById === 'function') ? getSlotById(resa.slotId + 1) : null;
    if (suivant) return resa.slotId + 1;
  }
  return resa.slotId;
}

// Millisecondes restantes jusqu'à la fin réelle de la présence (1 ou 2 créneaux)
function resaEndMs(resa) {
  var fin = resaFinSlotId(resa);
  return fin ? slotEndMs(fin) : 0;
}

// Durée totale de la présence prévue (du début du créneau d'arrivée à la fin du dernier créneau)
function resaDureeMs(resa) {
  var debut = (resa && typeof getSlotById === 'function') ? getSlotById(resa.slotId) : null;
  var fin   = (typeof getSlotById === 'function') ? getSlotById(resaFinSlotId(resa)) : null;
  if (!debut || !fin || typeof timeToMinutes !== 'function') return 0;
  return (timeToMinutes(fin.end) - timeToMinutes(debut.start)) * 60000;
}

if (typeof module !== 'undefined') {
  module.exports = { DURATION_MS, DURATION_MS_DOUBLE, getTimeRemaining, formatCountdown, getUrgencyLevel, slotEndMs, resaFinSlotId, resaEndMs, resaDureeMs };
}
