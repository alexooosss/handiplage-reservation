'use strict';

const PASS_QUOTA         = 40;
const PASS_SEASON_MONTHS = [6, 7, 8, 9]; // juin–septembre

var _passCountCache = {};

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

function setPassCountCache(cache) {
  _passCountCache = cache || {};
}

function getPassRemaining(inscriptionId) {
  if (!inscriptionId || !isPassSeason()) return 0;
  const used = _passCountCache[inscriptionId] || 0;
  return Math.max(0, PASS_QUOTA - used);
}

async function preloadPassCounts(inscriptionIds) {
  if (typeof getPassRemainingCount !== 'function') throw new Error('getPassRemainingCount not loaded');
  const monthISO = getPassMonthKey();
  const counts = await Promise.all(
    inscriptionIds.map(id => getPassRemainingCount(id, monthISO))
  );
  const cache = {};
  inscriptionIds.forEach((id, i) => { cache[id] = counts[i]; });
  _passCountCache = cache;
}

function getInscriptionsWithActivePass() {
  if (typeof getCachedInscriptions !== 'function') return [];
  return getCachedInscriptions()
    .filter(i => i.statut === 'valide' && i.pass && i.pass.actif)
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

if (typeof module !== 'undefined') {
  module.exports = {
    isPassSeason, getPassMonthKey, getPassMonthLabel,
    getPassResetDate, getPassRemaining, getInscriptionsWithActivePass,
    PASS_QUOTA, setPassCountCache, preloadPassCounts,
  };
}
