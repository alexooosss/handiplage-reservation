// tests/test-fermetures.js — règles de fermeture de la plage (suspension / recrédit)
'use strict';
const assert = require('assert');
const { suspensionRecreditee, resaCompteDansQuota, creneauFerme, creneauxNonTerminesA } = require('../js/slots.js');

const at = (iso, hhmm) => new Date(iso + 'T' + hhmm + ':00');
const J = '2026-07-15';

// Fermeture à 12h20 : seuls les créneaux 12h30, 14h30 et 16h30 sont suspendus
assert.deepStrictEqual(creneauxNonTerminesA('12:20'), [3, 4, 5]);
// Réouverture à 15h00 : 14h30 (en cours) et 16h30 sont rétablis, 12h30 reste recrédité
assert.deepStrictEqual(creneauxNonTerminesA('15:00'), [4, 5]);
// Jour passé déclaré fermé par erreur puis rouvert (heure 00:00) : tout est rétabli
assert.deepStrictEqual(creneauxNonTerminesA('00:00'), [1, 2, 3, 4, 5]);

// Une réservation suspendue compte tant que son créneau n'est pas terminé…
const r3 = { date: J, creneau_id: 3, statut: 'suspendu' };   // 12h30 – 14h15
assert.strictEqual(resaCompteDansQuota(r3, at(J, '13:00')), true);
// … puis est recréditée une fois le créneau terminé
assert.strictEqual(suspensionRecreditee(r3, at(J, '14:20')), true);
assert.strictEqual(resaCompteDansQuota(r3, at(J, '14:20')), false);
// Le lendemain, toute suspension restante est recréditée
assert.strictEqual(resaCompteDansQuota({ date: J, creneau_id: 5, statut: 'suspendu' }, at('2026-07-16', '08:00')), false);
// Les réservations honorées le matin restent comptées ; les annulées jamais
assert.strictEqual(resaCompteDansQuota({ date: J, creneau_id: 1, statut: 'parti' }, at(J, '20:00')), true);
assert.strictEqual(resaCompteDansQuota({ date: J, creneau_id: 1, statut: 'annule' }, at(J, '09:00')), false);
// Usager (objets « creneauId ») : même règle
assert.strictEqual(suspensionRecreditee({ date: J, creneauId: 3, statut: 'suspendu' }, at(J, '14:20')), true);

// Créneaux bloqués à la réservation : fermeture 12h20 → réouverture 15h00
const F = [{ date: J, heure_fermeture: '12:20:00', heure_reouverture: '15:00:00' }];
assert.ok(!creneauFerme(F, J, 2));   // 10h30 – 12h15 : terminé avant la fermeture
assert.ok(creneauFerme(F, J, 3));    // 12h30 – 14h15 : fermé
assert.ok(creneauFerme(F, J, 4));    // 14h30 – 16h15 : commencé pendant la fermeture
assert.ok(!creneauFerme(F, J, 5));   // 16h30 – 18h15 : réservable après la réouverture
assert.ok(!creneauFerme(F, '2026-07-16', 3));
// Fermeture sans réouverture : jusqu'au soir
assert.ok(creneauFerme([{ date: J, heure_fermeture: '12:20', heure_reouverture: null }], J, 5));

console.log('✓ test-fermetures.js OK');
