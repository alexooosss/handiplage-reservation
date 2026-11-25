'use strict';
const assert = require('assert');
const { peAngle, pePlacesDansLaMer, peProchainNumero, peChevauchements, peAimanter, peRepartir, peNumero, peAlignement, pePositionsRangee } = require('../js/plan-editeur.js');

// Numérotation : jamais un numéro déjà utilisé, même par une place supprimée d'un autre plan
assert.strictEqual(peNumero('P12'), 12);
assert.strictEqual(peProchainNumero([], { spots: [{ id: 'P1' }] }), 55, 'au moins après les 54 places d\'origine');
assert.strictEqual(peProchainNumero([{ contenu: { spots: [{ id: 'P60' }] } }], { spots: [{ id: 'P1' }] }), 61, 'tient compte des autres plans');
assert.strictEqual(peProchainNumero([], { spots: [{ id: 'P1' }], dernierNumero: 70 }), 71, 'place supprimée : numéro non réutilisé');

// Chevauchements
assert.deepStrictEqual(peChevauchements([{ id: 'P1', x: 0, y: 0 }, { id: 'P2', x: 50, y: 0 }]), []);
assert.deepStrictEqual(peChevauchements([{ id: 'P1', x: 0, y: 0 }, { id: 'P2', x: 20, y: 10 }, { id: 'P3', x: 200, y: 0 }]).sort(), ['P1', 'P2']);

// Grille aimantée
assert.strictEqual(peAimanter(42), 40);
assert.strictEqual(peAimanter(43), 45);

// Répartition régulière (ordre conservé)
assert.deepStrictEqual(peRepartir([0, 10, 100]), [0, 50, 100]);
assert.deepStrictEqual(peRepartir([100, 0, 37, 60]), [100, 0, 33, 67]);
assert.deepStrictEqual(peRepartir([5, 9]), [5, 9]);

// Alignement automatique : accroche à la ligne la plus proche sous le seuil
assert.deepStrictEqual(peAlignement([103], [100, 150], 8), { correction: -3, ligne: 100 });
assert.strictEqual(peAlignement([120], [100, 150], 8), null, 'trop loin : aucune accroche');
assert.deepStrictEqual(peAlignement([96, 148], [100, 150], 8), { correction: 2, ligne: 150 }, 'la plus proche gagne');

// Rangée tracée en glissant
assert.deepStrictEqual(pePositionsRangee({ x: 100, y: 300 }, { x: 100, y: 300 }, 50), [{ x: 100, y: 300 }], 'simple clic : une place');
assert.deepStrictEqual(pePositionsRangee({ x: 100, y: 300 }, { x: 260, y: 310 }, 50).map(p => p.x), [100, 150, 200, 250], 'horizontale');
assert.deepStrictEqual(pePositionsRangee({ x: 100, y: 300 }, { x: 95, y: 190 }, 50).map(p => p.y), [300, 250, 200], 'verticale vers le haut');
assert.strictEqual(pePositionsRangee({ x: 0, y: 0 }, { x: 5000, y: 0 }, 50).length, 30, 'plafond 30');

// Places qui débordent dans la mer (une place mesure 34 px)
assert.deepStrictEqual(pePlacesDansLaMer([{ id: 'P1', y: 200 }, { id: 'P2', y: 370 }], 380), ['P2']);
assert.deepStrictEqual(pePlacesDansLaMer([{ id: 'P1', y: 363 }], 380), [], 'pile au bord : OK');

// Rotation : aimantée et ramenée entre -180 et 180
assert.strictEqual(peAngle(47, 5), 45);
assert.strictEqual(peAngle(200, 0), -160);
assert.strictEqual(peAngle(-190, 0), 170);
assert.strictEqual(peAngle(30, 45), 45, 'Maj : par 45°');
assert.strictEqual(peAngle(360, 5), 0);

console.log('✓ test-plan-editeur.js OK');
