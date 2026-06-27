'use strict';

// Clé localStorage : handiplage_YYYY-MM-DD_slotN
function _key(date, slotId) {
  return `handiplage_${date}_slot${slotId}`;
}

// Retourne toutes les réservations d'un créneau sous la forme :
// { [spotId]: { nom, prenom, accompagnants, type, checkinTime, status } }
function getReservations(date, slotId) {
  const raw = localStorage.getItem(_key(date, slotId));
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// Sauvegarde ou remplace une entrée pour un emplacement
function saveCheckin(date, slotId, spotId, data) {
  const resas = getReservations(date, slotId);
  resas[spotId] = data;
  localStorage.setItem(_key(date, slotId), JSON.stringify(resas));
}

// Met à jour uniquement le statut d'un emplacement existant
function updateStatus(date, slotId, spotId, status) {
  const resas = getReservations(date, slotId);
  if (!resas[spotId]) return;
  resas[spotId].status = status;
  localStorage.setItem(_key(date, slotId), JSON.stringify(resas));
}

// Vide toutes les entrées d'un créneau
function clearSlot(date, slotId) {
  localStorage.setItem(_key(date, slotId), JSON.stringify({}));
}

// Retourne la date du jour au format YYYY-MM-DD
function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

if (typeof module !== 'undefined') {
  module.exports = { getReservations, saveCheckin, updateStatus, clearSlot, getTodayISO };
}
