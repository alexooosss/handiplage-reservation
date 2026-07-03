// tests/test-pass.js
'use strict';
const assert = require('assert');

// Mock getCachedInscriptions (défini globalement dans supabase-inscriptions.js en prod)
global.getCachedInscriptions = () => [
  { id: 'abc', statut: 'valide', nom: 'MARTIN', prenom: 'André',
    pass: { actif: true, activatedAt: '2026-06-01' } },
  { id: 'def', statut: 'valide', nom: 'DUPONT', prenom: 'Claire',
    pass: { actif: false, activatedAt: '2026-06-01' } },
  { id: 'ghi', statut: 'en_attente', nom: 'SIMON', prenom: 'Paul', pass: null },
];

// Mock getPassRemainingCount (défini globalement dans supabase-storage.js en prod)
global.getPassRemainingCount = async (inscriptionId, monthISO) => {
  const mockCounts = { 'abc': 3, 'def': 0 };
  return mockCounts[inscriptionId] || 0;
};

const {
  isPassSeason, getPassMonthKey, getPassMonthLabel, getPassResetDate,
  getPassRemaining, getInscriptionsWithActivePass, PASS_QUOTA,
  setPassCountCache, preloadPassCounts,
} = require('../js/pass.js');

// ── isPassSeason ──
{
  const m = new Date().getMonth() + 1;
  const expected = [6,7,8,9].includes(m);
  assert.strictEqual(isPassSeason(), expected, 'isPassSeason cohérent avec la date système');
}

// ── getPassMonthKey ──
{
  const key = getPassMonthKey();
  assert.match(key, /^\d{4}-\d{2}$/, 'format YYYY-MM');
}

// ── getPassResetDate ──
{
  const reset = getPassResetDate();
  assert.match(reset, /^\d{2}\/\d{2}\/\d{4}$/, 'format DD/MM/YYYY');
  assert.ok(reset.startsWith('01/'), 'commence le 1er du mois');
}

// ── PASS_QUOTA ──
{
  assert.strictEqual(PASS_QUOTA, 40);
}

// ── getPassMonthLabel ──
{
  const label = getPassMonthLabel();
  assert.match(label, /^.+ \d{4}$/, 'format "mois année"');
}

// ── getInscriptionsWithActivePass ──
{
  const result = getInscriptionsWithActivePass();
  assert.strictEqual(result.length, 1, 'seul l\'inscrit valide avec pass.actif=true');
  assert.strictEqual(result[0].id, 'abc');
}

// ── getPassRemaining — hors saison toujours 0 ──
// isPassSeason() lit la date système — branche hors-saison non testable sans injection de date

// ── setPassCountCache + getPassRemaining — cache vide ──
{
  setPassCountCache({});
  const m = new Date().getMonth() + 1;
  const inSeason = [6,7,8,9].includes(m);
  const rem = getPassRemaining('abc');
  assert.strictEqual(rem, inSeason ? PASS_QUOTA : 0, 'cache vide → quota plein (en saison) ou 0 (hors saison)');
}

// ── setPassCountCache + getPassRemaining — décompte cache ──
if ([6,7,8,9].includes(new Date().getMonth() + 1)) {
  // Uniquement en saison pour que getPassRemaining retourne > 0

  // 2 réservations utilisées → PASS_QUOTA - 2 restantes
  setPassCountCache({ 'abc': 2 });
  assert.strictEqual(getPassRemaining('abc'), PASS_QUOTA - 2, '2 utilisées → PASS_QUOTA - 2 restantes');

  // Autre inscrit non présent dans cache → quota plein
  assert.strictEqual(getPassRemaining('def'), PASS_QUOTA, 'id absent du cache → quota plein');

  // Quota épuisé (used >= PASS_QUOTA) → 0, jamais négatif
  setPassCountCache({ 'abc': PASS_QUOTA + 5 });
  assert.strictEqual(getPassRemaining('abc'), 0, 'quota dépassé → 0, jamais négatif');

  // inscriptionId absent/null → 0
  assert.strictEqual(getPassRemaining(null), 0, 'null → 0');
  assert.strictEqual(getPassRemaining(''), 0, 'chaîne vide → 0');

  // setPassCountCache avec null/undefined → traité comme {}
  setPassCountCache(null);
  assert.strictEqual(getPassRemaining('abc'), PASS_QUOTA, 'cache null → quota plein');
}

// ── preloadPassCounts ──
(async () => {
  // Cas normal : cache rempli depuis getPassRemainingCount
  setPassCountCache({});
  await preloadPassCounts(['abc', 'def']);
  assert.strictEqual(getPassRemaining('abc'), [6,7,8,9].includes(new Date().getMonth()+1) ? PASS_QUOTA - 3 : 0, 'preload abc: 3 utilisées');
  assert.strictEqual(getPassRemaining('def'), [6,7,8,9].includes(new Date().getMonth()+1) ? PASS_QUOTA : 0, 'preload def: 0 utilisées');

  // Tableau vide → cache vide {}
  await preloadPassCounts([]);
  assert.deepStrictEqual(getPassRemaining('abc'), [6,7,8,9].includes(new Date().getMonth()+1) ? PASS_QUOTA : 0, 'tableau vide → cache réinitialisé vide');

  // Guard : getPassRemainingCount non chargé → throw
  const orig = global.getPassRemainingCount;
  delete global.getPassRemainingCount;
  await assert.rejects(preloadPassCounts(['abc']), /not loaded/, 'guard: getPassRemainingCount absent → throw');
  global.getPassRemainingCount = orig;
})().then(() => {
  console.log('✓ test-pass.js OK');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
