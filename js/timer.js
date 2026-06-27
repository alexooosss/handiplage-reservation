'use strict';

const DURATION_MS = 105 * 60 * 1000; // 1h45

function getTimeRemaining(checkinTimestamp) {
  return Math.max(0, DURATION_MS - (Date.now() - checkinTimestamp));
}

// Formate des millisecondes en "MM:SS"
function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Retourne le niveau d'urgence : 'expired' | 'critical' | 'warning' | 'ok'
function getUrgencyLevel(ms) {
  if (ms === 0)              return 'expired';
  if (ms < 15 * 60 * 1000)  return 'critical';
  if (ms < 30 * 60 * 1000)  return 'warning';
  return 'ok';
}

if (typeof module !== 'undefined') {
  module.exports = { DURATION_MS, getTimeRemaining, formatCountdown, getUrgencyLevel };
}
