'use strict';

const PASS_QUOTA         = 40;
const PASS_SEASON_MONTHS = [6, 7, 8, 9]; // juin–septembre

function isPassSeason() {
  return PASS_SEASON_MONTHS.includes(new Date().getMonth() + 1);
}

function getPassMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPassMonthLabel() {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getPassResetDate() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${String(first.getDate()).padStart(2,'0')}/${String(first.getMonth()+1).padStart(2,'0')}/${first.getFullYear()}`;
}

function getPassRemaining(inscriptionId) {
  if (!inscriptionId || !isPassSeason()) return 0;
  const prefix = 'handiplage_' + getPassMonthKey(); // ex. "handiplage_2026-07"
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!data) continue;
      if (key.endsWith('_list')) {
        if (Array.isArray(data)) {
          count += data.filter(r => r.inscriptionId === inscriptionId && r.status !== 'annule').length;
        }
      } else {
        if (typeof data === 'object') {
          count += Object.values(data).filter(r => r && r.inscriptionId === inscriptionId).length;
        }
      }
    } catch {}
  }
  return Math.max(0, PASS_QUOTA - count);
}

function getInscriptionsWithActivePass() {
  if (typeof getInscriptions !== 'function') return [];
  return getInscriptions()
    .filter(i => i.statut === 'valide' && i.pass && i.pass.actif)
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

if (typeof module !== 'undefined') {
  module.exports = {
    isPassSeason, getPassMonthKey, getPassMonthLabel,
    getPassResetDate, getPassRemaining, getInscriptionsWithActivePass,
    PASS_QUOTA,
  };
}
