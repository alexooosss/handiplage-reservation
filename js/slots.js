'use strict';

const SLOTS = [
  { id: 1, label: '8h30 – 10h15',  start: '08:30', end: '10:15' },
  { id: 2, label: '10h30 – 12h15', start: '10:30', end: '12:15' },
  { id: 3, label: '12h30 – 14h15', start: '12:30', end: '14:15' },
  { id: 4, label: '14h30 – 16h15', start: '14:30', end: '16:15' },
  { id: 5, label: '16h30 – 18h15', start: '16:30', end: '18:15' },
];

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

if (typeof module !== 'undefined') {
  module.exports = { SLOTS, timeToMinutes, getSlotStatus, getActiveSlot, getSlotById, minutesSinceSlotStart, isLastSlot };
}
