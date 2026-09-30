// tests/test-usager-renewal.js
'use strict';
const assert = require('assert');

global.window = undefined;
global.supabaseClient = null;

const {
  _rowToUsagerInscription,
  computeUsagerAccessState,
} = require('../js/usager-storage.js');

// ── _rowToUsagerInscription : derniereSaisonValidee ──

// 1. Valeur présente en DB
{
  const row = {
    id: 'uuid-1', nom: 'MARTIN', prenom: 'André', mail: null, telephone: null,
    statut: 'valide', pass_actif: true, pass_activated_at: '2026-06-01',
    derniere_saison_validee: 2026, metadata: {},
  };
  const obj = _rowToUsagerInscription(row);
  assert.strictEqual(obj.derniereSaisonValidee, 2026,
    '_rowToUsagerInscription: derniereSaisonValidee mappé depuis derniere_saison_validee');
}

// 2. Valeur null (jamais validé)
{
  const row = {
    id: 'uuid-2', nom: 'DUPONT', prenom: 'Claire', mail: null, telephone: null,
    statut: 'en_attente', pass_actif: false, pass_activated_at: null,
    derniere_saison_validee: null, metadata: {},
  };
  const obj = _rowToUsagerInscription(row);
  assert.strictEqual(obj.derniereSaisonValidee, null,
    '_rowToUsagerInscription: derniereSaisonValidee null quand jamais validé');
}

// ── computeUsagerAccessState ──

// 3. Refusé → 'refuse'
{
  const state = computeUsagerAccessState({ statut: 'refuse', derniereSaisonValidee: null }, 2026);
  assert.strictEqual(state, 'refuse', 'refuse quel que soit derniereSaisonValidee');
}

// 4. En attente, jamais validé → 'premiere_demande'
{
  const state = computeUsagerAccessState({ statut: 'en_attente', derniereSaisonValidee: null }, 2026);
  assert.strictEqual(state, 'premiere_demande', '1ère demande jamais validée');
}

// 5. En attente, déjà validé une saison passée → 'renouvellement_attente'
{
  const state = computeUsagerAccessState({ statut: 'en_attente', derniereSaisonValidee: 2025 }, 2026);
  assert.strictEqual(state, 'renouvellement_attente', 'renouvellement soumis, en attente de validation staff');
}

// 6. Valide, saison à jour → 'actif'
{
  const state = computeUsagerAccessState({ statut: 'valide', derniereSaisonValidee: 2026 }, 2026);
  assert.strictEqual(state, 'actif', 'accès normal quand la saison validée = saison courante');
}

// 7. Valide, saison passée → 'a_renouveler'
{
  const state = computeUsagerAccessState({ statut: 'valide', derniereSaisonValidee: 2025 }, 2026);
  assert.strictEqual(state, 'a_renouveler', 'blocage renouvellement quand la saison validée != saison courante');
}

// 8. Valide, jamais de derniereSaisonValidee (cas défensif, ne devrait pas arriver en pratique) → 'a_renouveler'
{
  const state = computeUsagerAccessState({ statut: 'valide', derniereSaisonValidee: null }, 2026);
  assert.strictEqual(state, 'a_renouveler', 'valide sans saison stampée = doit renouveler');
}

console.log('✓ test-usager-renewal.js OK');
