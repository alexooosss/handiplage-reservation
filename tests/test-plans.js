'use strict';
const assert = require('assert');
const { BEACH_CONFIG } = require('../js/data.js');
const { planValide, appliquerPlan, _dateLocaleISO, placesManquantes, planPourDate } = require('../js/supabase-plans.js');

const cfg = JSON.parse(JSON.stringify(BEACH_CONFIG));
const origine = { version: 1, spots: cfg.spots, tapisH: cfg.tapisH, tapisV: cfg.tapisV, showers: cfg.showers, barnums: [] };

// 1. Le plan d'origine est valide et s'applique à l'identique
assert.ok(planValide(origine), 'plan d\'origine valide');
const c1 = JSON.parse(JSON.stringify(BEACH_CONFIG));
assert.ok(appliquerPlan(c1, origine));
assert.deepStrictEqual(c1.spots.map(s => s.id), BEACH_CONFIG.spots.map(s => s.id), 'mêmes places');
assert.deepStrictEqual(c1.tapisV, BEACH_CONFIG.tapisV, 'mêmes tapis');
assert.deepStrictEqual(c1.rocks, BEACH_CONFIG.rocks, 'décor fixe intact');

// 2. Plans invalides refusés : la config n'est pas touchée
const c2 = JSON.parse(JSON.stringify(BEACH_CONFIG));
[
  null, {}, { spots: [] },
  { spots: [{ id: 'P1', x: 1, y: 1 }, { id: 'P1', x: 2, y: 2 }] },   // identifiant en double
  { spots: [{ id: 'P1', x: '1', y: 1 }] },                           // coordonnée texte
  { spots: [{ id: '', x: 1, y: 1 }] },
  { spots: [{ id: 'P1', x: 1, y: 1 }], tapisH: 'x' },
].forEach((p, i) => {
  assert.strictEqual(planValide(p), false, 'plan invalide n°' + i);
  assert.strictEqual(appliquerPlan(c2, p), false);
});
assert.strictEqual(c2.spots.length, BEACH_CONFIG.spots.length, 'config intacte après refus');

// 3. Plan modifié : places masquées, nouvelle place, barnum, libellé par défaut
const c3 = JSON.parse(JSON.stringify(BEACH_CONFIG));
assert.ok(appliquerPlan(c3, {
  spots: [{ id: 'P1', x: 40, y: 30 }, { id: 'P55', x: 600, y: 260 }],
  barnums: [{ id: 'B1', nom: 'Accueil', x: 630, y: 182, w: 140, h: 40 }],
}));
assert.strictEqual(c3.spots.length, 2);
assert.strictEqual(c3.spots[1].label, 'Place 55', 'libellé par défaut');
assert.deepStrictEqual(c3.tapisH, [], 'éléments absents = vides');
assert.strictEqual(c3.barnums.length, 1);

// 3b. Front de mer : transmis s'il est valide, sinon plan refusé
const c4 = JSON.parse(JSON.stringify(BEACH_CONFIG));
assert.ok(appliquerPlan(c4, Object.assign({}, origine, { frontMer: 360 })));
assert.strictEqual(c4.frontMer, 360);
assert.ok(appliquerPlan(c4, origine));
assert.strictEqual(c4.frontMer, null, 'sans réglage : mer à sa place habituelle');
assert.strictEqual(planValide(Object.assign({}, origine, { frontMer: 'haut' })), false);

// 3c. Barrières : celles du plan si enregistrées, sinon celles d'origine
const c5 = JSON.parse(JSON.stringify(BEACH_CONFIG));
assert.ok(appliquerPlan(c5, Object.assign({}, origine, { barriers: [{ type: 'h', x: 0, y: 0, width: 100 }] })));
assert.strictEqual(c5.barriers.length, 1);
assert.ok(appliquerPlan(c5, origine));
assert.strictEqual(c5.barriers.length, BEACH_CONFIG.barriers.length, 'plan sans barrières : barrières par défaut');

// 4. Date locale au format AAAA-MM-JJ
assert.strictEqual(_dateLocaleISO(new Date(2026, 6, 5)), '2026-07-05');

// 5. Places occupées absentes du nouveau plan (triées par numéro)
assert.deepStrictEqual(placesManquantes(['P12', 'P3', 'P1'], { spots: [{ id: 'P1' }] }), ['P3', 'P12']);
assert.deepStrictEqual(placesManquantes(['P1'], { spots: [{ id: 'P1' }] }), []);

// 6. Plan du jour : programmation la plus courte, sinon plan par défaut ; brouillons ignorés
const plans = [
  { id: 'def', par_defaut: true }, { id: 'ete' }, { id: 'event' }, { id: 'brouillon', brouillon: true },
];
const progs = [
  { plan_id: 'ete', date_debut: '2027-06-15', date_fin: '2027-09-15', created_at: '1' },
  { plan_id: 'event', date_debut: '2027-07-12', date_fin: '2027-07-12', created_at: '2' },
  { plan_id: 'brouillon', date_debut: '2027-08-01', date_fin: '2027-08-01', created_at: '3' },
];
assert.strictEqual(planPourDate(plans, progs, '2027-06-01').id, 'def', 'hors programmation : défaut');
assert.strictEqual(planPourDate(plans, progs, '2027-06-15').id, 'ete', 'premier jour inclus');
assert.strictEqual(planPourDate(plans, progs, '2027-07-12').id, 'event', 'journée événement prioritaire');
assert.strictEqual(planPourDate(plans, progs, '2027-08-01').id, 'ete', 'brouillon jamais en service');
assert.strictEqual(planPourDate(plans, progs, '2027-09-15').id, 'ete', 'dernier jour inclus');
assert.strictEqual(planPourDate(plans, progs, '2027-09-16').id, 'def', 'retour au défaut');
assert.strictEqual(planPourDate([], [], '2027-01-01'), null, 'aucun plan');

console.log('✓ test-plans.js OK');
