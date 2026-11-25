'use strict';

const SLOTS = [
  { id: 1, label: '8h30 – 10h15',  start: '08:30', end: '10:15' },
  { id: 2, label: '10h30 – 12h15', start: '10:30', end: '12:15' },
  { id: 3, label: '12h30 – 14h15', start: '12:30', end: '14:15' },
  { id: 4, label: '14h30 – 16h15', start: '14:30', end: '16:15' },
  { id: 5, label: '16h30 – 18h15', start: '16:30', end: '18:15' },
];

// Les dates d'ouverture/fermeture de la plage vivent en base
// (app_config.saison_debut/saison_fin, lues via getSaisonDates() dans
// js/supabase-config.js) — plus de constante figée ici. Ces deux fonctions
// restent pures : les bornes sont passées en paramètres.

// true si la date ISO est comprise dans la période d'ouverture (bornes incluses)
function isWithinSeason(iso, seasonStart, seasonEnd) {
  return !!iso && iso >= seasonStart && iso <= seasonEnd;
}

// Ramène une date ISO à la fin de saison si elle la dépasse (sinon inchangée)
function clampToSeasonEnd(iso, seasonEnd) {
  return iso > seasonEnd ? seasonEnd : iso;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Retourne 'past' | 'active' | 'upcoming'
function getSlotStatus(slot, date) {
  const d = date || new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  const start = timeToMinutes(slot.start);
  const end = timeToMinutes(slot.end);
  if (now >= end)   return 'past';
  if (now >= start) return 'active';
  return 'upcoming';
}

// Retourne le créneau actif ou null
function getActiveSlot(date) {
  return SLOTS.find(s => getSlotStatus(s, date) === 'active') || null;
}

function getSlotById(id) {
  return SLOTS.find(s => s.id === id) || null;
}

// Minutes écoulées depuis le début du créneau (peut être négatif si avant le début)
function minutesSinceSlotStart(slotId) {
  const slot = getSlotById(slotId);
  if (!slot) return 0;
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  return currentMin - timeToMinutes(slot.start);
}

function isLastSlot(slotId) {
  return slotId >= SLOTS[SLOTS.length - 1].id;
}

// ── Fermeture de la plage : règles communes staff / usagers ──
function _isoLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Une réservation « suspendue » (plage fermée) dont le créneau est terminé est recréditée :
// elle ne compte plus dans le quota. Tant que le créneau n'est pas fini, elle compte encore
// (la plage peut rouvrir et la rétablir).
function suspensionRecreditee(r, now) {
  if (!r || r.statut !== 'suspendu') return false;
  now = now || new Date();
  var today = _isoLocal(now);
  if (r.date < today) return true;
  if (r.date > today) return false;
  var slot = SLOTS.find(function(s) { return s.id === (r.creneau_id || r.creneauId); });
  return !slot || (now.getHours() * 60 + now.getMinutes()) >= timeToMinutes(slot.end);
}

// Compte dans le quota du pass (et la limite journalière) ?
function resaCompteDansQuota(r, now) {
  if (!r || r.statut === 'annule') return false;
  if (r.statut === 'suspendu') return !suspensionRecreditee(r, now);
  return true;
}

// Le créneau est-il touché par une fermeture (intervalle [fermeture, réouverture[) ?
function creneauFerme(fermetures, dateISO, creneauId) {
  var slot = SLOTS.find(function(s) { return s.id === creneauId; });
  if (!slot || !fermetures) return null;
  var deb = timeToMinutes(slot.start), fin = timeToMinutes(slot.end);
  for (var i = 0; i < fermetures.length; i++) {
    var f = fermetures[i];
    if (f.date !== dateISO) continue;
    var hf = timeToMinutes(String(f.heure_fermeture).slice(0, 5));
    var hr = f.heure_reouverture ? timeToMinutes(String(f.heure_reouverture).slice(0, 5)) : 24 * 60;
    if (fin > hf && deb < hr) return f;
  }
  return null;
}

// Créneaux dont la fin est postérieure à une heure donnée (« HH:MM »)
function creneauxNonTerminesA(heure) {
  var m = timeToMinutes(String(heure).slice(0, 5));
  return SLOTS.filter(function(s) { return timeToMinutes(s.end) > m; }).map(function(s) { return s.id; });
}

if (typeof module !== 'undefined') {
  module.exports = { SLOTS, isWithinSeason, clampToSeasonEnd, timeToMinutes, getSlotStatus, getActiveSlot, getSlotById, minutesSinceSlotStart, isLastSlot,
    suspensionRecreditee, resaCompteDansQuota, creneauFerme, creneauxNonTerminesA };
}
